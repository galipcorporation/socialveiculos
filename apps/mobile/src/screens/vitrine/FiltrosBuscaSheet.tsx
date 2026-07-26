import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Button, Input, Sheet, Txt } from '../../components/ui'
import { maskMoedaInput, parseMoedaInput, formatNumber } from '../../lib/format'
import { vitrineService, type FiltrosAvancados, type OrdenacaoBusca } from '../../services'
import { ANOS, TIPOS_VEICULO, type TipoVeiculo } from '../../services/types'

const CAMBIOS = ['Manual', 'Automático', 'Automático CVT', 'Automatizado']
const COMBUSTIVEIS = ['Flex', 'Gasolina', 'Diesel', 'Etanol', 'Híbrido', 'Elétrico']
const CORES = ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Marrom']

const ORDENACOES: { value: OrdenacaoBusca; label: string }[] = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'preco_asc', label: 'Menor preço' },
  { value: 'preco_desc', label: 'Maior preço' },
  { value: 'km_asc', label: 'Menor km' },
  { value: 'ano_desc', label: 'Mais novo' },
]

const KMS_MAX = [20_000, 50_000, 80_000, 100_000, 150_000]

// Só os tipos que fazem sentido na vitrine B2C — o resto do catálogo (barco,
// aeronave…) polui o filtro sem ter anúncio publicado.
const TIPOS_BUSCA = TIPOS_VEICULO.filter((t) => ['carro', 'moto', 'caminhao'].includes(t.value))

interface FiltrosBuscaSheetProps {
  visible: boolean
  onClose: () => void
  valor: FiltrosAvancados
  onAplicar: (f: FiltrosAvancados) => void
}

/** Painel de busca avançada da vitrine — abre pelo ícone ao lado da barra de busca. */
export function FiltrosBuscaSheet({ visible, onClose, valor, onAplicar }: FiltrosBuscaSheetProps) {
  // O rascunho nasce do filtro que está valendo na tela. Quem abre o sheet troca a
  // `key` deste componente, remontando-o — daí não é preciso sincronizar por efeito.
  const [rascunho, setRascunho] = useState<FiltrosAvancados>(valor)
  const [precoMin, setPrecoMin] = useState(valor.preco_min != null ? formatNumber(valor.preco_min, 2) : '')
  const [precoMax, setPrecoMax] = useState(valor.preco_max != null ? formatNumber(valor.preco_max, 2) : '')

  const categoriasQ = useQuery({
    queryKey: ['vitrine', 'categorias'],
    queryFn: () => vitrineService.categorias(),
    enabled: visible,
    staleTime: 10 * 60 * 1000,
  })

  const anos = useMemo(() => ANOS.slice(0, 20), [])

  function set<K extends keyof FiltrosAvancados>(chave: K, v: FiltrosAvancados[K]) {
    // Tocar de novo na opção já ativa limpa o critério.
    setRascunho((f) => ({ ...f, [chave]: f[chave] === v ? undefined : v }))
  }

  function limpar() {
    setRascunho({})
    setPrecoMin('')
    setPrecoMax('')
  }

  function aplicar() {
    const min = precoMin ? parseMoedaInput(precoMin) : undefined
    const max = precoMax ? parseMoedaInput(precoMax) : undefined
    onAplicar({
      ...rascunho,
      preco_min: min || undefined,
      // Faixa invertida (mín > máx) devolveria lista vazia sem explicação: inverte.
      preco_max: max || undefined,
      ...(min && max && min > max ? { preco_min: max, preco_max: min } : {}),
    })
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Filtros" maxHeight={0.9}>
      <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
        <Secao titulo="Ordenar por">
          <Opcoes
            opcoes={ORDENACOES}
            selecionado={rascunho.ordenacao ?? 'relevancia'}
            onSelect={(v) => setRascunho((f) => ({ ...f, ordenacao: v === 'relevancia' ? undefined : v }))}
          />
        </Secao>

        <Secao titulo="Tipo">
          <Opcoes
            opcoes={TIPOS_BUSCA}
            selecionado={rascunho.tipo}
            onSelect={(v) => set('tipo', v as TipoVeiculo)}
          />
        </Secao>

        {categoriasQ.data && categoriasQ.data.length > 0 ? (
          <Secao titulo="Carroceria">
            <Opcoes
              opcoes={categoriasQ.data.map((c) => ({ value: c, label: c }))}
              selecionado={rascunho.carroceria}
              onSelect={(v) => set('carroceria', v)}
            />
          </Secao>
        ) : null}

        <Secao titulo="Faixa de preço">
          <View style={styles.linha}>
            <Input
              containerStyle={{ flex: 1 }}
              label="Mínimo"
              value={precoMin}
              onChangeText={(t) => setPrecoMin(maskMoedaInput(t))}
              keyboardType="numeric"
              placeholder="R$ 0,00"
            />
            <Input
              containerStyle={{ flex: 1 }}
              label="Máximo"
              value={precoMax}
              onChangeText={(t) => setPrecoMax(maskMoedaInput(t))}
              keyboardType="numeric"
              placeholder="Sem limite"
            />
          </View>
        </Secao>

        <Secao titulo="Ano do modelo">
          <View style={styles.linha}>
            <SeletorAno
              label="De"
              anos={anos}
              selecionado={rascunho.ano_min}
              onSelect={(v) => set('ano_min', v)}
            />
            <SeletorAno
              label="Até"
              anos={anos}
              selecionado={rascunho.ano_max}
              onSelect={(v) => set('ano_max', v)}
            />
          </View>
        </Secao>

        <Secao titulo="Km máxima">
          <Opcoes
            opcoes={KMS_MAX.map((k) => ({ value: String(k), label: `até ${formatNumber(k)} km` }))}
            selecionado={rascunho.km_max != null ? String(rascunho.km_max) : undefined}
            onSelect={(v) => set('km_max', rascunho.km_max === Number(v) ? undefined : Number(v))}
          />
        </Secao>

        <Secao titulo="Câmbio">
          <Opcoes
            opcoes={CAMBIOS.map((c) => ({ value: c, label: c }))}
            selecionado={rascunho.cambio}
            onSelect={(v) => set('cambio', v)}
          />
        </Secao>

        <Secao titulo="Combustível">
          <Opcoes
            opcoes={COMBUSTIVEIS.map((c) => ({ value: c, label: c }))}
            selecionado={rascunho.combustivel}
            onSelect={(v) => set('combustivel', v)}
          />
        </Secao>

        <Secao titulo="Cor">
          <Opcoes
            opcoes={CORES.map((c) => ({ value: c, label: c }))}
            selecionado={rascunho.cor}
            onSelect={(v) => set('cor', v)}
          />
        </Secao>

        <View style={styles.acoes}>
          <Button title="Limpar" variant="outline" onPress={limpar} style={{ flex: 1 }} />
          <Button title="Aplicar filtros" icon="checkmark" onPress={aplicar} style={{ flex: 1.4 }} />
        </View>
      </View>
    </Sheet>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Txt variant="captionMedium" color="textDim">{titulo.toUpperCase()}</Txt>
      {children}
    </View>
  )
}

