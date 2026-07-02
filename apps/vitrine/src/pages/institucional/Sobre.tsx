import { InstitucionalLayout } from './Layout'
import { whatsappLink } from '../../lib/contato'

export function Sobre() {
  return (
    <InstitucionalLayout
      titulo="Sobre a Social Veículos"
      subtitulo="A rede social de carros da sua região."
    >
      <p>
        A Social Veículos é uma vitrine social onde você acompanha, em um feed, os veículos
        anunciados pelas lojas parceiras da sua cidade. Diferente de um classificado tradicional,
        aqui você segue lojas, favorita carros e conversa direto com quem vende — tudo em um só lugar.
      </p>

      <h2>Como funciona</h2>
      <ul>
        <li><strong>Explore o feed:</strong> role e descubra carros anunciados perto de você.</li>
        <li><strong>Favorite:</strong> salve os veículos que te interessam para ver depois.</li>
        <li><strong>Converse:</strong> fale com a loja pelo chat interno ou pelo WhatsApp.</li>
      </ul>

      <h2>Para lojas</h2>
      <p>
        É lojista e quer anunciar seu estoque na vitrine e organizar suas vendas?{' '}
        <a href={whatsappLink('Olá! Quero saber como anunciar minha loja na Social Veículos.')}
           target="_blank" rel="noopener noreferrer">
          Fale com a gente
        </a>.
      </p>
    </InstitucionalLayout>
  )
}
