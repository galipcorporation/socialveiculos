import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { fonts, radius } from '../theme/tokens'
import { Txt } from './ui/Txt'
import type { TipoVeiculo, Veiculo } from '../services/types'

// Sem foto → placeholder em gradiente com monograma da marca.
// Paleta escura neutra proposital: parece "capa" e não erro.
const GRADIENTES: [string, string][] = [
  ['#1e3a5f', '#2c5282'],
  ['#3b2f63', '#553c9a'],
  ['#1f4037', '#2f6b52'],
  ['#4a2c2a', '#7b4a42'],
  ['#2d3748', '#4a5568'],
  ['#44337a', '#6b46c1'],
  ['#234e52', '#2c7a7b'],
]

function iconePorTipo(tipo: TipoVeiculo, size: number, color: string) {
  switch (tipo) {
    case 'moto':
      return <MaterialCommunityIcons name="motorbike" size={size} color={color} />
    case 'caminhao':
      return <MaterialCommunityIcons name="truck" size={size} color={color} />
    case 'reboque':
      return <MaterialCommunityIcons name="truck-trailer" size={size} color={color} />
    case 'barco':
    case 'jet':
      return <Ionicons name="boat" size={size} color={color} />
    case 'aeronave':
      return <Ionicons name="airplane" size={size} color={color} />
    default:
      return <Ionicons name="car-sport" size={size} color={color} />
  }
}

interface VehiclePhotoProps {
  veiculo: Pick<Veiculo, 'marca' | 'modelo' | 'tipo' | 'midias'>
  width?: number | '100%'
  height: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

export function VehiclePhoto({ veiculo, width = '100%', height, borderRadius = radius.md, style }: VehiclePhotoProps) {
  const foto = veiculo.midias?.find((m) => m.tipo === 'imagem')?.url

  if (foto) {
    return (
      <Image
        source={{ uri: foto }}
        style={[{ width, height, borderRadius, backgroundColor: '#2d3748' }, style as object]}
        contentFit="cover"
        transition={200}
      />
    )
  }

  const hash = [...`${veiculo.marca}${veiculo.modelo}`].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const [c1, c2] = GRADIENTES[hash % GRADIENTES.length]
  const iconSize = Math.min(height * 0.34, 44)

  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { width, height, borderRadius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        style,
      ]}
    >
      {iconePorTipo(veiculo.tipo, iconSize, 'rgba(255,255,255,0.85)')}
      {height >= 100 && (
        <Txt
          style={{
            fontFamily: fonts.semibold,
            fontSize: Math.min(height * 0.11, 13),
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginTop: 6,
          }}
        >
          {veiculo.marca}
        </Txt>
      )}
    </LinearGradient>
  )
}
