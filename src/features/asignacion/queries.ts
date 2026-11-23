import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query'

import { aplicarAtencion } from '@/features/atencion/queries'
import { servicioKeys } from '@/features/servicio/queries'

import { asignacionApi } from './api'

export const asignacionKeys = {
  pendiente: (paramedicoId: number) => ['asignacion-pendiente', paramedicoId] as const,
}

/** Cada cuanto se vuelve a preguntar si la unidad tiene una asignacion, por si el push no llego. */
const REFRESCO_MS = 5_000

/**
 * La asignacion que la unidad tiene esperando respuesta, o `null`. El push avisa en el momento; este pedido periodico
 * es el respaldo: la confirmacion tiene tiempo limite y no puede depender de que el aviso llegue.
 */
export const asignacionPendienteQuery = (paramedicoId: number) =>
  queryOptions({
    queryKey: asignacionKeys.pendiente(paramedicoId),
    queryFn: ({ signal }) => asignacionApi.pendiente(signal),
    refetchInterval: REFRESCO_MS,
    staleTime: 0,
  })

/** La tripulacion confirma que va: nace la atencion, igual que al tomar un incidente. */
export const confirmarAsignacionMutation = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: (_: { paramedicoId: number }) => asignacionApi.confirmar(),
    onSuccess: (atencion, { paramedicoId }) => {
      aplicarAtencion(queryClient, paramedicoId, atencion)
      queryClient.setQueryData(asignacionKeys.pendiente(paramedicoId), null)
      return queryClient.invalidateQueries({ queryKey: servicioKeys.actual(paramedicoId) })
    },
    // Si ya no esperaba respuesta (vencio o se la pasaron a otra unidad), se vuelve a pedir y el aviso se va solo.
    onError: (_error, { paramedicoId }) =>
      queryClient.invalidateQueries({ queryKey: asignacionKeys.pendiente(paramedicoId) }),
  })

/** La tripulacion dice que no puede ir. El motivo es obligatorio: la central tiene que poder leerlo despues. */
export const rechazarAsignacionMutation = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ motivo }: { paramedicoId: number; motivo: string }) => asignacionApi.rechazar(motivo),
    onSettled: (_datos, _error, { paramedicoId }) =>
      queryClient.invalidateQueries({ queryKey: asignacionKeys.pendiente(paramedicoId) }),
  })
