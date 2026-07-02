import { InstitucionalLayout } from './Layout'
import { CONTATO_EMAIL } from '../../lib/contato'

export function Termos() {
  return (
    <InstitucionalLayout
      titulo="Termos de Uso"
      subtitulo="Última atualização: julho de 2026"
    >
      <div className="vt-inst-nota">
        ⚠️ Rascunho inicial. <strong>[REVISAR COM ADVOGADO]</strong> antes de considerar
        juridicamente definitivo. O texto descreve o funcionamento real da plataforma na data acima.
      </div>

      <h2>1. Aceitação</h2>
      <p>
        Ao criar uma conta ou utilizar a Social Veículos (a "Plataforma"), você concorda com estes
        Termos de Uso. Se não concordar, não utilize a Plataforma.
      </p>

      <h2>2. O que a Plataforma é</h2>
      <p>
        A Social Veículos é uma vitrine que conecta pessoas interessadas em comprar veículos às
        lojas anunciantes. <strong>Não somos parte das negociações</strong>: não vendemos veículos,
        não intermediamos pagamentos e não garantimos o estado, a procedência ou o preço dos
        veículos anunciados. A responsabilidade pelo anúncio e pela venda é integralmente da loja
        anunciante.
      </p>

      <h2>3. Sua conta</h2>
      <ul>
        <li>Você é responsável por manter a confidencialidade da sua senha.</li>
        <li>Os dados cadastrados devem ser verdadeiros e mantidos atualizados.</li>
        <li>Contas podem ser suspensas em caso de uso indevido, fraude ou violação destes Termos.</li>
      </ul>

      <h2>4. Uso aceitável</h2>
      <p>É proibido usar a Plataforma para:</p>
      <ul>
        <li>Publicar conteúdo ilícito, ofensivo, enganoso ou que viole direitos de terceiros.</li>
        <li>Coletar dados de outros usuários ou lojas sem autorização (scraping, automações).</li>
        <li>Tentar comprometer a segurança ou a disponibilidade da Plataforma.</li>
      </ul>

      <h2>5. Conteúdo dos anúncios</h2>
      <p>
        Os anúncios (fotos, descrições, preços, disponibilidade) são de responsabilidade das lojas.
        A Social Veículos pode remover conteúdo que viole estes Termos ou a lei, a qualquer momento.
      </p>

      <h2>6. Limitação de responsabilidade</h2>
      <p>
        A Plataforma é fornecida "no estado em que se encontra". Na máxima extensão permitida em lei,
        a Social Veículos não se responsabiliza por prejuízos decorrentes de negociações entre
        usuários e lojas. <strong>[REVISAR COM ADVOGADO]</strong>
      </p>

      <h2>7. Alterações</h2>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas na Plataforma. O uso
        continuado após a atualização significa concordância com a nova versão.
      </p>

      <h2>8. Contato</h2>
      <p>
        Dúvidas sobre estes Termos: <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
      </p>
    </InstitucionalLayout>
  )
}
