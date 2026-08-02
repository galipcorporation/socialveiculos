import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import { Button, Input, OptionSheet, SelectField, Sheet, Slider, Txt, type SheetOption } from '../../components/ui'
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

// Slider de km máxima: o topo da faixa vale "sem limite" (não manda `km_max`),
// senão o filtro cortaria justamente os anúncios de rodagem alta.
const KM_MIN = 5_000
const KM_TOPO = 200_000
const KM_PASSO = 5_000

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
  const [anoAberto, setAnoAberto] = useState<'min' | 'max' | null>(null)
  const [cambioAberto, setCambioAberto] = useState(false)

  const categoriasQ = useQuery({
    queryKey: ['vitrine', 'categorias'],
    queryFn: () => vitrineService.categorias(),
    enabled: visible,
    staleTime: 10 * 60 * 1000,
  })

  const opcoesAno: SheetOption[] = useMemo(
    () => ANOS.slice(0, 20).map((a) => ({ value: String(a), label: String(a) })),
    []
  )

  const opcoesCambio: SheetOption[] = useMemo(
    () => [{ value: '', label: 'Qualquer' }, ...CAMBIOS.map((c) => ({ value: c, label: c }))],
    []
  )

  function set<K extends keyof FiltrosAvancados>(chave: K, v: FiltrosAvancados[K]) {
    // Tocar de novo na opção já ativa limpa o critério.
    setRascunho((f) => ({ ...f, [chave]: f[chave] === v ? undefined : v }))
  }

  /** Critérios multiescolha (combustível, cor): cada toque marca/desmarca uma
   *  opção e a busca aceita qualquer uma delas. Lista vazia vira `undefined`
   *  para o filtro sumir da contagem e dos chips da tela de busca. */
  function alternar(chave: 'combustivel' | 'cor', v: string) {
    setRascunho((f) => {
      const atual = f[chave] ?? []
      const proxima = atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v]
      return { ...f, [chave]: proxima.length > 0 ? proxima : undefined }
    })
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
    <>
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
            <SelectField
              label="De"
              value={rascunho.ano_min ? String(rascunho.ano_min) : undefined}
              placeholder="Qualquer"
              onPress={() => setAnoAberto('min')}
              containerStyle={{ flex: 1 }}
            />
            <SelectField
              label="Até"
              value={rascunho.ano_max ? String(rascunho.ano_max) : undefined}
              placeholder="Qualquer"
              onPress={() => setAnoAberto('max')}
              containerStyle={{ flex: 1 }}
            />
          </View>
        </Secao>

        <Slider
          label="KM MÁXIMA"
          min={KM_MIN}
          max={KM_TOPO}
          step={KM_PASSO}
          value={rascunho.km_max ?? KM_TOPO}
          onChange={(v) =>
            setRascunho((f) => ({ ...f, km_max: v >= KM_TOPO ? undefined : v }))
          }
          valorTexto={rascunho.km_max != null ? `até ${formatNumber(rascunho.km_max)} km` : 'Sem limite'}
          minTexto={`${formatNumber(KM_MIN)} km`}
          maxTexto="Sem limite"
        />

        <Secao titulo="Câmbio">
          <SelectField
            value={rascunho.cambio}
            placeholder="Qualquer"
            onPress={() => setCambioAberto(true)}
          />
        </Secao>

        <Secao titulo="Combustível" dica="Pode marcar mais de um">
          <Opcoes
            opcoes={COMBUSTIVEIS.map((c) => ({ value: c, label: c }))}
            selecionados={rascunho.combustivel ?? []}
            onSelect={(v) => alternar('combustivel', v)}
          />
        </Secao>

        <Secao titulo="Cor" dica="Pode marcar mais de uma">
          <Opcoes
            opcoes={CORES.map((c) => ({ value: c, label: c }))}
            selecionados={rascunho.cor ?? []}
            onSelect={(v) => alternar('cor', v)}
          />
        </Secao>

        <View style={styles.acoes}>
          <Button title="Limpar" variant="outline" onPress={limpar} style={{ flex: 1 }} />
          <Button title="Aplicar filtros" icon="checkmark" onPress={aplicar} style={{ flex: 1.4 }} />
        </View>
      </View>
    </Sheet>
    <OptionSheet
      visible={anoAberto != null}
      onClose={() => setAnoAberto(null)}
      title={anoAberto === 'min' ? 'Ano do modelo — de' : 'Ano do modelo — até'}
      options={opcoesAno}
      selected={anoAberto === 'min' ? (rascunho.ano_min ? String(rascunho.ano_min) : undefined) : (rascunho.ano_max ? String(rascunho.ano_max) : undefined)}
      onSelect={(v) => {
        const ano = parseInt(v, 10)
        if (anoAberto === 'min') set('ano_min', ano)
        else if (anoAberto === 'max') set('ano_max', ano)
        setAnoAberto(null)
      }}
    />
    <OptionSheet
      visible={cambioAberto}
      onClose={() => setCambioAberto(false)}
      title="Câmbio"
      options={opcoesCambio}
      selected={rascunho.cambio ?? ''}
      onSelect={(v) => {
        setRascunho((f) => ({ ...f, cambio: v || undefined }))
        setCambioAberto(false)
      }}
    />
    </>
  )
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.tituloRow}>
        <Txt variant="captionMedium" color="textDim">{titulo.toUpperCase()}</Txt>
        {dica ? <Txt variant="caption" color="textMuted">{dica}</Txt> : null}
      </View>
      {children}
    </View>
  )
}

interface OpcoesProps<T extends string> {
  opcoes: { value: T; label: string }[]
  /** Escolha única. */
  selecionado?: T
  /** Multiescolha — quando presente, manda em `selecionado`. */
  selecionados?: T[]
  onSelect: (v: T) => void
}

/** Grade de pílulas que quebram linha — cabe mais opção que um ScrollView horizontal. */
function Opcoes<T extends string>({ opcoes, selecionado, selecionados, onSelect }: OpcoesProps<T>) {
  const { colors } = useTheme()
  return (
    <View style={styles.pilulas}>
      {opcoes.map((o) => {
        const ativo = selecionados ? selecionados.includes(o.value) : o.value === selecionado
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            accessibilityRole={selecionados ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: ativo, selected: ativo }}
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

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: spacing.sm },
  tituloRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
