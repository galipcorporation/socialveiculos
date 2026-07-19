import React, { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { spacing } from '../../theme/tokens'
import {
  AppHeader, Button, Card, Input, OptionSheet, Screen, SelectField, Txt, useToast,
} from '../../components/ui'
import { leadsService, veiculosService } from '../../services'
import { ORIGEM_LEAD_LABEL, type OrigemLead } from '../../services/types'
import { formatBRL, maskMoedaInput, maskTelefoneInput, parseMoedaInput } from '../../lib/format'
import type { RootScreenProps } from '../../navigation/types'

export default function LeadFormScreen({ route }: RootScreenProps<'LeadForm'>) {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [origem, setOrigem] = useState<OrigemLead>('manual')
  const [veiculoId, setVeiculoId] = useState<string | undefined>(route.params?.veiculoId)
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [sheet, setSheet] = useState<'origem' | 'veiculo' | null>(null)
  const [erroNome, setErroNome] = useState<string | undefined>()

  const veiculosQ = useQuery({
    queryKey: ['veiculos', 'lista'],
    queryFn: () => veiculosService.listar(),
  })
  const disponiveis = (veiculosQ.data ?? []).filter(
    (v) => v.status === 'disponivel' || v.status === 'reservado'
  )
  const veiculoSel = disponiveis.find((v) => v.id === veiculoId)

  const mut = useMutation({
    mutationFn: () =>
      leadsService.criar({
        cliente_nome: nome.trim(),
        cliente_telefone: telefone.replace(/\D/g, '') || undefined,
        origem,
        veiculo_id: veiculoId,
        valor_proposta: valor ? parseMoedaInput(valor) : undefined,
        observacoes: obs.trim() || undefined,
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
