import { createContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';

export interface ExtensionState {
  /** null = verificando, true = instalada, false = ausente */
  isInstalled: boolean | null;
  /** true enquanto um ping ativo está em andamento */
  isChecking: boolean;
  /** Refaz a verificação manualmente */
  recheck: () => Promise<boolean>;
}

export const ExtensionContext = createContext<ExtensionState>({
  isInstalled: null,
  isChecking: true,
  recheck: async () => false,
});

// URLs da extensão
export const CHROME_STORE_URL =
  import.meta.env.VITE_EXTENSION_URL ||
  'https://chromewebstore.google.com/detail/simulador-f%C3%A1cil-automa%C3%A7%C3%A3o/omdlpfpgknkbllhjmckbalniecfickjj?hl=pt-BR';

/** Timeout para resposta ao ping (ms) */
const PING_TIMEOUT = 500;

export function ExtensionProvider({ children }: { children: ReactNode }) {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const resolvedRef = useRef(false);

  /**
   * Envia um ping e espera resposta da extensão.
   * Retorna `true` se recebeu resposta, `false` se timeout.
   */
  const pingExtension = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let listener: ((event: MessageEvent) => void) | null = null;
      let settled = false;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (listener) window.removeEventListener('message', listener);
      };

      listener = (event: MessageEvent) => {
        const type = event.data?.type;
        if (
          type === 'SF_EXTENSION_READY' ||
          type === 'EXTENSION_PONG' ||
          (typeof type === 'string' && type.startsWith('SF_') && type !== 'SF_PING_EXTENSION')
        ) {
          cleanup();
          resolve(true);
        }
      };

      window.addEventListener('message', listener);

      // Envia os dois formatos para compatibilidade com extensões antigas/novas
      window.postMessage({ type: 'SF_PING_EXTENSION' }, '*');
      window.postMessage({ type: 'EXTENSION_PING', payload: {} }, '*');

      timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, PING_TIMEOUT);
    });
  }, []);

  /**
   * Verifica se a extensão está instalada.
   * Pode ser chamada manualmente (ex: botão "Verificar Novamente").
   */
  const recheck = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const result = await pingExtension();
      setIsInstalled(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  }, [pingExtension]);

  // ── Verificação inicial com retry ──
  useEffect(() => {
    resolvedRef.current = false;
    let cancelled = false;

    const runChecks = async () => {
      // Tentativa 1 — 500ms
      const first = await pingExtension();
      if (cancelled) return;
      if (first) {
        setIsInstalled(true);
        setIsChecking(false);
        resolvedRef.current = true;
        return;
      }

      // Tentativa 2 — mais 500ms (máquinas lentas)
      const second = await pingExtension();
      if (cancelled) return;
      setIsInstalled(second);
      setIsChecking(false);
      resolvedRef.current = true;
    };

    runChecks();
    return () => { cancelled = true; };
  }, [pingExtension]);

  // ── Listener passivo permanente ──
  // Se a extensão enviar qualquer mensagem SF_* a qualquer momento, detectamos
  useEffect(() => {
    const passiveListener = (event: MessageEvent) => {
      const type = event.data?.type;
      if (typeof type === 'string' && type.startsWith('SF_') && type !== 'SF_PING_EXTENSION') {
        setIsInstalled(true);
      }
      if (type === 'EXTENSION_PONG') {
        setIsInstalled(true);
      }
    };

    window.addEventListener('message', passiveListener);
    return () => window.removeEventListener('message', passiveListener);
  }, []);

  // ── Token Sync ──
  // Sincroniza o token do localStorage com a extensão periodicamente
  useEffect(() => {
    const syncToken = () => {
      const token = localStorage.getItem('token');
      if (token && isInstalled) {
        window.postMessage({ type: 'SF_SYNC_TOKEN', token }, '*');
      }
    };

    syncToken();
    const interval = setInterval(syncToken, 10_000); // a cada 10s
    return () => clearInterval(interval);
  }, [isInstalled]);

  return (
    <ExtensionContext.Provider value={{ isInstalled, isChecking, recheck }}>
      {children}
    </ExtensionContext.Provider>
  );
}
