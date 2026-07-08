import React, { useState } from 'react'
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { User } from '../stores/authStore'
import { useAuthStore } from '../stores/authStore'
import { api, extractErrorDetails } from '../lib/api'

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email || !senha) {
      setErro('Preencha todos os campos.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const data = await api.post<LoginResponse>('/auth/login', { email, senha })
      login(data.access_token, data.refresh_token, data.user)
    } catch (err) {
      setErro(extractErrorDetails(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>SocialVeículos</Text>
      <Text style={styles.subtitle}>Entrar</Text>

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Entrar</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0B0F1A',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9AA5B1',
    textAlign: 'center',
    marginBottom: 24,
  },
  erro: {
    color: '#FF6B6B',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#151B29',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3345',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
})
