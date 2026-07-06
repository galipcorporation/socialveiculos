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
  icone: string      // SVG path d
  descricao: string
  imagem?: string    // caminho relativo em /ajuda/
  passos: Passo[]
  modulo?: ModuloKey // se definido, só aparece quando o usuário tem acesso
  gestorOnly?: boolean // só aparece para gestor/admin
}

interface FaqItem {
  pergunta: string
  resposta: string
  gestorOnly?: boolean
}

const TOPICOS: Topico[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros Passos',
    icone: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    descricao: 'Aprenda a fazer login, navegar pelo menu e entender a interface do SocialVeículos.',
    passos: [
      { texto: 'Acesse o sistema pelo endereço fornecido pela sua loja e informe seu e-mail e senha na tela de login.' },
      { texto: 'Após o login, você será direcionado ao Dashboard (Visão Geral), que mostra os indicadores principais da sua loja.' },
      { texto: 'No lado esquerdo da tela, você encontra o menu lateral (Sidebar) com todas as seções do sistema: Dashboard, Rede Social, CRM, Estoque, Financeiro, etc.' },
      { texto: 'No canto superior direito, clique no seu avatar para acessar Configurações da loja ou para Sair do sistema.' },
      { texto: 'Use a barra de busca no topo para encontrar rapidamente qualquer seção ou funcionalidade.', dica: 'Atalho: pressione Ctrl+K para abrir a busca rápida a qualquer momento.' },
    ],
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    modulo: undefined,
    icone: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
    descricao: 'Veja em tempo real os KPIs da sua loja: estoque ativo, leads, vendas do mês e receita.',
    imagem: '/ajuda/dashboard.png',
    passos: [
      { texto: 'O Dashboard é a tela inicial após o login. Ele exibe 4 indicadores-chave (KPIs) no topo: Estoque Ativo, Leads Ativos, Vendas do Mês e Receita do Mês.' },
      { texto: 'Logo abaixo dos KPIs, a seção "Acesso Rápido" mostra atalhos para as páginas que você mais visitou recentemente.' },
      { texto: 'No painel de Alertas, você verá notificações importantes como veículos sem foto, leads sem contato há mais de 3 dias, entre outros.' },
      { texto: 'Todos os dados são atualizados automaticamente a cada vez que você acessa o Dashboard.', dica: 'Os valores são isolados por loja — cada concessionária vê apenas seus próprios dados.' },
    ],
  },
  {
    id: 'estoque',
    titulo: 'Estoque de Veículos',
    modulo: 'estoque' as const,
    icone: 'M1 3h15a2 2 0 012 2v6a2 2 0 01-2 2H1V3zm0 0v13m4 2a2 2 0 100-4 2 2 0 000 4zm13 0a2 2 0 100-4 2 2 0 000 4z',
    descricao: 'Gerencie todo o inventário da sua loja: cadastre, edite, publique na vitrine e faça upload de fotos e vídeos.',
    imagem: '/ajuda/estoque.png',
    passos: [
      { texto: 'Acesse "Estoque" no menu lateral. No topo da página, você verá cards com informações resumidas: total de veículos, disponíveis, reservados e vendidos.' },
      { texto: 'Clique no botão "Novo Veículo" (azul) para cadastrar um veículo. Preencha a marca e modelo usando o autocomplete — o sistema sugere automaticamente a partir do catálogo FIPE.' },
      { texto: 'No cadastro, informe: tipo (Carro, Moto, Caminhão, etc.), ano, placa, cor, combustível, câmbio, quilometragem, preço de compra e preço de venda.' },
      { texto: 'Na aba de fotos/vídeos, arraste e solte as imagens ou clique para selecionar. Você pode reordenar as fotos arrastando-as e definir a foto de capa.', dica: 'A primeira foto/vídeo é a capa (thumbnail) do veículo. Na vitrine pública, todas as fotos e vídeos aparecem em carrossel — o cliente pode navegar entre eles.' },
      { texto: 'Use o toggle "Publicar na Vitrine" para controlar se o veículo aparece na vitrine pública (B2C) para clientes finais.' },
      { texto: 'Para filtrar veículos, use a barra de busca (pesquisa por marca, modelo ou placa) e os dropdowns de status e ordenação.' },
      { texto: 'Clique em qualquer veículo da lista para abrir o modal de edição, onde você pode atualizar informações, gerenciar mídias e ver o histórico de custos de preparação.' },
    ],
  },
  {
    id: 'crm',
    titulo: 'CRM — Clientes e Leads',
    modulo: 'crm' as const,
    icone: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm10 1v6m3-3h-6',
    descricao: 'Cadastre clientes, crie leads de negociação e acompanhe o funil de vendas pelo quadro Kanban.',
    imagem: '/ajuda/crm.png',
    passos: [
      { texto: 'Acesse "CRM" no menu lateral. A página possui duas abas: "Quadro" (Kanban de leads) e "Clientes" (cadastro de pessoas físicas).' },
      { texto: 'Na aba Quadro, o Kanban mostra 4 colunas: Novo, Em Contato, Proposta e Fechado. Cada card representa um lead (oportunidade de negócio).' },
      { texto: 'Para criar um novo lead, clique em "Novo Lead". Selecione um cliente existente (ou crie um novo) e opcionalmente vincule um veículo de interesse do estoque.' },
      { texto: 'Arraste os cards entre as colunas para mover o lead pelo funil de vendas. Isso atualiza automaticamente o status no sistema.' },
      { texto: 'Clique em um card para abrir os detalhes do lead. Aqui você pode adicionar propostas de financiamento, anotações e ver o histórico completo da negociação.' },
      { texto: 'Na aba "Clientes", cadastre pessoas físicas com CPF, telefone, e-mail e endereço. Esses clientes ficam disponíveis para vincular a leads.', dica: 'O CPF e o e-mail possuem validação automática. Espaços não são permitidos no campo de e-mail.' },
    ],
  },
  {
    id: 'rede-social',
    titulo: 'Rede Social',
    icone: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 0v2a4 4 0 01-3 3.87M16 3.13a4 4 0 010 7.75',
    descricao: 'Conecte-se com outras lojas parceiras: publique repasses, envie propostas, use o chat e encontre parceiros.',
    imagem: '/ajuda/redesocial.png',
    passos: [
      { texto: 'Acesse "Rede Social" no menu lateral. A página possui 4 abas: Feed de Repasses, Propostas, Parceiros e Chat.' },
      { texto: 'No Feed de Repasses, veja veículos publicados por outras lojas parceiras. Você pode curtir, comentar e enviar propostas de repasse.' },
      { texto: 'Na aba "Propostas", gerencie todas as propostas enviadas e recebidas. Aceite, rejeite ou negocie propostas com lojas parceiras.' },
      { texto: 'No "Diretório de Parceiros", busque lojas por nome, cidade ou UF para encontrar possíveis parceiros de negócio.' },
      { texto: 'O Chat permite conversar em tempo real com lojas parceiras. As mensagens são entregues instantaneamente via WebSocket.', dica: 'As propostas aceitas atualizam automaticamente o estoque, movendo o veículo entre as lojas envolvidas.' },
    ],
  },
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    modulo: 'financeiro' as const,
    icone: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    descricao: 'Controle o caixa da loja com lançamentos de receitas e despesas, e gerencie comissões da equipe.',
    imagem: '/ajuda/financeiro.png',
    passos: [
      { texto: 'Acesse "Financeiro" no menu lateral. No topo, você verá cards com o resumo financeiro: Receitas, Despesas e Saldo do período.' },
      { texto: 'A tabela de Lançamentos lista todas as entradas e saídas financeiras. Use os filtros para buscar por data, tipo (Receita/Despesa) ou descrição.' },
      { texto: 'Para registrar um novo lançamento, clique no botão "Novo Lançamento" e preencha: descrição, valor, tipo e data.' },
      { texto: 'Na aba "Comissões", veja as comissões calculadas para cada vendedor com base nas vendas realizadas no período.', dica: 'Os valores monetários usam a formatação brasileira (R$) com separadores de milhar automáticos.' },
    ],
  },
  {
    id: 'simulador',
    titulo: 'Simulador de Crédito',
    modulo: 'simulador' as const,
    icone: 'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V4a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-3',
    imagem: '/ajuda/simulador.png',
    descricao: 'Simule financiamentos em múltiplos bancos simultaneamente (BV, PAN) e imprima propostas para o cliente.',
    passos: [
      { texto: 'Acesse "Ferramentas → Simulador" no menu lateral. A primeira coisa a fazer é configurar as credenciais dos bancos: clique no botão "Configurar" em cada card de financeira e informe o usuário e senha do portal daquela instituição.' },
      { texto: 'Com as financeiras configuradas, marque os bancos desejados com o checkbox "Selecionar" nos cards do passo 1. Você pode simular em um ou todos os bancos ao mesmo tempo.' },
      { texto: 'No passo 2 (Dados do Cliente), informe o CPF. Ao sair do campo, o sistema busca automaticamente o cliente no CRM e preenche nome e telefone. Se não encontrar, preencha manualmente. A data de nascimento é obrigatória para as financeiras.' },
      { texto: 'No passo 3 (Dados do Veículo), clique no campo Placa e selecione o veículo do estoque na lista que aparece, ou digite a placa e clique no ícone de busca. O valor de venda e a entrada de 20% são preenchidos automaticamente.', dica: 'O simulador só aceita carros e motos. Outros tipos de veículo (caminhão, barco etc.) não são financiáveis pelos bancos integrados.' },
      { texto: 'Clique em "Simular Financiamento". Os resultados aparecem em cards: cada banco mostra parcela, taxa de juros e total financiado. Bancos que reprovarem exibem o motivo em vermelho.' },
      { texto: 'Na tela de resultados, clique em "Imprimir Proposta" para gerar um documento PDF com os dados do cliente, do veículo e as condições de cada banco — pronto para mostrar ou enviar ao comprador.' },
      { texto: 'Para reiniciar uma nova simulação, clique em "Limpar" para apagar todos os campos do formulário.', dica: 'O simulador requer a extensão "Simulador Fácil" instalada no Google Chrome (desktop). No celular ou em outros navegadores, a automação nos portais das financeiras não funciona.' },
    ],
  },
  {
    id: 'contratos',
    titulo: 'Contratos',
    modulo: 'contratos' as const,
    icone: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    imagem: '/ajuda/contratos.png',
    descricao: 'Crie, gerencie e compartilhe contratos de compra e venda, consignação e garantia diretamente pelo sistema.',
    passos: [
      { texto: 'Acesse "Ferramentas → Contratos" no menu lateral. Você verá os KPIs no topo: total de contratos, quantos estão aguardando assinatura e quantos já foram assinados.' },
      { texto: 'Para criar um contrato, clique em "Novo Contrato". Selecione o tipo: Compra e Venda (o mais comum), Consignação (veículo em consignação por terceiro) ou Garantia (termo de garantia pós-venda).' },
      { texto: 'Escolha o cliente no campo "Cliente" — use a caixa de busca abaixo para filtrar pelo nome. Em seguida, selecione o veículo da mesma forma.' },
      { texto: 'Preencha o valor da venda, o valor da entrada e o número de parcelas. No campo "Observações" você pode adicionar cláusulas extras, condições especiais ou notas internas.' },
      { texto: 'Clique em "Criar Contrato". O contrato aparece na lista com status "Rascunho". Para avançar o fluxo, use o dropdown de status na tabela: Rascunho → Aguardando → Assinado.', dica: 'Contratos cancelados não são excluídos — ficam registrados para histórico e auditoria.' },
      { texto: 'Para baixar o contrato em PDF, clique no ícone de download na linha do contrato. O documento abre em nova aba pronto para imprimir ou salvar.' },
      { texto: 'Para compartilhar pelo WhatsApp, clique no ícone verde do WhatsApp na linha do contrato. O sistema abre uma mensagem pré-formatada com o número e tipo do contrato.' },
    ],
  },
  {
    id: 'marketing',
    titulo: 'Marketing',
    modulo: 'marketing' as const,
    icone: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 11-5.8-1.6',
    imagem: '/ajuda/marketing.png',
    descricao: 'Gere posts e criativos profissionais para redes sociais a partir dos veículos do seu estoque com um clique.',
    passos: [
      { texto: 'Acesse "Ferramentas → Marketing" no menu lateral. O módulo permite criar artes prontas para Instagram, WhatsApp e Facebook usando os dados e fotos dos veículos já cadastrados no Estoque.' },
      { texto: 'Selecione o veículo que deseja divulgar. As fotos e as informações (marca, modelo, ano, preço) são carregadas automaticamente a partir do cadastro do Estoque.' },
      { texto: 'Escolha o template de arte desejado (formato quadrado para Instagram, stories, etc.). O sistema aplica as informações do veículo e o logotipo da loja no criativo.' },
      { texto: 'Faça o download da arte gerada e publique diretamente nas redes sociais da loja, ou envie pelo WhatsApp para clientes interessados.', dica: 'Para melhores resultados, cadastre os veículos com fotos de alta qualidade. A primeira foto do veículo será usada como imagem principal no criativo.' },
    ],
  },
  {
    id: 'assistente',
    titulo: 'Assistente de IA',
    modulo: 'assistente' as const,
    icone: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 5v5l4 2',
    descricao: 'Converse por texto ou voz com o assistente virtual para tirar dúvidas e agilizar o atendimento de leads.',
    passos: [
      { texto: 'Acesse "Assistente IA" no menu lateral. Digite sua pergunta ou clique no ícone de microfone para falar — o áudio é transcrito automaticamente.' },
      { texto: 'O assistente responde com base nos dados da sua loja (estoque, leads, financeiro) e pode ajudar a redigir mensagens para clientes.' },
      { texto: 'O histórico de conversas fica salvo e pode ser retomado a qualquer momento.', dica: 'Este módulo é premium e depende do plano contratado pela loja.' },
    ],
  },
  {
    id: 'fiscal',
    titulo: 'Fiscal / NF-e',
    modulo: 'fiscal' as const,
    icone: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z',
    descricao: 'Emita notas fiscais eletrônicas (NF-e) das vendas de veículos direto pelo sistema.',
    passos: [
      { texto: 'Acesse "Ferramentas → Fiscal" no menu lateral. Cadastre o certificado digital A1 da loja em Configurações antes de emitir a primeira nota.' },
      { texto: 'Selecione a venda desejada e clique em "Emitir NF-e". Os dados do veículo, cliente e valor são preenchidos automaticamente a partir do cadastro.' },
      { texto: 'Após a emissão, acompanhe o status do documento (Autorizada, Rejeitada, Cancelada) na listagem.' },
      { texto: 'Para corrigir uma nota já emitida, use "Cancelar" (dentro do prazo legal) ou "Carta de Correção" para ajustes que não alteram valores.', dica: 'O certificado digital é armazenado de forma criptografada e nunca é exibido novamente após o cadastro.' },
    ],
  },
  {
    id: 'meu-site',
    titulo: 'Meu Site',
    modulo: 'site' as const,
    icone: 'M3 12h18M12 3v18m9-9a9 9 0 11-18 0 9 9 0 0118 0z',
    descricao: 'Crie e publique o site público da sua loja com um construtor visual, sem precisar programar.',
    passos: [
      { texto: 'Acesse "Ferramentas → Meu Site" no menu lateral. Escolha um template para começar o site da sua loja.' },
      { texto: 'Personalize textos, cores, logotipo e seções (sobre a loja, veículos em destaque, contato) pelo construtor visual.' },
      { texto: 'O site exibe automaticamente os veículos publicados no Estoque, sem necessidade de duplicar cadastro.' },
      { texto: 'Clique em "Publicar" para colocar o site no ar. Visitantes podem enviar leads diretamente pelo formulário de contato do site.', dica: 'Alterações ficam em rascunho até você clicar em "Publicar" novamente.' },
    ],
  },
  {
    id: 'ferramentas-planos',
    titulo: 'Planos & Assinatura',
    gestorOnly: true,
    icone: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
    imagem: '/ajuda/ferramentas-planos.png',
    descricao: 'Veja os módulos disponíveis, o status da assinatura e como fazer upgrade do plano da sua loja.',
    passos: [
      { texto: 'Acesse "Ferramentas" no menu lateral e clique na aba "Módulos". Você verá cards para cada módulo premium: Contratos, Simulador, Marketing e Assistente IA. O badge no canto indica se está Ativo, Bloqueado ou Inadimplente.' },
      { texto: 'Módulos com badge "Ativo" têm o botão "Abrir módulo" disponível — clique para acessar diretamente.' },
      { texto: 'Módulos com badge "Bloqueado" (não estão no plano atual) ou "Inadimplente" (plano vencido) exibem o botão "Fazer upgrade". Clique nele para ir à aba de Planos.' },
      { texto: 'Na aba "Planos & Assinatura", veja o plano atual da loja, o status (Ativa, Inadimplente, Expirada) e quantos módulos estão ativos.' },
      { texto: 'Para mudar de plano, compare os planos disponíveis e clique em "Contratar" no plano desejado. Uma confirmação será exibida com o valor mensal antes de finalizar.', dica: 'Apenas o gestor da loja pode contratar ou alterar planos. Vendedores não veem esta seção.' },
    ],
  },
  {
    id: 'equipe',
    titulo: 'Equipe',
    gestorOnly: true,
    icone: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 0v2a4 4 0 01-3 3.87M16 3.13a4 4 0 010 7.75',
    imagem: '/ajuda/equipe.png',
    descricao: 'Gerencie os membros da sua equipe: convide vendedores, defina permissões e controle acessos.',
    passos: [
      { texto: 'Acesse "Equipe" no menu lateral (visível apenas para gestores). Aqui você vê todos os membros ativos e inativos da sua loja.' },
      { texto: 'Para convidar um novo membro, clique em "Convidar" e informe o e-mail do vendedor. Ele receberá um convite para criar a conta no sistema.' },
      { texto: 'Para cada membro, defina quais módulos ele pode acessar: Estoque, CRM, Financeiro, Simulador, Contratos, Marketing e Assistente IA.' },
      { texto: 'Você pode desativar um membro a qualquer momento sem apagar seus dados. Isso bloqueia imediatamente o acesso dele ao sistema.', dica: 'Apenas gestores e administradores da plataforma podem acessar a seção de Equipe. Vendedores não veem este menu.' },
    ],
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações',
    gestorOnly: true,
    imagem: '/ajuda/configuracoes.png',
    icone: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    descricao: 'Atualize os dados da sua loja: nome, CNPJ, endereço, contato e credenciais de bancos.',
    passos: [
      { texto: 'Clique no seu avatar no canto superior direito e selecione "Configurações". Você verá os dados cadastrais da sua loja.' },
      { texto: 'Edite os campos desejados: Nome da loja, CNPJ, Telefone, WhatsApp, E-mail, Endereço, Cidade, UF e CEP.' },
      { texto: 'Clique em "Salvar Alterações" para aplicar as mudanças. Os dados serão atualizados em todo o sistema, inclusive na vitrine pública.' },
      { texto: 'Na seção de Credenciais Bancárias, cadastre as credenciais de acesso das financeiras parceiras para usar o Simulador de Crédito.', dica: 'Os campos de CNPJ, Telefone e CEP possuem máscaras automáticas que formatam o valor conforme você digita.' },
    ],
  },
]

