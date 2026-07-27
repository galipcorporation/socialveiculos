import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { parseModulos, podeAcessarModulo, type ModuloKey } from '../lib/modulos'

/* ── Dados dos Tópicos ────────────────────────────────────────── */

interface Passo {
  texto: string
  dica?: string
}

interface Topico {
  id: string
  titulo: string
  icone: string       // SVG path d
  descricao: string
  imagem?: string     // caminho relativo em /ajuda/
  passos: Passo[]
  modulo?: ModuloKey  // se definido, só aparece quando o usuário tem acesso
  gestorOnly?: boolean // só aparece para gestor/admin da loja ou da plataforma
  adminOnly?: boolean  // só aparece para admin_plataforma
}

interface FaqItem {
  pergunta: string
  resposta: string
  gestorOnly?: boolean
  adminOnly?: boolean
}

const TOPICOS: Topico[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros Passos',
    icone: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    descricao: 'Aprenda a fazer login, navegar pelo menu lateral e utilizar os atalhos do SocialVeículos.',
    passos: [
      { texto: 'Acesse o sistema pelo endereço da sua loja ou plataforma e informe seu e-mail e senha cadastrados.' },
      { texto: 'Após a autenticação, você será direcionado ao Dashboard inicial, onde vê um resumo em tempo real da loja.' },
      { texto: 'No lado esquerdo fica a Sidebar com todas as seções: Dashboards, Rede Social, Clientes (CRM), Estoque, Pós-venda, Financeiro, Aprovações, Equipe e o menu expansível de Ferramentas.' },
      { texto: 'No canto superior direito, utilize o seu avatar para acessar as Configurações da loja ou encerrar a sessão (Sair).' },
      { texto: 'No topo, alterne entre o tema escuro e claro clicando no ícone de sol/lua conforme sua preferência visual.' },
    ],
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    icone: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
    descricao: 'Acompanhe os principais indicadores de desempenho (KPIs), atalhos de acesso rápido e alertas em tempo real.',
    imagem: '/ajuda/dashboard.png',
    passos: [
      { texto: 'O Dashboard traz 4 cards de KPIs principais no topo: Estoque Ativo, Leads Ativos, Vendas do Mês e Receita do Mês.' },
      { texto: 'Logo abaixo dos KPIs, o painel de Acesso Rápido traz botões para navegar direto para as telas que você mais utiliza.' },
      { texto: 'No painel de Alertas, o sistema avisa automaticamente sobre pendências importantes, como veículos sem foto ou cadastros incompletos.' },
      { texto: 'Os indicadores refletem com precisão os dados exclusivos da sua loja.', dica: 'Cada concessionária vê estritamente seus próprios dados de forma isolada.' },
    ],
  },
  {
    id: 'estoque',
    titulo: 'Estoque de Veículos',
    modulo: 'estoque' as const,
    icone: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 002 12v4c0 .6.4 1 1 1h2',
    descricao: 'Cadastre veículos, faça upload de fotos/vídeos, publique na Vitrine B2C, poste no Feed de Repasses B2B e feche vendas.',
    imagem: '/ajuda/estoque.png',
    passos: [
      { texto: 'Acesse "Estoque" no menu lateral. No topo, consulte o Total no Estoque, Disponíveis e Publicados na Vitrine.' },
      { texto: 'Clique em "Novo Veículo" para cadastrar. Preencha marca e modelo com autocomplete integrado ao catálogo FIPE, além de ano, placa, cor, combustível, câmbio, km, preço de compra e preço de venda.' },
      { texto: 'Na aba de mídias, faça upload de fotos e vídeos. Defina a foto de capa — ela aparecerá nos cards e na vitrine pública.' },
      { texto: 'Ative o toggle "Vitrine" para disponibilizar o veículo no marketplace público (B2C).', dica: 'Para ser publicado na Vitrine, o veículo deve ter status "Disponível" e pelo menos 1 foto.' },
      { texto: 'Ative o botão "Feed de Repasses" para ofertar o veículo diretamente para outras concessionárias parceiras na Rede Social B2B.' },
      { texto: 'Utilize a ação de fechar venda ($) para registrar o comprador e valor final: o veículo é marcado como vendido, o contrato é gerado e a esteira de Pós-venda é criada automaticamente.' },
      { texto: 'Ações de exclusão de veículo ou alteração de preço enviadas por vendedores disparam uma solicitação pendente para aprovação do Gestor.', dica: 'Gestores podem aprovar ou rejeitar reajustes e exclusões solicitados pela equipe na tela de Aprovações.' },
    ],
  },
  {
    id: 'crm',
    titulo: 'CRM — Clientes e Leads',
    modulo: 'crm' as const,
    icone: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm10 1v6m3-3h-6',
    descricao: 'Gerencie sua carteira de clientes e acompanhe todas as oportunidades de venda no funil Kanban de 5 etapas.',
    imagem: '/ajuda/crm.png',
    passos: [
      { texto: 'Acesse "Clientes (CRM)" no menu lateral. A página é dividida em duas abas: "Clientes" e "Funil de Vendas (CRM)".' },
      { texto: 'Na aba "Clientes", cadastre e edite pessoas físicas/jurídicas com CPF/CNPJ, CNH, renda mensal, profissão e endereço completo com busca automática por CEP.' },
      { texto: 'Na aba "Funil de Vendas", o quadro Kanban organiza os leads em 5 colunas: Lead Recebido, Proposta Enviada, Em Negociação, Fechamento e Perdido.' },
      { texto: 'Clique em "Novo Lead" para abrir uma oportunidade vinculando um cliente da carteira e um veículo de interesse do estoque.' },
      { texto: 'Arraste os cards entre as colunas para atualizar a etapa no funil. Ao mover para "Perdido", selecione o motivo da perda (preço, crédito negado, comprou no concorrente, etc.) para alimentar as estatísticas da loja.' },
      { texto: 'Clique em qualquer card para abrir os detalhes do lead: adicione histórico de interações (notas, ligações, WhatsApp, visitas) e simule propostas.', dica: 'Toda conversa iniciada por um cliente na Vitrine B2C vira um Lead com origem "Vitrine" automaticamente no CRM.' },
    ],
  },
  {
    id: 'pos-venda',
    titulo: 'Pós-venda',
    icone: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    descricao: 'Acompanhe a esteira de procedimentos pós-venda: emissão de contrato, quitação, documentação e transferência do veículo.',
    imagem: '/ajuda/posvenda.png',
    passos: [
      { texto: 'Acesse "Pós-venda" no menu lateral. A tela organiza as esteiras em 4 estágios: Contrato, Pagamento, Documentos e Transferência.' },
      { texto: 'A esteira de pós-venda é criada de forma automática sempre que uma venda é registrada no Estoque ou no CRM.' },
      { texto: 'Clique em um card de pós-venda para abrir a esteira e marcar as tarefas concluídas no checklist de cada etapa.' },
      { texto: 'Conforme os itens são checados, a barra de progresso avança. Ao concluir todas as etapas, a esteira é movida para finalizadas.', dica: 'Gestores podem personalizar os itens de checklist exigidos por etapa em cada contrato de venda.' },
    ],
  },
  {
    id: 'aprovacoes',
    titulo: 'Fila e Histórico de Aprovações',
    gestorOnly: true,
    icone: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
    descricao: 'Central de controle para o Gestor aprovar ou rejeitar reajustes de preço e exclusões de veículos solicitados por vendedores.',
    passos: [
      { texto: 'Acesse "Aprovações" no menu lateral (exclusivo para Gestores e Administradores da plataforma).' },
      { texto: 'Em "Fila de Aprovações", veja todas as solicitações pendentes enviadas pelos vendedores, incluindo o vendedor requisitante, veículo, motivo e o preço atual vs. o preço proposto.' },
      { texto: 'Para aprovar uma alteração de preço ou exclusão de veículo, clique no botão "Aprovar" e confirme.' },
      { texto: 'Para recusar, clique em "Rejeitar", informe a justificativa obrigatória (ex.: "Preço proposto abaixo da margem mínima") e confirme.', dica: 'O vendedor recebe a notificação da decisão com a justificativa registrada.' },
      { texto: 'Alterne para o botão "Ver histórico" no topo para consultar todas as solicitações processadas no passado com data e responsável.' },
    ],
  },
  {
    id: 'minhas-comissoes',
    titulo: 'Minhas Comissões',
    icone: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    descricao: 'Painel individual do vendedor para acompanhar as vendas realizadas, a porcentagem de comissão e o status de pagamento.',
    passos: [
      { texto: 'Acesse "Minhas Comissões" no menu lateral.' },
      { texto: 'A tabela exibe a lista de veículos vendidos por você, a data da venda, o valor total do veículo, a porcentagem (%) de comissão atribuída e o valor líquido a receber.' },
      { texto: 'Acompanhe o status de cada comissão: "Definir %" (aguardando gestor definir o percentual), "Pendente" (comissão aprovada aguardando pagamento) e "Paga" (comissão quitada).' },
      { texto: 'Use os filtros no topo ("Todas", "Pendentes", "Pagas") para filtrar rapidamente os valores do seu extrato.', dica: 'Os percentuais e acertos de comissão são gerenciados pelo Gestor na seção Financeiro.' },
    ],
  },
  {
    id: 'rede-social',
    titulo: 'Rede Social B2B',
    icone: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 0v2a4 4 0 01-3 3.87M16 3.13a4 4 0 010 7.75',
    descricao: 'Conecte-se com outras concessionárias parceiras: navegue pelo feed de repasses, troque propostas e negocie no chat em tempo real.',
    imagem: '/ajuda/redesocial.png',
    passos: [
      { texto: 'Acesse "Rede Social" no menu lateral. A página é dividida em 4 abas: Feed de Repasses, Propostas, Parceiros e Chat.' },
      { texto: 'No Feed de Repasses, veja oportunidades publicadas por outras concessionárias ativas no sistema. Curta, comente ou envie uma proposta direta de repasse.' },
      { texto: 'Na aba "Propostas", acompanhe as ofertas de compra/troca enviadas para suas publicações ou recebidas de parceiros, com opções para aceitar, recusar ou contrapropor.' },
      { texto: 'No "Diretório de Parceiros", encontre lojas parceiras por nome, cidade ou UF para expadir sua rede de contatos.' },
      { texto: 'O Chat B2B permite mensagens instantâneas com outros lojistas.', dica: 'Quando chegam novas mensagens não lidas no Chat, um indicador numérico (badge) aparece no menu lateral.' },
    ],
  },
  {
    id: 'vitrine-b2c',
    titulo: 'Vitrine B2C & Marketplace Público',
    icone: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    descricao: 'Entenda como a Vitrine pública (estilo rede social de veículos) atrai compradores finais e gera novos leads para a sua loja.',
    passos: [
      { texto: 'A Vitrine B2C é a portal público de busca e descoberta de veículos para consumidores finais.' },
      { texto: 'Veículos com o toggle "Publicar na Vitrine" ativado no Estoque (e com foto cadastrada) aparecem automaticamente no feed rolável da Vitrine.' },
      { texto: 'O consumidor navega livremente sem precisar de cadastro prévio. Ao tentar favoritar um carro, enviar mensagem ou ver o WhatsApp, um modal simples de login/cadastro é exibido.' },
      { texto: 'Quando o comprador clica em conversar com a loja na Vitrine, uma mensagem é iniciada e um **Lead com origem Vitrine** entra instantaneamente no CRM da sua loja.', dica: 'Dados internos da loja (preço de custo, margem de lucro, dados de repasse) jamais aparecem na Vitrine B2C.' },
    ],
  },
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    modulo: 'financeiro' as const,
    icone: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    descricao: 'Gerencie o fluxo de caixa da concessionária, lançamentos de receitas/despesas e acertos de comissão da equipe.',
    imagem: '/ajuda/financeiro.png',
    passos: [
      { texto: 'Acesse "Financeiro" no menu lateral. No topo, consulte o resumo de Receitas, Despesas e Saldo do período.' },
      { texto: 'Na tabela de Lançamentos, veja todas as entradas e saídas de caixa. Filtre por período ou busque por descrição.' },
      { texto: 'Clique em "Novo Lançamento" para cadastrar movimentações manuais (despesas operacionais, manutenção, vendas, etc.).' },
      { texto: 'Na aba "Comissões", o Gestor define a porcentagem de comissão de cada vendedor por venda realizada, aprova os valores calculados e confirma a liquidação/pagamento.', dica: 'Valores financeiros utilizam formatação monetária brasileira (R$) padronizada.' },
    ],
  },
  {
    id: 'simulador',
    titulo: 'Simulador de Crédito',
    modulo: 'simulador' as const,
    icone: 'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V4a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-3',
    imagem: '/ajuda/simulador.png',
    descricao: 'Simule financiamento de veículos simultaneamente em bancos parceiros (BV, C6, Itaú, Santander, Pan, Bradesco) e gere propostas em PDF.',
    passos: [
      { texto: 'Acesse "Ferramentas → Simulador" no menu lateral. Em primeiro lugar, certifique-se de cadastrar as credenciais das financeiras em Configurações.' },
      { texto: 'Selecione os bancos nos quais deseja rodar a simulação nos cards das instituições parceiras.' },
      { texto: 'No campo CPF do Cliente, ao digitar o número, o sistema carrega automaticamente os dados cadastrados no CRM. Informe também a data de nascimento.' },
      { texto: 'Selecione o veículo do estoque clicando na busca por placa ou digitação manual. O preço de venda e entrada padrão são calculados automaticamente.' },
      { texto: 'Clique em "Simular Financiamento". As propostas de cada financeira aparecem lado a lado com valor de parcela, taxas e prazos.' },
      { texto: 'Clique em "Imprimir Proposta" para gerar um documento PDF pronto com o comparativo bancário para entregar ou enviar ao comprador.', dica: 'A automação dos portais bancários depende da extensão "Simulador Fácil" ativa no Google Chrome em computador desktop.' },
    ],
  },
  {
    id: 'contratos',
    titulo: 'Contratos',
    modulo: 'contratos' as const,
    icone: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    imagem: '/ajuda/contratos.png',
    descricao: 'Gere minutas e contratos de Compra e Venda, Consignação, Termo de Garantia, Promissória e Procuração com preenchimento automático.',
    passos: [
      { texto: 'Acesse "Ferramentas → Contratos" no menu lateral. Acompanhe no topo o total de contratos e o status (Rascunho, Aguardando, Assinado, Cancelado).' },
      { texto: 'Clique em "Novo Contrato" e escolha o modelo desejado (Compra e Venda, Consignação, Termo de Garantia, etc.).' },
      { texto: 'Selecione o cliente e o veículo na lista. Todos os campos de qualificação (CPF/CNPJ, endereço, chassi, placa, ano, cor) são preenchidos automaticamente.' },
      { texto: 'Defina as condições financeiras (valor de venda, entrada, saldo financiado, parcelas e observações operacionais).' },
      { texto: 'Ao salvar, o contrato fica disponível em formato PDF pronto para impressão ou assinatura digital.' },
      { texto: 'Utilize o botão verde do WhatsApp para enviar o link/documento diretamente ao cliente.', dica: 'Vendas concluídas na tela de Estoque geram o contrato de compra e venda correspondente de forma automática.' },
    ],
  },
  {
    id: 'fipe',
    titulo: 'Consulta Tabela FIPE',
    icone: 'M9 17h6M12 3v14M5 8l7-5 7 5',
    descricao: 'Consulte valores oficiais de referência da Tabela FIPE para carros, motos e caminhões em um assistente guiado em 4 passos.',
    passos: [
      { texto: 'Acesse "Ferramentas → Consulta FIPE" no menu lateral.' },
      { texto: 'Passo 1: Escolha o Tipo de Veículo (Carro, Moto ou Caminhão).' },
      { texto: 'Passo 2: Selecione a Marca do veículo na lista atualizada.' },
      { texto: 'Passo 3: Selecione o Modelo desejado.' },
      { texto: 'Passo 4: Selecione o Ano/Modelo de fabricação.' },
      { texto: 'Clique em "Consultar FIPE". O sistema exibe o Valor FIPE de referência oficial imediatamente na tela.', dica: 'Esta ferramenta é perfeita para avaliar veículos oferecidos como entrada ou calcular valores de repasse sem precisar cadastrar o veículo no estoque.' },
    ],
  },
  {
    id: 'marketing',
    titulo: 'Marketing & Gerador de Posts com IA',
    modulo: 'marketing' as const,
    icone: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 11-5.8-1.6',
    imagem: '/ajuda/marketing.png',
    descricao: 'Crie anúncios profissionais com Inteligência Artificial a partir do estoque e agende publicações no Instagram e Facebook.',
    passos: [
      { texto: 'Acesse "Ferramentas → Marketing" no menu lateral.' },
      { texto: 'Selecione um veículo do seu estoque, a rede social de destino e o tom da mensagem (comercial, persuasivo, esportivo, etc.).' },
      { texto: 'Clique em "Gerar Anúncio". A IA redige a legenda completa destacando opcionais, motorização, facilidades de financiamento e chamada para ação (CTA).' },
      { texto: 'No painel de publicação, selecione "Publicar agora" ou "Agendar para" informando a data e horário desejados.' },
      { texto: 'Em "Histórico de Posts", acompanhe o status de cada publicação (Agendado, Publicado, Falhou).', dica: 'Para publicar no Instagram, a conta da loja deve ser Instagram Business e estar conectada à Página do Facebook.' },
    ],
  },
  {
    id: 'marketing-meta-setup',
    titulo: 'Conectar Instagram e Facebook (Meta)',
    gestorOnly: true,
    icone: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3a3 3 0 110 6 3 3 0 010-6zm0 14.2a7.2 7.2 0 01-6-3.22c.03-2 4-3.08 6-3.08s5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z',
    descricao: 'Guia de integração oficial para conectar as contas de redes sociais da loja via Meta Graph API.',
    passos: [
      { texto: 'Para permitir postagens automáticas, é necessário configurar uma única vez as chaves de integração da Meta.' },
      { texto: 'Acesse developers.facebook.com, crie um App do tipo "Business" e adicione "Facebook Login" e "Instagram Graph API".' },
      { texto: 'Anote o App ID e App Secret e configure o Redirect URI oficial da sua aplicação em nuvem (ex.: https://SEU-DOMINIO/api/v1/social-auth/meta/callback).' },
      { texto: 'Em Configurações → Redes Sociais, o gestor da loja clica em "Conectar via Meta" para autenticar e escolher a Página do Facebook e conta do Instagram Business.', dica: 'Contas pessoais do Instagram não possuem permissão de publicação por API oficial da Meta.' },
    ],
  },
  {
    id: 'assistente',
    titulo: 'Assistente de IA',
    modulo: 'assistente_ia' as const,
    icone: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 5v5l4 2',
    descricao: 'Assistente virtual para tirar dúvidas operacionais, sugerir abordagens comerciais e consultar dados do estoque e leads por texto ou voz.',
    passos: [
      { texto: 'Acesse "Assistente IA" no menu lateral.' },
      { texto: 'Digite sua mensagem na caixa de chat ou clique no ícone de microfone para enviar comandos por áudio com transcrição automática.' },
      { texto: 'Peça resumos do estoque, sugestões de resposta para clientes difíceis ou auxílio na montagem de propostas.' },
      { texto: 'O histórico de conversa fica armazenado para consulta a qualquer momento.', dica: 'O assistente considera as informações em tempo real da sua própria loja.' },
    ],
  },
  {
    id: 'fiscal',
    titulo: 'Fiscal / NF-e',
    modulo: 'fiscal' as const,
    icone: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z',
    descricao: 'Emita Notas Fiscais Eletrônicas (NF-e) de venda de veículos com integração SEFAZ e envio de DANFE/XML.',
    passos: [
      { texto: 'Acesse "Ferramentas → Notas Fiscais" no menu lateral. Antes de emitir a primeira nota, cadastre o Certificado Digital A1 da loja em Configurações → Fiscal.' },
      { texto: 'Em "Emitir NF-e", selecione um contrato de venda assinado. Todos os dados do emitente, destinatário, valores e veículo são importados automaticamente.' },
      { texto: 'Clique em "Emitir NF-e" para transmitir à SEFAZ. O status é atualizado para Autorizada, Rejeitada ou Cancelada.' },
      { texto: 'Baixe o XML oficial e o PDF da DANFE com um clique para arquivamento ou envio ao comprador.', dica: 'O Certificado A1 é criptografado e mantido com segurança máxima no ambiente do servidor.' },
    ],
  },
  {
    id: 'meu-site',
    titulo: 'Meu Site da Loja',
    modulo: 'site' as const,
    icone: 'M3 12h18M12 3v18m9-9a9 9 0 11-18 0 9 9 0 0118 0z',
    descricao: 'Crie e publique o website exclusivo da concessionária com seus veículos sem precisar digitar nenhum código.',
    passos: [
      { texto: 'Acesse "Ferramentas → Meu Site" no menu lateral.' },
      { texto: 'Escolha o template visual de sua preferência e personalize logo, cores institucionais, banners, texto "Sobre a Loja" e canais de atendimento.' },
      { texto: 'Os veículos marcados com "Publicar na Vitrine" no Estoque aparecem automaticamente na listagem do seu site oficial.' },
      { texto: 'Clique em "Publicar Site" para disponibilizar a página na internet. Formulários de contato preenchidos pelos clientes no site entram como Leads no seu CRM.', dica: 'Quaisquer edições feitas no construtor visual ficam salvas em rascunho até que você confirme a publicação.' },
    ],
  },
  {
    id: 'ferramentas-modulos',
    titulo: 'Ferramentas & Módulos Premium',
    gestorOnly: true,
    icone: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
    imagem: '/ajuda/ferramentas-planos.png',
    descricao: 'Painel geral dos módulos adicionais contratados pela concessionária (Simulador, Contratos, Marketing, FIPE, IA, Fiscal e Site).',
    passos: [
      { texto: 'Acesse "Ferramentas" no menu lateral (ou expanda o grupo de menus).' },
      { texto: 'Nesta página você visualiza os cards de todos os módulos disponíveis com seus respectivos badges de status ("Ativo" ou "Bloqueado").' },
      { texto: 'Módulos ativos possuem o botão "Abrir Módulo" para acesso direto.' },
      { texto: 'Módulos bloqueados podem ser solicitados ou ativados mediante contato com o consultor ou suporte da plataforma.', dica: 'A liberação de módulos premium para a loja é gerenciada pela Administração da Plataforma.' },
    ],
  },
  {
    id: 'equipe',
    titulo: 'Equipe & Permissões',
    gestorOnly: true,
    icone: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 0v2a4 4 0 01-3 3.87M16 3.13a4 4 0 010 7.75',
    imagem: '/ajuda/equipe.png',
    descricao: 'Gerencie membros da equipe da loja: convide vendedores, atribua permissões granulares por módulo e desative acessos.',
    passos: [
      { texto: 'Acesse "Equipe" no menu lateral (exclusivo para Gestores da loja).' },
      { texto: 'Clique em "Convidar Membro", preencha o nome e o e-mail do vendedor. Ele receberá um e-mail com instruções para criar sua senha de acesso.' },
      { texto: 'Defina os módulos que cada vendedor tem permissão para utilizar (ex.: liberar Estoque e CRM e restringir Financeiro e Contratos).' },
      { texto: 'Caso um membro saia da equipe, você pode desativar seu usuário imediatamente sem perder o histórico das vendas realizadas por ele.', dica: 'Vendedores não enxergam as seções de Equipe, Configurações de Loja, Fila de Aprovações e módulos aos quais não têm acesso.' },
    ],
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações da Loja',
    gestorOnly: true,
    imagem: '/ajuda/configuracoes.png',
    icone: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    descricao: 'Central de parâmetros da concessionária organizada em abas: Perfil da Loja, Credenciais Bancárias, IA, Redes Sociais, DETRAN e Fiscal.',
    passos: [
      { texto: 'Clique no seu avatar e escolha "Configurações" (acesso exclusivo para Gestores).' },
      { texto: 'Aba Perfil da Loja: edite Razão Social, Nome Fantasia, CNPJ, WhatsApp oficial, E-mail, CEP, Endereço e Porcentagem Padrão de Comissão.' },
      { texto: 'Aba Credenciais Bancárias: cadastre os acessos dos portais das financeiras (BV, C6, Itaú, Santander, Pan, Bradesco) que ativam as automações do Simulador.' },
      { texto: 'Aba Redes Sociais: vincule sua conta do Facebook e Instagram para publicação de postagens com IA.' },
      { texto: 'Aba Fiscal: cadastre e atualize o arquivo do Certificado Digital A1 da loja para a emissão de Notas Fiscais (NF-e).', dica: 'Os dados cadastrais alterados no perfil da loja são refletidos nos cabeçalhos de contratos e no seu site público.' },
    ],
  },
  {
    id: 'admin-plataforma',
    titulo: 'Painel do Administrador da Plataforma',
    adminOnly: true,
    icone: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    descricao: 'Painel exclusivo para administradores da plataforma SaaS: gestão de lojas (tenants), planos, patrocínios, suporte via "Observar" e auditoria.',
    passos: [
      { texto: 'Acesse "Administração" no menu lateral (exclusivo para Administradores da Plataforma).' },
      { texto: 'Na aba Overview, consulte as métricas globais do SaaS: Total de Lojas, Lojas Ativas, Total de Veículos, Usuários e Logs de Auditoria.' },
      { texto: 'Na aba Lojas, cadastre novas concessionárias, edite dados, ative/desative lojas e configure o badge de Destaque (lojas patrocinadas na Vitrine).' },
      { texto: 'Clique em "Observar" na linha de qualquer loja para abrir em nova aba a visão de Gestor daquela concessionária para prestar suporte direto.' },
      { texto: 'Em "Assinatura", gerencie os planos contratados pela loja, ative novos módulos e registre pagamentos.', dica: 'Todas as alterações administrativas e acessos via Impersonar/Observar ficam gravados com timestamp no log de auditoria global.' },
    ],
  },
]

