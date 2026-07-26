import React, { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Button, Card, Input, OptionSheet, Screen, SelectField, Txt, useToast,
} from '../../components/ui'
import { leadsService, veiculosService } from '../../services'
import { ORIGEM_LEAD_LABEL, type OrigemLead } from '../../services/types'
import {
  formatBRL, maskCEP, maskCPF, maskData, maskMoedaInput, maskTelefoneInput,
  parseMoedaInput,
} from '../../lib/format'
import { dataBRparaISO, validarCPF, validarEmail } from '../../lib/validacao'
import { buscarCep } from '../../lib/cep'
import type { RootScreenProps } from '../../navigation/types'

export default function LeadFormScreen({ route }: RootScreenProps<'LeadForm'>) {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [renda, setRenda] = useState('')
  const [cep, setCep] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [origem, setOrigem] = useState<OrigemLead>('manual')
  const [veiculoId, setVeiculoId] = useState<string | undefined>(route.params?.veiculoId)
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [sheet, setSheet] = useState<'origem' | 'veiculo' | null>(null)
  const [erroNome, setErroNome] = useState<string | undefined>()
  const [erroCpf, setErroCpf] = useState<string | undefined>()
  const [erroEmail, setErroEmail] = useState<string | undefined>()

  const veiculosQ = useQuery({
    queryKey: ['veiculos', 'lista'],
    queryFn: () => veiculosService.listar(),
  })
  const disponiveis = (veiculosQ.data ?? []).filter(
    (v) => v.status === 'disponivel' || v.status === 'reservado'
  )
  const veiculoSel = disponiveis.find((v) => v.id === veiculoId)

  // Ao completar 8 dígitos busca no ViaCEP e preenche cidade/UF (falha silenciosa).
  const preencherPorCep = async (texto: string) => {
    const mascarado = maskCEP(texto)
    setCep(mascarado)
    if (mascarado.replace(/\D/g, '').length !== 8) return
    const endereco = await buscarCep(mascarado)
    if (!endereco) return
    if (endereco.cidade) setCidade(endereco.cidade)
    if (endereco.estado) setEstado(endereco.estado)
  }

  const mut = useMutation({
    mutationFn: () =>
      leadsService.criar({
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, '') || undefined,
        cpf: cpf.replace(/\D/g, '') || undefined,
        email: email.trim() || undefined,
        data_nascimento: dataBRparaISO(nascimento),
        renda_mensal: renda ? parseMoedaInput(renda) : undefined,
        cep: cep.replace(/\D/g, '') || undefined,
        cidade: cidade.trim() || undefined,
        estado: estado.trim().toUpperCase() || undefined,
        origem,
        veiculo_id: veiculoId,
        valor_proposta: valor ? parseMoedaInput(valor) : undefined,
        lead_observacoes: obs.trim() || undefined,
      }),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.show('success', 'Lead criado.')
      navigation.goBack()
      navigation.navigate('LeadDetalhe', { id: lead.id })
    },
    onError: () => toast.show('error', 'Não foi possível criar o lead.'),
  })

  const salvar = () => {
    if (nome.trim().length < 3) {
      setErroNome('Informe o nome do cliente.')
      return
    }
    // CPF e e-mail são opcionais, mas se preenchidos precisam ser válidos —
    // senão o backend devolve 422 e o vendedor não entende o motivo.
    if (cpf.trim() && !validarCPF(cpf)) {
      setErroCpf('CPF inválido.')
      return
    }
    if (email.trim() && !validarEmail(email)) {
      setErroEmail('E-mail inválido.')
      return
    }
    mut.mutate()
  }

  return (
    <Screen scroll={false} padded={false} keyboardAvoiding>
      <AppHeader title="Novo lead" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <Txt variant="title">Cliente</Txt>
          <Input
            label="Nome *"
            placeholder="Ex.: João Pereira"
            icon="person-outline"
            value={nome}
            onChangeText={(t) => {
              setNome(t)
              setErroNome(undefined)
            }}
            error={erroNome}
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
            onChangeText={(t) => {
              setCpf(maskCPF(t))
              setErroCpf(undefined)
            }}
            error={erroCpf}
            hint="Necessário para financiamento e contrato."
          />
          <Input
            label="E-mail"
            placeholder="cliente@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail-outline"
            value={email}
            onChangeText={(t) => {
              setEmail(t)
              setErroEmail(undefined)
            }}
            error={erroEmail}
          />
          <Input
            label="Data de nascimento"
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            icon="calendar-outline"
            value={nascimento}
            onChangeText={(t) => setNascimento(maskData(t))}
          />
          <Input
            label="Renda mensal"
            placeholder="0,00"
            keyboardType="numeric"
            icon="wallet-outline"
            value={renda}
            onChangeText={(t) => setRenda(maskMoedaInput(t))}
            hint="Usada na simulação de financiamento."
          />
          <Input
            label="CEP"
            placeholder="00000-000"
            keyboardType="number-pad"
            icon="location-outline"
            value={cep}
            onChangeText={preencherPorCep}
            hint="Preenche cidade e UF automaticamente."
          />
          <Input
            label="Cidade"
            placeholder="Ex.: Porto Alegre"
            icon="business-outline"
            value={cidade}
            onChangeText={setCidade}
          />
          <Input
            label="Estado (UF)"
            placeholder="RS"
            autoCapitalize="characters"
            maxLength={2}
            value={estado}
            onChangeText={(t) => setEstado(t.replace(/[^A-Za-z]/g, '').toUpperCase())}
          />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Txt variant="title">Negociação</Txt>
          <SelectField
            label="Origem"
            value={ORIGEM_LEAD_LABEL[origem]}
            onPress={() => setSheet('origem')}
            icon="trail-sign-outline"
          />
          <SelectField
            label="Veículo de interesse"
            value={veiculoSel ? `${veiculoSel.marca} ${veiculoSel.modelo} · ${formatBRL(veiculoSel.preco_venda)}` : undefined}
            placeholder="Selecionar do estoque…"
            onPress={() => setSheet('veiculo')}
            icon="car-sport-outline"
          />
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
            placeholder="Preferências, troca, condições…"
            value={obs}
            onChangeText={setObs}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Card>

        <Button title="Criar lead" size="lg" loading={mut.isPending} onPress={salvar} />
        <Button title="Cancelar" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>

      <OptionSheet
        visible={sheet === 'origem'}
        onClose={() => setSheet(null)}
        title="Origem do lead"
        selected={origem}
        options={(Object.keys(ORIGEM_LEAD_LABEL) as OrigemLead[]).map((o) => ({
          value: o,
          label: ORIGEM_LEAD_LABEL[o],
        }))}
        onSelect={setOrigem}
      />
      <OptionSheet
        visible={sheet === 'veiculo'}
        onClose={() => setSheet(null)}
        title="Veículo de interesse"
        selected={veiculoId}
        options={[
          { value: '', label: 'Nenhum veículo específico' },
          ...disponiveis.map((v) => ({
            value: v.id,
            label: `${v.marca} ${v.modelo} ${v.ano_modelo}`,
            sublabel: formatBRL(v.preco_venda),
          })),
        ]}
        onSelect={(id) => setVeiculoId(id || undefined)}
      />
    </Screen>
  )
}
