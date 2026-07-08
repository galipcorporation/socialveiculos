import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, ErrorState, Input, OptionSheet, Screen, SelectField,
  Sheet, Skeleton, TONE_ETAPA_LEAD, Txt, useToast,
} from '../../components/ui'
import { VehiclePhoto } from '../../components/VehiclePhoto'
import { leadsService } from '../../services'
import { ETAPAS_LEAD, ORIGEM_LEAD_LABEL, type EtapaLead, type Interacao } from '../../services/types'
import { formatBRL, formatDataHora, formatTelefone, maskMoedaInput, parseMoedaInput } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

const ICONE_INTERACAO: Record<Interacao['tipo'], keyof typeof Ionicons.glyphMap> = {
  nota: 'document-text-outline',
  ligacao: 'call-outline',
  whatsapp: 'logo-whatsapp',
  visita: 'walk-outline',
  proposta: 'cash-outline',
  sistema: 'flash-outline',
}

export default function LeadDetalheScreen({ route }: RootScreenProps<'LeadDetalhe'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [etapaAberta, setEtapaAberta] = useState(false)
  const [interacaoAberta, setInteracaoAberta] = useState(false)
  const [propostaAberta, setPropostaAberta] = useState(false)

  const q = useQuery({ queryKey: ['leads', id], queryFn: () => leadsService.obter(id) })
  const lead = q.data

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const etapaMut = useMutation({
    mutationFn: (etapa: EtapaLead) => leadsService.moverEtapa(id, etapa),
    onSuccess: (l) => {
      invalidar()
      const label = ETAPAS_LEAD.find((e) => e.value === l.etapa)?.label
      toast.show('success', `Lead movido para "${label}".`)
    },
  })

  const ligar = () => {
    if (lead?.cliente?.telefone) Linking.openURL(`tel:${lead.cliente.telefone}`).catch(() => {})
  }
  const whatsapp = () => {
    if (!lead?.cliente?.telefone) return
    const numero = lead.cliente.telefone.replace(/\D/g, '')
    Linking.openURL(`https://wa.me/55${numero}`).catch(() =>
      toast.show('error', 'Não foi possível abrir o WhatsApp.')
    )
  }

  if (q.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Lead não encontrado." onRetry={() => navigation.goBack()} />
      </Screen>
    )
  }

  const etapaAtual = ETAPAS_LEAD.find((e) => e.value === lead?.etapa)
  const interacoes = [...(lead?.interacoes ?? [])].reverse()

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Detalhe do lead" large={false} back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cliente */}
        {lead ? (
          <Card>
            <View style={styles.clienteRow}>
              <Avatar nome={lead.cliente?.nome} size={52} />
              <View style={{ flex: 1 }}>
                <Txt variant="title" numberOfLines={1}>{lead.cliente?.nome}</Txt>
                <Txt variant="caption" color="textDim">
                  {formatTelefone(lead.cliente?.telefone)}
                  {lead.cliente?.cidade ? ` · ${lead.cliente.cidade}` : ''}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <Badge label={etapaAtual?.label ?? ''} tone={TONE_ETAPA_LEAD[lead.etapa]} size="sm" />
                  <Badge label={ORIGEM_LEAD_LABEL[lead.origem]} tone="neutral" size="sm" />
                </View>
              </View>
            </View>
            <View style={styles.acoesContato}>
              <AcaoContato icon="call" label="Ligar" onPress={ligar} disabled={!lead.cliente?.telefone} />
              <AcaoContato icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} disabled={!lead.cliente?.telefone} verde />
              <AcaoContato icon="swap-horizontal" label="Mover etapa" onPress={() => setEtapaAberta(true)} />
            </View>
          </Card>
        ) : (
          <Card style={{ gap: 8 }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={13} />
            <Skeleton height={40} />
          </Card>
        )}

        {/* Veículo de interesse */}
        {lead?.veiculo && (
          <Card
            padded={false}
            onPress={() => navigation.navigate('VeiculoDetalhe', { id: lead.veiculo!.id })}
          >
            <View style={styles.veiculoRow}>
              <VehiclePhoto veiculo={lead.veiculo} width={72} height={72} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" color="textMuted">Veículo de interesse</Txt>
                <Txt variant="bodySemibold" numberOfLines={1}>
                  {lead.veiculo.marca} {lead.veiculo.modelo}
                </Txt>
                <Txt style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.primaryText }}>
                  {formatBRL(lead.veiculo.preco_venda)}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        )}

        {/* Proposta */}
        {lead && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Txt variant="title">Proposta</Txt>
                <Txt
                  style={{
                    fontFamily: fonts.displayBold,
                    fontSize: 22,
                    color: lead.valor_proposta ? colors.text : colors.textMuted,
                    marginTop: 4,
                  }}
                >
                  {lead.valor_proposta ? formatBRL(lead.valor_proposta) : 'Sem valor'}
                </Txt>
              </View>
              <Button
                title={lead.valor_proposta ? 'Editar' : 'Definir'}
                variant="tonal"
                size="sm"
                icon="pencil"
                onPress={() => setPropostaAberta(true)}
              />
            </View>
            {lead.observacoes ? (
              <Txt variant="caption" color="textDim" style={{ marginTop: spacing.xs }}>
                {lead.observacoes}
              </Txt>
            ) : null}
          </Card>
        )}

        {/* Timeline */}
        {lead && (
          <Card>
            <View style={styles.timelineHeader}>
              <Txt variant="title">Histórico</Txt>
              <Button
                title="Registrar"
                variant="tonal"
                size="sm"
                icon="add"
                onPress={() => setInteracaoAberta(true)}
              />
            </View>
            {interacoes.length === 0 ? (
              <Txt variant="caption" color="textMuted">Nenhuma interação registrada ainda.</Txt>
            ) : (
              interacoes.map((i, idx) => (
                <View key={i.id} style={styles.timelineItem}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={[styles.timelineIcone, { backgroundColor: colors.overlaySoft }]}>
                      <Ionicons
                        name={ICONE_INTERACAO[i.tipo]}
                        size={14}
                        color={i.tipo === 'whatsapp' ? '#25D366' : colors.textDim}
                      />
                    </View>
                    {idx < interacoes.length - 1 && (
                      <View style={[styles.timelineLinha, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: spacing.sm }}>
                    <Txt variant="body">{i.texto}</Txt>
                    <Txt variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                      {formatDataHora(i.created_at)}
                      {i.autor ? ` · ${i.autor}` : ''}
                    </Txt>
                  </View>
                </View>
              ))
            )}
          </Card>
        )}
      </ScrollView>

      {/* Sheets */}
      <OptionSheet
        visible={etapaAberta}
        onClose={() => setEtapaAberta(false)}
        title="Mover para etapa"
        selected={lead?.etapa}
        options={ETAPAS_LEAD.map((e) => ({ value: e.value, label: e.label }))}
        onSelect={(e) => etapaMut.mutate(e)}
      />
      <NovaInteracaoSheet
        leadId={id}
        visible={interacaoAberta}
        onClose={() => setInteracaoAberta(false)}
      />
      <PropostaSheet
        leadId={id}
        valorAtual={lead?.valor_proposta}
        obsAtual={lead?.observacoes}
        visible={propostaAberta}
        onClose={() => setPropostaAberta(false)}
      />
    </Screen>
  )
}

