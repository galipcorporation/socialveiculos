import React, { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../../theme/ThemeContext'
import { spacing } from '../../../theme/tokens'
import {
  AppHeader, Button, Card, Input, ListRow, Screen, SegmentedControl,
  Sheet, SkeletonCard, Txt, useToast,
} from '../../../components/ui'
import { configService, type EscopoCredencial } from '../../../services'

const SENHA_MASCARADA = '••••••••'

export default function CredenciaisBancoScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const bancosQ = useQuery({ queryKey: ['config', 'bancos'], queryFn: () => configService.bancosSuportados() })
  const credsQ = useQuery({ queryKey: ['config', 'credenciais-banco'], queryFn: () => configService.credenciaisBanco() })

  const [banco, setBanco] = useState('bv')
  const [escopo, setEscopo] = useState<EscopoCredencial>('loja')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [teste, setTeste] = useState<{ valido: boolean; mensagem: string } | null>(null)
  const [formAberto, setFormAberto] = useState(false)

  const bancos = bancosQ.data ?? []
  const creds = credsQ.data ?? []

  // Pré-popula ao trocar banco/escopo.
  useEffect(() => {
    const existente = creds.find((c) => c.banco === banco && c.escopo === escopo && c.ativo)
    if (existente) {
      setUsuario(existente.usuario_configurado ?? '')
      setSenha(SENHA_MASCARADA)
    } else {
      setUsuario('')
      setSenha('')
    }
    setTeste(null)
  }, [banco, escopo, creds])

  const nomeBanco = (cod: string) => bancos.find((b) => b.codigo === cod)?.nome ?? cod.toUpperCase()

  const statusBanco = (cod: string) => {
    const cs = creds.filter((c) => c.banco === cod && c.ativo)
    if (cs.length === 0) return 'Não configurado'
    return cs.map((c) => (c.escopo === 'vendedor' ? `Minha: ${c.usuario_configurado ?? '✓'}` : `Loja: ${c.usuario_configurado ?? '✓'}`)).join(' · ')
  }

  const abrirForm = (cod: string) => {
    setBanco(cod)
    setFormAberto(true)
  }

  const testar = async () => {
    setTestando(true)
    setTeste(null)
    try {
      const r = await configService.testarCredencialBanco({ banco, usuario: usuario.trim(), senha })
      setTeste(r)
    } finally {
      setTestando(false)
    }
  }

  const salvar = async () => {
    if (!usuario.trim() || !senha.trim()) {
      toast.show('error', 'Usuário e senha são obrigatórios.')
      return
    }
    setSalvando(true)
    try {
      await configService.salvarCredencialBanco({ banco, escopo, usuario: usuario.trim(), senha })
      await queryClient.invalidateQueries({ queryKey: ['config', 'credenciais-banco'] })
      toast.show('success', 'Credencial cifrada salva.')
      setFormAberto(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Credenciais Bancárias" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        <Txt variant="caption" color="textDim">
          Configure as APIs bancárias para o Simulador de crédito. Dados cifrados (Fernet) — nunca exibimos a senha.
        </Txt>

        {bancosQ.isLoading || credsQ.isLoading ? (
          <SkeletonCard withImage={false} />
        ) : (
          <Card padded={false}>
            {bancos.map((b, i) => (
              <ListRow
                key={b.codigo}
                icon="card-outline"
                iconColor={creds.some((c) => c.banco === b.codigo && c.ativo) ? colors.success : colors.textDim}
                title={b.nome}
                subtitle={statusBanco(b.codigo)}
                chevron
                onPress={() => abrirForm(b.codigo)}
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
              />
            ))}
          </Card>
        )}
      </Screen>

      <Sheet visible={formAberto} onClose={() => setFormAberto(false)} title={`Configurar: ${nomeBanco(banco)}`}>
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <View style={{ gap: 6 }}>
            <Txt variant="captionMedium" color="textDim">Escopo</Txt>
            <SegmentedControl
              options={[{ value: 'loja', label: 'Desta loja' }, { value: 'vendedor', label: 'Minha credencial' }]}
              selected={escopo}
              onSelect={(v) => setEscopo(v as EscopoCredencial)}
            />
            <Txt variant="caption" color="textMuted">
              {escopo === 'loja'
                ? 'Compartilhada com a equipe. Só gestores alteram.'
                : 'Credencial pessoal. Suas simulações usam esta em vez da da loja.'}
            </Txt>
          </View>

          <Input label="Usuário / Login" value={usuario} onChangeText={setUsuario} autoCapitalize="none" placeholder="Usuário cadastrado no banco" />
          <Input
            label="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!mostrarSenha}
            placeholder="Senha"
            right={
              <Pressable onPress={() => setMostrarSenha((v) => !v)} hitSlop={8}>
                <Ionicons name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </Pressable>
            }
          />

          {teste && (
            <Txt variant="caption" color={teste.valido ? 'success' : 'error'}>
              {teste.valido ? '✓ ' : '✗ '}{teste.mensagem}
            </Txt>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Testar" variant="outline" loading={testando} onPress={testar} style={{ flex: 1 }} disabled={!usuario.trim() || !senha.trim()} />
            <Button title="Salvar" icon="lock-closed" loading={salvando} onPress={salvar} style={{ flex: 1 }} disabled={!usuario.trim() || !senha.trim()} />
          </View>
        </View>
      </Sheet>
    </Screen>
  )
}
