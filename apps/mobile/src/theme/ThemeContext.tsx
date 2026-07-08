import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, type ThemeColors } from './tokens'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  colors: ThemeColors
  dark: boolean
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const STORAGE_KEY = 'sv-theme-mode'

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  dark: true,
  mode: 'system',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved)
    })
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }, [])

  const dark = mode === 'system' ? system !== 'light' : mode === 'dark'

  const value = useMemo(
    () => ({ colors: dark ? darkColors : lightColors, dark, mode, setMode }),
    [dark, mode, setMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
