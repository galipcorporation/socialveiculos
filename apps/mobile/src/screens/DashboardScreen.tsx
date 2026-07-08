import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dashboard — em breve</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F1A' },
  text: { color: '#9AA5B1', fontSize: 16 },
})
