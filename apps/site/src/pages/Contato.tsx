import { useState } from 'react'
import { enviarLead, type SitePublicoResponse } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'
import { mascararTelefone, validarTelefone, validarEmail } from '../lib/mascaras'

export function Contato({ dados }: { dados: SitePublicoResponse }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState(false)
  const [erroValidacao, setErroValidacao] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroValidacao('')
    if (!validarTelefone(telefone)) {
      setErroValidacao('Informe um telefone válido com DDD (ex.: (11) 98765-4321).')
      return
    }
    if (email && !validarEmail(email)) {
      setErroValidacao('Informe um e-mail válido.')
      return
    }
    setEnviando(true)
    setErro(false)
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const ok = await enviarLead({ host, nome, telefone, email: email || undefined, mensagem: mensagem || undefined })
    setEnviando(false)
    if (ok) {
      setEnviado(true)
      setNome('')
      setTelefone('')
      setEmail('')
      setMensagem('')
    } else {
      setErro(true)
    }
  }

  return (
    <>
      <SiteHeader dados={dados} />
      <div className="site-container">
        <section className="site-section" style={{ borderTop: 'none', maxWidth: 480 }}>
          <h2 className="site-section-titulo">Fale conosco</h2>
          {enviado ? (
            <p>Recebemos sua mensagem! Em breve entraremos em contato.</p>
          ) : (
            <form onSubmit={submit}>
              {erro && <p style={{ color: 'var(--site-error, #ef4444)', marginBottom: 12 }}>Não foi possível enviar. Tente novamente.</p>}
              {erroValidacao && <p style={{ color: 'var(--site-error, #ef4444)', marginBottom: 12 }}>{erroValidacao}</p>}
              <div className="site-form-group">
                <label>Nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
              </div>
              <div className="site-form-group">
                <label>Telefone / WhatsApp</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  required
                  inputMode="tel"
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                />
              </div>
              <div className="site-form-group">
                <label>E-mail (opcional)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="site-form-group">
                <label>Mensagem (opcional)</label>
                <textarea rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
              </div>
              <button type="submit" className="site-form-submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar mensagem'}
              </button>
            </form>
          )}
        </section>
      </div>
      <SiteFooter dados={dados} />
    </>
  )
}
