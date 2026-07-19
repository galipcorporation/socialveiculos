import { useEffect, useState } from 'react'

export function useDebounce<T>(valor: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(valor)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), delayMs)
    return () => clearTimeout(t)
  }, [valor, delayMs])

  return debounced
}
