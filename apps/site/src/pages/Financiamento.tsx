import { useState } from 'react'
import { enviarLead, type SitePublicoResponse } from '../lib/api'
import { SiteHeader, SiteFooter } from '../components/SiteHeader'

export function Financiamento({ dados }: { dados: SitePublicoResponse }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro(false)
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const ok = await enviarLead({
      host,
      nome,
      telefone,
      mensagem: 'Interesse em financiamento — solicitado pela página Financiamento do site.',
    })
    setEnviando(false)
    if (ok) {
      setEnviado(true)
      setNome('')
      setTelefone('')
    } else {
      setErro(true)
    }
  }

  return (
    <>
      <SiteHeader dados={dados} />
      <div className="site-container">
        <section className="site-section" style={{ borderTop: 'none', maxWidth: 480 }}>
          <h2 className="site-section-titulo">Financiamento</h2>
          <p>Deixe seus dados que a equipe da {dados.loja.nome} entra em contato com as condições de financiamento disponíveis.</p>
          {enviado ? (
            <p style={{ marginTop: 16 }}>Recebemos seu interesse! Em breve entraremos em contato.</p>
          ) : (
            <form onSubmit={submit} style={{ marginTop: 16 }}>
              {erro && <p style={{ color: 'var(--site-error, #ef4444)', marginBottom: 12 }}>Não foi possível enviar. Tente novamente.</p>}
              <div className="site-form-group">
                <label>Nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
              </div>
              <div className="site-form-group">
                <label>Telefone / WhatsApp</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required minLength={8} />
              </div>
              <button type="submit" className="site-form-submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Quero saber mais'}
              </button>
            </form>
          )}
        </section>
      </div>
      <SiteFooter dados={dados} />
    </>
  )
}