interface OpcoesProps<T extends string> {
  opcoes: { value: T; label: string }[]
  selecionado?: T
  onSelect: (v: T) => void
}

/** Grade de pílulas que quebram linha — cabe mais opção que um ScrollView horizontal. */
function Opcoes<T extends string>({ opcoes, selecionado, onSelect }: OpcoesProps<T>) {
  const { colors } = useTheme()
  return (
    <View style={styles.pilulas}>
      {opcoes.map((o) => {
        const ativo = o.value === selecionado
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={[
              styles.pilula,
              {
                backgroundColor: ativo ? colors.primary : colors.surface,
                borderColor: ativo ? colors.primary : colors.border,
              },
            ]}
          >
            <Txt
              style={{
                fontFamily: fonts.semibold,
                fontSize: 13,
                color: ativo ? colors.onPrimary : colors.textDim,
              }}
            >
              {o.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

interface SeletorAnoProps {
  label: string
  anos: number[]
  selecionado?: number
  onSelect: (v: number) => void
}

function SeletorAno({ label, anos, selecionado, onSelect }: SeletorAnoProps) {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Txt variant="captionMedium" color="textDim">{label}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anosRow}>
        {anos.map((a) => {
          const ativo = a === selecionado
          return (
            <Pressable
              key={a}
              onPress={() => onSelect(a)}
              style={[
                styles.pilula,
                {
                  backgroundColor: ativo ? colors.primary : colors.surface,
                  borderColor: ativo ? colors.primary : colors.border,
                },
              ]}
            >
              <Txt
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  color: ativo ? colors.onPrimary : colors.textDim,
                }}
              >
                {a}
              </Txt>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: spacing.sm },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  anosRow: { gap: spacing.xs, paddingRight: spacing.sm },
  pilula: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
})
