import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import DashboardScreen from '../screens/DashboardScreen'
import CrmScreen from '../screens/CrmScreen'
import EstoqueScreen from '../screens/EstoqueScreen'
import ChatScreen from '../screens/ChatScreen'
import MaisScreen from '../screens/MaisScreen'

export type MainTabsParamList = {
  Dashboard: undefined
  CRM: undefined
  Estoque: undefined
  Chat: undefined
  Mais: undefined
}

const Tab = createBottomTabNavigator<MainTabsParamList>()

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#0B0F1A', borderTopColor: '#2A3345' },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9AA5B1',
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="CRM" component={CrmScreen} />
      <Tab.Screen name="Estoque" component={EstoqueScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Mais" component={MaisScreen} />
    </Tab.Navigator>
  )
}
