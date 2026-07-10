import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { spacing } from '../../../theme/tokens'
import { AppHeader, Badge, Button, Card, Input, Screen, SkeletonCard, Txt, useToast } from '../../../components/ui'
import { configService, type PerfilInput } from '../../../services'
import { capitalizarNome, maskCEP, maskCNPJ, maskTelefoneInput } from '../../../lib/format'
import { buscarCep } from '../../../lib/cep'

type FormState = {
  nome: string
  cnpj: string
  telefone: string
  whatsapp: string
  email: string
  cep: string
  endereco: string
  cidade: string
  estado: string
  percentual: string
}

const VAZIO: FormState = {
  nome: '', cnpj: '', telefone: '', whatsapp: '', email: '',
  cep: '', endereco: '', cidade: '', estado: '', percentual: '',
}

export default function PerfilLojaScreen() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const onCepBlur = async () => {
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    const r = await buscarCep(cep)
    setBuscandoCep(false)
    if (r) setForm((f) => ({ ...f, endereco: r.endereco, cidade: r.cidade, estado: r.estado }))
  }

  const q = useQuery({ queryKey: ['config', 'perfil'], queryFn: () => configService.perfil() })

  useEffect(() => {
    if (!q.data) return
    const p = q.data
    setForm({
      nome: p.nome ?? '',
      cnpj: p.cnpj ? maskCNPJ(p.cnpj) : '',
      telefone: p.telefone ? maskTelefoneInput(p.telefone) : '',
      whatsapp: p.whatsapp ? maskTelefoneInput(p.whatsapp) : '',
      email: p.email ?? '',
      cep: p.cep ? maskCEP(p.cep) : '',
      endereco: p.endereco ?? '',
      cidade: p.cidade ?? '',
      estado: p.estado ?? '',
      percentual: String(p.percentual_comissao_padrao ?? 0),
    })
  }, [q.data])

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const salvar = async () => {
    setSalvando(true)
    try {
      const input: PerfilInput = {
        nome: form.nome.trim(),
        cnpj: form.cnpj.replace(/\D/g, ''),
        telefone: form.telefone.replace(/\D/g, ''),
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        email: form.email.trim(),
        cep: form.cep.replace(/\D/g, ''),
        endereco: form.endereco.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado.trim().toUpperCase(),
        percentual_comissao_padrao: parseFloat(form.percentual.replace(',', '.')) || 0,
      }
      await configService.salvarPerfil(input)
      await queryClient.invalidateQueries({ queryKey: ['config', 'perfil'] })
      toast.show('success', 'Perfil da loja salvo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Perfil da Loja" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        {q.isLoading ? (
          <SkeletonCard withImage={false} />
        ) : (
          <>
            {q.data && (
              <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                <Badge label={`Slug: ${q.data.slug}`} tone="neutral" size="sm" />
                <Badge label={q.data.verificada ? 'Verificada' : 'Não verificada'} tone={q.data.verificada ? 'success' : 'neutral'} size="sm" />
              </View>
            )}

            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Dados cadastrais</Txt>
              <Input label="Nome da loja" value={form.nome} onChangeText={(v) => set('nome')(capitalizarNome(v))} />
              <Input label="CNPJ" value={form.cnpj} onChangeText={(v) => set('cnpj')(maskCNPJ(v))} keyboardType="number-pad" />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Input label="Telefone" value={form.telefone} onChangeText={(v) => set('telefone')(maskTelefoneInput(v))} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
                <Input label="WhatsApp" value={form.whatsapp} onChangeText={(v) => set('whatsapp')(maskTelefoneInput(v))} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
              </View>
              <Input label="E-mail" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Endereço</Txt>
              <Input label="CEP" value={form.cep} onChangeText={(v) => set('cep')(maskCEP(v))} onBlur={onCepBlur} keyboardType="number-pad" hint={buscandoCep ? 'Buscando endereço…' : undefined} />
              <Input label="Endereço" value={form.endereco} onChangeText={(v) => set('endereco')(capitalizarNome(v))} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Input label="Cidade" value={form.cidade} onChangeText={(v) => set('cidade')(capitalizarNome(v))} containerStyle={{ flex: 3 }} />
                <Input label="UF" value={form.estado} onChangeText={(v) => set('estado')(v.toUpperCase())} maxLength={2} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
              </View>
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Comissão de vendas</Txt>
              <Input
                label="Comissão padrão da loja (%)"
                value={form.percentual}
                onChangeText={(v) => set('percentual')(v.replace(/[^\d.,]/g, ''))}
                keyboardType="decimal-pad"
                hint="Aplicada a cada venda. Membros com % próprio (em Equipe) usam o valor individual."
              />
            </Card>

            <Button title="Salvar alterações" icon="checkmark" loading={salvando} onPress={salvar} full />
          </>
        )}
      </Screen>
    </Screen>
  )
}
