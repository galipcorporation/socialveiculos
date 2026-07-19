import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius } from '../../theme/tokens'
import { Txt } from './Txt'
import type { EstagioEsteira, EtapaLead, TipoLancamento, VeiculoStatus } from '../../services/types'

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  label: string
  tone?: Tone
  size?: 'sm' | 'md'
  style?: StyleProp<ViewStyle>
}

/** Pill tonal — fundo translúcido da cor semântica (padrão do gestor). */
export function Badge({ label, tone = 'neutral', size = 'md', style }: BadgeProps) {
  const { colors } = useTheme()
  const map: Record<Tone, string> = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    neutral: colors.textMuted,
  }
  const cor = map[tone]
  return (
    <View
      style={[
        {
          backgroundColor: cor + '22',
          borderRadius: radius.full,
          paddingHorizontal: size === 'sm' ? 8 : 10,
          paddingVertical: size === 'sm' ? 2 : 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Txt
        style={{
          color: tone === 'neutral' ? colors.textDim : cor,
          fontFamily: fonts.semibold,
          fontSize: size === 'sm' ? 11 : 12,
        }}
      >
        {label}
      </Txt>
    </View>
  )
}

// ── Mapeamentos semânticos do domínio ──────────────────────

export const TONE_STATUS_VEICULO: Record<VeiculoStatus, Tone> = {
  disponivel: 'success',
  reservado: 'warning',
  vendido: 'primary',
  repasse: 'info',
  inativo: 'neutral',
  rascunho: 'neutral',
}

export const TONE_ETAPA_LEAD: Record<EtapaLead, Tone> = {
  lead: 'info',
  proposta: 'primary',
  negociacao: 'warning',
  fechamento: 'success',
  perdido: 'error',
}

export const TONE_ESTAGIO_ESTEIRA: Record<EstagioEsteira, Tone> = {
  contrato: 'info',
  pagamento: 'warning',
  documentos: 'primary',
  transferencia: 'warning',
  concluido: 'success',
}

export const TONE_TIPO_LANCAMENTO: Record<TipoLancamento, Tone> = {
  receita: 'success',
  despesa: 'error',
  comissao: 'warning',
}
