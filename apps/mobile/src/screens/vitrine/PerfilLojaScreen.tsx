import React from 'react'
import { FlatList, Linking, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, spacing } from '../../theme/tokens'
import {
  AppHeader, Avatar, Button, EmptyState, Screen, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { AnuncioCard } from './AnuncioCard'
import { vitrineService } from '../../services'
import { useGateLogin } from '../../hooks/useGateLogin'
import { useAuthStore } from '../../stores/authStore'
import type { VitrineScreenProps } from '../../navigation/types'

export default function PerfilLojaScreen({ route }: VitrineScreenProps<'PerfilLoja'>) {
  const { id } = route.params
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const comLogin = useGateLogin()

  const isAuth = useAuthStore((s) => s.isAuthenticated)

  const lojaQ = useQuery({ queryKey: ['vitrine', 'loja', id], queryFn: () => vitrineService.loja(id) })
  const veicQ = useQuery({ queryKey: ['vitrine', 'loja-veiculos', id], queryFn: () => vitrineService.veiculosDaLoja(id) })
  const seguindoQ = useQuery({
    queryKey: ['vitrine', 'seguindo', id],
    queryFn: () => vitrineService.checarSeguindo(id),
    enabled: isAuth,
  })
  const loja = lojaQ.data
  const seguindo = seguindoQ.data ?? false

  const seguirMut = useMutation({
    mutationFn: () => vitrineService.alternarSeguir(id, seguindo),
    onSuccess: (novo) => {
      queryClient.setQueryData(['vitrine', 'seguindo', id], novo)
      toast.show('success', novo ? 'Você está seguindo esta loja.' : 'Deixou de seguir.')
    },
    onError: () => toast.show('error', 'Não foi possível atualizar.'),
  })

  const alternarSeguir = () =>
    comLogin('Entre para seguir lojas.', () => seguirMut.mutateAsync())

  const favoritar = (anuncioId: string) =>
    comLogin('Entre para salvar seus favoritos.', async () => {
      await vitrineService.alternarFavorito(anuncioId)
      queryClient.invalidateQueries({ queryKey: ['vitrine'] })
    })

  const whatsapp = async () => {
    if (!loja?.whatsapp) { toast.show('info', 'Loja sem WhatsApp cadastrado.'); return }
    const url = `https://wa.me/55${loja.whatsapp.replace(/\D/g, '')}`
    const ok = await Linking.canOpenURL(url)
    if (ok) Linking.openURL(url)
    else toast.show('info', 'Não foi possível abrir o WhatsApp.')
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title={loja?.nome ?? 'Loja'} large={false} back />
      {lojaQ.isLoading ? (
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      ) : !loja ? (
        <EmptyState icon="business-outline" title="Loja indisponível" subtitle="Não foi possível carregar esta loja." />
      ) : (
        <FlatList
          data={veicQ.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar nome={loja.nome} size={60} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Txt style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text }} numberOfLines={1}>{loja.nome}</Txt>
                    {loja.verificada && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                  </View>
                  <Txt variant="caption" color="textDim">
                    {[loja.cidade && loja.estado ? `${loja.cidade}/${loja.estado}` : null, `${loja.total_veiculos} veículos`].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={seguindo ? 'Seguindo' : 'Seguir'}
                  variant={seguindo ? 'tonal' : 'outline'}
                  icon={seguindo ? 'checkmark' : 'add'}
                  loading={seguirMut.isPending}
                  onPress={alternarSeguir}
                  style={{ flex: 1 }}
                />
                <Button title="WhatsApp" variant="success" icon="logo-whatsapp" onPress={whatsapp} style={{ flex: 1 }} />
              </View>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase', marginTop: spacing.xs }}>Estoque da loja</Txt>
            </View>
          }
          ListEmptyComponent={
            veicQ.isLoading
              ? <SkeletonCard />
              : <EmptyState icon="car-outline" title="Sem veículos" subtitle="Esta loja não tem anúncios ativos." />
          }
          renderItem={({ item }) => (
            <AnuncioCard
              anuncio={item}
              onPress={() => navigation.navigate('CarroDetalhe', { id: item.id })}
              onFavorito={() => favoritar(item.id)}
            />
          )}
        />
      )}
    </Screen>
  )
}
