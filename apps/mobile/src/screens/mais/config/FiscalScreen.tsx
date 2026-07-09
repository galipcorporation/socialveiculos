import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../../theme/ThemeContext'
import { radius, spacing } from '../../../theme/tokens'
import {
  AppHeader, Button, Card, EmptyState, Input, Screen, SelectField, SkeletonCard, Txt, useToast,
} from '../../../components/ui'
import { OptionSheet } from '../../../components/ui'
import { configService, REGIMES_FISCAIS, type AmbienteFiscal, type RegimeTributario } from '../../../services'
import { formatData } from '../../../lib/format'

const AMBIENTES: { value: AmbienteFiscal; label: string }[] = [
  { value: 'homologacao', label: 'Homologação (testes)' },
  { value: 'producao', label: 'Produção' },
]

export default function FiscalScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const q = useQuery({ queryKey: ['config', 'fiscal'], queryFn: () => configService.fiscal() })
  const cfg = q.data

  const [ie, setIe] = useState('')
  const [regime, setRegime] = useState<RegimeTributario>('simples')
  const [cnae, setCnae] = useState('')
  const [ambiente, setAmbiente] = useState<AmbienteFiscal>('homologacao')
  const [salvando, setSalvando] = useState(false)
  const [regimeSheet, setRegimeSheet] = useState(false)
  const [ambienteSheet, setAmbienteSheet] = useState(false)

  // Certificado (mock — informar nome + senha; app real usaria document-picker)
  const [nomeCert, setNomeCert] = useState('')
  const [senhaCert, setSenhaCert] = useState('')
  const [enviandoCert, setEnviandoCert] = useState(false)

  useEffect(() => {
    if (!cfg) return
    setIe(cfg.inscricao_estadual ?? '')
    setRegime(cfg.regime_tributario ?? 'simples')
    setCnae(cfg.cnae ?? '')
    setAmbiente(cfg.ambiente ?? 'homologacao')
  }, [cfg])

  const salvar = async () => {
    setSalvando(true)
    try {
      await configService.salvarFiscal({
        inscricao_estadual: ie.trim() || null,
        regime_tributario: regime,
        cnae: cnae.trim() || null,
        ambiente,
      })
      await queryClient.invalidateQueries({ queryKey: ['config', 'fiscal'] })
      toast.show('success', 'Dados fiscais salvos.')
    } finally {
      setSalvando(false)
    }
  }

  const enviarCert = async () => {
    if (!nomeCert.trim() || !senhaCert.trim()) {
      toast.show('error', 'Informe o arquivo .pfx e a senha.')
      return
    }
    setEnviandoCert(true)
    try {
      await configService.enviarCertificado(nomeCert.trim())
      await queryClient.invalidateQueries({ queryKey: ['config', 'fiscal'] })
      toast.show('success', 'Certificado enviado e validado.')
      setNomeCert('')
      setSenhaCert('')
    } finally {
      setEnviandoCert(false)
    }
  }

  const diasParaVencer = cfg?.certificado_validade
    ? Math.ceil((new Date(cfg.certificado_validade).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Fiscal / NF-e" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        {q.isLoading ? (
          <SkeletonCard withImage={false} />
        ) : cfg && !cfg.liberado ? (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
            <Ionicons name="diamond-outline" size={40} color={colors.primary} />
            <Txt variant="title" align="center">Recurso Premium</Txt>
            <Txt variant="caption" color="textDim" align="center">
              O módulo Fiscal não está ativo no seu plano. Emita NF-e de venda sem precisar de um sistema fiscal à parte.
            </Txt>
          </Card>
        ) : cfg ? (
          <>
            {/* Status */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                padding: spacing.sm, borderRadius: radius.md, borderWidth: 1,
                backgroundColor: (cfg.ativo ? colors.success : colors.warning) + '14',
                borderColor: (cfg.ativo ? colors.success : colors.warning) + '55',
              }}
            >
              <Ionicons name={cfg.ativo ? 'shield-checkmark' : 'alert-circle'} size={18} color={cfg.ativo ? colors.success : colors.warning} />
              <Txt variant="caption" style={{ flex: 1, color: cfg.ativo ? colors.success : colors.warning }}>
                {cfg.ativo
                  ? `Emissão de NF-e habilitada (ambiente: ${cfg.ambiente}).`
                  : 'Emissão bloqueada — complete os dados fiscais e envie o certificado A1.'}
              </Txt>
            </View>

            {diasParaVencer !== null && diasParaVencer < 30 && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                  padding: spacing.sm, borderRadius: radius.md, borderWidth: 1,
                  backgroundColor: colors.error + '14', borderColor: colors.error + '55',
                }}
              >
                <Ionicons name="warning" size={18} color={colors.error} />
                <Txt variant="caption" style={{ flex: 1, color: colors.error }}>
                  {diasParaVencer > 0
                    ? `Certificado vence em ${diasParaVencer} dia(s) — renove para não interromper as emissões.`
                    : 'Certificado vencido — envie um novo para voltar a emitir NF-e.'}
                </Txt>
              </View>
            )}

            {/* Dados fiscais */}
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Dados fiscais</Txt>
              <Input label="Inscrição Estadual" value={ie} onChangeText={setIe} placeholder="000.000.000.000" keyboardType="number-pad" />
              <SelectField label="Regime Tributário" value={REGIMES_FISCAIS.find((r) => r.value === regime)?.label} onPress={() => setRegimeSheet(true)} />
              <Input label="CNAE" value={cnae} onChangeText={setCnae} placeholder="4511-1/02" />
              <SelectField label="Ambiente" value={AMBIENTES.find((a) => a.value === ambiente)?.label} onPress={() => setAmbienteSheet(true)} />
              <Button title="Salvar dados fiscais" icon="checkmark" loading={salvando} onPress={salvar} full />
            </Card>

            {/* Certificado A1 */}
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Certificado Digital A1</Txt>
              {cfg.certificado_configurado && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name="document-lock-outline" size={18} color={colors.success} />
                  <Txt variant="caption" color="textDim">
                    Certificado configurado{cfg.certificado_validade ? ` — validade ${formatData(cfg.certificado_validade)}` : ''}
                  </Txt>
                </View>
              )}
              <Input label="Arquivo do certificado (.pfx)" value={nomeCert} onChangeText={setNomeCert} autoCapitalize="none" placeholder="certificado.pfx" />
              <Input label="Senha do certificado" value={senhaCert} onChangeText={setSenhaCert} secureTextEntry placeholder="Senha do arquivo .pfx" />
              <Button
                title={cfg.certificado_configurado ? 'Atualizar certificado' : 'Enviar certificado'}
                icon="cloud-upload-outline"
                loading={enviandoCert}
                onPress={enviarCert}
                full
                disabled={!nomeCert.trim() || !senhaCert.trim()}
              />
            </Card>
          </>
        ) : (
          <EmptyState icon="alert-circle-outline" title="Erro" subtitle="Não foi possível carregar a configuração fiscal." />
        )}
      </Screen>

      <OptionSheet
        visible={regimeSheet}
        onClose={() => setRegimeSheet(false)}
        title="Regime Tributário"
        options={REGIMES_FISCAIS.map((r) => ({ value: r.value, label: r.label }))}
        selected={regime}
        onSelect={(v) => setRegime(v as RegimeTributario)}
      />
      <OptionSheet
        visible={ambienteSheet}
        onClose={() => setAmbienteSheet(false)}
        title="Ambiente"
        options={AMBIENTES.map((a) => ({ value: a.value, label: a.label }))}
        selected={ambiente}
        onSelect={(v) => setAmbiente(v as AmbienteFiscal)}
      />
    </Screen>
  )
}
