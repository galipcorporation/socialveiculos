import React, { useState } from 'react'
import { FlatList, StyleSheet, Switch, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Badge, Button, Card, EmptyState, ErrorState, Fab, Input,
  SegmentedControl, Sheet, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { equipeService } from '../../services'
import type { Membro, Papel } from '../../services/types'
import { formatTelefone, maskTelefoneInput } from '../../lib/format'
import { MODULOS, TODOS_MODULOS, parseModulos, type ModuloKey } from '../../lib/modulos'

export default function EquipeScreen() {
  const queryClient = useQueryClient()
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Membro | null>(null)

  const q = useQuery({ queryKey: ['equipe'], queryFn: () => equipeService.listar() })
  const membros = q.data ?? []

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Equipe"
        subtitle={q.isSuccess ? `${membros.filter((m) => m.ativo).length} membros ativos` : undefined}
        back
      />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}
        </View>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={membros}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MembroCard
              membro={item}
              onPress={() => {
                setEditando(item)
                setFormAberto(true)
              }}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['equipe'] })}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Equipe vazia"
              subtitle="Adicione vendedores para distribuir as vendas e comissões."
              actionLabel="Adicionar membro"
              onAction={() => setFormAberto(true)}
            />
          }
        />
      )}

      <Fab
        icon="person-add"
        label="Membro"
        onPress={() => {
          setEditando(null)
          setFormAberto(true)
        }}
      />
      <MembroFormSheet
        visible={formAberto}
        membro={editando}
        onClose={() => {
          setFormAberto(false)
          setEditando(null)
        }}
      />
    </View>
  )
}

function MembroCard({ membro, onPress }: { membro: Membro; onPress: () => void }) {
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const toast = useToast()

  const ativoMut = useMutation({
    mutationFn: () => equipeService.alternarAtivo(membro.id),
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      toast.show('info', m.ativo ? `${m.nome} reativado.` : `${m.nome} desativado.`)
    },
  })

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm, opacity: membro.ativo ? 1 : 0.6 }}>
      <View style={styles.row}>
        <Avatar nome={membro.nome} size={46} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodySemibold" numberOfLines={1}>{membro.nome}</Txt>
          <Txt variant="caption" color="textDim" numberOfLines={1}>
            {membro.email} · {formatTelefone(membro.telefone)}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
            <Badge
              label={membro.papel === 'gestor' ? 'Gestor' : 'Vendedor'}
              tone={membro.papel === 'gestor' ? 'primary' : 'info'}
              size="sm"
            />
            {membro.papel === 'vendedor' && (
              <Badge label={`Comissão ${membro.percentual_comissao ?? 0}%`} tone="warning" size="sm" />
            )}
            {!membro.ativo && <Badge label="Inativo" tone="neutral" size="sm" />}
          </View>
        </View>
        <Switch
          value={membro.ativo}
          onValueChange={() => ativoMut.mutate()}
          disabled={ativoMut.isPending || membro.papel === 'gestor'}
          trackColor={{ false: colors.overlayStrong, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>
    </Card>
  )
}