const FAQ_ITEMS: FaqItem[] = [
  {
    pergunta: 'Esqueci minha senha. Como recuperar o acesso?',
    resposta: 'Na tela de login, clique em "Esqueci minha senha". Informe seu e-mail cadastrado e você receberá um link seguro por e-mail para cadastrar uma nova senha. O link expira em 1 hora por segurança.',
  },
  {
    pergunta: 'Posso utilizar o sistema no celular ou tablet?',
    resposta: 'Sim! O SocialVeículos é 100% responsivo e otimizado para dispositivos móveis. No smartphone, o menu lateral é recolhido em um menu hambúrguer no topo para facilitar a navegação.',
  },
  {
    pergunta: 'Por que meu veículo não aparece na Vitrine B2C pública?',
    resposta: 'Para um veículo ser exibido no marketplace público para clientes finais, 3 requisitos precisam ser atendidos: (1) o toggle "Publicar na Vitrine" deve estar ativo no cadastro do veículo; (2) o status do veículo precisa ser "Disponível"; e (3) o veículo deve ter pelo menos 1 foto cadastrada em sua galeria de mídias.',
  },
  {
    pergunta: 'Vendedores podem excluir veículos do estoque ou alterar preços livremente?',
    resposta: 'Depende da permissão. Por padrão, solicitações de exclusão permanente ou alterações no preço de venda enviadas por vendedores disparam uma pendência na Fila de Aprovações. A alteração só é efetuada no estoque após o Gestor clicar em "Aprovar".',
  },
  {
    pergunta: 'Como o vendedor consulta suas comissões a receber?',
    resposta: 'O vendedor deve acessar o menu "Minhas Comissões" na Sidebar. Lá ele pode visualizar todas as suas vendas de veículos, a porcentagem (%) configurada pelo gestor, os valores líquidos e o status do pagamento ("Definir %", "Pendente" ou "Paga").',
  },
  {
    pergunta: 'O que acontece quando um cliente manda mensagem pela Vitrine pública?',
    resposta: 'Ao clicar para conversar sobre um carro na Vitrine B2C, o cliente inicia um atendimento. O sistema cria automaticamente um novo Lead no CRM da sua loja com a origem identificada como "Vitrine", vinculando o cliente e o veículo em questão.',
  },
  {
    pergunta: 'Como funciona o Simulador de Crédito simultâneo?',
    resposta: 'O Simulador consulta as condições de financiamento em múltiplos bancos de uma só vez (BV, C6, Itaú, Santander, Pan, Bradesco). Para funcionar, o Gestor deve primeiro cadastrar os acessos das financeiras em Configurações → Credenciais Bancárias.',
  },
  {
    pergunta: 'Como consultar a Tabela FIPE de um veículo sem cadastrá-lo?',
    resposta: 'Acesse "Ferramentas → Consulta FIPE" no menu lateral. Siga o assistente de 4 passos selecionando o Tipo (Carro/Moto/Caminhão), Marca, Modelo e Ano para visualizar a cotação oficial de mercado.',
  },
  {
    pergunta: 'Como convidar um novo vendedor para a equipe da loja?',
    resposta: 'Acesse "Equipe" no menu lateral (exclusivo para Gestores), clique em "Convidar Membro" e digite o nome e e-mail do vendedor. Em seguida, selecione quais módulos (Estoque, CRM, Financeiro, etc.) ele terá permissão para acessar.',
    gestorOnly: true,
  },
  {
    pergunta: 'Os dados da minha concessionária são isolados e seguros?',
    resposta: 'Com certeza. O SocialVeículos adota arquitetura multi-tenant com isolamento rígido de dados no banco de dados e criptografia de credenciais. Os dados de custo, margem e negociações da sua loja são estritamente confidenciais e protegidos em conformidade com a LGPD.',
  },
  {
    pergunta: 'O que é a função Observar/Impersonar do Administrador da Plataforma?',
    resposta: 'É um recurso exclusivo para administradores globais da plataforma prestarem suporte técnico às concessionárias. Permite abrir o painel da loja em nova aba para diagnosticar dúvidas ou apoiar configurações sem alterar a senha da loja.',
    adminOnly: true,
  },
  {
    pergunta: 'Por que não consigo conectar a conta do Instagram no Marketing?',
    resposta: 'São necessários 3 requisitos: (1) a conta do Instagram precisa ser do tipo Profissional (Business ou Criador); (2) ela deve estar vinculada a uma Página oficial do Facebook que você administra; e (3) o App oficial da plataforma na Meta precisa estar ativo.',
    gestorOnly: true,
  },
  {
    pergunta: 'Como funciona a alternância do Tema Claro e Escuro?',
    resposta: 'No canto superior direito, próximo ao seu avatar, há um botão de sol/lua. Clique para alternar instantaneamente entre o tema escuro elegante e o tema claro. Sua escolha fica salva no seu navegador.',
  },
]

