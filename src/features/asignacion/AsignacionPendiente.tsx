import Feather from '@expo/vector-icons/Feather'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, H2, Label, Paragraph, RadioGroup, Sheet, Spinner, Text, XStack, YStack, useTheme } from 'tamagui'

import { textoPersonasAfectadas } from '@/features/incidentes/cercania'
import { direccionIncidenteQuery } from '@/features/incidentes/queries'
import { mensajeDeError } from '@/shared/api/cliente'
import { useAhora } from '@/shared/reloj/useAhora'
import { BotonPrincipal } from '@/shared/ui/BotonPrincipal'

import type { Asignacion, Prioridad } from './api'
import { asignacionPendienteQuery, confirmarAsignacionMutation, rechazarAsignacionMutation } from './queries'

/** Por que la tripulacion no puede ir. Se manda el texto: la central lo lee tal cual. */
const MOTIVOS = ['La unidad tiene una falla', 'Estamos con otro paciente', 'No tenemos el equipo completo', 'Otro motivo']

/** Lo que la norma le pide a la unidad segun la prioridad del caso. El color nunca va solo. */
const TEXTO_DE_PRIORIDAD: Record<Prioridad, string> = {
  ROJA: 'Prioridad roja: salir de inmediato',
  AMARILLA: 'Prioridad amarilla: salir rápido',
  VERDE: 'Prioridad verde',
}

const COLOR_DE_PRIORIDAD = { ROJA: '$primario', AMARILLA: '$enAtencion', VERDE: '$disponible' } as const

type Props = {
  paramedicoId: number
}

/**
 * La central le asigno un incidente a esta unidad y espera su confirmacion (PB-34). Se muestra sobre el mapa hasta
 * que la tripulacion contesta, se acaba el tiempo o la asignacion deja de hacer falta. No se cierra tocando afuera:
 * hay que contestar si se va o por que no.
 */
export function AsignacionPendiente({ paramedicoId }: Props) {
  const asignacion = useQuery(asignacionPendienteQuery(paramedicoId)).data
  return asignacion ? <Aviso key={asignacion.id} paramedicoId={paramedicoId} asignacion={asignacion} /> : null
}

