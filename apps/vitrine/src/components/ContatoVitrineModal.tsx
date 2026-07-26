import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { whatsappLojaLink } from '../lib/contato'
import { mascararTelefone, capitalizarNome } from '../lib/mascaras'

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
          telefone: mascararTelefone(parsed.telefone || ''),
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
      <div className="vt-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="vt-modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className="vt-modal-header">
          <h3>Falar com a loja</h3>
          <p>
            Informe seus dados de contato para ser atendido pelo vendedor do{' '}
            <strong>
              {veiculoInfo.marca} {veiculoInfo.modelo}
            </strong>.
          </p>
        </div>

        {erro && <div className="vt-modal-error">{erro}</div>}

        <form onSubmit={enviar}>
          <div className="vt-form-group">
            <label htmlFor="vt-lead-nome">Seu nome completo</label>
            <input
              id="vt-lead-nome"
              className="vt-input"
              placeholder="Ex: João da Silva"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: capitalizarNome(e.target.value) })}
            />
          </div>

          <div className="vt-form-group">
            <label htmlFor="vt-lead-tel">WhatsApp / Telefone</label>
            <input
              id="vt-lead-tel"
              className="vt-input"
              placeholder="(00) 00000-0000"
              required
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: mascararTelefone(e.target.value) })}
            />
          </div>

          <div className="vt-form-group">
            <label htmlFor="vt-lead-email">E-mail (opcional)</label>
            <input
              id="vt-lead-email"
              className="vt-input"
              placeholder="seuemail@exemplo.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="vt-form-group">
            <label htmlFor="vt-lead-msg">Dúvida ou mensagem rápida (opcional)</label>
            <textarea
              id="vt-lead-msg"
              className="vt-input"
              placeholder="Ex: Aceita troca? Qual o menor valor?"
              rows={2}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>

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

