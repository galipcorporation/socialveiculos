import React, { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, ConfirmSheet, ErrorState, Input, OptionSheet, Screen,
  Sheet, Skeleton, TONE_ETAPA_LEAD, Txt, useToast,
} from '../../components/ui'
import { VehiclePhoto } from '../../components/VehiclePhoto'
import { RegistrarVendaSheet } from '../../components/RegistrarVendaSheet'
import { leadsService } from '../../services'
import {
  ETAPAS_LEAD, MOTIVOS_PERDA, ORIGEM_LEAD_LABEL, TIPOS_INTERACAO,
  type Cliente, type EtapaLead, type Interacao, type MotivoPerda,
  type Negociacao, type TipoInteracao,
} from '../../services/types'
import {
  formatBRL, formatData, formatDataHora, formatRelativo, formatTelefone,
  maskCEP, maskCPF, maskData, maskMoedaInput, maskTelefoneInput, parseMoedaInput,
} from '../../lib/format'
import { dataBRparaISO, isoParaDataBR, validarCPF, validarEmail } from '../../lib/validacao'
import { buscarCep } from '../../lib/cep'
import { ApiError } from '../../lib/api'
import { abrirWhatsapp } from '../../lib/whatsapp'
import type { RootScreenProps } from '../../navigation/types'

const ICONE_INTERACAO: Record<TipoInteracao, keyof typeof Ionicons.glyphMap> = {
  nota: 'document-text-outline',
  ligacao: 'call-outline',
  whatsapp: 'logo-whatsapp',
  visita: 'walk-outline',
  email: 'mail-outline',
  proposta: 'cash-outline',
  sistema: 'flash-outline',
}

const MOTIVO_PERDA_LABEL: Record<MotivoPerda, string> = Object.fromEntries(
  MOTIVOS_PERDA.map((m) => [m.value, m.label]),
) as Record<MotivoPerda, string>

/** Confirmação pendente: título/mensagem do ConfirmSheet + ação a executar no OK. */
type Confirmacao = { titulo: string; mensagem: string; onOk: () => void }