function AcaoContato({
  icon, label, onPress, disabled, verde,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
  verde?: boolean
}) {
  const { colors } = useTheme()
  const cor = verde ? '#25D366' : colors.primary
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.acaoContato,
        {
          backgroundColor: pressed ? colors.overlay : colors.overlaySoft,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={cor} />
      <Txt variant="captionMedium" color="textDim">{label}</Txt>
    </Pressable>
  )
}

function NovaInteracaoSheet({ leadId, visible, onClose }: { leadId: string; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tipo, setTipo] = useState<Interacao['tipo']>('nota')
  const [texto, setTexto] = useState('')

  const tipos: { value: Interacao['tipo']; label: string }[] = [
    { value: 'nota', label: 'Nota' },
    { value: 'ligacao', label: 'Ligação' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'visita', label: 'Visita' },
    { value: 'proposta', label: 'Proposta' },
  ]

  const mut = useMutation({
    mutationFn: () => leadsService.adicionarInteracao(leadId, tipo, texto.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setTexto('')
      onClose()
      toast.show('success', 'Interação registrada.')
    },
  })

  return (
    <Sheet visible={visible} onClose={onClose} title="Registrar interação">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {tipos.map((t) => {
            const ativo = tipo === t.value
            return (
              <Pressable
                key={t.value}
                onPress={() => setTipo(t.value)}
                style={[
                  styles.tipoChip,
                  {
                    backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft,
                    borderColor: ativo ? colors.primary : colors.border,
                  },
                ]}
              >
                <Txt
                  style={{
                    fontFamily: ativo ? fonts.semibold : fonts.medium,
                    fontSize: 13,
                    color: ativo ? colors.primaryText : colors.textDim,
                  }}
                >
                  {t.label}
                </Txt>
              </Pressable>
            )
          })}
        </View>
        <Input
          placeholder="O que aconteceu? Ex.: cliente pediu fotos do motor…"
          value={texto}
          onChangeText={setTexto}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Button
          title="Salvar interação"
          loading={mut.isPending}
          disabled={texto.trim().length < 3}
          onPress={() => mut.mutate()}
        />
      </View>
    </Sheet>
  )
}

function PropostaSheet({
  leadId, valorAtual, obsAtual, visible, onClose,
}: {
  leadId: string
  valorAtual?: number
  obsAtual?: string
  visible: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')

  React.useEffect(() => {
    if (visible) {
      setValor(valorAtual ? maskMoedaInput(String(Math.round(valorAtual * 100))) : '')
      setObs(obsAtual ?? '')
    }
  }, [visible, valorAtual, obsAtual])

  const mut = useMutation({
    mutationFn: () =>
      leadsService.atualizarProposta(leadId, valor ? parseMoedaInput(valor) : undefined, obs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
      toast.show('success', 'Proposta atualizada.')
    },
  })

  return (
    <Sheet visible={visible} onClose={onClose} title="Proposta">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <Input
          label="Valor da proposta"
          placeholder="0,00"
          keyboardType="numeric"
          icon="cash-outline"
          value={valor}
          onChangeText={(t) => setValor(maskMoedaInput(t))}
        />
        <Input
          label="Observações"
          placeholder="Condições, troca, prazo…"
          value={obs}
          onChangeText={setObs}
          multiline
          style={{ minHeight: 60, textAlignVertical: 'top' }}
        />
        <Button title="Salvar" loading={mut.isPending} onPress={() => mut.mutate()} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  clienteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  acoesContato: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  acaoContato: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.md,
  },
  veiculoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  timelineItem: { flexDirection: 'row', gap: spacing.sm },
  timelineIcone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLinha: { width: 2, flex: 1, marginVertical: 2 },
  tipoChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