const FAQ_ITEMS: FaqItem[] = [
  {
    pergunta: 'Esqueci minha senha. Como recuperar?',
    resposta: 'Na tela de login, clique em "Esqueci minha senha". Informe o e-mail cadastrado e você receberá um link de recuperação. O link é válido por 1 hora.',
  },
  {
    pergunta: 'Posso usar o sistema no celular?',
    resposta: 'Sim! O SocialVeículos é responsivo e funciona em qualquer dispositivo. No celular, o menu lateral se transforma em um menu hambúrguer que pode ser aberto pelo ícone no canto superior.',
  },
  {
    pergunta: 'Como publicar um veículo na vitrine pública?',
    resposta: 'No Estoque, abra o veículo desejado e ative o toggle "Publicar na Vitrine". O veículo aparecerá instantaneamente no feed público para clientes finais. Certifique-se de que o veículo tenha pelo menos uma foto.',
  },
  {
    pergunta: 'Vendedores podem ver os dados financeiros?',
    resposta: 'Não por padrão. O acesso ao módulo Financeiro é controlado pelo gestor na seção de Equipe. O gestor pode liberar ou bloquear o acesso individualmente para cada vendedor.',
  },
  {
    pergunta: 'Como funciona o Simulador de Crédito?',
    resposta: 'O Simulador permite rodar simulações de financiamento com os bancos parceiros. É necessário primeiro cadastrar as credenciais dos bancos em Configurações. Depois, no Simulador, preencha os dados do cliente e do veículo para receber propostas de financiamento.',
  },
  {
    pergunta: 'O que é a Rede Social?',
    resposta: 'É uma rede interna entre lojas parceiras. Você pode publicar veículos para repasse, enviar propostas a outras lojas, usar o chat para negociar e buscar parceiros no Diretório. É um marketplace exclusivo entre concessionárias.',
  },
  {
    pergunta: 'Como convidar um vendedor para o sistema?',
    resposta: 'Acesse "Equipe" no menu lateral, clique em "Convidar" e informe o e-mail do vendedor. Ele receberá um convite por e-mail com link para criar a conta. Após o cadastro, defina quais módulos ele terá acesso.',
    gestorOnly: true,
  },
  {
    pergunta: 'Os dados da minha loja ficam seguros?',
    resposta: 'Sim. O SocialVeículos utiliza tecnologias avançadas de segurança e criptografia para garantir o isolamento completo de dados entre as lojas, em conformidade com as diretrizes da LGPD. Suas informações são protegidas com total sigilo e privacidade.',
  },
  {
    pergunta: 'Posso alterar o tema para claro?',
    resposta: 'Sim! No canto superior direito, ao lado do seu avatar, há um ícone de sol/lua que alterna entre o tema escuro e claro. Sua preferência fica salva no navegador.',
  },
  {
    pergunta: 'O que são módulos premium?',
    resposta: 'São funcionalidades avançadas (Simulador de Crédito, Contratos, Marketing e Assistente IA) que requerem um plano de assinatura superior. Acesse "Ferramentas" para ver os módulos disponíveis e fazer upgrade.',
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

  const topicosVisiveis = TOPICOS.filter((t) => {
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
        // Múltiplos thresholds para precisão granular
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
          Central de Ajuda
        </h2>
        <p>Manual completo do sistema SocialVeículos. Encontre instruções detalhadas para cada módulo.</p>
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
          placeholder="Buscar no manual... (ex: cadastrar veículo, Kanban, financeiro)"
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
              <p>Tente buscar por outros termos como "estoque", "lead" ou "financeiro".</p>
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
                        Tela do módulo {topico.titulo}
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
                      <p className="ajuda-topico-desc">Respostas rápidas para as perguntas mais comuns sobre o sistema.</p>
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