function MembroFormSheet({ visible, membro, onClose }: { visible: boolean; membro: Membro | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { colors } = useTheme()
  const editando = !!membro

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [papel, setPapel] = useState<Papel>('vendedor')
  const [comissao, setComissao] = useState('2')
  const [modulos, setModulos] = useState<ModuloKey[]>([])
  const [senha, setSenha] = useState('')
  const [iaAtivo, setIaAtivo] = useState(false)
  const [iaAutonomia, setIaAutonomia] = useState<'copiloto' | 'automatico'>('copiloto')

  React.useEffect(() => {
    if (visible) {
      setNome(membro?.nome ?? '')
      setEmail(membro?.email ?? '')
      setTelefone(membro?.telefone ?? '')
      setPapel(membro?.papel ?? 'vendedor')
      setComissao(membro?.percentual_comissao != null ? String(membro.percentual_comissao) : '2')
      setModulos(parseModulos(membro?.modulos))
      setSenha('')
      setIaAtivo(membro?.assistente_ativo ?? false)
      setIaAutonomia(membro?.assistente_autonomia ?? 'copiloto')
    }
  }, [visible, membro])

  const toggleModulo = (key: ModuloKey) =>
    setModulos((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const mut = useMutation({
    mutationFn: async () => {
      const input = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone.replace(/\D/g, '') || undefined,
        papel,
        percentual_comissao: papel === 'vendedor' ? parseFloat(comissao.replace(',', '.')) || 0 : null,
        modulos: papel === 'gestor' ? JSON.stringify(TODOS_MODULOS) : JSON.stringify(modulos),
        senha: editando ? undefined : senha,
      }
      const m = editando ? await equipeService.atualizar(membro!.id, input) : await equipeService.criar(input)
      if (papel === 'vendedor') await equipeService.configurarIA(m.id, { ativo: iaAtivo, autonomia: iaAutonomia })
      return m
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      onClose()
      toast.show('success', editando ? 'Membro atualizado.' : 'Membro adicionado à equipe.')
    },
    onError: (e) =>
      toast.show('error', e instanceof Error ? e.message : 'Não foi possível salvar.'),
  })

  const removerMut = useMutation({
    mutationFn: () => equipeService.excluir(membro!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipe'] }); onClose(); toast.show('success', 'Membro removido.') },
  })

  const valido = nome.trim().length >= 3 && /\S+@\S+\.\S+/.test(email) && (editando || senha.length >= 6)

  return (
    <Sheet visible={visible} onClose={onClose} title={editando ? 'Editar membro' : 'Novo membro'}>
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <Input label="Nome *" placeholder="Nome completo" icon="person-outline" value={nome} onChangeText={setNome} />
        <Input
          label="E-mail *"
          placeholder="email@loja.com.br"
          icon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Telefone"
          placeholder="(51) 99999-9999"
          icon="call-outline"
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={(t) => setTelefone(maskTelefoneInput(t))}
        />
        {!editando && (
          <Input
            label="Senha provisória *"
            placeholder="Mínimo 6 caracteres"
            icon="lock-closed-outline"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            hint="O membro troca no primeiro acesso."
          />
        )}
        <View style={{ gap: 6 }}>
          <Txt variant="captionMedium" color="textDim">Papel</Txt>
          <SegmentedControl
            options={[
              { value: 'vendedor', label: 'Vendedor' },
              { value: 'gestor', label: 'Gestor' },
            ]}
            selected={papel}
            onSelect={setPapel}
          />
        </View>
        {papel === 'vendedor' && (
          <Input
            label="Percentual de comissão (%)"
            placeholder="2"
            keyboardType="decimal-pad"
            icon="ribbon-outline"
            value={comissao}
            onChangeText={setComissao}
            hint="Aplicado automaticamente ao registrar vendas deste vendedor"
          />
        )}

        <View style={{ gap: 6 }}>
          <Txt variant="captionMedium" color="textDim">Acessos</Txt>
          {papel === 'gestor' ? (
            <Card style={{ padding: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                <Txt variant="caption" color="textDim" style={{ flex: 1 }}>
                  Gestor tem acesso total a todos os módulos.
                </Txt>
              </View>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {MODULOS.map((m, i) => (
                <View
                  key={m.key}
                  style={[
                    styles.moduloRow,
                    i < MODULOS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <Txt variant="body" style={{ flex: 1 }}>{m.label}</Txt>
                  <Switch
                    value={modulos.includes(m.key)}
                    onValueChange={() => toggleModulo(m.key)}
                    trackColor={{ false: colors.overlayStrong, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </Card>
          )}
          {papel === 'vendedor' && (
            <Txt variant="caption" color="textDim">Selecione a que o vendedor terá acesso no app.</Txt>
          )}
        </View>

        {/* Config do Assistente de IA (vendedor) */}
        {papel === 'vendedor' && (
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Assistente de IA</Txt>
            <Card style={{ gap: spacing.sm, padding: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                <Txt variant="body" style={{ flex: 1 }}>Habilitar assistente</Txt>
                <Switch value={iaAtivo} onValueChange={setIaAtivo} trackColor={{ false: colors.overlayStrong, true: colors.primary }} thumbColor="#fff" />
              </View>
              {iaAtivo && (
                <SegmentedControl
                  options={[{ value: 'copiloto', label: 'Copiloto' }, { value: 'automatico', label: 'Automático' }]}
                  selected={iaAutonomia}
                  onSelect={(v) => setIaAutonomia(v as 'copiloto' | 'automatico')}
                />
              )}
              {iaAtivo && (
                <Txt variant="caption" color="textDim">
                  {iaAutonomia === 'copiloto' ? 'A IA sugere respostas para o vendedor aprovar.' : 'A IA responde diretamente aos leads.'}
                </Txt>
              )}
            </Card>
          </View>
        )}

        <Button
          title={editando ? 'Salvar alterações' : 'Adicionar membro'}
          loading={mut.isPending}
          disabled={!valido}
          onPress={() => mut.mutate()}
        />
        {editando && membro!.papel !== 'gestor' && (
          <Button title="Remover membro" variant="outline" loading={removerMut.isPending} onPress={() => removerMut.mutate()} style={{ borderColor: colors.error }} />
        )}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moduloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
})
