import { InstitucionalLayout } from './Layout'
import { whatsappLink, CONTATO_EMAIL } from '../../lib/contato'

export function Anuncie() {
  const msg = 'Olá! Tenho uma loja de veículos e quero anunciar meu estoque na Social Veículos.'
  return (
    <InstitucionalLayout
      titulo="Anuncie sua loja"
      subtitulo="Coloque seu estoque na frente de compradores da sua cidade."
    >
      <p>
        A Social Veículos reúne, num feed social, os veículos das lojas da região. Sua loja ganha
        vitrine pública com SEO, chat com o comprador e uma ponte direta para o WhatsApp — além do
        painel de gestão de estoque, clientes e vendas.
      </p>

      <h2>O que sua loja recebe</h2>
      <ul>
        <li>Vitrine pública dos seus veículos, otimizada para busca no Google.</li>
        <li>Chat interno com compradores e integração com WhatsApp.</li>
        <li>Painel de estoque, CRM de clientes e acompanhamento de vendas.</li>
      </ul>

      <h2>Quero anunciar</h2>
      <p>
        No momento o cadastro de lojas é feito com atendimento direto da nossa equipe. Chame no
        WhatsApp que a gente coloca sua loja no ar:
      </p>
      <a className="vt-inst-cta" href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer">
        Falar no WhatsApp
      </a>
      <p style={{ marginTop: 16 }}>
        Prefere e-mail? Escreva para{' '}
        <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
      </p>
    </InstitucionalLayout>
  )
}
