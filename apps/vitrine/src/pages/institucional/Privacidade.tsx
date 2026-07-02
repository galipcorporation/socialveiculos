import { InstitucionalLayout } from './Layout'
import { CONTATO_EMAIL } from '../../lib/contato'

export function Privacidade() {
  return (
    <InstitucionalLayout
      titulo="Política de Privacidade"
      subtitulo="Última atualização: julho de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)"
    >
      <div className="vt-inst-nota">
        ⚠️ Rascunho inicial fiel ao que a Plataforma coleta hoje.{' '}
        <strong>[REVISAR COM ADVOGADO]</strong> antes de considerar juridicamente definitivo.
      </div>

      <h2>1. Quem trata seus dados</h2>
      <p>
        A Social Veículos é a controladora dos dados coletados na vitrine pública. Para exercer seus
        direitos ou tirar dúvidas, use o canal em <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
        <strong> [REVISAR COM ADVOGADO — razão social, CNPJ e encarregado/DPO]</strong>
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail e telefone informados na criação da conta.</li>
        <li><strong>Autenticação:</strong> senha (armazenada apenas como hash, nunca em texto).</li>
        <li><strong>Uso da vitrine:</strong> veículos favoritados e lojas que você segue.</li>
        <li><strong>Mensagens:</strong> conteúdo das conversas iniciadas com as lojas pelo chat interno.</li>
        <li><strong>Dados técnicos:</strong> endereço IP e registros de acesso, para segurança e auditoria.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Permitir seu acesso e o funcionamento das funcionalidades (favoritos, chat, contato com lojas).</li>
        <li>Conectar você às lojas anunciantes quando você inicia uma conversa ou clica em contato.</li>
        <li>Segurança, prevenção a fraude e cumprimento de obrigações legais.</li>
      </ul>

      <h2>4. Compartilhamento</h2>
      <p>
        Quando você entra em contato com uma loja (chat interno ou WhatsApp), os dados necessários ao
        atendimento (como seu nome e a mensagem) são compartilhados com aquela loja. Também usamos
        provedores de infraestrutura (hospedagem, armazenamento de imagens e envio de e-mail) que
        processam dados em nosso nome. Não vendemos seus dados.
      </p>

      <h2>5. Seus direitos (LGPD)</h2>
      <p>
        Você pode solicitar a qualquer momento: confirmação e acesso aos seus dados, correção,
        anonimização, portabilidade, eliminação e revogação de consentimento. Basta escrever para{' '}
        <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
      </p>

      <h2>6. Retenção e exclusão</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir e pelo prazo necessário ao cumprimento de
        obrigações legais. Você pode pedir a exclusão da conta pelo canal acima.
        <strong> [REVISAR COM ADVOGADO — prazos legais de retenção]</strong>
      </p>

      <h2>7. Segurança</h2>
      <p>
        Adotamos medidas técnicas para proteger seus dados, incluindo senhas armazenadas com hash e
        controle de acesso. Nenhum sistema é 100% imune, mas trabalhamos para reduzir riscos.
      </p>

      <h2>8. Alterações</h2>
      <p>
        Esta Política pode ser atualizada. Mudanças relevantes serão comunicadas na Plataforma.
      </p>
    </InstitucionalLayout>
  )
}
