import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { fonts } from '../theme/tokens'
import type { VitrineTabsParamList } from './types'
import FeedScreen from '../screens/vitrine/FeedScreen'
import BuscarScreen from '../screens/vitrine/BuscarScreen'
import MensagensScreen from '../screens/vitrine/MensagensScreen'
import PerfilScreen from '../screens/vitrine/PerfilScreen'

const Tab = createBottomTabNavigator<VitrineTabsParamList>()

const ICONS: Record<keyof VitrineTabsParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Feed: { on: 'compass', off: 'compass-outline' },
  Buscar: { on: 'search', off: 'search-outline' },
  Mensagens: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  Perfil: { on: 'person', off: 'person-outline' },
}

export default function VitrineTabs() {
  const { colors } = useTheme()
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={focused ? ICONS[route.name].on : ICONS[route.name].off} size={size - 2} color={color} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Descobrir' }} />
      <Tab.Screen name="Buscar" component={BuscarScreen} />
      <Tab.Screen name="Mensagens" component={MensagensScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  )
}
