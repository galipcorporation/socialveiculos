import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../theme/ThemeContext'
import { fonts } from '../theme/tokens'
import { chatService } from '../services'
import type { MainTabsParamList } from './types'
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import EstoqueScreen from '../screens/estoque/EstoqueScreen'
import CrmScreen from '../screens/crm/CrmScreen'
import ChatScreen from '../screens/chat/ChatScreen'
import MaisScreen from '../screens/mais/MaisScreen'

const Tab = createBottomTabNavigator<MainTabsParamList>()

const ICONS: Record<keyof MainTabsParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Inicio: { on: 'home', off: 'home-outline' },
  Estoque: { on: 'car-sport', off: 'car-sport-outline' },
  CRM: { on: 'people', off: 'people-outline' },
  Chat: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  Mais: { on: 'grid', off: 'grid-outline' },
}

export default function MainTabs() {
  const { colors } = useTheme()
  const { data: naoLidas } = useQuery({
    queryKey: ['chat', 'nao-lidas'],
    queryFn: () => chatService.totalNaoLidas(),
    staleTime: 45_000,
    refetchInterval: 60_000,
  })

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={focused ? ICONS[route.name].on : ICONS[route.name].off}
            size={size - 2}
            color={color}
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      })}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Estoque" component={EstoqueScreen} />
      <Tab.Screen name="CRM" component={CrmScreen} />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarBadge: naoLidas ? naoLidas : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            color: '#fff',
            fontFamily: fonts.semibold,
            fontSize: 11,
          },
        }}
      />
      <Tab.Screen name="Mais" component={MaisScreen} />
    </Tab.Navigator>
  )
}
