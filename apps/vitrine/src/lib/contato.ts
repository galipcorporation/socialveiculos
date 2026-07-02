/**
 * Canais de contato.
 *
 * IMPORTANTE (regra de negócio): o contato de um VEÍCULO é sempre da LOJA que o
 * anuncia — use `whatsappLojaLink(loja_whatsapp, ...)`. Os canais globais abaixo
 * são só da PLATAFORMA (páginas institucionais: Sobre, Anuncie) e de SUPORTE,
 * nunca de um carro.
 *
 * Configure por env no build (Vercel): VITE_CONTATO_WHATSAPP, VITE_CONTATO_EMAIL.
 * Sem env definida, cai no e-mail de suporte da plataforma (não é loja/veículo).
 */
export const CONTATO_WHATSAPP: string =
  (import.meta.env.VITE_CONTATO_WHATSAPP as string | undefined)?.trim() || '5517991110057'

export const CONTATO_EMAIL: string =
  (import.meta.env.VITE_CONTATO_EMAIL as string | undefined)?.trim() || 'suporte@socialveiculos.com'

/** Normaliza um telefone para o formato wa.me (só dígitos, com DDI 55 se faltar). */
function normalizarWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (!digitos) return ''
  // Números BR sem DDI (10-11 dígitos) → prefixa 55.
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

/** Link wa.me para a PLATAFORMA (institucional). Não usar para veículos. */
export function whatsappLink(texto?: string): string {
  const base = `https://wa.me/${CONTATO_WHATSAPP}`
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base
}

/**
 * Link wa.me para a LOJA que anuncia o veículo. Retorna null se a loja não tem
 * WhatsApp cadastrado — nesse caso o chamador deve esconder o botão (cai no chat interno).
 */
export function whatsappLojaLink(lojaWhatsapp?: string | null, texto?: string): string | null {
  if (!lojaWhatsapp) return null
  const numero = normalizarWhatsapp(lojaWhatsapp)
  if (!numero) return null
  const base = `https://wa.me/${numero}`
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base
}