export default function LeadDetalheScreen({ route }: RootScreenProps<'LeadDetalhe'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [etapaAberta, setEtapaAberta] = useState(false)
  const [interacaoAberta, setInteracaoAberta] = useState(false)
  const [vendaAberta, setVendaAberta] = useState(false)
  const [clienteAberto, setClienteAberto] = useState(false)
  const [perdaAberta, setPerdaAberta] = useState(false)
  const [interacaoEditando, setInteracaoEditando] = useState<Interacao | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  const q = useQuery({ queryKey: ['leads', id], queryFn: () => leadsService.obter(id) })
  const lead = q.data

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const etapaMut = useMutation({
    mutationFn: (vars: { etapa: EtapaLead; motivo_perda?: MotivoPerda; motivo_perda_detalhe?: string }) =>
      leadsService.moverEtapa(id, vars.etapa, vars),
    onSuccess: (l) => {
      invalidar()
      const label = ETAPAS_LEAD.find((e) => e.value === l.etapa)?.label
      toast.show('success', `Lead movido para "${label}".`)
      if (l.etapa === 'fechamento') setVendaAberta(true)
    },
    onError: () => toast.show('error', 'Não foi possível mover o lead.'),
  })

  const excluirMut = useMutation({
    mutationFn: () => leadsService.excluir(id),
    onSuccess: () => {
      invalidar()
      toast.show('success', 'Lead excluído.')
      navigation.goBack()
    },
    onError: (e) => {
      // 403 = vendedor sem permissão de exclusão (RBAC); a API já devolve texto claro.
      toast.show('error', e instanceof ApiError && e.details.status === 403
        ? 'Apenas o gestor pode excluir leads.'
        : 'Não foi possível excluir o lead.')
    },
  })

  const interacaoDelMut = useMutation({
    mutationFn: (idInt: string) => leadsService.removerInteracao(id, idInt),
    onSuccess: () => {
      invalidar()
      toast.show('success', 'Interação excluída.')
    },
    onError: (e) => {
      toast.show('error', e instanceof ApiError && e.details.status === 403
        ? 'Apenas o gestor pode excluir registros do histórico.'
        : 'Não foi possível excluir a interação.')
    },
  })

  // Escolher a etapa "perdido" exige informar o motivo antes de gravar.
  const selecionarEtapa = (etapa: EtapaLead) => {
    if (etapa === 'perdido') {
      setPerdaAberta(true)
      return
    }
    etapaMut.mutate({ etapa })
  }

  const ligar = () => {
    if (lead?.cliente?.telefone) Linking.openURL(`tel:${lead.cliente.telefone}`).catch(() => {})
  }
  const whatsapp = () => {
    if (!lead?.cliente?.telefone) return
    abrirWhatsapp(lead.cliente.telefone)
  }

  if (q.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Lead não encontrado." onRetry={() => navigation.goBack()} />
      </Screen>
    )
  }

  const etapaAtual = ETAPAS_LEAD.find((e) => e.value === lead?.etapa)
  // A API já devolve a timeline em ordem cronológica; aqui mostramos do mais
  // recente para o mais antigo.
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
                  {formatTelefone(lead.cliente?.telefone) || 'Sem telefone'}
                  {lead.cliente?.cidade ? ` · ${lead.cliente.cidade}` : ''}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <Badge label={etapaAtual?.label ?? ''} tone={TONE_ETAPA_LEAD[lead.etapa]} size="sm" />
                  <Badge label={ORIGEM_LEAD_LABEL[lead.origem]} tone="neutral" size="sm" />
                </View>
              </View>
              <Pressable onPress={() => setClienteAberto(true)} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </Pressable>
            </View>

            {/* Dados essenciais — no mobile o lead é o cadastro do cliente. */}
            <View style={[styles.dadosBloco, { borderTopColor: colors.border }]}>
              <DadoLinha label="CPF" valor={lead.cliente?.cpf ? maskCPF(lead.cliente.cpf) : undefined} />
              <DadoLinha label="E-mail" valor={lead.cliente?.email} />
              <DadoLinha
                label="Nascimento"
                valor={lead.cliente?.data_nascimento ? formatData(lead.cliente.data_nascimento) : undefined}
              />
              <DadoLinha
                label="Renda mensal"
                valor={lead.cliente?.renda_mensal ? formatBRL(lead.cliente.renda_mensal) : undefined}
              />
              <DadoLinha
                label="Endereço"
                valor={[
                  lead.cliente?.endereco,
                  lead.cliente?.numero,
                  lead.cliente?.bairro,
                ].filter(Boolean).join(', ') || undefined}
              />
              <DadoLinha
                label="Cidade/UF"
                valor={lead.cliente?.cidade
                  ? `${lead.cliente.cidade}${lead.cliente.estado ? `/${lead.cliente.estado}` : ''}`
                  : undefined}
              />
              <DadoLinha label="Responsável" valor={lead.responsavel_nome} />
              <DadoLinha
                label="Próximo contato"
                valor={lead.proximo_contato ? formatData(lead.proximo_contato) : undefined}
              />
            </View>

            {lead.etapa === 'perdido' && lead.motivo_perda ? (
              <View style={[styles.perdaBox, { backgroundColor: colors.error + '14', borderColor: colors.error + '40' }]}>
                <Txt variant="captionMedium" style={{ color: colors.error }}>
                  Perdido — {MOTIVO_PERDA_LABEL[lead.motivo_perda]}
                </Txt>
                {lead.motivo_perda_detalhe ? (
                  <Txt variant="caption" color="textDim">{lead.motivo_perda_detalhe}</Txt>
                ) : null}
              </View>
            ) : null}

            {lead.valor_proposta ? (
              <View style={[styles.propostaLead, { borderTopColor: colors.border }]}>
                <Txt variant="caption" color="textMuted">Valor da proposta</Txt>
                <Txt style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
                  {formatBRL(lead.valor_proposta)}
                </Txt>
              </View>
            ) : null}
            {lead.observacoes ? (
              <Txt variant="caption" color="textDim" style={{ marginTop: spacing.xs }}>
                {lead.observacoes}
              </Txt>
            ) : null}
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

        {/* Negociações (histórico de propostas) */}
        {lead && <NegociacoesCard leadId={lead.id} />}

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
                  {/* Marcos do sistema não são editáveis (o backend recusa). */}
                  {i.tipo !== 'sistema' && (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable onPress={() => setInteracaoEditando(i)} hitSlop={8}>
                        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmacao({
                          titulo: 'Excluir interação',
                          mensagem: 'Esta anotação será removida do histórico. Esta ação não pode ser desfeita.',
                          onOk: () => interacaoDelMut.mutate(i.id),
                        })}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        {/* Excluir lead — RBAC: só gestor/admin (vendedor recebe 403). */}
        {lead && (
          <Button
            title="Excluir lead"
            variant="ghost"
            icon="trash-outline"
            loading={excluirMut.isPending}
            onPress={() => setConfirmacao({
              titulo: 'Excluir lead',
              mensagem: `O lead de ${lead.cliente?.nome ?? 'cliente'}, suas propostas e o histórico serão apagados. Esta ação não pode ser desfeita.`,
              onOk: () => excluirMut.mutate(),
            })}
            style={{ marginTop: spacing.xs }}
          />
        )}
      </ScrollView>

      {/* Sheets */}
      <ConfirmSheet
        visible={confirmacao !== null}
        onClose={() => setConfirmacao(null)}
        onConfirm={() => { confirmacao?.onOk(); setConfirmacao(null) }}
        title={confirmacao?.titulo ?? ''}
        message={confirmacao?.mensagem ?? ''}
        confirmText="Excluir"
        destructive
      />
      <OptionSheet
        visible={etapaAberta}
        onClose={() => setEtapaAberta(false)}
        title="Mover para etapa"
        selected={lead?.etapa}
        options={ETAPAS_LEAD.map((e) => ({ value: e.value, label: e.label }))}
        onSelect={selecionarEtapa}
      />
      <MotivoPerdaSheet
        visible={perdaAberta}
        onClose={() => setPerdaAberta(false)}
        salvando={etapaMut.isPending}
        onConfirmar={(motivo, detalhe) => {
          etapaMut.mutate(
            { etapa: 'perdido', motivo_perda: motivo, motivo_perda_detalhe: detalhe },
            { onSuccess: () => setPerdaAberta(false) },
          )
        }}
      />
      <ClienteSheet
        leadId={id}
        cliente={lead?.cliente}
        visible={clienteAberto}
        onClose={() => setClienteAberto(false)}
      />
      <InteracaoSheet
        leadId={id}
        interacao={interacaoEditando}
        visible={interacaoAberta || !!interacaoEditando}
        onClose={() => {
          setInteracaoAberta(false)
          setInteracaoEditando(null)
        }}
      />
      <RegistrarVendaSheet
        veiculo={lead?.veiculo}
        visible={vendaAberta}
        onClose={() => setVendaAberta(false)}
        compradorInicial={lead?.cliente?.nome}
        leadId={lead?.id}
      />
    </Screen>
  )
}

