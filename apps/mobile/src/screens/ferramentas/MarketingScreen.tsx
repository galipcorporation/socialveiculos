import React, { useState, useMemo, useEffect } from 'react'
import { Pressable, Share, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, EmptyState, Input, Paywall, Screen, SegmentedControl,
  SelectField, Sheet, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { OptionSheet } from '../../components/ui'
import {
  marketingService, modulosService, veiculosService, configService, TONS_MARKETING, CANAIS_MARKETING,
  type TomMarketing, type CanalMarketing,
} from '../../services'
import type { PostMarketing } from '../../services/marketing'
import type { Veiculo } from '../../services/types'
import { formatBRL, formatDataHora, formatRelativo } from '../../lib/format'

export default function MarketingScreen() {
  const { colors } = useTheme()
  const toast = useToast()
  const queryClient = useQueryClient()
  const navigation = useNavigation<any>()

  const gateQ = useQuery({ queryKey: ['modulo', 'marketing'], queryFn: () => modulosService.liberado('marketing') })
  const veiculosQ = useQuery({ queryKey: ['veiculos', 'marketing'], queryFn: () => veiculosService.listar({ status: 'disponivel' }), enabled: gateQ.data === true })
  const redesQ = useQuery({ queryKey: ['config', 'redes'], queryFn: () => configService.redesSociais(), enabled: gateQ.data === true })
  const histQ = useQuery({ queryKey: ['marketing', 'historico'], queryFn: () => marketingService.historico(), enabled: gateQ.data === true })

  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [tom, setTom] = useState<TomMarketing>('entusiasmado')
  const [canal, setCanal] = useState<CanalMarketing>('instagram')
  const [destaques, setDestaques] = useState('')
  const [veiculoSheet, setVeiculoSheet] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [legenda, setLegenda] = useState('')
  const [agendarAberto, setAgendarAberto] = useState(false)

  // Publicação / Agendamento
  const [redesSelecionadas, setRedesSelecionadas] = useState<string[]>([])
  const [modoEnvio, setModoEnvio] = useState<'agora' | 'agendar'>('agora')
  const [agendadoPara, setAgendadoPara] = useState<string | null>(null)

  const redesSociais = redesQ.data ?? []
  const conectadas = useMemo(() => redesSociais.filter(r => r.conectada || r.page_id || r.instagram_account_id).map(r => r.rede), [redesSociais])

  useEffect(() => {
    if (conectadas.length > 0 && redesSelecionadas.length === 0) {
      setRedesSelecionadas([conectadas[0]])
    }
  }, [conectadas])

  const toggleRede = (rede: string) => {
    setRedesSelecionadas(prev => prev.includes(rede) ? prev.filter(r => r !== rede) : [...prev, rede])
  }

  const gerar = async () => {
    if (!veiculo) return
    setGerando(true)
    try {
      setLegenda(await marketingService.gerarLegenda(veiculo, tom, canal, destaques))
    } finally {
      setGerando(false)
    }
  }

  const compartilhar = async () => {
    if (!legenda) return
    try { await Share.share({ message: legenda }) } catch { toast.show('info', 'Não foi possível compartilhar.') }
  }

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Marketing IA" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }
  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Marketing IA" large={false} back />
        <Screen padded>
          <Paywall titulo="Marketing com IA" descricao="Gere legendas e publique nas redes a partir do seu estoque. Módulo não incluído no plano atual." />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen scroll padded={false}>
      <AppHeader title="Marketing IA" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">Gere uma legenda e publique nas redes a partir de um veículo do estoque.</Txt>

        <Card style={{ gap: spacing.sm }}>
          <SelectField label="Veículo" value={veiculo ? `${veiculo.marca} ${veiculo.modelo}` : undefined} placeholder={veiculosQ.isLoading ? 'Carregando…' : 'Selecione um veículo'} icon="car-sport-outline" onPress={() => setVeiculoSheet(true)} />
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Canal / Rede social</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {CANAIS_MARKETING.map((c) => {
                const ativo = canal === c.value
                return (
                  <Pressable key={c.value} onPress={() => setCanal(c.value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.md, borderWidth: 1, backgroundColor: ativo ? colors.primary + '1c' : colors.overlaySoft, borderColor: ativo ? colors.primary : colors.border }}>
                    <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={16} color={ativo ? colors.primary : colors.textMuted} />
                    <Txt style={{ fontFamily: fonts.semibold, fontSize: 13, color: ativo ? colors.primaryText : colors.textDim }}>{c.label}</Txt>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Tom</Txt>
            <SegmentedControl options={TONS_MARKETING.map((t) => ({ value: t.value, label: t.label }))} selected={tom} onSelect={(v) => setTom(v as TomMarketing)} />
          </View>
          <Input label="Destaques (opcional)" value={destaques} onChangeText={setDestaques} placeholder="Ex.: único dono, teto solar, IPVA pago" />
          <Button title="Gerar legenda" icon="sparkles" loading={gerando} onPress={gerar} full disabled={!veiculo} />
        </Card>

        {legenda ? (
          <>
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Legenda gerada</Txt>
              <View style={{ backgroundColor: colors.overlaySoft, borderRadius: radius.md, padding: spacing.sm }}>
                <Txt style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text }}>{legenda}</Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Button title="Compartilhar manual" variant="tonal" icon="share-social-outline" onPress={compartilhar} style={{ flex: 1 }} />
                <Button title="Refazer" variant="ghost" icon="refresh" onPress={gerar} loading={gerando} />
              </View>
            </Card>

            <Card style={{ gap: spacing.md }}>
              <Txt variant="bodySemibold">Publicar / Agendar</Txt>

              {!redesQ.isLoading && conectadas.length === 0 ? (
                <View style={{ gap: spacing.sm, alignItems: 'center', padding: spacing.sm }}>
                  <Txt variant="caption" color="textDim" align="center">Nenhuma rede social conectada para publicação automática.</Txt>
                  <Button title="Configurar redes sociais" icon="settings-outline" onPress={() => navigation.navigate('RedesSociais')} size="sm" />
                </View>
              ) : (
                <>
                  <View style={{ gap: 6 }}>
                    <Txt variant="captionMedium" color="textDim">Selecione as redes conectadas</Txt>
                    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                      {conectadas.map((rede) => {
                        const selecionada = redesSelecionadas.includes(rede)
                        const nome = rede === 'facebook' ? 'Facebook' : 'Instagram'
                        const icon = rede === 'facebook' ? 'logo-facebook' : 'logo-instagram'
                        return (
                          <Pressable
                            key={rede}
                            onPress={() => toggleRede(rede)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 12,
                              height: 36,
                              borderRadius: radius.md,
                              borderWidth: 1,
                              backgroundColor: selecionada ? colors.primary + '1c' : colors.overlaySoft,
                              borderColor: selecionada ? colors.primary : colors.border
                            }}
                          >
                            <Ionicons name={icon as any} size={16} color={selecionada ? colors.primary : colors.textMuted} />
                            <Txt style={{ fontFamily: fonts.semibold, fontSize: 13, color: selecionada ? colors.primaryText : colors.textDim }}>{nome}</Txt>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Txt variant="captionMedium" color="textDim">Modo de Envio</Txt>
                    <SegmentedControl
                      options={[
                        { value: 'agora', label: 'Publicar agora' },
                        { value: 'agendar', label: 'Agendar' }
                      ]}
                      selected={modoEnvio}
                      onSelect={(v) => setModoEnvio(v as 'agora' | 'agendar')}
                    />
                  </View>

                  {modoEnvio === 'agendar' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, backgroundColor: colors.overlaySoft, borderRadius: radius.md }}>
                      <Txt variant="captionMedium" color="textDim">
                        {agendadoPara ? `Agendado para: ${formatDataHora(agendadoPara)}` : 'Nenhuma data selecionada'}
                      </Txt>
                      <Button title="Escolher data/hora" variant="outline" size="sm" icon="time-outline" onPress={() => setAgendarAberto(true)} />
                    </View>
                  )}

                  <Button
                    title={modoEnvio === 'agora' ? 'Publicar nas redes' : 'Agendar publicação'}
                    icon={modoEnvio === 'agora' ? 'send' : 'time-outline'}
                    disabled={redesSelecionadas.length === 0 || (modoEnvio === 'agendar' && !agendadoPara)}
                    onPress={async () => {
                      if (modoEnvio === 'agora') {
                        try {
                          await marketingService.publicar(legenda, redesSelecionadas as any[])
                          queryClient.invalidateQueries({ queryKey: ['marketing', 'historico'] })
                          toast.show('success', 'Publicado com sucesso!')
                        } catch (err: any) {
                          toast.show('error', err.message || 'Erro ao publicar.')
                        }
                      } else {
                        if (!agendadoPara) return
                        try {
                          await marketingService.agendar(legenda, redesSelecionadas as any[], agendadoPara)
                          queryClient.invalidateQueries({ queryKey: ['marketing', 'historico'] })
                          toast.show('success', 'Publicação agendada.')
                        } catch (err: any) {
                          toast.show('error', err.message || 'Erro ao agendar.')
                        }
                      }
                    }}
                    full
                  />
                </>
              )}
            </Card>
          </>
        ) : null}

        {/* Histórico */}
        <Card padded={false}>
          <Txt variant="title" style={{ padding: spacing.md, paddingBottom: spacing.xs }}>Publicações</Txt>
          {histQ.isLoading ? (
            <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
          ) : (histQ.data ?? []).length === 0 ? (
            <View style={{ paddingBottom: spacing.md }}><EmptyState icon="megaphone-outline" title="Sem publicações" subtitle="Publique ou agende sua primeira." /></View>
          ) : (
            (histQ.data ?? []).map((p, i) => <PostRow key={p.id} post={p} first={i === 0} />)
          )}
        </Card>
      </Screen>

      <OptionSheet
        visible={veiculoSheet}
        onClose={() => setVeiculoSheet(false)}
        title="Escolha o veículo"
        options={(veiculosQ.data ?? []).map((v) => ({ value: v.id, label: `${v.marca} ${v.modelo}`, sublabel: [v.versao, formatBRL(v.preco_venda)].filter(Boolean).join(' · ') }))}
        selected={veiculo?.id}
        onSelect={(id) => setVeiculo((veiculosQ.data ?? []).find((v) => v.id === id) ?? null)}
      />

      <AgendarSheet
        visible={agendarAberto}
        onClose={() => setAgendarAberto(false)}
        onConfirm={(quando) => {
          setAgendadoPara(quando)
          setAgendarAberto(false)
        }}
      />
    </Screen>
  )
}

function PostRow({ post, first }: { post: PostMarketing; first: boolean }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const tone = post.status === 'publicado' ? 'success' : post.status === 'agendado' ? 'warning' : 'error'
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Badge label={post.status === 'publicado' ? 'Publicado' : post.status === 'agendado' ? 'Agendado' : 'Falhou'} tone={tone} size="sm" />
        <Txt variant="caption" color="textMuted" style={{ flex: 1 }}>
          {post.canais.map((c) => CANAIS_MARKETING.find((x) => x.value === c)?.label).join(', ')}
        </Txt>
        <Txt variant="caption" color="textMuted">{post.agendado_para ? formatDataHora(post.agendado_para) : formatRelativo(post.created_at)}</Txt>
      </View>
      <Txt variant="caption" color="textDim" numberOfLines={2}>{post.legenda}</Txt>
      {post.status === 'agendado' && (
        <Pressable onPress={async () => { await marketingService.cancelarAgendado(post.id); queryClient.invalidateQueries({ queryKey: ['marketing', 'historico'] }) }} hitSlop={6}>
          <Txt variant="caption" color="error">Cancelar agendamento</Txt>
        </Pressable>
      )}
    </View>
  )
}

function AgendarSheet({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: (quando: string) => void }) {
  const opcoes = [
    { label: 'Daqui a 1 hora', ms: 3600_000 },
    { label: 'Hoje à noite (20h)', ms: -1 },
    { label: 'Amanhã de manhã (9h)', ms: -2 },
  ]
  const calcular = (opt: typeof opcoes[number]): string => {
    if (opt.ms > 0) return new Date(Date.now() + opt.ms).toISOString()
    const d = new Date()
    if (opt.ms === -1) { d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1) }
    else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0) }
    return d.toISOString()
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Agendar publicação" scrollable={false}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        {opcoes.map((o) => (
          <Button key={o.label} title={o.label} variant="outline" icon="time-outline" onPress={() => onConfirm(calcular(o))} />
        ))}
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  )
}
