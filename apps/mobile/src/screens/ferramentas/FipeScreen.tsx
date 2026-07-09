import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Button, Card, Screen, SegmentedControl, SelectField, Txt,
} from '../../components/ui'
import { OptionSheet } from '../../components/ui'
import { fipeService, TIPOS_FIPE } from '../../services'
import type { FipeResultado } from '../../services/types'
import { formatBRL } from '../../lib/format'

type Tipo = 'carro' | 'moto' | 'caminhao'
type Campo = 'marca' | 'modelo' | 'ano' | null

export default function FipeScreen() {
  const { colors } = useTheme()
  const [tipo, setTipo] = useState<Tipo>('carro')
  const [marcaCod, setMarcaCod] = useState('')
  const [modeloCod, setModeloCod] = useState('')
  const [anoCod, setAnoCod] = useState('')
  const [sheet, setSheet] = useState<Campo>(null)
  const [result, setResult] = useState<FipeResultado | null>(null)
  const [consultando, setConsultando] = useState(false)

  const marcasQ = useQuery({ queryKey: ['fipe', 'marcas', tipo], queryFn: () => fipeService.marcas(tipo) })
  const modelosQ = useQuery({ queryKey: ['fipe', 'modelos', tipo, marcaCod], queryFn: () => fipeService.modelos(tipo, marcaCod), enabled: !!marcaCod })
  const anosQ = useQuery({ queryKey: ['fipe', 'anos', tipo, marcaCod, modeloCod], queryFn: () => fipeService.anos(tipo, marcaCod, modeloCod), enabled: !!modeloCod })

  // Reset em cascata.
  useEffect(() => { setMarcaCod(''); setModeloCod(''); setAnoCod(''); setResult(null) }, [tipo])
  useEffect(() => { setModeloCod(''); setAnoCod(''); setResult(null) }, [marcaCod])
  useEffect(() => { setAnoCod(''); setResult(null) }, [modeloCod])

  const nomeMarca = marcasQ.data?.find((m) => m.codigo === marcaCod)?.nome
  const nomeModelo = modelosQ.data?.find((m) => m.codigo === modeloCod)?.nome
  const nomeAno = anosQ.data?.find((a) => a.codigo === anoCod)?.nome

  const consultar = async () => {
    if (!anoCod) return
    setConsultando(true)
    try {
      setResult(await fipeService.consultar({ tipo, marcaCod, modeloCod, anoCod }))
    } finally {
      setConsultando(false)
    }
  }

  const limpar = () => {
    setMarcaCod(''); setModeloCod(''); setAnoCod(''); setResult(null)
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Consulta FIPE" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Consulte o valor de referência sem cadastrar o veículo. Útil durante a negociação.
        </Txt>

        <Card style={{ gap: spacing.sm }}>
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Tipo de veículo</Txt>
            <SegmentedControl
              options={TIPOS_FIPE.map((t) => ({ value: t.value, label: t.label }))}
              selected={tipo}
              onSelect={(v) => setTipo(v as Tipo)}
            />
          </View>

          <SelectField label="Marca" value={nomeMarca} placeholder={marcasQ.isLoading ? 'Carregando…' : 'Selecione a marca'} onPress={() => setSheet('marca')} />
          <SelectField label="Modelo" value={nomeModelo} placeholder={!marcaCod ? 'Aguardando marca…' : modelosQ.isLoading ? 'Carregando…' : 'Selecione o modelo'} onPress={() => marcaCod && setSheet('modelo')} />
          <SelectField label="Ano / Modelo" value={nomeAno} placeholder={!modeloCod ? 'Aguardando modelo…' : anosQ.isLoading ? 'Carregando…' : 'Selecione o ano'} onPress={() => modeloCod && setSheet('ano')} />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Button title="Consultar FIPE" icon="search" loading={consultando} onPress={consultar} disabled={!anoCod} style={{ flex: 1 }} />
            <Button title="Limpar" variant="outline" onPress={limpar} />
          </View>
        </Card>

        {result && (
          <Card style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg }}>
            {result.fipe_disponivel && result.fipe != null ? (
              <>
                <Txt variant="caption" color="textDim">Valor FIPE</Txt>
                <Txt style={{ fontFamily: fonts.displayBold, fontSize: 30, color: colors.primaryText }}>
                  {formatBRL(result.fipe)}
                </Txt>
                <Txt variant="caption" color="textMuted" align="center">
                  {nomeMarca} {nomeModelo} · {nomeAno} · referência de mercado
                </Txt>
              </>
            ) : (
              <Txt variant="body" color="textDim" align="center">
                Valor não disponível para esta combinação.
              </Txt>
            )}
          </Card>
        )}
      </Screen>

      <OptionSheet
        visible={sheet === 'marca'}
        onClose={() => setSheet(null)}
        title="Marca"
        options={(marcasQ.data ?? []).map((m) => ({ value: m.codigo, label: m.nome }))}
        selected={marcaCod}
        onSelect={setMarcaCod}
      />
      <OptionSheet
        visible={sheet === 'modelo'}
        onClose={() => setSheet(null)}
        title="Modelo"
        options={(modelosQ.data ?? []).map((m) => ({ value: m.codigo, label: m.nome }))}
        selected={modeloCod}
        onSelect={setModeloCod}
      />
      <OptionSheet
        visible={sheet === 'ano'}
        onClose={() => setSheet(null)}
        title="Ano / Modelo"
        options={(anosQ.data ?? []).map((a) => ({ value: a.codigo, label: a.nome }))}
        selected={anoCod}
        onSelect={setAnoCod}
      />
    </Screen>
  )
}
