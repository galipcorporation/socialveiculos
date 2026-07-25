import React, { useCallback } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, EmptyState, ErrorState, Screen, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { vitrineService } from '../../services'
import type { LojaVitrine } from '../../services/types'

export default function LojasSeguidasScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const toast = useToast()

  const lojasQ = useQuery({
    queryKey: ['vitrine', 'lojas-seguidas'],
    queryFn: () => vitrineService.lojasSeguidas(),
  })

  const deixarMut = useMutation({
    mutationFn: (lojaId: string) => vitrineService.alternarSeguir(lojaId, true),
    onSuccess: (_novo, lojaId) => {
      queryClient.setQueryData<LojaVitrine[]>(['vitrine', 'lojas-seguidas'], (atual) =>
        (atual ?? []).filter((l) => l.id !== lojaId),
      )
      queryClient.setQueryData(['vitrine', 'seguindo', lojaId], false)
      queryClient.invalidateQueries({ queryKey: ['vitrine', 'feed'] })
      toast.show('success', 'Deixou de seguir a loja.')
    },
    onError: () => toast.show('error', 'Não foi possível deixar de seguir.'),
  })

  const abrirLoja = useCallback(
    (id: string) => navigation.navigate('PerfilLoja', { id }),
    [navigation],
  )

  const renderItem = useCallback(
    ({ item }: { item: LojaVitrine }) => {
      const local = [item.cidade, item.estado].filter(Boolean).join(' · ')
      return (
        <Pressable
          onPress={() => abrirLoja(item.id)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            padding: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1, borderColor: colors.border,
          }}
        >
          {item.logo_url ? (
            <Image
              source={{ uri: item.logo_url }}
              style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.overlaySoft }}
              contentFit="cover"
            />
          ) : (
            <Avatar nome={item.nome} size={48} />
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Txt variant="bodySemibold" numberOfLines={1} style={{ flexShrink: 1 }}>{item.nome}</Txt>
              {item.verificada && <Ionicons name="checkmark-circle" size={14} color={colors.info} />}
            </View>
            <Txt variant="caption" color="textDim" numberOfLines={1}>
              {[local, `${item.total_veiculos} anúncio${item.total_veiculos === 1 ? '' : 's'}`]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </View>

          <Pressable
            onPress={() => deixarMut.mutate(item.id)}
            disabled={deixarMut.isPending}
            hitSlop={8}
            style={{
              paddingHorizontal: spacing.sm, paddingVertical: 6,
              borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border,
              backgroundColor: colors.overlaySoft,
            }}
          >
            <Txt variant="caption" color="textDim">Seguindo</Txt>
          </Pressable>
        </Pressable>
      )
    },
    [abrirLoja, colors, deixarMut],
  )

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Lojas que sigo" back />
      {lojasQ.isLoading ? (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : lojasQ.isError ? (
        <ErrorState onRetry={() => lojasQ.refetch()} />
      ) : (
        <FlatList
          data={lojasQ.data ?? []}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          refreshing={lojasQ.isRefetching}
          onRefresh={() => lojasQ.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="Você ainda não segue nenhuma loja"
              subtitle="Siga as lojas que te interessam para acompanhar os anúncios delas no feed."
            />
          }
        />
      )}
    </Screen>
  )
}
