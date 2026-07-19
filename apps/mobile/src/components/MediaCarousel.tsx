import React, { useRef, useState } from 'react'
import { Dimensions, FlatList, Pressable, StyleSheet, View, type ViewToken } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { fonts, radius } from '../theme/tokens'
import { Txt } from './ui/Txt'
import type { Midia, TipoVeiculo, Veiculo } from '../services/types'

// Sem foto → placeholder em gradiente com monograma da marca.
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

function Placeholder({ veiculo, width, height, borderRadius }: { veiculo: Pick<Veiculo, 'marca' | 'modelo' | 'tipo'>; width: number; height: number; borderRadius: number }) {
  const hash = [...`${veiculo.marca}${veiculo.modelo}`].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const [c1, c2] = GRADIENTES[hash % GRADIENTES.length]
  const iconSize = Math.min(height * 0.34, 44)
  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width, height, borderRadius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
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

function VideoSlide({ url, width, height, borderRadius, ativo }: { url: string; width: number; height: number; borderRadius: number; ativo: boolean }) {
  const player = useVideoPlayer(url, (p) => { p.loop = true; p.muted = true })

  React.useEffect(() => {
    if (ativo) player.play()
    else player.pause()
  }, [ativo, player])

  return (
    <VideoView
      player={player}
      style={{ width, height, borderRadius, backgroundColor: '#2d3748' }}
      contentFit="cover"
      nativeControls={false}
    />
  )
}

interface MediaCarouselProps {
  veiculo: Pick<Veiculo, 'marca' | 'modelo' | 'tipo' | 'midias'>
  width?: number
  height: number
  borderRadius?: number
}

/** Carrossel de fotos/vídeos do veículo — setas, bolinhas e contador "N/M". */
export function MediaCarousel({ veiculo, width, height, borderRadius = radius.md }: MediaCarouselProps) {
  const larguraTela = Dimensions.get('window').width
  const w = width ?? larguraTela
  const midias: Midia[] = [...(veiculo.midias ?? [])].sort((a, b) => a.ordem - b.ordem)
  const [indice, setIndice] = useState(0)
  const listRef = useRef<FlatList<Midia>>(null)

  const onViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const primeiro = viewableItems[0]
    if (primeiro?.index != null) setIndice(primeiro.index)
  }).current

  if (midias.length === 0) {
    return <Placeholder veiculo={veiculo} width={w} height={height} borderRadius={borderRadius} />
  }

  if (midias.length === 1) {
    const m = midias[0]
    return m.tipo === 'video'
      ? <VideoSlide url={m.url} width={w} height={height} borderRadius={borderRadius} ativo />
      : <Image source={{ uri: m.url }} style={{ width: w, height, borderRadius, backgroundColor: '#2d3748' }} contentFit="cover" transition={200} />
  }

  const irPara = (i: number) => {
    const alvo = Math.max(0, Math.min(midias.length - 1, i))
    listRef.current?.scrollToIndex({ index: alvo, animated: true })
    setIndice(alvo)
  }

  return (
    <View style={{ width: w, height }}>
      <FlatList
        ref={listRef}
        data={midias}
        keyExtractor={(m) => m.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
        onViewableItemsChanged={onViewableChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) =>
          item.tipo === 'video'
            ? <VideoSlide url={item.url} width={w} height={height} borderRadius={borderRadius} ativo={index === indice} />
            : <Image source={{ uri: item.url }} style={{ width: w, height, borderRadius, backgroundColor: '#2d3748' }} contentFit="cover" transition={200} />
        }
      />

      {indice > 0 && (
        <Pressable onPress={() => irPara(indice - 1)} hitSlop={10} style={[styles.seta, { left: 8 }]}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
      )}
      {indice < midias.length - 1 && (
        <Pressable onPress={() => irPara(indice + 1)} hitSlop={10} style={[styles.seta, { right: 8 }]}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      )}

      <View style={styles.contador}>
        <Txt style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 11 }}>{indice + 1}/{midias.length}</Txt>
      </View>

      <View style={styles.bolinhas}>
        {midias.map((m, i) => (
          <View key={m.id} style={[styles.bolinha, { opacity: i === indice ? 1 : 0.4 }]} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  seta: {
    position: 'absolute', top: '50%', marginTop: -16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  contador: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  bolinhas: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  bolinha: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff',
  },
})