function Aviso({ paramedicoId, asignacion }: Props & { asignacion: Asignacion }) {
  const margenes = useSafeAreaInsets()
  const tema = useTheme()
  const queryClient = useQueryClient()
  const ahora = useAhora(1_000)
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  const direccion = useQuery(
    direccionIncidenteQuery({ id: asignacion.incidenteId, latitud: asignacion.latitud, longitud: asignacion.longitud }),
  ).data
  const confirmar = useMutation(confirmarAsignacionMutation(queryClient))
  const rechazar = useMutation(rechazarAsignacionMutation(queryClient))
  const enviando = confirmar.isPending || rechazar.isPending
  const segundos = Math.max(0, Math.ceil((new Date(asignacion.venceEn).getTime() - ahora) / 1000))
  const error = confirmar.error ?? rechazar.error

  useEffect(() => {
    // Con el tiempo cumplido, el servidor se la pasa a otra unidad: se vuelve a preguntar para que el aviso se vaya.
    if (segundos === 0) {
      void queryClient.invalidateQueries({ queryKey: asignacionPendienteQuery(paramedicoId).queryKey })
    }
  }, [segundos, paramedicoId, queryClient])

  const detalles = [
    asignacion.minutosDeLlegada != null ? `A unos ${asignacion.minutosDeLlegada} min` : null,
    asignacion.cantidadAfectados != null ? textoPersonasAfectadas(asignacion.cantidadAfectados) : null,
  ].filter((detalle): detalle is string => detalle !== null)

  return (
    <Sheet modal open snapPointsMode="fit" dismissOnSnapToBottom={false} dismissOnOverlayPress={false} disableDrag>
      <Sheet.Overlay bg="$velo" transition="quick" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Sheet.Frame
        gap={18}
        px={20}
        pt={24}
        pb={margenes.bottom + 24}
        borderTopLeftRadius={22}
        borderTopRightRadius={22}
        bg="$superficie"
      >
        <YStack gap={6}>
          <XStack items="center" gap={10}>
            <Feather name="alert-circle" size={22} color={tema.primario?.val} />
            <H2 flex={1} color="$texto" fontSize={24} lineHeight={30} fontWeight="600">
              {eligiendoMotivo ? '¿Por qué no pueden ir?' : 'Te asignaron una emergencia'}
            </H2>
          </XStack>
          <Paragraph color="$textoSecundario" fontSize={15} lineHeight={22}>
            {eligiendoMotivo
              ? 'El motivo es obligatorio. La emergencia pasa en el momento a la unidad siguiente.'
              : (direccion ?? 'Ubicación en el mapa')}
          </Paragraph>
          {!eligiendoMotivo && detalles.length > 0 ? (
            <Text color="$texto" fontSize={16} lineHeight={22} fontWeight="500">
              {detalles.join(' · ')}
            </Text>
          ) : null}
          {!eligiendoMotivo && asignacion.prioridad ? (
            <XStack self="flex-start" items="center" gap={8} px={10} py={6} rounded={8} borderWidth={1} borderColor="$bordeFuerte">
              <XStack width={10} height={10} rounded={3} bg={COLOR_DE_PRIORIDAD[asignacion.prioridad]} />
              <Text color="$texto" fontSize={15} lineHeight={20} fontWeight="600">
                {TEXTO_DE_PRIORIDAD[asignacion.prioridad]}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        <XStack items="center" gap={10} px={14} py={12} rounded={14} borderWidth={1} borderColor="$enAtencion" bg="$enAtencionTinte">
          <Feather name="clock" size={18} color={tema.enAtencionTexto?.val} />
          <Text flex={1} color="$enAtencionTexto" fontSize={15} lineHeight={20} fontWeight="600">
            {segundos > 0 ? `Tienes ${segundos} s para contestar` : 'Se acabó el tiempo: pasa a otra unidad'}
          </Text>
        </XStack>

        {eligiendoMotivo ? (
          <RadioGroup value={motivo ?? ''} onValueChange={setMotivo} gap={8} aria-label="Motivo para no ir">
            {MOTIVOS.map((opcion, indice) => {
              const elegido = motivo === opcion
              const id = `motivo-asignacion-${indice}`
              return (
                <XStack
                  key={opcion}
                  items="center"
                  gap={12}
                  minH={52}
                  px={14}
                  py={12}
                  rounded={14}
                  borderWidth={elegido ? 2 : 1}
                  borderColor={elegido ? '$primario' : '$borde'}
                  onPress={() => setMotivo(opcion)}
                >
                  <RadioGroup.Item value={opcion} id={id} size="$4" borderColor={elegido ? '$primario' : '$bordeFuerte'}>
                    <RadioGroup.Indicator bg="$primario" />
                  </RadioGroup.Item>
                  <Label flex={1} htmlFor={id} color="$texto" fontSize={15} lineHeight={20} fontWeight={elegido ? '600' : '500'}>
                    {opcion}
                  </Label>
                </XStack>
              )
            })}
          </RadioGroup>
        ) : null}

        {error ? (
          <Paragraph color="$enAtencionTexto" fontSize={14} lineHeight={20}>
            {mensajeDeError(error)}
          </Paragraph>
        ) : null}

        {eligiendoMotivo ? (
          <YStack gap={10}>
            <BotonPrincipal
              disabled={!motivo || enviando}
              opacity={!motivo || enviando ? 0.6 : 1}
              icon={rechazar.isPending ? <Spinner color="$primarioTexto" /> : undefined}
              onPress={() => motivo && rechazar.mutate({ paramedicoId, motivo })}
            >
              <Button.Text color="$primarioTexto" fontSize={17} fontWeight="600">
                No podemos ir
              </Button.Text>
            </BotonPrincipal>
            <Button
              height={52}
              rounded={14}
              bg="$superficie"
              borderColor="$bordeFuerte"
              disabled={enviando}
              onPress={() => setEligiendoMotivo(false)}
            >
              <Button.Text color="$texto" fontSize={16} fontWeight="500">
                Volver
              </Button.Text>
            </Button>
          </YStack>
        ) : (
          <YStack gap={10}>
            <BotonPrincipal
              disabled={enviando}
              opacity={enviando ? 0.6 : 1}
              icon={confirmar.isPending ? <Spinner color="$primarioTexto" /> : undefined}
              onPress={() => confirmar.mutate({ paramedicoId })}
            >
              <Button.Text color="$primarioTexto" fontSize={17} fontWeight="600">
                Vamos
              </Button.Text>
            </BotonPrincipal>
            <Button
              height={52}
              rounded={14}
              bg="$superficie"
              borderColor="$bordeFuerte"
              disabled={enviando}
              onPress={() => setEligiendoMotivo(true)}
            >
              <Button.Text color="$texto" fontSize={16} fontWeight="500">
                No podemos ir
              </Button.Text>
            </Button>
          </YStack>
        )}
      </Sheet.Frame>
    </Sheet>
  )
}