function DadoLinha({ label, valor }: { label: string; valor?: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.dadoLinha}>
      <Txt variant="caption" color="textMuted">{label}</Txt>
      <Txt
        variant="caption"
        style={{
          flex: 1,
          textAlign: 'right',
          color: valor ? colors.text : colors.textMuted,
          fontFamily: valor ? fonts.medium : fonts.regular,
        }}
        numberOfLines={2}
      >
        {valor || 'Não informado'}
      </Txt>
    </View>
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

function InteracaoSheet({
  leadId, interacao, visible, onClose,
}: {
  leadId: string
  interacao: Interacao | null
  visible: boolean
  onClose: () => void
}) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tipo, setTipo] = useState<TipoInteracao>('nota')
  const [texto, setTexto] = useState('')

  const editando = !!interacao

  // Ao abrir para editar, carrega o registro escolhido; ao criar, limpa.
  useEffect(() => {
    if (!visible) return
    setTipo(interacao?.tipo && interacao.tipo !== 'sistema' ? interacao.tipo : 'nota')
    setTexto(interacao?.texto ?? '')
  }, [visible, interacao])

  const mut = useMutation({
    mutationFn: () => editando
      ? leadsService.atualizarInteracao(leadId, interacao!.id, tipo, texto)
      : leadsService.adicionarInteracao(leadId, tipo, texto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setTexto('')
      onClose()
      toast.show('success', editando ? 'Interação atualizada.' : 'Interação registrada.')
    },
    onError: () => toast.show('error', 'Não foi possível salvar a interação.'),
  })

  return (
    <Sheet visible={visible} onClose={onClose} title={editando ? 'Editar interação' : 'Registrar interação'}>
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {TIPOS_INTERACAO.map((t) => {
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
          title={editando ? 'Salvar alterações' : 'Salvar interação'}
          loading={mut.isPending}
          disabled={texto.trim().length < 3}
          onPress={() => mut.mutate()}
        />
      </View>
    </Sheet>
  )
}

function MotivoPerdaSheet({
  visible, onClose, salvando, onConfirmar,
}: {
  visible: boolean
  onClose: () => void
  salvando: boolean
  onConfirmar: (motivo: MotivoPerda, detalhe?: string) => void
}) {
  const { colors } = useTheme()
  const [motivo, setMotivo] = useState<MotivoPerda>('preco')
  const [detalhe, setDetalhe] = useState('')

  useEffect(() => {
    if (visible) {
      setMotivo('preco')
      setDetalhe('')
    }
  }, [visible])

  return (
    <Sheet visible={visible} onClose={onClose} title="Por que o lead foi perdido?">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {MOTIVOS_PERDA.map((m) => {
            const ativo = motivo === m.value
            return (
              <Pressable
                key={m.value}
                onPress={() => setMotivo(m.value)}
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
                  {m.label}
                </Txt>
              </Pressable>
            )
          })}
        </View>
        <Input
          label="Detalhe (opcional)"
          placeholder="Ex.: achou R$ 3 mil mais barato na concorrência"
          value={detalhe}
          onChangeText={setDetalhe}
          multiline
          style={{ minHeight: 56, textAlignVertical: 'top' }}
        />
        <Button
          title="Marcar como perdido"
          loading={salvando}
          onPress={() => onConfirmar(motivo, detalhe.trim() || undefined)}
        />
      </View>
    </Sheet>
  )
}

function ClienteSheet({
  leadId, cliente, visible, onClose,
}: {
  leadId: string
  cliente?: Cliente
  visible: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [renda, setRenda] = useState('')
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [erros, setErros] = useState<{ nome?: string; cpf?: string; email?: string }>({})

  // Recarrega o formulário sempre que o sheet abre, para não editar dado velho.
  useEffect(() => {
    if (!visible) return
    setNome(cliente?.nome ?? '')
    setTelefone(cliente?.telefone ? maskTelefoneInput(cliente.telefone) : '')
    setCpf(cliente?.cpf ? maskCPF(cliente.cpf) : '')
    setEmail(cliente?.email ?? '')
    setNascimento(isoParaDataBR(cliente?.data_nascimento))
    setRenda(cliente?.renda_mensal ? maskMoedaInput(String(Math.round(cliente.renda_mensal * 100))) : '')
    setCep(cliente?.cep ? maskCEP(cliente.cep) : '')
    setEndereco(cliente?.endereco ?? '')
    setNumero(cliente?.numero ?? '')
    setBairro(cliente?.bairro ?? '')
    setCidade(cliente?.cidade ?? '')
    setEstado(cliente?.estado ?? '')
    setErros({})
  }, [visible, cliente])

  const preencherPorCep = async (texto: string) => {
    const mascarado = maskCEP(texto)
    setCep(mascarado)
    if (mascarado.replace(/\D/g, '').length !== 8) return
    const end = await buscarCep(mascarado)
    if (!end) return
    if (end.endereco) setEndereco(end.endereco)
    if (end.bairro) setBairro(end.bairro)
    if (end.cidade) setCidade(end.cidade)
    if (end.estado) setEstado(end.estado)
  }

  const mut = useMutation({
    mutationFn: () => leadsService.atualizarCliente(leadId, {
      nome: nome.trim(),
      telefone: telefone.replace(/\D/g, '') || undefined,
      cpf: cpf.replace(/\D/g, '') || undefined,
      email: email.trim() || undefined,
      data_nascimento: dataBRparaISO(nascimento),
      renda_mensal: renda ? parseMoedaInput(renda) : undefined,
      cep: cep.replace(/\D/g, '') || undefined,
      endereco: endereco.trim() || undefined,
      numero: numero.trim() || undefined,
      bairro: bairro.trim() || undefined,
      cidade: cidade.trim() || undefined,
      estado: estado.trim().toUpperCase() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
      toast.show('success', 'Dados do cliente atualizados.')
    },
    onError: (e) => {
      toast.show('error', e instanceof ApiError && e.details.status === 403
        ? 'Você não tem permissão para editar clientes.'
        : 'Não foi possível salvar os dados.')
    },
  })

  const salvar = () => {
    if (nome.trim().length < 3) {
      setErros({ nome: 'Informe o nome do cliente.' })
      return
    }
    if (cpf.trim() && !validarCPF(cpf)) {
      setErros({ cpf: 'CPF inválido.' })
      return
    }
    if (email.trim() && !validarEmail(email)) {
      setErros({ email: 'E-mail inválido.' })
      return
    }
    mut.mutate()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Dados do cliente">
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Input
          label="Nome *"
          icon="person-outline"
          value={nome}
          onChangeText={(t) => { setNome(t); setErros((e) => ({ ...e, nome: undefined })) }}
          error={erros.nome}
        />
        <Input
          label="Telefone / WhatsApp"
          placeholder="(51) 99999-9999"
          keyboardType="phone-pad"
          icon="call-outline"
          value={telefone}
          onChangeText={(t) => setTelefone(maskTelefoneInput(t))}
        />
        <Input
          label="CPF"
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          icon="card-outline"
          value={cpf}
          onChangeText={(t) => { setCpf(maskCPF(t)); setErros((e) => ({ ...e, cpf: undefined })) }}
          error={erros.cpf}
        />
        <Input
          label="E-mail"
          placeholder="cliente@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail-outline"
          value={email}
          onChangeText={(t) => { setEmail(t); setErros((e) => ({ ...e, email: undefined })) }}
          error={erros.email}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input
            label="Nascimento"
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            value={nascimento}
            onChangeText={(t) => setNascimento(maskData(t))}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="Renda mensal"
            placeholder="0,00"
            keyboardType="numeric"
            value={renda}
            onChangeText={(t) => setRenda(maskMoedaInput(t))}
            containerStyle={{ flex: 1 }}
          />
        </View>
        <Input
          label="CEP"
          placeholder="00000-000"
          keyboardType="number-pad"
          icon="location-outline"
          value={cep}
          onChangeText={preencherPorCep}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input
            label="Endereço"
            value={endereco}
            onChangeText={setEndereco}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="Nº"
            value={numero}
            onChangeText={setNumero}
            containerStyle={{ width: 80 }}
          />
        </View>
        <Input label="Bairro" value={bairro} onChangeText={setBairro} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input
            label="Cidade"
            value={cidade}
            onChangeText={setCidade}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="UF"
            autoCapitalize="characters"
            maxLength={2}
            value={estado}
            onChangeText={(t) => setEstado(t.replace(/[^A-Za-z]/g, '').toUpperCase())}
            containerStyle={{ width: 80 }}
          />
        </View>
        <Button title="Salvar dados" loading={mut.isPending} onPress={salvar} />
      </View>
    </Sheet>
  )
}

function NegociacoesCard({ leadId }: { leadId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Negociacao | null>(null)
  const [valor, setValor] = useState('')
  const [entrada, setEntrada] = useState('')
  const [parcelas, setParcelas] = useState('')
  const [obs, setObs] = useState('')
  const [excluindo, setExcluindo] = useState<Negociacao | null>(null)

  const q = useQuery({ queryKey: ['leads', leadId, 'negociacoes'], queryFn: () => leadsService.negociacoes(leadId) })
  const negs = q.data ?? []

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const limpar = () => {
    setValor(''); setEntrada(''); setParcelas(''); setObs('')
    setAberto(false); setEditando(null)
  }

  const abrirEdicao = (n: Negociacao) => {
    setEditando(n)
    // maskMoedaInput trabalha em centavos: 40000 → "400.000,00" se não converter.
    setValor(maskMoedaInput(String(Math.round(n.valor_proposta * 100))))
    setEntrada(n.valor_entrada ? maskMoedaInput(String(Math.round(n.valor_entrada * 100))) : '')
    setParcelas(n.parcelas ? String(n.parcelas) : '')
    setObs(n.observacoes ?? '')
    setAberto(true)
  }

  const salvarMut = useMutation({
    mutationFn: () => {
      const dados = {
        valor_proposta: parseMoedaInput(valor),
        valor_entrada: parseMoedaInput(entrada) || undefined,
        parcelas: parseInt(parcelas.replace(/\D/g, ''), 10) || undefined,
        observacoes: obs.trim() || undefined,
      }
      return editando
        ? leadsService.atualizarNegociacao(leadId, editando.id, dados)
        : leadsService.adicionarNegociacao(leadId, dados)
    },
    onSuccess: () => {
      invalidar()
      toast.show('success', editando ? 'Proposta atualizada.' : 'Proposta registrada.')
      limpar()
    },
    onError: () => toast.show('error', 'Não foi possível salvar a proposta.'),
  })

  const remMut = useMutation({
    mutationFn: (id: string) => leadsService.removerNegociacao(leadId, id),
    onSuccess: () => {
      invalidar()
      setExcluindo(null)
      toast.show('success', 'Proposta excluída.')
    },
    onError: (e) => {
      setExcluindo(null)
      toast.show('error', e instanceof ApiError && e.details.status === 403
        ? 'Apenas o gestor pode excluir propostas.'
        : 'Não foi possível excluir a proposta.')
    },
  })

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Txt variant="title">Negociações</Txt>
        <Button
          title="Nova proposta"
          variant="tonal"
          size="sm"
          icon="add"
          onPress={() => { setEditando(null); setValor(''); setEntrada(''); setParcelas(''); setObs(''); setAberto(true) }}
        />
      </View>
      {negs.length === 0 ? (
        <Txt variant="caption" color="textDim">Nenhuma proposta registrada ainda.</Txt>
      ) : (
        negs.map((n, i) => (
          <View key={n.id} style={{ paddingVertical: spacing.xs, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>{formatBRL(n.valor_proposta)}</Txt>
              <Txt variant="caption" color="textDim">
                {[n.valor_entrada ? `entrada ${formatBRL(n.valor_entrada)}` : null, n.parcelas ? `${n.parcelas}x` : null, formatRelativo(n.created_at)].filter(Boolean).join(' · ')}
              </Txt>
              {n.observacoes ? <Txt variant="caption" color="textMuted">{n.observacoes}</Txt> : null}
            </View>
            <Pressable onPress={() => abrirEdicao(n)} hitSlop={8}>
              <Ionicons name="create-outline" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => setExcluindo(n)}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </Pressable>
          </View>
        ))
      )}

      <Sheet
        visible={aberto}
        onClose={limpar}
        title={editando ? 'Editar proposta' : 'Nova proposta'}
      >
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Input label="Valor da proposta" placeholder="0,00" keyboardType="numeric" icon="cash-outline" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Input label="Entrada" placeholder="0,00" keyboardType="numeric" value={entrada} onChangeText={(t) => setEntrada(maskMoedaInput(t))} containerStyle={{ flex: 1 }} />
            <Input label="Parcelas" placeholder="48" keyboardType="number-pad" value={parcelas} onChangeText={(t) => setParcelas(t.replace(/\D/g, ''))} containerStyle={{ width: 90 }} />
          </View>
          <Input label="Observações" placeholder="Condições, troca, prazo…" value={obs} onChangeText={setObs} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
          <Button
            title={editando ? 'Salvar alterações' : 'Registrar proposta'}
            loading={salvarMut.isPending}
            disabled={parseMoedaInput(valor) <= 0}
            onPress={() => salvarMut.mutate()}
          />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={excluindo !== null}
        onClose={() => setExcluindo(null)}
        onConfirm={() => { if (excluindo) remMut.mutate(excluindo.id) }}
        title="Excluir proposta"
        message={excluindo
          ? `A proposta de ${formatBRL(excluindo.valor_proposta)} será removida do histórico. Esta ação não pode ser desfeita.`
          : ''}
        confirmText="Excluir"
        loading={remMut.isPending}
        destructive
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  clienteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dadosBloco: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, gap: 4 },
  dadoLinha: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  perdaBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  propostaLead: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
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
