import React, { useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { spacing, radius } from '../theme/tokens'
import { useTheme } from '../theme/ThemeContext'
import {
  Button, Input, OptionSheet, SelectField, Sheet, Txt, useToast,
} from './ui'
import { equipeService, veiculosService } from '../services'
import type { Veiculo } from '../services/types'
import { formatBRL, maskMoedaInput, parseMoedaInput } from '../lib/format'
import { useAuthStore } from '../stores/authStore'

export function RegistrarVendaSheet({
  veiculo, visible, onClose, compradorInicial, leadId,
}: {
  veiculo: Veiculo | undefined
  visible: boolean
  onClose: () => void
  compradorInicial?: string
  leadId?: string
}) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigation = useNavigation()
  const user = useAuthStore((s) => s.user)

  const [comprador, setComprador] = useState(compradorInicial ?? '')
  const [valor, setValor] = useState(veiculo?.preco_venda ? maskMoedaInput(String(Math.round(veiculo.preco_venda * 100))) : '')
  const [vendedor, setVendedor] = useState(user?.nome ?? '')
  const [vendedorAberto, setVendedorAberto] = useState(false)
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<Veiculo | undefined>(veiculo)
  const [veiculoAberto, setVeiculoAberto] = useState(false)

  const veiculosQ = useQuery({
    queryKey: ['veiculos', { status: 'disponivel' }],
    queryFn: () => veiculosService.listar({ status: 'disponivel' }),
    enabled: visible && !veiculo,
  })

  // Pagamento composto (M058)
  const [dinheiro, setDinheiro] = useState('')
  const [financiado, setFinanciado] = useState('')
  const [troca, setTroca] = useState('')
  const [trocaDesc, setTrocaDesc] = useState('')

  const equipeQ = useQuery({ queryKey: ['equipe'], queryFn: () => equipeService.listar(), enabled: visible })

  const vTotal = parseMoedaInput(valor)
  const composto = parseMoedaInput(dinheiro) + parseMoedaInput(financiado) + parseMoedaInput(troca)
  const falta = vTotal - composto
  const fecha = vTotal > 0 && Math.abs(falta) < 1

  const vendaMut = useMutation({
    mutationFn: () => {
      if (!veiculoSelecionado) throw new Error('Selecione um veículo.')
      return veiculosService.registrarVenda(veiculoSelecionado.id, {
        comprador_nome: comprador.trim(),
        valor_venda: vTotal,
        vendedor_nome: vendedor || undefined,
        valor_dinheiro: parseMoedaInput(dinheiro) || undefined,
        valor_financiado: parseMoedaInput(financiado) || undefined,
        valor_troca: parseMoedaInput(troca) || undefined,
        troca_descricao: trocaDesc.trim() || undefined,
        lead_id: leadId,
      })
    },
    onSuccess: (esteira) => {
      queryClient.invalidateQueries()
      onClose()
      toast.show('success', 'Venda registrada! Esteira de pós-venda criada.')
      navigation.navigate('EsteiraDetalhe', { id: esteira.id })
    },
    onError: () => toast.show('error', 'Não foi possível registrar a venda.'),
  })

  // Comissão prevista (para transparência ao vendedor)
  const membro = (equipeQ.data ?? []).find((m) => m.nome === vendedor)
  const comissaoPct = membro?.percentual_comissao ?? null
  const comissaoPrev = comissaoPct ? (vTotal * comissaoPct) / 100 : null

  const valido = !!veiculoSelecionado && comprador.trim().length >= 3 && vTotal > 0

  return (
    <Sheet visible={visible} onClose={onClose} title="Registrar venda">
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        {veiculo ? (
          <Txt variant="caption" color="textDim">
            {veiculo.marca} {veiculo.modelo} · a venda abre a esteira de pós-venda.
          </Txt>
        ) : (
          <SelectField
            label="Veículo"
            value={veiculoSelecionado ? `${veiculoSelecionado.marca} ${veiculoSelecionado.modelo}` : ''}
            placeholder="Selecionar veículo"
            onPress={() => setVeiculoAberto(true)}
            icon="car-outline"
          />
        )}
        <Input label="Nome do comprador" placeholder="Ex.: Maria da Silva" value={comprador} onChangeText={setComprador} icon="person-outline" />
        <Input label="Valor da venda" placeholder="0,00" keyboardType="numeric" value={valor} onChangeText={(t) => setValor(maskMoedaInput(t))} icon="cash-outline" />

        {/* Composição do pagamento */}
        <View style={{ gap: spacing.sm }}>
          <Txt variant="captionMedium" color="textDim">Composição do pagamento (opcional)</Txt>
          <Input label="Dinheiro / à vista" placeholder="0,00" keyboardType="numeric" value={dinheiro} onChangeText={(t) => setDinheiro(maskMoedaInput(t))} icon="wallet-outline" />
          <Input label="Financiamento" placeholder="0,00" keyboardType="numeric" value={financiado} onChangeText={(t) => setFinanciado(maskMoedaInput(t))} icon="card-outline" />
          <Input label="Troca (valor avaliado)" placeholder="0,00" keyboardType="numeric" value={troca} onChangeText={(t) => setTroca(maskMoedaInput(t))} icon="swap-horizontal-outline" />
          {parseMoedaInput(troca) > 0 && (
            <Input label="Veículo da troca" placeholder="Ex.: Chevrolet Onix 2019" value={trocaDesc} onChangeText={setTrocaDesc} icon="car-outline" hint="Entra no estoque como rascunho (inativo) para avaliação." />
          )}
          {composto > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.sm, borderRadius: radius.md, backgroundColor: fecha ? colors.success + '14' : colors.warning + '14' }}>
              <Txt variant="caption" color={fecha ? 'success' : 'warning'}>
                {fecha ? '✓ Pagamento fecha com o valor' : falta > 0 ? `Falta ${formatBRL(falta)}` : `Excede ${formatBRL(-falta)}`}
              </Txt>
              <Txt variant="captionMedium" color={fecha ? 'success' : 'warning'}>{formatBRL(composto)}</Txt>
            </View>
          )}
        </View>

        <SelectField label="Vendedor responsável" value={vendedor} onPress={() => setVendedorAberto(true)} icon="people-outline" />
        {comissaoPrev != null && vTotal > 0 && (
          <Txt variant="caption" color="textMuted">Comissão prevista: {formatBRL(comissaoPrev)} ({comissaoPct}%).</Txt>
        )}

        <Button title="Confirmar venda" size="lg" loading={vendaMut.isPending} disabled={!valido} onPress={() => vendaMut.mutate()} />
      </View>
      <OptionSheet
        visible={vendedorAberto}
        onClose={() => setVendedorAberto(false)}
        title="Vendedor responsável"
        selected={vendedor}
        options={(equipeQ.data ?? []).filter((m) => m.ativo).map((m) => ({ value: m.nome, label: m.nome, sublabel: m.papel === 'gestor' ? 'Gestor' : 'Vendedor' }))}
        onSelect={setVendedor}
      />
      {!veiculo && (
        <OptionSheet
          visible={veiculoAberto}
          onClose={() => setVeiculoAberto(false)}
          title="Selecionar veículo"
          selected={veiculoSelecionado?.id ?? ''}
          options={(veiculosQ.data ?? []).map((v) => ({ value: v.id, label: `${v.marca} ${v.modelo}`, sublabel: formatBRL(v.preco_venda) }))}
          onSelect={(vid) => {
            const escolhido = (veiculosQ.data ?? []).find((v) => v.id === vid)
            setVeiculoSelecionado(escolhido)
            if (escolhido?.preco_venda) setValor(maskMoedaInput(String(Math.round(escolhido.preco_venda * 100))))
          }}
        />
      )}
    </Sheet>
  )
}
