import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { VitrineStackParamList } from './types'
import VitrineTabs from './VitrineTabs'
import CarroDetalheScreen from '../screens/vitrine/CarroDetalheScreen'
import PerfilLojaScreen from '../screens/vitrine/PerfilLojaScreen'
import ConversaVitrineScreen from '../screens/vitrine/ConversaVitrineScreen'
import { LoginSheet } from '../components/LoginSheet'

const Stack = createNativeStackNavigator<VitrineStackParamList>()

/** Fluxo do comprador (B2C). Feed público — login só por ação (LoginSheet global). */
export default function VitrineNavigator() {
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="VitrineTabs" component={VitrineTabs} />
        <Stack.Screen name="CarroDetalhe" component={CarroDetalheScreen} />
        <Stack.Screen name="PerfilLoja" component={PerfilLojaScreen} />
        <Stack.Screen name="ConversaVitrine" component={ConversaVitrineScreen} />
      </Stack.Navigator>
      <LoginSheet />
    </>
  )
}
