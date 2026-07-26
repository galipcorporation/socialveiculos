import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { whatsappLojaLink } from '../lib/contato'

export interface ContatoVitrineModalProps {
  veiculoId: string
  veiculoInfo: {
    marca: string
    modelo: string
    ano_modelo?: number
    loja_whatsapp?: string
  }
  onClose: () => void
}

const LOCAL_STORAGE_KEY = 'sv_vitrine_comprador'

export function ContatoVitrineModal({ veiculoId, veiculoInfo, onClose }: ContatoVitrineModalProps) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', mensagem: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (salvo) {
        const parsed = JSON.parse(salvo)
        setForm((f) => ({
          ...f,
          nome: parsed.nome || '',
          telefone: parsed.telefone || '',
          email: parsed.email || '',
        }))
      }
    } catch {
      // Ignora erro de localStorage
    }
  }, [])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.telefone.trim()) {
      setErro('Por favor, informe seu nome e telefone.')
      return
    }

    setEnviando(true)
    setErro('')

    try {
      // Salvar preferência do comprador no localStorage
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            nome: form.nome.trim(),
            telefone: form.telefone.trim(),
            email: form.email.trim(),
          })
        )
      } catch {
        // Ignora erro de localStorage
      }

      const res = await api.post<{ ok: boolean; whatsapp_url?: string }>('/marketplace/lead-vitrine', {
        veiculo_id: veiculoId,
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim() || undefined,
        mensagem: form.mensagem.trim() || undefined,
      })

      const msgWa = `Olá! Meu nome é ${form.nome.trim()}. Tenho interesse no ${veiculoInfo.marca} ${veiculoInfo.modelo} ${veiculoInfo.ano_modelo || ''} que vi na Vitrine.`
      const fallbackUrl = whatsappLojaLink(veiculoInfo.loja_whatsapp, msgWa)
      const targetUrl = res.whatsapp_url || fallbackUrl

      onClose()

      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cadastrar o interesse. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div className="vt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="vt-modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <form onSubmit={enviar}>
          <h3 style={{ marginBottom: 4 }}>Falar com a loja</h3>
          <p style={{ color: 'var(--vt-text-dim)', fontSize: 13, marginBottom: 16 }}>
            Informe seus dados de contato para ser atendido pelo vendedor do{' '}
            <strong>
              {veiculoInfo.marca} {veiculoInfo.modelo}
            </strong>.
          </p>

          <input
            className="vt-input"
            placeholder="Seu nome completo"
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />

          <input
            className="vt-input"
            placeholder="WhatsApp / Telefone (com DDD)"
            required
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            style={{ marginTop: 10 }}
          />

          <input
            className="vt-input"
            placeholder="E-mail (opcional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ marginTop: 10 }}
          />

          <textarea
            className="vt-input"
            placeholder="Dúvida ou mensagem rápida (opcional)"
            rows={2}
            value={form.mensagem}
            onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            style={{ marginTop: 10, resize: 'vertical' }}
          />

          {erro && <p style={{ color: 'var(--vt-error, #dc2626)', fontSize: 13, marginTop: 10 }}>{erro}</p>}

          <button
            className="vt-btn vt-btn-primary vt-btn-block"
            type="submit"
            disabled={enviando}
            style={{ marginTop: 16 }}
          >
            {enviando ? 'Conectando à loja…' : 'Continuar para o WhatsApp 💬'}
          </button>
        </form>
      </div>
    </div>
  )
}