/* ── Componente Principal ────────────────────────────────────── */

export function Ajuda() {
  const [busca, setBusca] = useState('')
  const [topicoAtivo, setTopicoAtivo] = useState<string | null>(null)
  const [faqAberto, setFaqAberto] = useState<number | null>(null)

  const user = useAuthStore((s) => s.user)
  const papel = user?.papel
  const modulosUsuario = parseModulos(user?.modulos)
  const isGestor = papel === 'gestor' || papel === 'admin_plataforma'
  const isAdminPlataforma = papel === 'admin_plataforma'

  const topicosVisiveis = TOPICOS.filter((t) => {
    if (t.adminOnly && !isAdminPlataforma) return false
    if (t.gestorOnly && !isGestor) return false
    if (t.modulo && !podeAcessarModulo(papel, modulosUsuario, t.modulo)) return false
    return true
  })

  const buscaLower = busca.toLowerCase()
  const topicosFiltrados = topicosVisiveis.filter(
    (t) =>
      t.titulo.toLowerCase().includes(buscaLower) ||
      t.descricao.toLowerCase().includes(buscaLower) ||
      t.passos.some((p) => p.texto.toLowerCase().includes(buscaLower))
  )

  const faqFiltrado = FAQ_ITEMS.filter((f) => {
    if (f.adminOnly && !isAdminPlataforma) return false
    if (f.gestorOnly && !isGestor) return false
    return (
      f.pergunta.toLowerCase().includes(buscaLower) ||
      f.resposta.toLowerCase().includes(buscaLower)
    )
  })

  const scrollParaTopico = (id: string) => {
    setTopicoAtivo(id)
    const el = document.getElementById(`ajuda-topico-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  /* Detectar tópico visível no scroll via IntersectionObserver */
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-topico-id]')
    if (sections.length === 0) return

    const visibleMap = new Map<string, number>() // id → ratio

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.topicoId ?? ''
          if (id) visibleMap.set(id, entry.intersectionRatio)
        })

        // Escolhe a seção com maior visibilidade
        let bestId = ''
        let bestRatio = 0
        visibleMap.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        })
        if (bestId) setTopicoAtivo(bestId)
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      }
    )

    sections.forEach((sec) => observer.observe(sec))
    return () => observer.disconnect()
  }, [topicosFiltrados, faqFiltrado])

  return (
    <div className="page-content ajuda-page">
      <div className="page-header">
        <h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 28, height: 28, verticalAlign: 'middle', marginRight: 10 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Central de Ajuda & Manual do Usuário
        </h2>
        <p>Guia completo do sistema SocialVeículos. Consulte passo a passo as instruções atualizadas de cada módulo e funcionalidade.</p>
        <a
          href="/manual/manual-socialveiculos.pdf"
          download="Manual-SocialVeiculos.pdf"
          className="btn btn-secondary ajuda-download-manual"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Baixar Manual em PDF
        </a>
      </div>

      {/* Barra de busca */}
      <div className="ajuda-busca-wrapper">
        <svg className="ajuda-busca-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="ajuda-busca"
          type="text"
          placeholder="Buscar no manual... (ex: cadastrar veículo, aprovações, comissões, FIPE, Vitrine, CRM)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          id="ajuda-busca-input"
        />
        {busca && (
          <button className="ajuda-busca-clear" onClick={() => setBusca('')} title="Limpar busca">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="ajuda-layout">
        {/* Sumário lateral */}
        <aside className="ajuda-sumario">
          <h4 className="ajuda-sumario-titulo">Sumário</h4>
          <nav className="ajuda-sumario-nav">
            {topicosVisiveis.map((t) => (
              <button
                key={t.id}
                className={`ajuda-sumario-item ${topicoAtivo === t.id ? 'active' : ''} ${
                  busca && !topicosFiltrados.find((f) => f.id === t.id) ? 'dimmed' : ''
                }`}
                onClick={() => scrollParaTopico(t.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={t.icone} />
                </svg>
                <span>{t.titulo}</span>
              </button>
            ))}
            <div className="ajuda-sumario-divider" />
            <button
              className={`ajuda-sumario-item ${topicoAtivo === 'faq' ? 'active' : ''}`}
              onClick={() => scrollParaTopico('faq')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Dúvidas Frequentes</span>
            </button>
          </nav>
        </aside>

        {/* Conteúdo principal */}
        <div className="ajuda-conteudo">
          {topicosFiltrados.length === 0 && faqFiltrado.length === 0 ? (
            <div className="ajuda-vazio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h3>Nenhum resultado encontrado</h3>
              <p>Tente buscar por termos como "estoque", "aprovações", "comissões", "FIPE" ou "CRM".</p>
            </div>
          ) : (
            <>
              {/* Tópicos */}
              {topicosFiltrados.map((topico, idx) => (
                <section
                  key={topico.id}
                  id={`ajuda-topico-${topico.id}`}
                  data-topico-id={topico.id}
                  className="ajuda-topico-section"
                >
                  <div className="ajuda-topico-header">
                    <div className="ajuda-topico-numero">{String(idx + 1).padStart(2, '0')}</div>
                    <div>
                      <h3 className="ajuda-topico-titulo">{topico.titulo}</h3>
                      <p className="ajuda-topico-desc">{topico.descricao}</p>
                    </div>
                  </div>

                  {topico.imagem && (
                    <div className="ajuda-topico-imagem-wrapper">
                      <img
                        src={topico.imagem}
                        alt={`Screenshot: ${topico.titulo}`}
                        className="ajuda-topico-imagem"
                        loading="lazy"
                      />
                      <div className="ajuda-topico-imagem-caption">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        Interface do módulo {topico.titulo}
                      </div>
                    </div>
                  )}

                  <div className="ajuda-passos">
                    {topico.passos.map((passo, i) => (
                      <div key={i} className="ajuda-passo">
                        <div className="ajuda-passo-numero">{i + 1}</div>
                        <div className="ajuda-passo-conteudo">
                          <p>{passo.texto}</p>
                          {passo.dica && (
                            <div className="ajuda-passo-dica">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2.26C10.19 13.47 9 11.38 9 9a7 7 0 017-7z" />
                              </svg>
                              <span>{passo.dica}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {/* FAQ */}
              {faqFiltrado.length > 0 && (
                <section
                  id="ajuda-topico-faq"
                  data-topico-id="faq"
                  className="ajuda-topico-section"
                >
                  <div className="ajuda-topico-header">
                    <div className="ajuda-topico-numero">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="ajuda-topico-titulo">Dúvidas Frequentes</h3>
                      <p className="ajuda-topico-desc">Respostas diretas para as perguntas mais comuns sobre o funcionamento do sistema.</p>
                    </div>
                  </div>

                  <div className="ajuda-faq-lista">
                    {faqFiltrado.map((item, i) => (
                      <div
                        key={i}
                        className={`ajuda-faq-item ${faqAberto === i ? 'aberto' : ''}`}
                      >
                        <button
                          className="ajuda-faq-pergunta"
                          onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                          aria-expanded={faqAberto === i}
                        >
                          <span>{item.pergunta}</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ajuda-faq-chevron">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {faqAberto === i && (
                          <div className="ajuda-faq-resposta">
                            <p>{item.resposta}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
