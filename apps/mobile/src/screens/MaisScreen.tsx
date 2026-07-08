import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useAuthStore } from '../stores/authStore'

export default function MaisScreen() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <View style={styles.container}>
      <Text style={styles.nome}>{user?.nome}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.text}>PosVenda · Comissões · Financeiro · Equipe — em breve</Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sair</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F1A', padding: 24 },
  nome: { color: '#fff', fontSize: 18, fontWeight: '600' },
  email: { color: '#9AA5B1', fontSize: 14, marginBottom: 24 },
  text: { color: '#9AA5B1', fontSize: 14, marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#EF4444', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: '#fff', fontWeight: '600' },
})
