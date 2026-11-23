import type { Atencion } from '@/features/atencion/api'
import { api } from '@/shared/api/cliente'

/**
 * `OfertaResponse` del backend: el incidente que la central le asigno a la unidad y que espera su confirmacion.
 * `minutosDeLlegada` es lo que el sistema estimo al asignarla; `venceEn`, hasta cuando se puede contestar.
 * `prioridad` es la del triaje de la central: roja (P1), amarilla (P2) o verde (P3); null si no se sabe.
 */
export type Prioridad = 'ROJA' | 'AMARILLA' | 'VERDE'

export type Asignacion = {
  id: number
  incidenteId: number
  latitud: number
  longitud: number
  cantidadAfectados: number | null
  tipoSuceso: string | null
  ofrecidaEn: string
  venceEn: string
  minutosDeLlegada: number | null
  prioridad: Prioridad | null
}

/** La unidad no viaja en la peticion: es la del turno abierto del paramedico. */
export const asignacionApi = {
  /** 204 cuando la unidad no tiene nada esperando respuesta. */
  pendiente: async (signal?: AbortSignal) =>
    (await api.get<Asignacion | undefined>('/paramedicos/actual/oferta', { signal })) ?? null,
  confirmar: () => api.post<Atencion>('/paramedicos/actual/oferta/confirmacion'),
  rechazar: (motivo: string) => api.post<void>('/paramedicos/actual/oferta/rechazo', { motivo }),
}
