import React, { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Button, Card, EmptyState, Fab, Input, SearchBar, Sheet,
  SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { clientesService, type ClienteInput } from '../../services'
import type { Cliente } from '../../services/types'
import { buscarCep } from '../../lib/cep'
import {
  capitalizarNome, formatBRL, formatTelefone, maskCEP, maskCPFouCNPJ, maskData, maskRG,
  maskTelefoneInput, maskMoedaInput, parseMoedaInput,
} from '../../lib/format'

export default function ClientesScreen() {
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [editar, setEditar] = useState<Cliente | 'novo' | null>(null)

  const q = useQuery({ queryKey: ['clientes', busca], queryFn: () => clientesService.listar(busca) })

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Clientes" back subtitle={q.isSuccess ? `${q.data.length} na carteira` : undefined} large={false} />
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
        <SearchBar value={busca} onChangeText={setBusca} placeholder="Nome, CPF ou telefone…" />
      </View>
      {q.isLoading ? (
        <View style={{ paddingHorizontal: spacing.md }}>{[0, 1, 2].map((i) => <SkeletonCard key={i} withImage={false} />)}</View>
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['clientes'] })}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhum cliente" subtitle={busca ? 'Nada encontrado.' : 'Cadastre o primeiro cliente da carteira.'} />}
          renderItem={({ item }) => (
            <Card onPress={() => setEditar(item)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar nome={item.nome} size={42} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodySemibold" numberOfLines={1}>{item.nome}</Txt>
                  <Txt variant="caption" color="textDim" numberOfLines={1}>
                    {[item.telefone ? formatTelefone(item.telefone) : null, item.cidade].filter(Boolean).join(' · ') || 'Sem contato'}
                  </Txt>
                </View>
              </View>
            </Card>
          )}
        />
      )}
      <Fab icon="person-add" label="Cliente" onPress={() => setEditar('novo')} />
      {editar && <ClienteForm cliente={editar === 'novo' ? null : editar} onClose={() => setEditar(null)} />}
    </View>
  )
}

function ClienteForm({ cliente, onClose }: { cliente: Cliente | null; onClose: () => void }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const [f, setF] = useState<ClienteInput & { cepMask: string; telMask: string; rendaMask: string }>(() => ({
    nome: cliente?.nome ?? '',
    telefone: cliente?.telefone ?? '',
    telMask: cliente?.telefone ? maskTelefoneInput(cliente.telefone) : '',
    email: cliente?.email ?? '',
    cpf: cliente?.cpf ?? '',
    rg: cliente?.rg ?? '',
    data_nascimento: cliente?.data_nascimento ?? '',
    renda_mensal: cliente?.renda_mensal,
    rendaMask: cliente?.renda_mensal ? maskMoedaInput(String(Math.round(cliente.renda_mensal * 100))) : '',
    cep: cliente?.cep ?? '',
    cepMask: cliente?.cep ? maskCEP(cliente.cep) : '',
    endereco: cliente?.endereco ?? '',
    bairro: cliente?.bairro ?? '',
    cidade: cliente?.cidade ?? '',
    estado: cliente?.estado ?? '',
    observacoes: cliente?.observacoes ?? '',
  }))
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))

  const onCepBlur = async () => {
    const cep = f.cepMask.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    const r = await buscarCep(cep)
    setBuscandoCep(false)
    if (r) set({ endereco: r.endereco, bairro: r.bairro, cidade: r.cidade, estado: r.estado })
  }

  const salvar = async () => {
    if (f.nome.trim().length < 3) { toast.show('error', 'Informe o nome do cliente.'); return }
    setSalvando(true)
    try {
      const input: ClienteInput = {
        nome: f.nome, telefone: f.telMask.replace(/\D/g, '') || undefined, email: f.email?.trim() || undefined,
        cpf: f.cpf?.replace(/\D/g, '') || undefined, rg: f.rg?.trim() || undefined,
        data_nascimento: f.data_nascimento?.trim() || undefined,
        renda_mensal: parseMoedaInput(f.rendaMask) || undefined,
        cep: f.cepMask.replace(/\D/g, '') || undefined, endereco: f.endereco?.trim() || undefined,
        bairro: f.bairro?.trim() || undefined, cidade: f.cidade?.trim() || undefined,
        estado: f.estado?.trim().toUpperCase() || undefined, observacoes: f.observacoes?.trim() || undefined,
      }
      if (cliente) await clientesService.atualizar(cliente.id, input)
      else await clientesService.criar(input)
      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.show('success', cliente ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!cliente) return
    setSalvando(true)
    try {
      await clientesService.excluir(cliente.id)
      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.show('success', 'Cliente removido.')
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet visible onClose={onClose} title={cliente ? 'Editar cliente' : 'Novo cliente'}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        <Input label="Nome completo" value={f.nome} onChangeText={(v) => set({ nome: capitalizarNome(v) })} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input label="Telefone" value={f.telMask} onChangeText={(v) => set({ telMask: maskTelefoneInput(v) })} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
          <Input label="Nascimento" value={f.data_nascimento} onChangeText={(v) => set({ data_nascimento: maskData(v) })} placeholder="DD/MM/AAAA" keyboardType="number-pad" containerStyle={{ flex: 1 }} />
        </View>
        <Input label="E-mail" value={f.email} onChangeText={(v) => set({ email: v })} keyboardType="email-address" autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input label="CPF / CNPJ" value={f.cpf} onChangeText={(v) => set({ cpf: maskCPFouCNPJ(v) })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          <Input label="RG" value={f.rg} onChangeText={(v) => set({ rg: maskRG(v) })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
        </View>
        <Input label="Renda mensal" value={f.rendaMask} onChangeText={(v) => set({ rendaMask: maskMoedaInput(v) })} keyboardType="numeric" placeholder="0,00" hint={f.rendaMask ? formatBRL(parseMoedaInput(f.rendaMask)) : undefined} />

        <Txt variant="captionMedium" color="textDim" style={{ marginTop: spacing.xs }}>Endereço</Txt>
        <Input label="CEP" value={f.cepMask} onChangeText={(v) => set({ cepMask: maskCEP(v) })} onBlur={onCepBlur} keyboardType="number-pad" hint={buscandoCep ? 'Buscando endereço…' : undefined} />
        <Input label="Endereço" value={f.endereco} onChangeText={(v) => set({ endereco: v })} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input label="Bairro" value={f.bairro} onChangeText={(v) => set({ bairro: v })} containerStyle={{ flex: 1 }} />
          <Input label="UF" value={f.estado} onChangeText={(v) => set({ estado: v.toUpperCase() })} maxLength={2} autoCapitalize="characters" containerStyle={{ width: 70 }} />
        </View>
        <Input label="Cidade" value={f.cidade} onChangeText={(v) => set({ cidade: v })} />
        <Input label="Observações" value={f.observacoes} onChangeText={(v) => set({ observacoes: v })} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />

        <Button title={cliente ? 'Salvar alterações' : 'Cadastrar cliente'} icon="checkmark" loading={salvando} onPress={salvar} full />
        {cliente && <Button title="Remover cliente" variant="outline" onPress={excluir} disabled={salvando} style={{ borderColor: colors.error }} />}
      </View>
    </Sheet>
  )
}
