# MELHORIAS — Registro contínuo

> Arquivo vivo (mesmo padrão do [BUGS.md](BUGS.md)). Toda melhoria/ajuste de UX entra aqui. Marcar `[x]` quando concluída, mantendo o histórico. Referenciar este arquivo em commits/PRs.

## Convenção
- `[ ]` aberto · `[x]` concluído.
- Formato: **ID — título** · prioridade · arquivo(s) · o que fazer → validação. Datar quando concluir.
- IDs nunca reutilizados. Próximo ID livre: **M074**.
- Consolidado a partir dos arquivos soltos `documentos/melhorias/01..19` (2026-06-28). A numeração antiga `NN` virou `M0(NN+1)` para abrir espaço à M001 nova.

---

## 📱 Mobile — Ajustes pós-Fase 2

> Seção especial para os ajustes do app do gestor (`apps/mobile`, reconstruído 2026-07-08, mock-first). Todo ajuste apontado na revisão do app entra aqui, seguindo a mesma convenção de IDs do arquivo.

- [x] **M048 — Configurações: espelhar as configurações do gestor web** _(2026-07-09)_ · P2 (UX / paridade) · `apps/mobile/src/screens/mais/ConfiguracoesScreen.tsx` + `apps/mobile/src/screens/mais/config/*` (novos) + `apps/mobile/src/services/config.ts` (novo)
  - **Feito:** a tela Configurações ganhou uma seção **Loja** (lista de itens que navegam para subtelas nativas, não abas horizontais), mantendo o que já existia (Aparência · Dados de demonstração · Sobre). Seis subtelas novas espelhando o gestor web (`Configuracoes.tsx`):
    - **Perfil da Loja** (`PerfilLojaScreen.tsx`) — dados cadastrais com máscaras (CNPJ/telefone/WhatsApp/CEP), slug/verificada em badges, **Comissão padrão da loja (%)**. Máscaras `maskCNPJ`/`maskTelefoneInput`/`maskCEP`/`capitalizarNome` adicionadas em `lib/format.ts` (espelho de `mascaras.ts` do gestor).
    - **Credenciais Bancárias** (`CredenciaisBancoScreen.tsx`) — lista de bancos suportados com status, sheet de configuração por banco com escopo (loja/vendedor via `SegmentedControl`), usuário/senha (olho de mostrar), botão **Testar** e salvar cifrado.
    - **IA / BYOK** (`CredenciaisIAScreen.tsx`) — credenciais configuradas (remover com confirmação), formulário provedor (Anthropic/OpenAI/Gemini via `OptionSheet`) + API key + modelo padrão.
    - **Redes Sociais** (`RedesSociaisScreen.tsx`) — cards Facebook/Instagram com status (conectado/expira), conectar (mock OAuth) / desconectar (confirmação).
    - **DETRAN / BYOF** (`DetranScreen.tsx`) — fornecedor configurado + form URL base/chave, remover com confirmação.
    - **Fiscal / NF-e** (`FiscalScreen.tsx`) — **gate premium** (paywall quando `liberado=false`), banner de status (habilitada/bloqueada), **alerta de validade do certificado (< 30 dias / vencido)**, dados fiscais (IE/regime/CNAE/ambiente) + upload de certificado A1 (mock, sem novo dep — o app real usará expo-document-picker).
  - **Arquitetura:** `configService` novo (mock-first, mesma técnica dos demais services — AsyncStorage via `db.ts`, `SEED_VERSION` 1→2 com seed de perfil/credenciais/redes/detran/fiscal); tipos em `types.ts`; navegação registrada em `RootNavigator.tsx` + `navigation/types.ts`. Vendedor vê só "Credenciais Bancárias" (sua credencial pessoal); gestor vê todas as seções. **Swap p/ API real = só reimplementar `config.ts`.**
  - **Validação:** `tsc --noEmit` limpo em `apps/mobile` (zero erros).

- [x] **M049 — Chat: alternar entre conversas de Parceiros e de Clientes** _(2026-07-09)_ · P2 (UX / paridade) · `apps/mobile/src/screens/chat/ChatScreen.tsx` + `apps/mobile/src/services/{chat,seed,types}.ts`
  - **Feito:** a tela Conversas ganhou abas **Clientes** e **Parceiros** no topo (via `FilterChips`, com badge individual de não lidas por aba). O badge da tab bar (ícone Chat) continua mostrando a **soma das duas** (`totalNaoLidas` inalterado). Tipo `Conversa` ganhou `tipo: 'cliente' | 'parceiro'` e `loja_parceira_nome`; `buildConversasB2B()` no seed cria 3 conversas B2B fictícias (repasses entre lojas — Garagem RS Motors, AutoCenter Canoas, Premium Motors Gravataí). Conversa de parceiro abre a mesma `ConversaScreen` identificando a **loja parceira** no cabeçalho; o card mostra ícone de "business" (info) em vez do WhatsApp e o contato da loja. Novo método `chatService.naoLidasPorTipo()` disponível para a API futura.
  - **Validação:** `tsc --noEmit` limpo em `apps/mobile`. Alternar abas troca a lista; badges por aba corretos; soma no ícone da tab bar preservada.

- [x] **M050 — Validação geral do mobile: comparação módulo a módulo com o gestor web** _(2026-07-09)_ · P1 (QA / paridade) · `apps/mobile/`
  - **Feito:** varredura completa das 18 telas do mobile (`apps/mobile/src/screens/`) contra as 22 páginas do gestor web (`apps/gestor/src/pages/`). Resultado consolidado abaixo e transformado nos itens M051–M056.
  - **Em paridade (OK):**
    - **Dashboard** — escopo vendedor/loja, 4 KPIs por escopo, ações rápidas, gráfico de vendas por mês, alertas/notificações. Equivale a `Dashboard.tsx`.
    - **Estoque** — lista + filtros, form de veículo com tipos ampliados (carro/moto/barco/jet/aeronave/reboque/outro) e matriz de campos por tipo, detalhe, mídia unificada. Equivale a `Estoque.tsx`.
    - **CRM** — kanban/lista por etapa, lead form, detalhe com interações. Equivale a `CRM.tsx`.
    - **PosVenda** — esteira (contrato→pagamento→documentos→transferência), detalhe com checklist. Equivale a `PosVenda.tsx`.
    - **Minhas Comissões** — vendas do vendedor, valores a receber. Equivale a `MinhasComissoes.tsx`.
    - **Financeiro** (gestor) — receitas/despesas/comissões, resumo. Equivale a `Financeiro.tsx`.
    - **Equipe** (gestor) — membros, papéis, % comissão. Equivale a `Equipe.tsx`.
    - **Simulador** — cálculo de parcelas. Equivale a `ferramentas/Simulador.tsx`.
  - **Divergências já registradas:** Chat sem abas Parceiros/Clientes ([[M049]]); Configurações sem seções da loja ([[M048]]).
  - **Gaps novos (viraram itens):** Ferramentas incompletas ([[M051]] Contratos, [[M052]] Notas Fiscais, [[M053]] Meu Site, [[M054]] FIPE) · Rede Social / Feed B2B de repasses ausente ([[M055]]) · Marketing IA + Assistente IA ausentes ([[M056]]).
  - **Fora do escopo mobile (confirmado):** Painel Admin (`Admin.tsx`), Impersonar (`Impersonar.tsx`), Aprovações (`Aprovacoes.tsx` — fluxo de gestor aprovar solicitações; nice-to-have, não bloqueante). O Admin permanece exclusivamente web ([[M045]]).
  - **⚠️ Correção (2026-07-09, reauditoria profunda):** a lista "em paridade" acima foi feita a nível de _tela_ (existe/não existe), não de _recurso_. Uma reauditoria recurso-a-recurso (3 agentes, gestor×mobile) revelou que vários módulos marcados como "em paridade" na verdade **simplificam bastante** o equivalente web. Divergências reais viraram os itens **[[M057]]–[[M070]]** abaixo. Módulos afetados: Simulador, Estoque (venda/custos/docs/FIPE/KePlaca/aprovação), CRM (clientes/negociações), AssistenteIA (divergência conceitual), PosVenda, Financeiro, RedeSocial, Contratos, Marketing, Equipe, NotasFiscais, MeuSite, Configurações.

### Paridade recurso-a-recurso — gaps da reauditoria (M057–M070, mock-first)

- [x] **M057 — Simulador mobile: multi-banco + dados de cliente/veículo + resultados por banco + paywall** _(2026-07-09)_ · P1 (paridade) · `apps/mobile/src/screens/ferramentas/SimuladorScreen.tsx` + `services/simulador.ts`
  - **Feito:** gate do módulo `simulador` (Paywall); seleção multi-banco (BV/C6/Itaú/Santander); nome do cliente + escolher veículo do estoque (pré-preenche valor/entrada); estimativa Price local + **resultados por banco** (mock `simuladorService` com taxas/parcelas por banco, nega quando entrada < 10%); compartilhar proposta. Automação real via extensão Chrome é desktop-only — não portada.
  - **Gap:** mobile só faz cálculo Price local (valor/entrada/parcelas/taxa). Web (`ferramentas/Simulador.tsx`) tem: seleção de **múltiplos bancos** (BV/C6/Itaú/Santander) + status configurado, **dados do cliente** (CPF com busca, nome, nascimento, telefone), **dados do veículo** (placa com busca no estoque, marca/modelo/ano), **simulação por banco** (resultados com status/taxa/prazo/parcela), **paywall** do módulo `simulador`, e imprimir proposta.
  - **O que fazer:** manter a calculadora Price, e adicionar (mock): gate do módulo `simulador`; seleção de bancos; escolher veículo do estoque (OptionSheet, pré-preenche valor); dados do cliente; tela de resultados por banco (mock com taxas/parcelas fictícias por banco). Automação real via extensão Chrome é **desktop-only** (o próprio web bloqueia no mobile) — não portar.

- [x] **M058 — Estoque: fluxo de venda composto + custos** _(2026-07-09; docs/aprovação adiados)_ · P1 (paridade) · `apps/mobile/src/screens/estoque/*` + `services/veiculos.ts`
  - **Feito:** venda com **pagamento composto** (dinheiro + financiamento + troca) com barra de saldo (fecha/falta/excede) e **comissão prevista**; veículo de troca entra no estoque como rascunho (inativo). **Histórico de custos de preparação** por veículo (categoria/descrição/valor) que lança **despesa no Financeiro** e projeta lucro (custo compra + preparação → lucro projetado).
  - **Adiado (anotado):** upload de documentos de venda e gate de aprovação do vendedor (excluir/reajustar com motivo → APROVACAO_PENDENTE) — menor valor no mobile.
  - **Gap:** venda mobile só captura comprador+valor+vendedor. Web tem venda composta (**troca + dinheiro + financiamento** com barra de saldo composto/falta/comissão), captura do veículo de troca (entra como rascunho), cadastro rápido do comprador, e redireciona ao contrato gerado. Falta também: **histórico de custos/preparação** (mecânica/pintura/pneus → despesa no Financeiro + lucro projetado), **Venda & Docs** (upload de contrato/NF/garantia/laudo, flag "visível ao comprador"), e **aprovação do vendedor** (excluir/reajustar preço exige motivo → APROVACAO_PENDENTE).
  - **O que fazer (faseável):** priorizar venda composta (troca/dinheiro/financiamento) + comissão calculada; depois custos de preparação e docs; por fim o gate de aprovação do vendedor (motivo obrigatório). Mock-first.

- [x] **M059 — CRM: carteira de Clientes + histórico de Negociações** _(2026-07-09)_ · P1 (paridade) · `apps/mobile/src/screens/crm/*` + `services/clientes.ts`
  - **Feito:** aba **Clientes** (via header do CRM): lista + busca por nome/CPF/telefone + `ClienteForm` completo (CPF/CNPJ/RG, nascimento, e-mail, renda, **CEP com auto-endereço ViaCEP**, endereço/bairro/cidade/UF, observações) com criar/editar/remover. **Negociações** por lead (histórico de propostas com valor/entrada/parcelas/obs) substituindo a proposta única. Kanban DnD segue P3 (lista+sheet aceitável no mobile).
  - **Gap:** mobile não tem gestão de clientes (lead só guarda nome+telefone). Web tem aba **Clientes** (lista + busca por nome/CPF/telefone + `ClienteModal` completo: CPF/CNPJ/RG, nascimento, e-mail, renda, CEP c/ auto-endereço, endereço completo, observações, validações) e **múltiplas propostas por lead** (Negociações: valor/entrada/parcelas/obs como histórico). Kanban com drag-and-drop também (mobile é lista+sheet).
  - **O que fazer:** adicionar tela/aba de Clientes (CRUD mock + busca) e histórico de negociações por lead (entrada/parcelas). Kanban DnD é P3 (lista+sheet é aceitável no mobile).

- [ ] **M060 — Assistente do Vendedor: alinhar ao copiloto de WhatsApp do web (divergência conceitual)** · P1 (paridade / produto) · `apps/mobile/src/screens/ferramentas/AssistenteIAScreen.tsx`
  - **Gap:** mobile é um chatbot genérico de dicas de venda. Web (`AssistenteIA.tsx`) é um **copiloto de WhatsApp**: conectar sessão (QR), lista de conversas de leads reais, autonomia por conversa (copiloto×automático), painel de sugestão da IA (editar/enviar/enviar como áudio), **voz clonada (ElevenLabs)**, config de tom + consentimento LGPD, treino por upload de áudio + roteiro guiado (gravador in-app).
  - **Decisão de produto (bater com o fundador):** o recorte mobile do copiloto de WhatsApp (é o produto real) vs. manter o chatbot de dicas como algo à parte. Ver [[stack-ia-assistente-vs-marketing]] (Groq/Llama+Whisper no real). Mock-first quando definido.

- [x] **M061 — PosVenda: anexar documento, concluir esteira explícito, add/remover itens** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/posvenda/EsteiraDetalheScreen.tsx` + `services/esteira.ts`
  - **Feito:** botão **Concluir pós-venda** com regra de itens obrigatórios pendentes (bloqueia + mostra quantos faltam); **anexar documento** (mock nome do arquivo) em itens de documento; **adicionar/remover itens** do checklist (gestor).
  - **Gap:** web permite **anexar PDF** a itens de documento, **"Concluir esteira"** explícito (com regra de itens obrigatórios pendentes → bloqueia), e **adicionar/remover itens** do checklist (RBAC gestor). Mobile só alterna status dos itens (conclusão é efeito colateral do último item).
  - **O que fazer:** botão Concluir com validação de obrigatórios; anexar documento (mock); add/remover item de checklist gateado por papel.

- [x] **M062 — Financeiro: filtro por período + excluir/alternar pagamento + vincular veículo** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/financeiro/FinanceiroScreen.tsx`
  - **Feito:** filtro de **período** (mês/ano, ou ano inteiro) dirigindo resumo + lista; sheet de ações do lançamento com **alternar pago/pendente** e **excluir**; campo **veículo** (opcional) no novo lançamento.
  - **Gap:** web tem filtro **mês/ano** (dirige resumo + lista), **excluir** lançamento, **alternar pago/pendente** inline, e **vincular veículo** no novo lançamento. Mobile: resumo fixo no mês atual, lista sem filtro de data, `alternarPagamento` existe no service mas a tela nunca expõe, sem excluir, sem vínculo de veículo.
  - **O que fazer:** filtro de período (mês/ano), expor alternar pagamento, excluir lançamento, campo veículo no novo lançamento.

- [x] **M063 — Rede Social: comentários, iniciar chat B2B, favoritar/filtros de parceiros** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/rede/RedeSocialScreen.tsx` + `services/{repasses,chat}.ts`
  - **Feito:** **comentários** no feed (sheet listar/enviar); **iniciar chat B2B** a partir do card do feed e do card de parceiro (`chatService.abrirConversaParceiro` cria/reaproveita conversa que aparece na aba Parceiros do [[M049]]); **favoritar parceiro** + busca + filtro Todos/Favoritos no diretório.
  - **Gap:** web tem **comentários** no feed, **mensagem direta a partir do post**, **chat B2B realtime** (lista/histórico/enviar/badges), aba **Clientes** (leads da vitrine + triagem IA quente/ruído), **favoritar parceiro** + filtro, busca/cidade/UF no diretório, link "Ver Vitrine". Mobile tem feed+curtir+propor+parceiros(WhatsApp), sem comentários nem chat in-app. **Obs:** o chat B2B já foi parcialmente feito no [[M049]] (abas no ChatScreen) — aqui é integrar o "Iniciar chat" a partir do feed/proposta/parceiro.
  - **O que fazer:** comentários (mock), iniciar chat B2B a partir do card/proposta (liga com [[M049]]), badges de não lidas, favoritar + filtros no diretório.

- [x] **M064 — Contratos: criar contrato + mudar status + emitir NF-e** _(2026-07-09; templates HTML adiados)_ · P2 (paridade) · `apps/mobile/src/screens/ferramentas/ContratosScreen.tsx`
  - **Feito:** **criar contrato** (Fab + sheet: tipo, veículo, cliente, valor, entrada, parcelas, obs); **mudar status** (rascunho→aguardando→assinado→cancelado via OptionSheet); atalho **Emitir NF-e** a partir de contrato compra_venda. Templates HTML (editor rico) adiados — pesados no mobile.
  - **Gap:** mobile é read-only (lista/detalhe/PDF). Web tem **criar contrato** (tipo, cliente/veículo, valores, entrada, parcelas, template + campos extras), **aba Modelos** (CRUD de templates HTML + variáveis do sistema), **mudar status** (rascunho→aguardando→assinado→cancelado), compartilhar por WhatsApp, atalho **Emitir NF-e**, busca/filtros/KPIs.
  - **O que fazer:** criar contrato (mock) + mudar status + atalho para [[M052]] (Notas Fiscais). Templates HTML são P3 (editor rico é pesado no mobile).

- [x] **M065 — Marketing IA: canal/hashtags/destaques + publicar + agendar + histórico** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/ferramentas/MarketingScreen.tsx` + `services/marketing.ts`
  - **Feito:** seleção de **canal** (IG/FB/WhatsApp/OLX) com **hashtags por canal** (OLX sem), campo **destaques**; **publicar** e **agendar** (mock, opções relativas) + **histórico** de publicações (status publicado/agendado/falhou + cancelar agendamento). Legenda segue mock determinístico (sem LLM).
  - **Gap:** mobile gera legenda + Share do SO. Web tem seleção de **rede/canal** (IG/FB/WhatsApp/OLX), **hashtags**, campo **destaques**, **publicar** nas redes conectadas, **agendar** (data/hora), **histórico** de posts (status publicado/agendado/falhou + cancelar), banner de redes conectadas e de BYOK.
  - **O que fazer:** canal + hashtags + destaques na geração; histórico mock; publicar/agendar mock (respeitando redes conectadas do [[M048]] Redes Sociais).

- [x] **M066 — Equipe: senha provisória + remover membro + config IA por vendedor** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/equipe/EquipeScreen.tsx`
  - **Feito:** **senha provisória** obrigatória no convite (mín. 6); **remover membro** (edição, exceto gestor); **config do Assistente de IA** por vendedor (habilitar + autonomia copiloto/automático → `equipeService.configurarIA`).
  - **Gap:** web tem **senha provisória** no convite, **remover membro**, e **Config. IA por vendedor** (habilitar assistente + autonomia copiloto/automático). Mobile só ativa/desativa e edita %.
  - **O que fazer:** campo senha no convite, remover membro (confirmação), e config de IA por vendedor (liga com [[M060]]).

- [x] **M067 — Notas Fiscais: CC-e + download DANFE/XML + motivo de rejeição** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/ferramentas/NotasFiscaisScreen.tsx`
  - **Feito:** botões **DANFE/XML** (abrem via Linking); **motivo de rejeição** exibido no card; **Carta de Correção (CC-e)** com histórico por sequência (`emitirCartaCorrecao` mock, ≥15 caracteres); menu de ações (⋮) com CC-e e Cancelar.
  - **Gap:** web tem **Carta de Correção (CC-e)**, links de **download DANFE (PDF)/XML**, exibe **motivo de rejeição**, e pré-seleção de contrato via deep-link. Mobile: emitir + cancelar apenas.
  - **O que fazer:** CC-e (modal + histórico, mock), botões de DANFE/XML (mock/Linking), exibir motivo de rejeição.

- [x] **M068 — Meu Site: cor secundária + upload logo/banner + SEO title/description** _(2026-07-09)_ · P3 (paridade) · `apps/mobile/src/screens/ferramentas/MeuSiteScreen.tsx`
  - **Feito:** **cor secundária** (usada no CTA do preview); **upload de logo e banner** (expo-image-picker); seção **SEO** (title/description "como aparece no Google").
  - **Gap:** web tem **cor secundária**, **upload de logo/banner/favicon**, e **SEO** (title/description "como aparece no Google"). Mobile: só cor primária (paleta de 7), sem imagens, só GA4/Pixel.
  - **O que fazer:** cor secundária, upload de logo/banner (via image-picker já instalado), campos de SEO.

- [x] **M069 — Configurações: CEP com auto-endereço no Perfil da Loja** _(2026-07-09)_ · P3 (paridade) · `apps/mobile/src/screens/mais/config/PerfilLojaScreen.tsx` + `lib/cep.ts`
  - **Feito:** ao sair do campo CEP (`onBlur`), `buscarCep` (ViaCEP) preenche endereço/cidade/UF automaticamente. Helper `lib/cep.ts` compartilhado (também usado no cadastro de clientes do [[M059]]).
  - **Gap:** web preenche endereço/bairro/cidade/UF automaticamente ao sair do campo CEP (`buscarCEP`). Mobile só aplica a máscara.
  - **O que fazer:** lookup de CEP (ViaCEP) no blur, preenchendo os campos. Simples e alto valor de UX.

- [x] **M070 — Estoque: FIPE/precificação + KePlaca + ordenação + KPIs** _(2026-07-09)_ · P3 (paridade) · `apps/mobile/src/screens/estoque/*` + `services/veiculos.ts`
  - **Feito:** **KPIs** no topo do Estoque (total/disponíveis/na vitrine); **ordenação** (mais recentes/maior-menor preço/menor km/ano mais novo); **KePlaca** mock (`consultarPlaca` preenche marca/modelo/ano/cor no form); **card de precificação FIPE** no detalhe (valor de referência, margem sobre FIPE, dias em estoque, **alerta de encalhe** > 60 dias).
  - **Gap:** web tem card **FIPE** (valor, margem sobre FIPE, alerta de encalhe/dias em estoque), **KePlaca** (consulta de placa auto-preenche marca/modelo/ano), **ordenação** por ano/km/preço, e **KPIs** (total/disponíveis/na vitrine). Mobile não tem nenhum.
  - **O que fazer:** KePlaca (liga com o service de FIPE do [[M054]]), ordenação na lista, KPIs no topo, card de precificação FIPE + alerta de encalhe.

> **Fase mobile M051–M056 concluída em 2026-07-09** (autonomia total autorizada). Infra compartilhada nova: `modulosService` (gate de módulos pagos, mock — fiscal/site/marketing liberados, assistente **bloqueado** p/ demonstrar o paywall), componente `Paywall` reutilizável (`components/ui/Paywall.tsx`), e 6 services mock-first (`fipe`, `contratos`, `notasFiscais`, `site`, `repasses`, `marketing`) — todos com as mesmas assinaturas da API futura. Navegação e MaisScreen atualizados. `tsc --noEmit` limpo. **Swap p/ API real = só reimplementar cada service.**

- [x] **M051 — Ferramentas/Contratos no mobile** _(2026-07-09)_ · P3 (paridade) · `apps/mobile/src/screens/ferramentas/ContratosScreen.tsx` + `services/contratos.ts`
  - **Feito:** lista de contratos (número, status com badge, veículo/cliente, valor, data) + sheet de detalhe + botão **Abrir PDF** (via `Linking`, URL fictícia; toast honesto quando indisponível offline). Mock com 5 contratos (compra_venda/compra, status assinado/aguardando/rascunho). Alimenta a emissão de NF-e ([[M052]]).

- [x] **M052 — Ferramentas/Notas Fiscais no mobile** _(2026-07-09)_ · P3 (paridade, módulo pago) · `apps/mobile/src/screens/ferramentas/NotasFiscaisScreen.tsx` + `services/notasFiscais.ts`
  - **Feito:** **gate do módulo `fiscal`** (Paywall quando não liberado). Lista de notas com status (autorizada/processando/cancelada), chave de acesso de 44 díg., valor. Emissão a partir de um contrato assinado (cria em `processando` → autoriza assíncrono após ~2,5s, mesma UX do gestor). Cancelamento com justificativa obrigatória (≥15 caracteres, aviso de irreversível). Mock-first.

- [x] **M053 — Ferramentas/Meu Site no mobile** _(2026-07-09)_ · P3 (paridade, módulo pago) · `apps/mobile/src/screens/ferramentas/MeuSiteScreen.tsx` + `services/site.ts`
  - **Feito:** **gate do módulo `site`** (Paywall). Editor: status publicado/rascunho + link do subdomínio, publicar/despublicar (exige hero_titulo), template (`OptionSheet` clean/premium/compacto), paleta de cor primária, conteúdo (hero título/subtítulo/CTA/sobre), analytics (GA4/Meta Pixel). **Preview em tempo real** (mock de browser com o hero renderizado ao vivo — cor/título/subtítulo/CTA/template). Mock-first. Domínio próprio/SSL segue fora (mesma pendência do [[M038]]).

- [x] **M054 — Ferramentas/FIPE no mobile** _(2026-07-09)_ · P3 (paridade) · `apps/mobile/src/screens/ferramentas/FipeScreen.tsx` + `services/fipe.ts`
  - **Feito:** consulta em cascata Tipo (Segmented carro/moto/caminhão) → Marca → Modelo → Ano (via `OptionSheet`, com loading por etapa) → **valor FIPE** em destaque. Catálogo mock reduzido com depreciação ~7% a.a. sobre a base do modelo. Espelha os endpoints `/veiculos/fipe/*` do gestor.

- [x] **M055 — Rede Social / Feed de repasses (B2B) no mobile** _(2026-07-09)_ · P2 (paridade) · `apps/mobile/src/screens/rede/RedeSocialScreen.tsx` + `services/repasses.ts`
  - **Feito:** tela com 3 abas (`FilterChips`): **Feed** (publicações de repasse de parceiros — loja/autor, veículo, valor, curtir, e **Propor repasse** via sheet com valor+observações), **Propostas** (enviadas/recebidas, status; recebida→aceitar/rejeitar, enviada→cancelar), **Parceiros** (diretório de lojas com verificada/cidade/total de veículos + botão WhatsApp via `Linking`). Acessível pelo menu Mais → Gestão. Liga com o chat B2B do [[M049]]. Mock-first.

- [x] **M056 — Marketing IA + Assistente de IA no mobile** _(2026-07-09)_ · P3 (paridade, módulos pagos) · `apps/mobile/src/screens/ferramentas/{MarketingScreen,AssistenteIAScreen}.tsx` + `services/marketing.ts`
  - **Feito:** **Marketing IA** (gate `marketing`) — recorte mobile forte: escolher veículo do estoque + tom (entusiasmado/sofisticado/direto) → **gerar legenda** (mock determinístico por template, com hashtags) → **Compartilhar** via `Share` nativo (Instagram/WhatsApp) ou refazer. **Assistente do Vendedor** (gate `assistente`, **bloqueado no mock** → mostra o Paywall; a UI de chat com sugestões e respostas mock já está pronta para quando o módulo for liberado). Respeita a decisão de stack ([[stack-ia-assistente-vs-marketing]]): o app real usa Groq/Llama no assistente e Claude no marketing — aqui é tudo mock.

- [x] **M073 — Usabilidade mobile: fluxo de venda, módulos do vendedor, Mais/CRM ágil, notificações acionáveis, cadastro rápido por placa** _(2026-07-11)_ · P1 (UX/paridade real, não mock) · múltiplos arquivos `apps/api` + `apps/mobile`
  - **Feito (6 fases, spec original `usabilidade-mobile-diagnostico.md`, dev-master):**
    1. **Fluxo de venda ponta a ponta** — `EsteiraPosVenda.lead_id` (migration `b8227b6208e4`), `VenderVeiculoRequest/Response.lead_id`; sheet de venda extraído para `apps/mobile/src/components/RegistrarVendaSheet.tsx` (reusado por `VeiculoDetalheScreen` e `LeadDetalheScreen`, com seletor de veículo quando aberto sem veículo fixo); `LeadDetalheScreen` abre o sheet automaticamente ao mover lead para "Fechamento"; `EsteiraDetalheScreen` ganhou botões contextuais "Gerar contrato"/"Emitir NF-e" nos cards de categoria (navegando com `contratoId`); `ContratosScreen`/`NotasFiscaisScreen` aceitam `route.params.contratoId` e destacam visualmente o item correspondente; `DashboardScreen` ganhou card "Vendas em andamento (N)".
    2. **Módulos do vendedor** — `MaisScreen`/`DashboardScreen` passam a usar `parseModulos(user.modulos)` (via `lib/modulos.ts`) para decidir o que aparece a um vendedor, em vez de só checar o papel; `gestor` agora é estritamente `papel === 'gestor'`.
    3. **Mais reorganizado + CRM ágil** _(mockup aprovado pelo usuário antes de codar)_ — `MaisScreen` ganhou grade de atalhos no topo (4 itens por papel: vendedor Simulador/Assistente IA/Comissões/FIPE, gestor Financeiro/Equipe/Pós-venda/Marketing), sem remover nenhum item da lista abaixo. `CrmScreen` ganhou `SearchBar` (nome/veículo/telefone), long-press no `LeadCard` abre `OptionSheet` de etapa direto da lista (`Card` ganhou prop `onLongPress`), chip "Ativos" renomeado (era "Funil"), chip fixo "Clientes" com destaque visual.
    4. **Notificações acionáveis** — padronizado o valor de `Notificacao.link` nos 6 pontos de criação (`esteira_worker.py`, `b2b.py` ×4, `vitrine_interativo.py`) para o formato `"<tipo>:<id>"` (`esteira:`, `chat:`, `rede_social:`); mobile parseia o link no sheet de notificações do `DashboardScreen` e navega para `EsteiraDetalhe`/`Conversa` conforme o prefixo, marcando como lida em paralelo. `Notificacao`/`Conversa.nome` ajustados (`nome` virou opcional).
    5. **Cadastro rápido por placa** — `VeiculoFormScreen` ganhou modo rápido (padrão ao criar): badge "sempre entra como rascunho", força `publicado_marketplace=false`, e as seções "Detalhes técnicos" e "Opcionais e descrição" viram acordeões colapsados (campos essenciais tipo/placa/marca-modelo/preço/fotos continuam sempre visíveis).
    6. **Polimentos** — avatar do `DashboardScreen` agora navega para a aba "Mais" em vez de "Configurações".
  - **Validação:** `tsc --noEmit` limpo em `apps/mobile` após cada fase; `python -c "import ast; ..."` limpo nos arquivos Python tocados; migration `b8227b6208e4` aplicada com sucesso (`alembic upgrade head`).
  - **Pendências conhecidas:** notificações do tipo `lead:` ainda não são emitidas por nenhum ponto do backend (só `esteira:`/`chat:`/`rede_social:` existem hoje) — o parser mobile já suporta o prefixo para quando for implementado.

---

## Abertas

- [x] **M072 — Dashboard mobile: KPI "Estoque ativo" mostra 0 mas Estoque lista os veículos** _(2026-07-10)_ · P2 (UX / bug) · `apps/api/routers/financeiro.py`, `apps/mobile/src/screens/{dashboard/DashboardScreen,estoque/EstoqueScreen}.tsx`, `apps/mobile/src/navigation/types.ts`
  - **Origem:** usuário reportou card "Estoque ativo" no Dashboard mostrando 0, mas ao clicar (navegar pra Estoque) apareciam 7 veículos.
  - **Causa raiz:** não era bug de cálculo — descompasso de critério. O KPI (`financeiro.py:142-146`) conta só `Veiculo.status == DISPONIVEL`; a tela Estoque do mobile (`EstoqueScreen.tsx:39`) lista **todos** os veículos sem filtro de status por padrão. Os 7 veículos da loja estavam em outro status (reservado/repasse/vendido/inativo) — o card reportava corretamente 0 disponíveis, mas a tela de destino não refletia esse recorte, confundindo o usuário.
  - **Feito:** alinhada a tela ao critério do KPI (não o inverso — "Estoque ativo" deve mesmo significar "disponível para venda"). `MainTabsParamList['Estoque']` ganhou `{ statusInicial?: 'disponivel' | 'todos' }`; `EstoqueScreen` lê `route.params?.statusInicial` como valor inicial do filtro (`useState`); o card do Dashboard agora navega com `params: { statusInicial: 'disponivel' }`. Outros pontos de navegação para Estoque (menu, tab bar) continuam sem filtro (`'todos'` por padrão) — só o clique vindo do KPI é escopado.
  - **Validação:** `tsc --noEmit` limpo em `apps/mobile`. Clicar no card agora abre Estoque já filtrado pelo chip "Disponível", mostrando a mesma contagem do KPI.

- [x] **M071 — Marketing IA: Endurecer OAuth/publicação Meta no backend e portar para o Mobile** _(2026-07-10)_ · P1 (paridade / segurança) · `apps/api/routers/marketing_social.py` + `apps/api/marketing_worker.py` + `apps/mobile/src/services/{marketing,config}.ts` + `apps/mobile/src/screens/ferramentas/MarketingScreen.tsx` + `apps/gestor/src/pages/Ajuda.tsx` + `apps/mobile/src/screens/mais/config/RedesSociaisScreen.tsx`
  - **Spec:** `documentos/tarefa/specs/m071-marketing-meta-publicacao-design.md`.
  - **Achado ao auditar:** a maior parte já tinha sido implementada em sessões anteriores sem fechar o item — CSRF assinado no `state` (1.1), escolha de página multi-conta (1.2), validação IG sem mídia (1.3) e refresh de token com tick diário (1.4) já estavam no backend; o service `marketingSocial`/tela de publicar-agendar-histórico já estavam no mobile (migrados para API real no M045); e os tópicos de Ajuda no gestor (`marketing` + `marketing-meta-setup` gestorOnly + FAQ do Instagram) já existiam.
  - **Gap real encontrado e corrigido:** no mobile, `RedesSociaisScreen.tsx` chamava `conectarRede()` mas **nunca abria a URL OAuth** (botão "Conectar via Meta" não fazia nada de fato) e o callback do backend só sabia redirecionar para `/configuracoes` (rota do gestor web), sem volta pro app. Resolvido com: `state` assinado ganhou campo `origem` (`web`/`app`); `_redirect_final()` novo decide entre path do gestor ou deep link `socialveiculos://meta-callback`; `app.json` ganhou `"scheme": "socialveiculos"`; `RedesSociaisScreen.tsx` agora chama `Linking.openURL(oauth_url)`, escuta o retorno via `Linking.addEventListener('url', …)` e mostra um `Sheet` de escolha de página quando o backend sinaliza múltiplas páginas Meta (`configService.metaPaginasPendentes`/`metaConfirmarPagina`, novos, reaproveitando os endpoints já existentes `/social-auth/meta/paginas` e `/confirmar`). Também corrigido `marketingService.publicar()` no mobile, que ignorava falha parcial por rede (ex.: IG sem mídia) e sempre reportava "publicado com sucesso" — agora lança erro com o detalhe por rede, no mesmo padrão que o gestor web (`Marketing.tsx:200-204`) já usava.
  - **Validação:** `tsc --noEmit` limpo em `apps/mobile`; `python -c "import main"` limpo em `apps/api` (backend sobe sem erro de sintaxe/import). Sem teste em device real ainda — falta exercer o deep link num Expo Go real ou build dev (URL scheme só funciona fora do Expo Go gerenciado por padrão a partir do SDK atual; validar se precisa de `expo-dev-client` para testar `Linking` de scheme customizado).

- [x] **M047 — Inputs de Marca/Modelo: Placeholders dinâmicos por tipo de veículo (Mobile e Gestor)** _(2026-07-09)_ · P3 (UX) · `apps/mobile/src/screens/estoque/VeiculoFormScreen.tsx`, `apps/gestor/src/components/VehicleIdentityFields.tsx`
  - **Feito:**
    - Criada a função helper `getPlaceholders` que retorna placeholders apropriados de marca e modelo baseado no tipo de veículo selecionado (Moto, Caminhão, Barco, Jet Ski, Aeronave, Reboque, Outro e Carro).
    - No app Mobile (`VeiculoFormScreen.tsx`), substituídos os placeholders estáticos `"Ex.: Toyota"` e `"Ex.: Corolla"` pelos novos placeholders dinâmicos.
    - No Gestor (`VehicleIdentityFields.tsx`), substituídos os placeholders estáticos `"Marca"` e `"Modelo"` pelos novos placeholders dinâmicos correspondentes ao tipo de veículo selecionado.
  - **Validação:** Edições manuais e conferência de tipagem e renderização nos componentes correspondentes.


- [x] **M046 — Rede Social: Nomenclatura, Reposicionamento do Diretório de Parceiros e Chat Unificado com Sub-abas** _(2026-07-06)_ · P2 (UX) · `apps/gestor/src/pages/RedeSocial.tsx`
  - **Feito:**
    - Renomeação da seção "Rede de Repasses" para **"Rede Social"** no cabeçalho e simplificação das abas superiores (Feed de Repasses -> **Feed**, Propostas de Repasse -> **Propostas**).
    - Remoção do botão "Diretório de Parceiros" do menu principal de abas superiores, adicionando-o na extremidade direita do cabeçalho como um botão azul destacado chamado **"Ver Parceiros"**.
    - Unificação dos chats de parceiros e de clientes sob um único botão superior **"Chats"** (mostrando a soma dos balões de não lidas).
    - Internamente na sidebar do chat, os títulos foram convertidos em abas interativas (**"Parceiros"** e **"Clientes"**), separando os chats por guia no próprio título da sidebar e mostrando o indicador individual de não lidas em cada uma.
  - **Validação:** Compilação limpa do Vite (`pnpm run build` bem-sucedido).

- [x] **M044 — Estoque: ordenação por prioridade de status + Esteira: destaque do botão "Mostrar finalizados"** _(2026-07-05)_ · P3 (UX) · `apps/api/routers/veiculos.py`, `apps/gestor/src/pages/PosVenda.tsx`
  - **Feito:** Endpoint `/veiculos` passou a ordenar primeiro por uma cláusula `case` do SQLAlchemy priorizando status `DISPONIVEL` (1) e `RESERVADO` (2), seguidos de `REPASSE` (3) e por último `VENDIDO`/`INATIVO` (4/5), mantendo a ordenação secundária escolhida pelo usuário. O botão "Mostrar finalizados" da Esteira Pós-venda (`PosVenda.tsx`) passou a usar `.btn-outline` com cor invertida: azul primário destacado quando os finalizados estão ocultos (incentivando o clique) e cinza/outline neutro quando já estão visíveis.

- [x] **M043 — Fila de Aprovações: metadados do veículo no card + motivo obrigatório do vendedor** _(2026-07-05)_ · P2 (UX / auditoria) · `apps/api/models.py`, `apps/api/routers/*` (fila de aprovações), `apps/gestor/src/pages/Estoque.tsx`, `apps/gestor/src/pages/Aprovacoes.tsx`
  - **Feito:** Adicionada a coluna `motivo` na tabela `solicitacao_aprovacao`. Ao listar solicitações pendentes, o backend resolve e anexa dinamicamente os dados do veículo associado (`veiculo_marca`, `veiculo_modelo`, `veiculo_placa`, `veiculo_ano`, `veiculo_cor`). Quando um vendedor solicita exclusão ou alteração de preço de um veículo no Estoque (`Estoque.tsx`), passa a ser exigido um campo obrigatório "Motivo da Alteração/Exclusão" (estilizado no próprio fluxo, sem `prompt()` nativo), gravado no banco. A tela `Aprovacoes.tsx` passou a exibir marca, modelo, ano, cor e placa no corpo do card, substituindo a exibição do ID/GUID bruto.

- [x] **M042 — Pós-venda, Cadastro Rápido e Financeiro: correção de PDF de contrato, modal customizado e polimento de inputs** _(2026-07-05)_ · P2 (UX / correção) · `apps/gestor/src/pages/ferramentas/Contratos.tsx`, `apps/gestor/src/pages/Estoque.tsx`, `apps/gestor/src/pages/PosVenda.tsx`, `apps/gestor/src/pages/Financeiro.tsx`, `apps/gestor/src/styles/theme.css`
  - **Feito:** Aplicada a máscara `capitalizarNome` no campo "Nome completo" do Cadastro Rápido (`VenderModal` em `Estoque.tsx`), capitalizando a primeira letra de cada palavra em tempo real. Corrigida a URL de geração de PDF do contrato em `Contratos.tsx` para `/v1/contratos/{contrato_id}/pdf` (removendo duplicação de `/v1` herdada da base URL) e trocada a origem do token de autenticação para o estado persistido do `useAuthStore` (em vez da chave inexistente `sv_token` no localStorage), anexando também `X-Loja-Id` para suportar impersonações. Substituído o `confirm()` nativo do navegador por `useUIStore.getState().confirm` em `handleDeletarItem` (`PosVenda.tsx`), padronizando com o design system Velocity Glass. Adicionado estado visual desabilitado genérico para `.btn` no `theme.css` (`opacity: 0.5; cursor: not-allowed; pointer-events: none`). Refatorado o botão de ação do rodapé do modal de detalhe em `PosVenda.tsx` para alternar dinamicamente entre "Salvar" e "Concluir esteira" conforme itens pendentes. Trocados os seletores nativos de mês/ano do Fechamento Financeiro (`Financeiro.tsx`) pela classe `.filter-select` e estilizado globalmente o `::-webkit-calendar-picker-indicator` de todos os `input[type="date"]` com ícone SVG customizado responsivo ao hover.

- [x] **M041 — Painel Admin: Edição de Garagens e liberação de módulos premium** _(2026-07-04)_ · P2 (UX / Gestão) · `apps/admin/src/AdminPage.tsx`, `apps/api/routers/admin.py`
  - **Feito:** Adicionado botão "Editar" na listagem de garagens (lojas) do Painel Admin que abre o modal `ModalEditarLoja`. O modal permite atualizar as propriedades cadastrais da loja (nome, CNPJ, cidade, UF, telefone e WhatsApp) e também gerenciar individualmente os módulos premium ativos (Contratos, Simulador, Marketing, Assistente de IA, Fiscal e Meu Site/Vitrine). No backend API, o schema `EditarLojaRequest` e o endpoint `PATCH /admin/lojas/{loja_id}` foram atualizados para suportar o recebimento e atualização de `modulos_ativos` no banco SQLite, e o endpoint `GET /admin/lojas/{loja_id}` agora retorna a lista `modulos_ativos` real correspondente aos registros habilitados.
  - **Validação:** Compilação TypeScript (`tsc -b`) limpa em `apps/admin` e build estático do Vite concluído com sucesso.

- [x] **M040 — Roteiro guiado para gravação da amostra de voz (clonagem ElevenLabs)** _(2026-07-04)_ · P3 (UX) · `apps/gestor/src/pages/AssistenteIA.tsx` (bloco "Treinar IA com seu Áudio", linhas ~710-737)
  - **Feito:** botão "🎙️ Gravar com roteiro guiado" abre `RoteiroGravacaoModal` com texto sugerido (~40-60s, cobre saudação/números/despedida), botão **copiar texto**, dica de ambiente silencioso. Gravação **in-browser via `MediaRecorder`** (sem libs novas) com medidor de tempo (mm:ss), player de replay antes de confirmar, botão **Regravar**, e aviso quando a duração fica abaixo do mínimo recomendado (20s) — avisa via toast se tentar confirmar abaixo do limite, sem bloquear. Upload de arquivo continua disponível como alternativa (input `type="file"` mantido ao lado). Ao confirmar, gera um `File` (`audio/webm`) que alimenta o mesmo `handleUploadAudio` já existente — nenhum endpoint novo.
- [ ] **M045 — Construção dos Aplicativos Mobile (Expo/React Native) para Gestor B2B e Vitrine B2C** · P2 (Multiplataforma) · `apps/mobile/` · **Specs:** `documentos/tarefa/specs/m045-mobile-fase1-{design,plano}.md` (Fase 1 — infra/auth/nav) · `m045-mobile-fase2-design.md` + `m045-mobile-fase2-parte{1-infra-crm,2-estoque,3-chat,4-mais}-plano.md` (Fase 2, por módulo) · `m045-vitrine-b2c-mobile-design.md` (Vitrine B2C) · `m045-mobile-api-real-{design,plano}.md` (troca mock→API real, 2026-07-10) · `m045-usabilidade-mobile-design.md` (implementação, baseado no diagnóstico `documentos/tarefa/usabilidade-mobile-diagnostico.md`) · Implementar as duas experiências mobile centrais do produto utilizando o boilerplate de Expo + React Native existente:
  - **Gestor B2B Mobile**: Painel operacional do lojista responsivo, permitindo cadastrar veículos e subir fotos/vídeos capturados diretamente pela câmera do aparelho, receber notificações push de novos leads/mensagens, visualizar o funil de vendas (CRM Kanban mobile) e interagir no Chat de Parceiros.
  - **Vitrine B2C Mobile**: Experiência de navegação nativa leve (estilo feed vertical/Instagram) para compradores finais pesquisarem carros, favoritarem anúncios e iniciarem negociações diretamente no chat ou link de WhatsApp.
  - **Escopo**: O Painel de Administração da Plataforma (Admin) **não precisa** de versão mobile nativa (permanece exclusivamente web responsiva).
  - **Validação**: Execução limpa do Expo (`pnpm --filter @sv/mobile dev`) com navegação fluida por abas e renderização correta tanto em emulador/browser em modo iPhone quanto no app Expo Go em celulares físicos.
  - **Início da implementação (2026-07-07):** decompondo em fases dado o tamanho do escopo. **Fase 1 — infra + auth + navegação** (Gestor B2B) documentada em `documentos/tarefa/specs/m045-mobile-fase1-design.md`. Substitui `documentos/tarefa/plano-app-mobile.md` (concepção anterior com OCR de CNH/placa e offline-first — mantido só como backlog de ideias de longo prazo, não é a direção ativa). Escopo confirmado: mobile cobre Login, Dashboard, CRM, Estoque, Chat B2B, PosVenda, MinhasComissões, Financeiro, Equipe (só Admin fica fora).
  - **Gestor B2B mobile — completo (2026-07-08 + ajustes M048–M056 em 2026-07-09):** app do lojista reconstruído e em paridade quase total com o gestor web (só falta o web-only: Admin/Impersonar/Aprovações). Ver a seção Mobile acima.
  - **Vitrine B2C mobile — Fase 2 feita (2026-07-09):** app do comprador dentro do mesmo `apps/mobile`, **fluxo por tipo de conta** (decisão do usuário). Spec em `documentos/tarefa/specs/m045-vitrine-b2c-mobile-design.md`. Entregue:
    - **Modo de experiência** (`experienciaStore` persistido) + `EscolhaExperienciaScreen` no primeiro boot (Sou comprador / Sou lojista). `RootNavigator` ramifica: null→escolha, comprador→`VitrineNavigator` (feed **público**), lojista→Login/MainTabs (Gestor intacto). Troca de experiência nos dois lados (Perfil da vitrine "Sou lojista →"; Mais do gestor "Ver como comprador →").
    - **Gate de login por ação** (`useGateLogin` + `LoginSheet` + `loginGateStore`): feed abre sem login; favoritar/conversar/perfil disparam o cadastro leve (nome/e-mail) ou conta demo, e re-executam a ação pendente. Conta PF `papel: 'cliente'`.
    - **`vitrineService`** (mock **multi-loja**: 6 lojas fictícias coerentes com o diretório de parceiros do M055, ~18 anúncios, favoritos, chat comprador↔loja, perfil de loja). Tipos `AnuncioVitrine`/`LojaVitrine`/`ConversaVitrine`.
    - **`VitrineTabs`** (Feed cards roláveis + filtros · Buscar com sub-aba Favoritos · Mensagens · Perfil) + stack (CarroDetalhe com specs/loja/Conversar/WhatsApp · PerfilLoja com estoque da loja · ConversaVitrine com envio otimista). `AnuncioCard` compartilhado reusa `VehiclePhoto` (placeholder, nunca imagem quebrada).
    - **Fora desta fase:** C2C "anunciar meu carro" (MeusVeiculos), Stories, push, câmera. `tsc --noEmit` limpo. **Swap p/ API real = só reimplementar `vitrine.ts`.**

- [ ] **M039 — Emissor de Nota Fiscal: NF-e de compra e venda com cálculo automático de impostos** _(Fase 1 implementada 2026-07-03)_ · P2 (feature / diferencial competitivo + novo módulo pago) · `apps/api/models.py` (novos `ConfiguracaoFiscal`, `NotaFiscal`) · `apps/api/routers/fiscal.py` (novo) · `apps/gestor/src/pages/ferramentas/Fiscal.tsx` + `NotasFiscais.tsx` (novos) · integração no fluxo de venda (`contratos.py:305`) e na Esteira Pós-venda

  ### Fase 1 — feito (2026-07-03)
  Decisões batidas com o fundador: gateway **Focus NFe**, custo **absorvido pela plataforma** (conta mestre + empresa própria por loja, isolamento mantido), certificado A1 cifrado **na própria plataforma** (Fernet), escopo restrito a **NF-e de venda (saída) em homologação**. Entregue: `ConfiguracaoFiscal` + `NotaFiscal` (migração `c4a7d92e1f36`), `fiscal_gateway.py` (chamadas Focus NFe via `httpx`), `routers/fiscal.py` (config/certificado/emissão/webhook de autorização), gate `Modulo.FISCAL` (mesmo mecanismo dos módulos pagos existentes), auto-anexo do DANFE na Carteira do Proprietário + auto-conclusão do item `nota_entregue` da Esteira (reaproveitando `anexar_documento_interno` extraído de `esteira.py`), frontend `Fiscal.tsx` (config + certificado) e `NotasFiscais.tsx` (emissão + histórico). Design documentado em `documentos/tarefa/specs/m039-fiscal-nfe-fase1-design.md` (arquivo não encontrado no repo — spec original perdido/nunca commitado). Testes de isolamento multi-tenant cobrindo `ConfiguracaoFiscal` adicionados; suíte completa verde (29 testes).

  ### Fase 2 — parcial (2026-07-04): cancelamento + Carta de Correção (CC-e)
  Escolhido como recorte inicial da Fase 2 (as demais frentes ficam para depois — ver "Falta" abaixo). Entregue: `fiscal_gateway.cancelar_nfe`/`emitir_carta_correcao` (Focus NFe: `DELETE /v2/nfe/{ref}` e `POST /v2/nfe/{ref}/carta_correcao`); campos `NotaFiscal.justificativa_cancelamento`/`cancelada_em` + tabela nova `CartaCorrecaoNfe` (migração `a2c9e5f14b83`); endpoints `POST /v1/fiscal/notas/{id}/cancelar` (só para nota `autorizada`, não já cancelada; grava justificativa e marca `processando_cancelamento`), `POST` e `GET /v1/fiscal/notas/{id}/carta-correcao` (histórico com `sequencia`); webhook do Focus atualizado para tratar `status: cancelado` (grava `cancelada_em`) e eventos `tipo_evento: carta_correcao` (atualiza a CC-e pendente mais recente). Frontend `NotasFiscais.tsx`: coluna Ações com botões **Cancelar** (modal com justificativa obrigatória ≥15 caracteres, aviso de que não pode ser desfeito) e **CC-e** (modal com aviso de que só corrige dado não-essencial), ambos só para notas `autorizada`.

  ### Falta (resto da Fase 2, não implementado)
  NF-e de entrada (compra), inutilização, contingência, perfis fiscais por UF (validar CFOP/CST/redução de base **com contador**), ambiente produção, BYO-gateway.

  ### Ajuste 2026-07-04: atalho "Emitir NF-e" a partir do contrato
  O botão de emissão só existia na página dedicada Notas Fiscais (busca manual do contrato). Adicionado atalho direto: `apps/gestor/src/pages/ferramentas/Contratos.tsx` ganhou um botão **"Emitir NF-e"** (ícone `FileSignature`) na coluna Ações de cada contrato `compra_venda`, que navega para `/ferramentas/notas-fiscais?contrato={id}`; `NotasFiscais.tsx` lê o parâmetro `contrato`, busca `GET /contratos/{id}` (endpoint já existente) e pré-preenche o campo de contrato do formulário de emissão, removendo o parâmetro da URL em seguida. Nenhum endpoint novo. `tsc -b` limpo em `apps/gestor`.

  ### Origem
  Levantamento de concorrentes (Victor, 2026-07-03): rivais oferecem **"Emissor de Nota Fiscal — emissão de notas de compra e venda, sem limite de emissão e com cálculo automático de todos os impostos"**. Hoje **não emitimos NF-e**. É um gancho de venda forte (a revenda não precisa de sistema fiscal à parte) e um **módulo cobrável**.

  ### Estado atual verificado (no código)
  - **Não há emissão fiscal** hoje. A "nota fiscal" existe só como **documento manual**: `TipoDocumentoVeiculo.NOTA_FISCAL` (enums.csv:112, models.py:217) na Carteira do Proprietário, e o item de checklist **`nota_entregue`** ("Nota fiscal / recibo de venda entregue") na Esteira Pós-venda (`pos_venda_template.py:79`). Ou seja: hoje o lojista **anexa** um PDF/recibo — não gera NF-e de verdade.
  - Já existem os ganchos certos para plugar a emissão: `Contrato` de compra/venda (models.py:1127), `vender_veiculo` (`contratos.py:305`), `LancamentoFinanceiro`/`financeiro.py` (caixa), Esteira Pós-venda ([[M031]]/[[M032]]) e Carteira do Proprietário ([[M018]]).
  - `Loja` já tem `cnpj` (models.py). Falta o resto dos dados fiscais (IE, regime, certificado, série).
  - Padrão de credenciais sensíveis já estabelecido: **cifra Fernet** (ver [[M022]]/[[M024]]) — usar o mesmo para o certificado A1.

  ### Visão por papel (CEO · programador · UX · gestor · sócio)
  - **CEO:** fecha lacuna vs. concorrentes e vira **módulo pago**; "sem limite de emissão" como diferencial de plano.
  - **Sócio:** parceria com **gateway fiscal** (markup/repasse por nota), upsell sobre a base.
  - **Gestor da loja:** emite nota de **compra e venda** dentro do próprio fluxo, sem sistema externo; impostos calculados; DANFE/XML entregues ao cliente e anexados na Carteira.
  - **UX:** emitir **em 1 clique** a partir do contrato/venda; formulário fiscal que pré-preenche o que dá; alerta de validade do certificado.
  - **Programador:** **não reinventar a SEFAZ** — integrar gateway fiscal; certificado A1 **cifrado**; emissão **assíncrona** com webhook; idempotência; ambientes homologação/produção.

  ### Decisão-chave (por isso não implementar sozinho): gateway fiscal vs SEFAZ direto
  Recomendo **fortemente integrar um gateway fiscal** (PlugNotas/Tecnospeed, Focus NFe, NFe.io, eNotas, WebmaniaBR) em vez de falar direto com as 27 SEFAZ. O gateway abstrai assinatura XML, transmissão por UF, contingência, cancelamento e — crucialmente — o **"cálculo automático de todos os impostos"** que o concorrente promete. Fazer direto com SEFAZ são meses de trabalho + manutenção fiscal contínua. **Definir qual gateway** antes de codar.

  ### O que fazer (faseado)

  **1) Modelo de dados**
  - `ConfiguracaoFiscal` (1 por loja): `inscricao_estadual`, `regime_tributario` (Simples/Presumido/Real), `cnae`, `endereco_fiscal`, `certificado_a1_cifrado` (Fernet, `.pfx`), `certificado_senha_cifrada`, `certificado_validade`, `serie_nfe`, `proximo_numero`, `ambiente` (`homologacao|producao`), `gateway` + `gateway_token_cifrado`, e **defaults fiscais** (`natureza_operacao`, `cfop_venda`/`cfop_compra`, `ncm` padrão `8703` p/ automóveis, `cst`/`csosn`, `origem`).
  - `NotaFiscal` (emitida): `loja_id`, `contrato_id?`, `veiculo_id?`, `cliente_id?`, `tipo` (`entrada|saida`), `modelo` (55), `serie`, `numero`, `chave_acesso` (44 díg.), `protocolo`, `status` (`rascunho|processando|autorizada|rejeitada|cancelada|erro`), `ambiente`, `valor_total`, `impostos_json` (breakdown ICMS/PIS/COFINS…), `xml_url`, `danfe_pdf_url`, `motivo_rejeicao`, `emitida_em`, `cancelada_em`, `motivo_cancelamento`. Migração idempotente (padrão SQLite do projeto).

  **2) Endpoints (`apps/api/routers/fiscal.py`, novo)**
  `GET/PUT /v1/fiscal/config`; `POST /v1/fiscal/certificado` (upload `.pfx` + senha → cifra Fernet, lê validade); `POST /v1/fiscal/notas` (emitir a partir de contrato/venda ou avulsa → monta payload → gateway → status); `GET /v1/fiscal/notas` + `/{id}` (listar/detalhe, baixar XML/DANFE); `POST /v1/fiscal/notas/{id}/cancelar`; `POST /v1/fiscal/notas/{id}/carta-correcao`; **webhook** do gateway → atualiza status assíncrono (autorizada/rejeitada).

  **3) Cálculo de impostos**
  Delegado ao gateway a partir da `ConfiguracaoFiscal` (regime + CFOP/CST/NCM/origem) e do valor da operação. **Atenção ao regime de usados:** muitos estados têm redução de base de cálculo/regime especial para revenda de seminovos — os defaults fiscais precisam ser conferidos **com contador** por UF (candidato a tabela de perfis fiscais). Marcar no produto que a responsabilidade tributária é da loja (disclaimer/aceite) — a plataforma não é contadora.

  **4) Integração no fluxo (venda, compra e pós-venda)**
  - **Venda (saída):** botão **"Emitir NF-e"** no contrato/`vender_veiculo` e na Esteira. Modal: preview dos dados fiscais + impostos calculados → confirmar.
  - **Compra (entrada):** NF-e de entrada ao dar entrada no veículo (compra de PF sem nota, ou de PJ) — no Estoque/Compra.
  - Ao **autorizar**: gerar DANFE (PDF) + XML, **anexar à Carteira do Proprietário** (reusar `TipoDocumentoVeiculo.NOTA_FISCAL`) e **auto-marcar o item `nota_entregue`** da Esteira. Lançar/relacionar com `LancamentoFinanceiro` se fizer sentido.

  **5) Frontend (gestor)**
  - Página/aba **Fiscal** em Configurações (`Fiscal.tsx`): dados fiscais + upload de certificado A1 (**alerta de validade** quando faltar < 30 dias) + série/ambiente + escolha/token do gateway. Botão **Testar** em homologação.
  - Página **Notas Fiscais** (`NotasFiscais.tsx`): lista com status, chave de acesso, valor, impostos, baixar DANFE/XML, cancelar, CC-e. Filtro por período/tipo/status.
  - Estados vazios honestos: sem certificado/gateway → emissão bloqueada com CTA "Configurar emissor fiscal" (nada de botão fake — ver "Padrões a vigiar").

  **6) Gate por módulo/plano**
  Novo módulo **"Fiscal / NF-e"** no sistema de módulos; owner (`admin_plataforma`, [[M025]]) libera por loja. "Sem limite de emissão" do concorrente embute **custo do gateway** — definir cobrança: absorver no plano premium, repassar por nota, ou **BYO-gateway** (a loja pluga a própria conta do gateway, análogo ao BYOK da [[M024]]).

  ### Decisões de produto (a bater o martelo)
  - **Qual gateway fiscal** (PlugNotas/Focus/NFe.io/eNotas/WebmaniaBR) e modelo de custo (plataforma absorve × repasse × BYO-gateway).
  - **Certificado A1 (arquivo `.pfx`)** — recomendado p/ SaaS (armazenado cifrado); **A3** (token físico) inviável no servidor.
  - **Perfis fiscais de usados por UF** — validar CFOP/CST/redução de base **com contador**.
  - **Escopo fase 1:** só **NF-e de saída (venda)** em homologação, ou já incluir entrada?

  ### Faseamento sugerido
  - **Fase 1 (MVP):** config fiscal + certificado A1 + gateway + **NF-e de venda** a partir do contrato → DANFE/XML → anexo na Carteira + item da Esteira. Começar em **homologação**.
  - **Fase 2:** NF-e de **entrada (compra)**, cancelamento, CC-e, inutilização, contingência; perfis fiscais por UF; produção.
  - **Fase 3:** NFS-e (serviços: despachante/comissão), relatórios fiscais, exportação p/ contador (SPED), NFC-e se aplicável.

  ### Validação
  - Configurar certificado + IE + gateway em **homologação** → emitir NF-e de venda de um contrato → status **"autorizada"** com **chave de 44 dígitos** → DANFE (PDF) + XML gerados.
  - DANFE/XML **anexados à Carteira do Proprietário** e item **`nota_entregue`** da Esteira marcado automaticamente.
  - Impostos batendo com o regime/UF (conferir na nota de homologação).
  - Cancelar dentro do prazo → status **"cancelada"**.
  - Sem certificado/gateway → emissão **bloqueada** com CTA claro (sem ação fake).

  ### Referências
  Liga com `Contrato`/`vender_veiculo` (`contratos.py:305`), `TipoDocumentoVeiculo.NOTA_FISCAL` + item `nota_entregue` da Esteira ([[M031]]/[[M032]]), Carteira do Proprietário ([[M018]]), `LancamentoFinanceiro`/`financeiro.py`, padrão de credenciais Fernet ([[M022]]/[[M024]]), gate por módulo/owner ([[M025]]), BYO-gateway análogo ao BYOK ([[M024]]).


- [ ] **M038 — Construtor de Sites: site próprio/personalizado por loja (white-label)** _(Fase 1 e Fase 2 implementadas 2026-07-04; falta só domínio próprio/SSL)_ · P2 (feature / diferencial competitivo + novo módulo pago) · app novo `apps/site` (reusando o pipeline SSR/prerender da `apps/vitrine`) · `apps/api/models.py` (novo `SiteLoja`) · `apps/api/routers/site.py` (novo) · `apps/gestor/src/pages/ferramentas/MeuSite.tsx` (novo) · resolução por host

  ### Fase 1 — parte 1 feita (2026-07-04)
  Decisão batida: app dedicado `apps/site` (não estender a `vitrine` compartilhada) — mas o app em si (páginas públicas Home/Estoque/Contato) fica para a próxima rodada. Entregue nesta parte: modelo `SiteLoja` (migração `d5b8e3f92a17`, campos de tema/hero/SEO/analytics/redes, `subdominio` derivado de `Loja.slug`, `rascunho_json` para versão não publicada); `Modulo.SITE` no gate de assinatura (`modulos.py`) — liberação **só via plano contratado** (`Plano.modulos_incluidos`), sem endpoint de toggle manual (decisão: não criar mecanismo novo de liberação por loja, seguir o padrão já existente); `apps/api/routers/site.py` com `GET/PUT /v1/site` (auto-cria o registro no primeiro acesso), `POST /v1/site/publicar` (exige ao menos o hero_titulo) / `despublicar`, e `GET /v1/public/site/{host}` (resolução por host **sem middleware** — endpoint simples que nunca vaza rascunho não publicado); builder `MeuSite.tsx` (Ferramentas → Meu Site) com upload de logo/banner via `/midias/upload`, cores, conteúdo da home, SEO/GA4/Meta Pixel, e toggle Publicar/Despublicar com preview do link do subdomínio.
  - **Validação:** suíte completa (29 testes) verde. E2E no Chrome (Playwright headless): paywall aparece quando módulo não liberado; com módulo liberado (teste manual via `ModuloHabilitado`, revertido após), builder salva campos, publica, endpoint público `/v1/public/site/{host}` resolve o subdomínio e retorna a config + identidade da loja; despublicar oculta do público; testado em dark e light sem hardcode quebrado, zero `console.error`.
  - **Falta (resto da Fase 1 + Fase 2):** domínio próprio + SSL (Cloudflare for SaaS — decisão batida, não implementado ainda: exige conta/API token real da Cloudflare), analytics de fato disparando (GA4/Pixel só são campos guardados hoje, não integrados a nenhuma página), sitemap/schema.org, páginas Sobre/Financiamento, mais que 3 templates.

  ### Fase 2 — parte 1 feita (2026-07-04)
  Entregue: **app público `apps/site`** (novo, porta 5175) reusando o pipeline SSR/prerender da vitrine tal como planejado (`vite.config.ts` + `entry-server.tsx` + `prerender.js` + `main.tsx`, mesma técnica de extração de `<head>` do Helmet). Páginas Home (hero + sobre, 3 variações de template — ver abaixo), Estoque (grid consumindo o `GET /v1/marketplace/loja/{slug}` já existente, sem endpoint novo) e Contato (form → lead). Resolução de host: como o app roda client-side por `window.location.hostname`, o prerender gera `dist/_hosts/<host>/{,estoque,contato}/index.html` por site publicado (consumindo o sitemap novo `GET /v1/public/site/_sitemap/hosts`); a query de produção real (reverse-proxy por `Host` header) fica para quando houver decisão de infra de deploy do app.
  **Captura de lead:** `POST /v1/public/site/lead` (público, `rate_limit(5, 60)`), cria/reaproveita `ClientePF` pelo telefone (sem exigir login) e grava `Lead` com a nova origem `OrigemLead.SITE_PROPRIO` (não precisou de migração — enums em SQLite são `VARCHAR` sem constraint, mesmo padrão já usado para `REPASSE`).
  **3 templates visuais implementados de fato** (antes só existiam como opção no seletor sem diferença visual): `clean` (hero centralizado, fundo claro), `premium` (hero em tela cheia com banner de fundo + overlay escuro), `compacto` (faixa estreita alinhada à esquerda, cor secundária da loja). Cores da loja (`cor_primaria`/`cor_secundaria`) aplicadas via CSS custom properties injetadas em runtime.
  - **Bug crítico pré-existente encontrado e corrigido durante a validação:** o monorepo tinha `react@19.2.3` (fixado em `apps/mobile`) e `react-dom@19.2.7` (resolvido livremente pelo range `^19.1.0` dos demais apps) coexistindo, causando `Error: Incompatible React versions` em **qualquer app do monorepo em runtime** — inclusive a `vitrine` já existente, que travava totalmente (tela em branco) tanto em dev quanto no build SSR, o que quebraria qualquer deploy fresco (Vercel roda `pnpm install` do zero a cada build). Corrigido com `pnpm.overrides` no `package.json` raiz fixando `react`/`react-dom` em `19.2.3` para todo o workspace.
  - **Validação:** suíte completa (29 testes) verde. `pnpm install` limpo sem warning de peer dependency. Build completo (`tsc -b && vite build && vite build --ssr && node prerender.js`) rodando sem erro em `apps/site` **e** `apps/vitrine` (que antes quebrava). E2E no Chrome: Home/Estoque/Contato renderizam com dados reais da loja (veículo com foto/preço do estoque de verdade), formulário de contato cria `Lead` de fato no CRM (`origem=SITE_PROPRIO`, conferido direto no banco), HTML pré-renderizado por host contém `<title>`, dados SSG embutidos e conteúdo real (não SPA shell vazio). Zero `console.error`.

  ### Fase 2 — parte 2 feita (2026-07-04): SEO técnico + páginas Sobre/Financiamento + Analytics real
  Fechado o restante do escopo listado em "Falta" (exceto domínio próprio/SSL, que segue exigindo conta Cloudflare real — fora de alcance sem credencial).
  - **SEO técnico:** `GET /v1/public/site/{host}/sitemap.xml` (novo, `site.py`) lista `/`, `/estoque`, `/contato`, `/financiamento` e `/sobre` (só quando `sobre_texto` preenchido) do host publicado, respeitando `secoes_ativas` quando configurado. `GET /v1/public/site/{host}/robots.txt` (novo) aponta pro sitemap acima; ambos 404 se o host não corresponder a um site publicado (não vaza rascunho). Nova config `settings.api_base_url` (`config.py`) usada na URL do `Sitemap:` do robots.txt.
  - **JSON-LD schema.org:** `apps/site/src/App.tsx` agora injeta `AutoDealer` (nome, endereço cidade/UF, telefone, imagem) via Helmet em toda página; `Estoque.tsx` injeta `ItemList` de `Vehicle` (marca, modelo, ano, km, preço/oferta) quando o estoque carrega. Reaproveita o mesmo shape de JSON-LD já usado em `apps/vitrine/src/lib/loaders.ts` (`carroMeta`/`lojaMeta`).
  - **Open Graph + Twitter Card:** `og:type`, `og:title`, `og:description`, `og:image` (usa `og_image_url` ou `logo_url` como fallback — campo que já existia no modelo/schema mas nunca era lido em lugar nenhum do front) e `twitter:card` adicionados ao `<Helmet>` da Home.
  - **`GET /v1/public/site/{host}` enriquecido:** o bloco `loja` da resposta ganhou `cidade`, `estado`, `verificada` e `total_veiculos` (antes só `id/nome/slug/whatsapp`) — necessário para o JSON-LD `AutoDealer` e para a nova página Sobre.
  - **Analytics real:** GA4 (`ga4_id`) e Meta Pixel (`meta_pixel_id`) — campos que já existiam no builder (`MeuSite.tsx`) e no modelo, mas nunca disparavam nada — agora injetam os scripts oficiais via Helmet. **Achado durante a implementação:** `react-helmet-async` descarta/deduplica `<script>` inline sem `type` explícito quando há mais de um na árvore (só o último sobrevivia na extração SSR); corrigido usando `type="text/javascript"` em todos e consolidando o loader do GA4 num único `<script>` (via `document.createElement` inline) em vez de dois `<script>` separados. `apps/site/src/entry-server.tsx` teve o regex de extração de `<head>` ampliado para reconhecer qualquer `<script>` do Helmet (antes só pegava `type="application/ld+json"`), evitando que GA4/Pixel/JSON-LD ficassem soltos dentro do `<div id="root">` do HTML pré-renderizado.
  - **Fase 2 — parte 3 (Preview em tempo real + Layout colunado) feita (2026-07-04):** O construtor de sites no Gestor (`MeuSite.tsx`) foi reestruturado de um layout de tela cheia empilhado para uma visualização colunada (grid). No lado esquerdo, empilhamos verticalmente as configurações de aparência (template, cores, logo e banner) e os conteúdos. No lado direito, acoplamos uma janela de preview (mock de browser/iframe com mockup do site real) que renderiza e atualiza em tempo real as customizações de template, logo, banner, cores, título hero, subtítulo, CTA e descrição sobre a loja antes de publicar.
  - **Validação:** Compilação TypeScript (`tsc -b`) limpa e build do `gestor` bem-sucedido.
  - **Páginas novas:** `Sobre.tsx` (descrição da loja + cidade/UF + selo verificada + total de veículos + WhatsApp) e `Financiamento.tsx` (formulário de interesse → gera `Lead`, sem prometer simulação real — o motor de crédito consumer-facing não existe ainda, ver [[M017]]). `SiteHeader.tsx` ganhou os links (Sobre só aparece se houver `sobre_texto`). `prerender.js` inclui as duas rotas na geração estática (Sobre condicional).
  - **Validação:** suíte completa da API (37 testes) verde após as mudanças. `apps/site`: `tsc -b` limpo, build client+SSR sem erro. Testado ponta a ponta contra a API real (loja demo com módulo `site` habilitado temporariamente e revertido ao final, mesmo padrão da Fase 1): publicado um site de teste, `GET /v1/public/site/{host}` retornou o bloco `loja` enriquecido, `sitemap.xml`/`robots.txt` responderam corretamente, `node prerender.js` gerou as 5 páginas por host (`/`, `/estoque`, `/sobre`, `/financiamento`, `/contato`) com `<title>`, meta description, OG, JSON-LD `AutoDealer`, script do GA4 e do Meta Pixel todos presentes no `<head>` do HTML estático e **zero scripts soltos no `<body>`** (conferido via inspeção direta do HTML gerado, já que não há ferramenta de browser automation neste ambiente).
  - **Falta (fora desta rodada):** domínio próprio + SSL (Cloudflare for SaaS — decisão já batida na Fase 1, só falta conta/API token real).

  ### Origem
  Levantamento de concorrentes (Victor, 2026-07-03): plataformas rivais oferecem **"Construtor de Sites — Tenha seu Site Personalizado"**, ou seja, cada revenda ganha um **site próprio, com a marca dela, domínio próprio e só o estoque dela**. Hoje **não temos** isso. É um dos ganchos de venda mais fortes do mercado (presença digital independente do marketplace) e um **módulo cobrável** novo.

  ### Estado atual verificado (no código)
  - `apps/vitrine` já é SPA **com SSR + prerender** (`entry-server.tsx`, `prerender.js`, `dist-server`, `build` roda `vite build --ssr`) — ótima base de SEO já existe.
  - Já existe uma **página de perfil de loja dentro do marketplace**: rota `/loja/:slug` (`apps/vitrine/src/pages/Loja.tsx`), com `Helmet` (meta/OG) e dados SSG via `fetchLoja(slug)`. É um perfil dentro do domínio compartilhado — **não** um site white-label da loja.
  - `Loja` (models.py:227) já tem `slug` (unique), `logo_url`, `telefone`, `whatsapp`, `email`, `endereco`, `cidade`, `estado`. `LojaConfig` (models.py:1261) existe mas é mínimo (só `delay_exclusividade_horas`).
  - **Não existe** hoje: domínio/subdomínio por loja, tema/cores por loja, resolução por host, provisionamento de SSL, ou builder de site.
  - **Gap:** transformar o perfil `/loja/:slug` num **site autônomo e personalizável** (marca + domínio + páginas próprias), servindo só o estoque da loja e capturando lead no CRM dela.

  ### Visão por papel (lente do projeto: CEO · programador · UX · gestor · sócio)
  - **CEO:** diferencial competitivo direto e **receita recorrente nova** (módulo "Site" + possível repasse de domínio). Fecha a lacuna vs. concorrentes.
  - **Sócio:** upsell natural sobre a base de lojas; parcerias de registro de domínio/SSL; caminho para plano premium.
  - **Gestor da loja:** presença digital **própria** (não fica só "mais um" no marketplace), leads caem direto no **CRM dele**, autonomia para editar marca/estoque/contato.
  - **UX:** construtor **simples**, com **preview ao vivo** e templates prontos — o lojista não deve precisar saber nada técnico. Publicar em 1 clique.
  - **Programador:** multi-tenant **por host**, SEO por SSR/prerender, provisionamento de domínio/SSL, isolamento de escopo de estoque por loja.

  ### O que fazer (faseado)

  **1) Modelo de dados — `SiteLoja` (novo, 1 linha por loja; ou expandir `LojaConfig`)**
  Campos sugeridos: `loja_id` (FK unique), `subdominio` (deriva de `Loja.slug` → `{slug}.socialveiculos.com.br`), `dominio_customizado` (nullable), `dominio_status` (`pendente|verificando|ativo|erro`), `ssl_status`, `publicado` (bool), `template` (`clean|premium|compacto`), `cor_primaria`, `cor_secundaria`, `logo_url`, `banner_url`, `favicon_url`, `hero_titulo`, `hero_subtitulo`, `hero_cta`, `sobre_texto`, `secoes_ativas` (JSON: home/estoque/sobre/contato/financiamento/localizacao), `redes` (JSON), `seo_title`, `seo_description`, `og_image_url`, `ga4_id`, `meta_pixel_id`, `whatsapp` (fallback p/ `Loja.whatsapp`), `rascunho_json` (config não publicada) + `criado_em/atualizado_em`. Opcional `PaginaSite` para páginas livres (fase 3). Migração idempotente (padrão SQLite do projeto).

  **2) Resolução por host (multi-tenant por domínio)**
  Middleware no backend/edge que mapeia `Host` → `loja_id`: `{slug}.socialveiculos.com.br` (subdomínio **grátis e automático**) e domínio próprio (`www.revenda.com.br` via CNAME). Endpoint público `GET /v1/public/site/{host}` retorna a config publicada do site + identidade da loja (consumido pelo SSR do `apps/site`).

  **3) Provisionamento de domínio + SSL**
  - Subdomínio: automático ao publicar (wildcard `*.socialveiculos.com.br` + TLS wildcard).
  - Domínio próprio (**fase 2**): instruir CNAME, verificar propagação, emitir TLS. Avaliar **Cloudflare for SaaS** (mais simples, custo por domínio) vs **Caddy/Traefik com on-demand TLS** (self-host). Expor status no builder.

  **4) App do site (frontend) — `apps/site`**
  Reaproveitar o pipeline **SSR + prerender da vitrine** criando um tema/app que renderiza a **marca da loja** e **só o estoque dela**. Páginas: Home (hero + destaques + busca), Estoque (grid + filtros, escopo loja), Detalhe do veículo (galeria + WhatsApp + form de interesse), Sobre, Contato (form → Lead), Financiamento (simulador consumer — liga com [[M017]]/[[M029]]), Localização/mapa. Tema aplica cores/logo via **tokens** (`--vt-*`), **nunca hardcode** (padrão do projeto — ver "Padrões a vigiar").

  **5) Builder no gestor — `MeuSite.tsx` (Ferramentas/Configurações)**
  Seletor de template (2–3 iniciais), cores (primária/secundária), upload de logo/banner/favicon, edição de hero/sobre/contato/redes, toggles de seções, campos de SEO, config de domínio (subdomínio + próprio) e analytics. **Preview ao vivo** (iframe carregando o site em modo rascunho). Botões **Publicar/Despublicar** e distinção **rascunho vs publicado**.

  **6) Captura de lead integrada**
  Formulários de contato/interesse e clique no botão de WhatsApp geram `Lead` no **CRM existente** com `origem="site-proprio"`. Botão WhatsApp usa `Loja.whatsapp` (liga com [[M030]]).

  **7) SEO técnico**
  SSR/prerender por loja; `sitemap.xml` e `robots.txt` por domínio; dados estruturados schema.org (`AutoDealer`, `Vehicle`/`Car`); Open Graph por veículo (reaproveitar imagem/marketing da [[M024]]); `canonical`; meta por página; GA4 + Meta Pixel por loja.

  **8) Gate por módulo/plano**
  Novo módulo **"Site"** no sistema de módulos/permissões; o owner (`admin_plataforma`, [[M025]]) libera por loja. Sem o módulo → site indisponível + CTA de upgrade no builder. Definir cobrança (add-on mensal? incluso no premium? repasse do domínio próprio?).

  **9) Endpoints (`apps/api/routers/site.py`)**
  `GET/PUT /v1/site` (config da loja logada), `POST /v1/site/dominio` + `GET /v1/site/dominio/status` (registrar/verificar domínio próprio), `POST /v1/site/publicar` / `POST /v1/site/despublicar`, `POST /v1/site/lead` (público, form de contato → CRM), `GET /v1/public/site/{host}` (SSR). Reaproveitar endpoints públicos de veículos com escopo de loja para o estoque.

  ### Decisões de produto (por isso não implementar sozinho)
  - **App novo (`apps/site`) vs estender a `vitrine`?** Recomendo **app/tema dedicado reusando o pipeline SSR da vitrine**, para não misturar o marketplace compartilhado com o site white-label.
  - **SSL/domínio próprio:** Cloudflare for SaaS vs Caddy/Traefik on-demand. Recomendo **MVP só com subdomínio grátis** e domínio próprio na fase 2.
  - **Cobrança do módulo Site** (add-on mensal / incluso no premium / repasse de domínio).
  - **Templates iniciais** (quantidade e estilo).

  ### Faseamento sugerido
  - **Fase 1 (MVP):** subdomínio automático + 1 template + cores/logo/banner + Home/Estoque/Detalhe/Contato + lead no CRM + SEO básico + preview + publicar.
  - **Fase 2:** domínio próprio + SSL + mais templates + Sobre/Financiamento + analytics (GA4/Pixel) + sitemap/schema.
  - **Fase 3:** páginas livres/blog, integração com Marketing IA ([[M024]]) para gerar textos/banner, A/B de template.

  ### Validação
  - Liberar módulo → configurar site → publicar → acessar `{slug}.socialveiculos.com.br` e ver **só o estoque da loja** com a **marca dela**.
  - Enviar form de contato no site → aparece **Lead no CRM** com `origem="site-proprio"`.
  - Alterar cor/logo no builder → refletir no site após publicar (rascunho não vaza para o público).
  - SEO: `view-source` mostra meta/OG/schema corretos; `sitemap.xml` lista os veículos da loja.
  - Fase 2: domínio próprio via CNAME resolve com **HTTPS válido** e status "ativo" no builder.

  ### Referências
  Liga com [[M007]]/`Loja.tsx` (perfil de loja atual), [[M024]] (Marketing IA p/ conteúdo/imagens), [[M017]]/[[M029]] (financiamento + login consumer), [[M025]] (owner libera módulo), [[M030]] (WhatsApp da loja).


- [x] **M037 — Esteira Pós-venda sem gate RBAC: efeito colateral financeiro acessível a qualquer membro da loja** _(2026-07-03)_ · P2 (segurança/permissões) · `apps/api/routers/esteira.py`
  - **Feito:** opção (a) aplicada. Em `atualizar_item`, ao marcar CONCLUÍDO um item `CategoriaItem.FINANCEIRO`, checa inline `can(ctx.usuario, Acao.CRIAR, Recurso.FINANCEIRO, modulos_liberados)` (mesma matriz RBAC de `financeiro.py`) antes de mudar o status/lançar o financeiro; sem permissão → 403. Demais categorias (contrato/documento/transferência) continuam abertas a qualquer membro da loja.
  - **Validação:** suíte completa (29 testes) segue verde.
  - **Origem (Execução #17, análise B — RBAC/multiempresa):** o router `/v1/esteira` **não usa `exige_permissao` em nenhum endpoint** — depende só de `get_current_b2b_user` (qualquer membro autenticado da loja). Isso é aceitável para o trabalho operacional de pós-venda, **exceto por um efeito colateral financeiro**: em `atualizar_item`, marcar como CONCLUÍDO um item da categoria `FINANCEIRO` chama `_lancar_financeiro(...)`, que **grava uma despesa/lançamento no caixa da loja** (`LancamentoFinanceiro`). Ou seja, um **vendedor sem o módulo `financeiro` liberado** — que o `financeiro.py` bloqueia com `exige_permissao(CRIAR, FINANCEIRO)` (403) — consegue, pela esteira, **criar lançamento financeiro indiretamente**, contornando o gate. O escopo multi-tenant está OK (todo endpoint passa por `_carregar_esteira(..., ctx.loja.id)` → 404 cross-loja); o furo é de **autorização por papel/módulo dentro da própria loja**, não de tenant.
  - **Decisão de produto (por isso não apliquei sozinho):** definir a política de permissão da esteira. Duas opções válidas: (a) manter a esteira aberta a todos os operadores da loja, mas **gatear só os caminhos com efeito financeiro** (itens `CategoriaItem.FINANCEIRO` e/ou `concluir`) atrás de `exige_permissao`/checagem de módulo `financeiro`; ou (b) documentar explicitamente que a esteira é operacional e aberta, aceitando o lançamento como parte do fluxo de pós-venda. Recomendo (a).
  - **Validação:** teste de regressão — vendedor sem módulo financeiro marca item FINANCEIRO da esteira → deve receber 403 (após a decisão (a)); gestor/vendedor-com-módulo → 200 e lançamento criado.
  - **Nota:** escopo de tenant e cálculo já auditados OK nesta rodada; item puramente de política de autorização por papel.


- [x] **M036 — Higiene de repositório: arquivo temporário versionado, `.db` vazio na raiz e FastAPI em faixa aberta** _(2026-07-03)_ · P3 (higiene/DevEx) · `apps/api/routers/_wtest.tmp`, `socialveiculos.db` (raiz), `apps/api/requirements.txt`
  - **Feito:** `_wtest.tmp` e `socialveiculos.db` (vazio) removidos do disco — nenhum dos dois estava de fato trackeado no git (já cobertos por `.gitignore`: `*.tmp`/`_*.tmp` e `*.db`), então não havia o que dar `git rm --cached`. `fastapi>=0.115.0` trocado por `fastapi>=0.115,<0.140` em `requirements.txt`.
  - **Validação:** `git status` sem os artefatos; `requirements.txt` com faixa fechada.

- [x] **M034 — Deprecações do Pydantic V2 (quebram no Pydantic V3)** _(2026-07-03)_ · P2 (débito técnico) · `apps/api/schemas.py`, e ~8 routers (`auth.py`, `assistente.py`, `credenciais_ia.py`, `credenciais_detran.py`, `fiscal.py`, `stories.py`, `triagem.py`, `marketplace.py`)
  - **Feito:** todos os `class Config: from_attributes = True` (36× em `schemas.py` + 1× em cada um dos 8 routers) e `class Config: populate_by_name = True` (`assistente.py`) migrados para `model_config = ConfigDict(...)`. Removido `from pydantic.generics import GenericModel` (import morto — nenhum schema usava genéricos) junto com `Generic`/`TypeVar` não utilizados em `schemas.py`.
  - **Validação:** `python -W error::DeprecationWarning -c "import main"` sobe sem nenhum warning de Pydantic (antes eram ~40 `PydanticDeprecatedSince20`); suíte completa (29 testes) segue verde.

- [x] **M033 — Normalização de fim de linha (`.gitattributes`) — fim do ruído de CRLF** _(aplicado parcialmente 2026-07-02, Execução #15)_ · P2 (higiene/DevEx) · `.gitattributes` (novo), repositório inteiro
  - **Origem:** todo `git status` mostrava **27 arquivos "modificados" sem nenhuma mudança de conteúdo** — puro CRLF (Windows) vs LF (repo). `git diff -w` / `--ignore-all-space` confirmava **0 linhas de conteúdo alteradas** em `enums.csv`, os 3 mappings de banco, `theme.css` e `social.md`. Ruído que poluía diffs, esconde mudanças reais e infla commits.
  - **Feito:** criado `.gitattributes` com `* text=auto eol=lf` + regras por extensão (LF para código/dados; CRLF para `.ps1`/`.bat`/`.cmd`; `binary` para imagens/PDF/fontes/db).
  - **Falta (ação do fundador — git travado no sandbox):** rodar UMA vez `git add --renormalize .` e commitar (`chore: normaliza fins de linha`). Depois disso o `git status` fica limpo e os phantom-diffs somem.
  - **Validação:** após renormalizar, `git status` sem os 27 modificados; novos checkouts em Windows não reintroduzem CRLF no diff.

- [x] **M032 — Esteira Pós-venda: Interface Frontend (Gestor)** _(2026-07-03)_ · P1 · `apps/gestor/src/pages/PosVenda.tsx`, `apps/api/models.py`, `apps/api/routers/esteira.py`
  - **Feito:** board Kanban (item 2) e menu/rota (item 1) já existiam prontos de uma sessão anterior. Completado nesta rodada: **modal de detalhe/checklist** (item 3) — clique no card abre `EsteiraDetalheModal` com itens agrupados por categoria (Contrato/Pagamento/Documentos/Transferência), checkbox para concluir/reabrir item (`PATCH /esteira/{id}/itens/{item_id}`), upload de PDF com link automático ao item de documento (`POST /veiculos/{id}/documentos/upload` + `POST /esteira/{id}/documentos`), chip de status/vencido, e botão "Concluir esteira" (`POST /esteira/{id}/concluir`) desabilitado até os itens obrigatórios estarem resolvidos. **Nudges (item 4)** já cobertos de ponta a ponta pelo `esteira_worker.py` (dispara `Notificacao` em D-7/vencimento) + painel "⚠️ Alertas" já existente no `Dashboard.tsx` — nada a fazer. **Mobile (item 5)** não abordado (não há app mobile no projeto hoje).
  - **Bugs de backend pré-existentes encontrados e corrigidos durante a validação end-to-end no Chrome** (bloqueavam a feature inteira, não introduzidos nesta sessão):
    - `EsteiraPosVenda` não tinha `relationship` para `veiculo`/`comprador` (só as colunas `_id`) — `GET /v1/esteira` (o board) quebrava com 500 (`AttributeError`) sempre que havia pelo menos uma esteira. Corrigido com `relationship("Veiculo", ..., viewonly=True)` e `relationship("ClientePF", ..., viewonly=True)` em `models.py`.
    - As 4 chamadas de `registrar_auditoria(...)` em `esteira.py` (atualizar item, anexar documento, transferência, concluir) usavam assinatura errada (faltavam `acao`/`entidade`/`entidade_id` obrigatórios) — todo `PATCH`/`POST` de ação na esteira quebrava com 500 (`TypeError`). Corrigidas as 4 chamadas.
  - **Validação:** suíte completa (29 testes) verde. E2E manual no Chrome (Playwright headless, login real `gestor@autopremium.com.br`): board carrega 33 esteiras sem erro, modal abre, toggle de item conclui/reabre com o card refletindo o progresso, board+modal conferidos nos temas dark e light sem hardcode quebrado, zero `console.error`.

- [x] **M031 — Esteira Pós-venda: Implementação Backend** _(2026-07-02)_ · `apps/api/models.py`, `apps/api/routers/esteira.py`, `apps/api/routers/contratos.py`, `apps/api/esteira_worker.py`
  - **Origem:** especificação `documentos/ESTEIRA-POS-VENDA.md`. O backend está totalmente implementado, contendo a modelagem de banco de dados (`EsteiraPosVenda`, `ItemChecklist`), geração de template de checklist automático na venda, endpoints de board, detalhes e atualizações em `/v1/esteira`, além do worker em segundo plano para monitoramento de prazos.

- [x] **M030 — WhatsApp da loja: cadastro no admin + sincronização com o número pareado (QR)** _(2026-07-03)_ · P2 (feature) · `apps/api/models.py`, `apps/api/routers/admin.py`, `apps/api/routers/auth.py`, `apps/api/routers/assistente.py`, `apps/gestor/src/pages/Admin.tsx`, `apps/whatsapp-worker/server.js`
  - **Feito:**
    1. **Admin edita telefone/whatsapp** — `EditarLojaRequest`/`editar_loja` (`admin.py`) aceitam `whatsapp`; novo botão **Editar** na aba Lojas de `apps/gestor/src/pages/Admin.tsx` (rota `/admin`, confirmado como o painel Owner real — `apps/admin/src/AdminPage.tsx` não foi tocado, é um app separado fora de escopo) abre `ModalEditarLoja` com nome/cidade/UF/telefone/whatsapp usando a mesma máscara (`mascararTelefone`) do `Configuracoes.tsx`.
    2. **Campo no cadastro** — `RegisterB2BRequest.loja_whatsapp` adicionado e passado para `Loja(...)` em `register_b2b` (`auth.py`).
    3. **Sync com o QR** — worker (`server.js`) extrai `sock.user.id.split(':')[0]` no evento `connection === 'open'` e envia `numero_pareado` no webhook; `WebhookPayload` (`assistente.py`) ganhou o campo; o handler do evento `connection` agora busca a `Loja`, grava `whatsapp_pareado` e calcula `whatsapp_divergente` (dígitos normalizados, sem sobrescrever `whatsapp` automaticamente).
    4. **Alerta de divergência** — novos campos `Loja.whatsapp_pareado`/`whatsapp_divergente` (migração `f1a5c8e30d47`), expostos em `LojaResponse`; badge "⚠ Divergente" na coluna WhatsApp da tabela do admin + aviso no modal de edição.
  - **Validação:** suíte completa (29 testes) verde. E2E no Chrome (Playwright headless, login owner): coluna WhatsApp aparece na aba Lojas, modal edita e salva o número com máscara, lista reflete a mudança, testado em dark e light sem hardcode quebrado, zero `console.error`.
  - **Nota:** bug de schema pego durante a validação — `whatsapp_divergente: bool` não aceitava `NULL` das lojas existentes (coluna nova sem backfill) e quebrava `GET /v1/admin/lojas` com 500; corrigido para `Optional[bool] = False`.

- [x] **M029 — Login social (Google) + MFA real** _(2026-07-04)_ · P2 (feature) · TDD em `documentos/2026-07-04_m029-login-google-mfa-real.md`
  - **Origem:** diagnóstico de lançamento (2026-07-01, `documentos/2026-07-01_diagnostico-gaps-lancamento.md`). Stubs fake removidos em 2026-07-01; esta é a reimplementação real.
  - **Feito (Google):** `apps/api/oauth_google.py` (novo) — Authorization Code flow com `httpx` + validação do `id_token` via JWKS do Google (`PyJWT`/`PyJWKClient`), sem lib OAuth extra. Rotas `GET /v1/auth/google/login` e `/google/callback` em `apps/api/routers/auth.py`; callback redireciona ao front (`/auth/google/callback`, página nova `apps/vitrine/src/pages/GoogleCallback.tsx`) com tokens no fragmento da URL (nunca vai a logs de servidor). Cria ou vincula `Usuario` por e-mail verificado; `models.py` ganhou `google_sub` (unique) e `senha_hash` virou nullable (migration `1612348e9e66`).
  - **Feito (MFA):** `pyotp` + `qrcode[pil]`. Rotas `/mfa/enroll` (gera secret + QR base64), `/mfa/confirm`, `/mfa/disable` (exige senha), `/mfa/verify-login` (segunda etapa). `login()` refatorado com helper `_emitir_sessao_login`; quando `mfa_ativo=True` retorna `mfa_challenge_token` (JWT de 5 min, escopo `mfa_pending`) em vez dos tokens finais. Front: `LoginModal.tsx` trata o desvio de MFA inline; novo `MfaSettingsModal.tsx` nas configurações da conta (modal de perfil da vitrine) para ativar/desativar.
  - **Fora do escopo (documentado no TDD):** login social no gestor/admin, outros provedores sociais, MFA via SMS, recovery codes de backup (perda do autenticador exige suporte manual via banco por ora).
  - **Pendente de ação do usuário:** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` não configurados — sem isso `/v1/auth/google/login` responde 503 de forma controlada (não quebra). Criar em https://console.cloud.google.com/apis/credentials quando for usar em produção.
  - **Validação:** suíte pytest 31/31 verde (7 regressão auth + 2 novos `test_mfa.py`: enroll/confirm/verify-login com código certo e errado, disable exige senha). Typecheck + build da vitrine limpos. E2E no Chrome real (Playwright): botão Google visível no LoginModal, login por senha funcionando, modal de MFA abre com QR renderizado corretamente, zero erros de console, sem regressão visual em light mode.

- [x] **M028 — Documentar a camada de IA na Stack (memória do projeto)** _(2026-07-04)_ · P3 (documentação) · `f:/Projetos/_Memoria/01-projetos/socialveiculos.md` (seção Stack)
  - **Feito — auditoria fina revelou que a memória estava errada, não só incompleta:** o **Assistente do Vendedor não usa Anthropic Claude/Whisper da Anthropic** como a memória registrava. Conferido em `apps/api/assistente/motor.py`: o chat usa **Groq (Llama 3.3 70B, `llama-3.3-70b-versatile`)** com fallback para `gpt-4o-mini` da OpenAI se só houver `OPENAI_API_KEY`; a transcrição de voz usa **Whisper via Groq (`whisper-large-v3`)** ou OpenAI (`whisper-1`); ElevenLabs (`eleven_multilingual_v2`) segue correto para TTS/clonagem. Já o **Marketing** (`apps/api/routers/marketing.py:89`) de fato usa **Anthropic Claude `claude-opus-4-8`, hardcoded** — confirmado que BYOK/chave da plataforma (`CredencialIA`, M024) só trocam a API key usada na chamada, não o modelo (o `modelo_padrao` da credencial não é lido pelo `_chamar_claude`). Stack do `socialveiculos.md` corrigida linha a linha com essa distinção.
  - **Validação:** seção Stack lista provedores + modelos reais, conferidos diretamente no código (não de memória); nenhum modelo/serviço documentado que não exista no código.

- [x] **M027 — UX dos Campos de Busca Autocomplete (Cliente e Veículo)** _(2026-06-29)_ · Criado `SearchSelect.tsx` (componente unificado: input+ícone de busca+dropdown flutuante, reutilizável). Aplicado em `Contratos.tsx` substituindo o par input+select despadronizado. CRM já usava o padrão correto (`autocomplete-search-result`).

- [x] **M026 — Integração API FIPE para Dados do Veículo** _(2026-06-29)_ · Resolvido como parte da M016: `VehicleIdentityFields.tsx` já usava o catálogo FIPE (marcas/modelos via `/catalogo`); M016 completou com anos reais FIPE (com combustível) ao selecionar modelo. Fluxo completo: tipo → marcas FIPE → modelos FIPE → anos FIPE com código.

- [x] **M001 — Gestor: perfil/avatar abre dropdown com Configurações + Sair (remover do menu lateral)** _(2026-06-28)_ · P1 (UX + consistência com a vitrine) · `apps/gestor/src/components/Topbar.tsx` (bloco `.topbar-user` / `#user-menu`, ~106–112) + `apps/gestor/src/components/Sidebar.tsx` (rodapé `.sidebar-footer`, ~214–243) · `theme.css` (estilos do dropdown).
  - **Origem:** print do usuário no Estoque — hoje "Configurações" e "Sair" ficam no rodapé do menu lateral; o avatar/badge **GESTOR · VH** no topbar **não tem `onClick`**. Pedido: clicar no perfil abre um menu suspenso com **Configurações** e **Sair**, e remover esses itens do menu lateral.
  - **O que fazer:**
    1. **Topbar:** tornar `.topbar-user` (id `user-menu`) clicável → abre um **dropdown** ancorado embaixo do avatar com: nome/e-mail do usuário (cabeçalho), **Configurações** (`navigate('/configuracoes')`) e **Sair** (logout — reaproveitar `handleLogout` que hoje vive no Sidebar). Fechar ao clicar fora / `Esc`. Setinha de estado (▾) opcional.
    2. **Sidebar:** remover o `.sidebar-footer` inteiro (os dois itens Configurações e Sair, ~214–243) e o `logout`/`handleLogout` correspondente migra para a Topbar.
    3. **Estilo:** usar tokens `--sv-*` e tema dark/light do gestor (NUNCA hardcode). Item "Sair" em tom de alerta como já era no `.logout`.
  - **Validação:** clicar no avatar abre o dropdown; Configurações navega para `/configuracoes`; Sair desloga; menu lateral não tem mais o rodapé; fecha ao clicar fora; OK em dark e light. (Opcional `/testar-sistema`.)

- [x] **M023 — Rede Social: filtros colados à busca, "Enviar Mensagem" não abre conversa, texto do chat fixo branco** _(2026-06-28)_ · P1 (UX quebrada) · `apps/gestor/src/pages/RedeSocial.tsx`.
  - **Origem:** prints do usuário — (a) busca e filtros Cidade/UF muito distantes em telas largas; (b) clicar "Enviar Mensagem" no Diretório de Parceiros troca para a aba Chat mas não seleciona a conversa recém-criada; (c) texto das mensagens recebidas e input do chat estão `color: 'white'` hardcoded — invisível no tema claro.
  - **Estado atual verificado:**
    - `filter-bar` (linha 688): `search-wrapper` cresce com `flex: 1`, empurrando Cidade/UF/Filtrar para a extremidade direita.
    - `handleStartConversation` (linha 676): faz `POST /b2b/chat/conversas` e chama `onStartChat()` que é apenas `() => setActiveTab('chat')` (linha 228) — não passa o id da conversa criada.
    - `ChatTab` (linha 762): não recebe prop de conversa inicial; mensagem recebida tem `color: 'white'` (linha 946); input tem `color: 'white'` (linha 972).
  - **O que fazer:**
    ### 1) Filtros — agrupar busca + filtros sem espaço morto
    - Remover `flex: 1` do `search-wrapper` dentro do `filter-bar`; dar a ele um `max-width` fixo (ex: 280px) ou usar `gap` uniforme entre todos os campos. O `filter-bar` já tem `display: flex` — basta ajustar proporções: busca ~40%, Cidade ~25%, UF ~10%, botão fixo.
    ### 2) "Enviar Mensagem" → abrir conversa diretamente
    - Alterar assinatura de `onStartChat` em `ParceirosTab` de `() => void` para `(conversaId: string) => void`.
    - Em `handleStartConversation` (linha 676): capturar o `id` retornado pelo POST e passá-lo: `onStartChat(res.id)`.
    - No componente pai `RedeSocial` (linha 228): mudar o callback para `(id) => { setActiveTab('chat'); setInitialConversaId(id) }` — novo estado `initialConversaId`.
    - `ChatTab` recebe prop `initialConversaId?: string`; no `useEffect` que carrega conversas, se vier o id, selecionar automaticamente essa conversa (chamar `handleSelectConversa`) após o fetch.
    ### 3) Texto do chat adaptado ao tema
    - Mensagens recebidas (linha 946): trocar `color: 'white'` por `color: 'var(--sv-text)'` e `background: 'rgba(255,255,255,0.05)'` por `background: 'var(--sv-surface-bright)'`.
    - Input do chat (linha 972): trocar `color: 'white'` por `color: 'var(--sv-text)'`.
    - Timestamp das mensagens (linha 958): trocar `color: 'rgba(255,255,255,0.5)'` por `color: 'var(--sv-text-muted)'`.
    - Autor da mensagem recebida (linha 956): trocar `color: 'var(--sv-primary-text)'` por `color: 'var(--sv-primary)'` (que já se adapta dark/light).
  - **Validação:** filtros compactos sem gap gigante; "Enviar Mensagem" abre a aba Chat já com a conversa selecionada e mensagens carregadas; texto legível em dark e light; sem `white` hardcoded no chat.
  - **Vitrine (mesmo comportamento):** `apps/vitrine/src/pages/Feed.tsx:266` faz `POST /vitrine/conversas` e depois `navigate('/mensagens')` sem passar o id retornado. `Mensagens.tsx` não lê nenhum parâmetro de rota/estado para pré-selecionar. Fix: capturar `res.id` do POST e usar `navigate('/mensagens', { state: { conversaId: res.id } })`; em `Mensagens.tsx` ler `useLocation().state?.conversaId` e, após o `fetchConversas()`, selecionar automaticamente a conversa correspondente via `handleSelectConversa`.

- [x] **M022 — Credenciais bancárias: campos reais (usuário + senha) + escopo loja vs vendedor** _(2026-06-28)_ · P1 (página de Configurações inconsistente com o Simulador; vendedor não tem credencial própria) · `apps/gestor/src/pages/Configuracoes.tsx` + `apps/api/routers/configuracoes.py` + `apps/api/models.py` (`CredencialBanco`).
  - **Origem:** print do usuário — a aba "Credenciais Bancárias (Simulador)" pede um **payload JSON** bruto (`{"client_id":"...","client_secret":"..."}`), mas a realidade do Simulador (verificado em `Simulador.tsx:82-83` e `configuracoes.py:120-154`) é **usuário + senha** simples. Além disso, hoje só existe credencial **por loja** (`UniqueConstraint loja_id+banco`); falta a possibilidade de o **vendedor** cadastrar credencial própria (sobrepõe a da loja para as simulações dele).
  - **Estado atual verificado:**
    - `CredencialBanco` (models.py:857): `loja_id`, `banco`, `credenciais_cifradas` (JSON Fernet), `ativo` — sem campo `usuario_id`.
    - `Simulador.tsx:79-83`: front já envia/lê `{ usuario, senha }` via POST `/configuracoes/credenciais_banco`.
    - `Configuracoes.tsx:298`: textarea pede `{ "client_id": "..." }` — desatualizado e inconsistente.
    - `simulador_router.py:106-107`: busca credencial por `loja_id` — não contempla credencial de vendedor.
  - **O que fazer:**
    ### Backend (`apps/api`)
    1. **models.py** — adicionar coluna `usuario_id` nullable em `CredencialBanco` e mudar `UniqueConstraint` para `(loja_id, banco, usuario_id)` (NULL = da loja; preenchido = do vendedor). Migração idempotente (SQLite DDL não-transacional — ver padrão enums.csv).
    2. **configuracoes.py** — endpoints `GET`/`POST /credenciais_banco`:
       - `GET`: retornar credenciais da loja + credencial própria do usuário logado (se existir), com flag `escopo: "loja" | "vendedor"`.
       - `POST`: aceitar `{ banco, usuario, senha, escopo }` — `"loja"` grava `usuario_id=NULL` (gestor/admin only); `"vendedor"` grava `usuario_id=context.usuario.id` (qualquer papel).
    3. **simulador_router.py** — ao buscar credencial para simular: preferir credencial do `usuario_id` logado, fallback para a da loja.
    ### Frontend (`apps/gestor`)
    4. **Configuracoes.tsx** — substituir o textarea JSON por dois campos `<input>`: **Usuário** e **Senha** (tipo `password`, com toggle mostrar/ocultar). Adicionar seletor de escopo: **"Desta loja" (padrão, gestor)** / **"Minha credencial pessoal"** (qualquer papel). Mostrar status atual com o usuário configurado (mascarado) + botão limpar. Remover toda menção a `client_id`, `client_secret`, `api_key`, `partner_code`.
  - **Validação:** gestor salva credencial da loja → vendedor logado simula usando-a; vendedor cadastra a própria → a dele sobrepõe nas simulações dele; campos são usuário+senha (não JSON); tela de Configurações e Simulador mostram o mesmo modelo.

- [x] **M025 — Painel Owner (admin_plataforma): visão geral da plataforma + gestão de clientes/lojas** _(2026-06-28)_ · P1 · rota `/admin` exclusiva para `papel === 'admin_plataforma'` · `apps/gestor/src/pages/Admin.tsx` (novo) + `apps/gestor/src/App.tsx` + `apps/gestor/src/components/Sidebar.tsx` + `apps/api/routers/admin.py` (expansão)

  ### Contexto
  Você é o dono da plataforma e precisa de um painel separado para: fechar contratos com novos clientes (lojas), ver saúde do negócio, e navegar como observador dentro do gestor/vitrine de qualquer loja. O backend já tem `PapelUsuario.ADMIN_PLATAFORMA` e rotas `/v1/admin/lojas`, `/v1/admin/stats`, `/v1/admin/auditoria`. O frontend **reconhece** o papel (Sidebar, Topbar, authStore) mas **não tem nenhuma página** de admin — esse é o gap a resolver.

  ---

  ### 1) Seed / criação da conta owner

  **`apps/api/seed.py` (ou script avulso `create_owner.py`):**
  ```python
  # Criar usuário owner uma única vez
  owner = Usuario(
      id=_uuid(),
      nome="Victor Belo",
      email="victorbelocorreia@gmail.com",
      papel=PapelUsuario.ADMIN_PLATAFORMA,
      ativo=True,
      # senha hasheada de um valor seguro definido via variável de ambiente OWNER_PASSWORD
  )
  ```
  - O owner **não pertence a nenhuma loja** (`MembroLoja` não criado para ele).
  - Autenticação usa o mesmo endpoint `POST /v1/auth/login` com e-mail + senha.
  - Após login, `user.papel === 'admin_plataforma'` → frontend redireciona para `/admin` em vez de `/`.

  ---

  ### 2) Redirecionamento pós-login

  **`apps/gestor/src/pages/Login.tsx`** — após autenticação bem-sucedida:
  ```tsx
  if (user.papel === 'admin_plataforma') {
    navigate('/admin')
  } else {
    navigate('/')
  }
  ```

  **`apps/gestor/src/App.tsx`** — rota protegida nova:
  ```tsx
  import { AdminPage } from './pages/Admin'

  // dentro de <Route element={<PrivateRoute />}>:
  <Route path="admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
  ```

  `AdminGuard` — redireciona para `/` se `papel !== 'admin_plataforma'`:
  ```tsx
  function AdminGuard({ children }: { children: ReactNode }) {
    const user = useAuthStore((s) => s.user)
    if (user?.papel !== 'admin_plataforma') return <Navigate to="/" replace />
    return <>{children}</>
  }
  ```

  ---

  ### 3) Sidebar — item Admin

  **`apps/gestor/src/components/Sidebar.tsx`:**
  - Adicionar item `{ path: '/admin', label: 'Admin', icon: <ShieldIcon> }` ao topo do `NAV_ITEMS`, **visível somente** para `user?.papel === 'admin_plataforma'`.
  - O admin não vê os itens normais de loja (Estoque, CRM, etc.) — filtrar `visibleNavItems` para excluir itens de módulo quando `papel === 'admin_plataforma'`.

  ---

  ### 4) Backend — expansão de `apps/api/routers/admin.py`

  Novos endpoints além dos 3 já existentes (`/lojas`, `/stats`, `/auditoria`):

  ```python
  # Detalhe de uma loja específica com métricas
  GET /v1/admin/lojas/{loja_id}
  # → { loja, total_veiculos, total_leads, total_usuarios, assinatura, modulos_ativos }

  # Criar/editar loja (fechar novo cliente)
  POST /v1/admin/lojas          # cria loja + gestor inicial
  PATCH /v1/admin/lojas/{loja_id}  # edita nome, cidade, plano

  # Ativar/desativar loja (sem deletar dados)
  PATCH /v1/admin/lojas/{loja_id}/status   # body: { ativa: bool }

  # Gerenciar módulos de uma loja (liberar/revogar sem assinatura)
  PATCH /v1/admin/lojas/{loja_id}/modulos  # body: { modulo: str, liberado: bool }

  # Stats enriquecidas (para o dashboard owner)
  GET /v1/admin/stats
  # adicionar: receita_mrr (futuro), lojas_trial, lojas_pagas, veiculos_ultimos_30d, leads_ultimos_30d

  # Impersonação / observação de loja (retorna token temporário com loja_id injetado)
  POST /v1/admin/lojas/{loja_id}/impersonar
  # → { access_token, loja_nome } — token de curta duração (15 min) que simula um gestor daquela loja
  ```

  **Impersonação (ver gestor/vitrine de qualquer loja):**
  - Gera JWT com `sub=owner_id`, `loja_id=target`, `papel=gestor`, `exp=now+15min`.
  - No frontend: abre o gestor daquela loja em nova aba com token na querystring (ou sessionStorage), com banner "Você está observando como [Loja X] · Sair".

  ---

  ### 5) Frontend — `apps/gestor/src/pages/Admin.tsx` (arquivo novo)

  Layout: mesma estrutura `page-content` / `glass-card` do gestor, sem sidebar de módulos.

  **Aba 1 — Overview (dashboard do dono):**
  - Cards de métricas: Total de lojas · Lojas ativas · Veículos na plataforma · Leads gerados (últimos 30 dias) · Usuários cadastrados.
  - Cada card usa os dados de `GET /v1/admin/stats`.
  - Linha do tempo (log de auditoria): tabela com ação, loja, usuário, data — `GET /v1/admin/auditoria`.

  **Aba 2 — Lojas (fechar clientes):**
  - Tabela de todas as lojas: Nome · Cidade/UF · Plano · Módulos ativos · Status (ativa/inativa) · Criado em · Ações.
  - Botão **"+ Nova Loja"** → modal com campos:
    - Nome da loja, CNPJ, cidade/UF, telefone.
    - Nome do gestor inicial, e-mail, senha temporária.
    - Plano (select dos planos cadastrados).
    - Módulos liberados (checkboxes).
    - Ao salvar: `POST /v1/admin/lojas` → cria loja + usuário gestor + assinatura + módulos.
  - Por linha: botão **Detalhes** (expande inline ou abre drawer), **Ativar/Desativar**, **Observar** (impersonação).
  - Filtro: busca por nome/cidade + toggle Ativas / Inativas.

  **Aba 3 — Produtos (gestor + vitrine):**
  - Visão read-only cruzada: card por produto (Estoque, CRM, Simulador, Marketing, etc.) com:
    - Quantas lojas têm o módulo ativo.
    - Total de uso agregado (veículos cadastrados, leads abertos, posts gerados — via stats).
  - Link "Acessar como loja" → impersonação.

  **Drawer de detalhe de loja:**
  - Colunas: Info básica (nome, CNPJ, cidade) + Assinatura + Módulos + Equipe (lista de membros) + Veículos (count) + Leads (count).
  - Botão **Editar** (inline save), **Ativar/Desativar**, **Observar gestor**, **Observar vitrine**.

  ---

  ### 6) Impersonação no frontend

  Após clicar em "Observar":
  1. `POST /v1/admin/lojas/{id}/impersonar` → recebe `{ access_token, loja_nome }`.
  2. Abre nova aba: `window.open('/gestor-impersonado?token=...&loja=...')`.
  3. Na aba aberta: carrega token em memória (não em localStorage), exibe banner fixo no topo:
     ```
     ⚠ Observando como [Nome da Loja] — token expira em 15 min  [Encerrar]
     ```
  4. Todas as chamadas de API usam esse token temporário.
  5. Botão "Encerrar" fecha a aba ou limpa o token e redireciona para `/admin`.

  ---

  ### Validação
  - Login com `victorbelocorreia@gmail.com` → redireciona para `/admin` (não `/`).
  - Acessar `/admin` com conta de gestor/vendedor → redireciona para `/`.
  - "Nova Loja" → loja aparece na listagem + gestor consegue logar com a senha temporária.
  - "Observar" → abre gestor da loja; banner visível; token expira em 15 min.
  - Stats mostram totais corretos (verificar via `GET /v1/admin/stats`).

- [x] **M024 — Marketing IA: dois modos de uso (SaaS gerenciado + BYOK) + postagem automática nas redes sociais** _(BYOK + banner + MarketingUsage concluídos 2026-06-28; OAuth Meta + agendamento + histórico concluídos 2026-06-29)_ · P1 · `apps/api/routers/marketing.py` + `apps/api/models.py` + `apps/gestor/src/pages/ferramentas/Marketing.tsx` + `apps/gestor/src/pages/Configuracoes.tsx`

  ### Contexto
  Hoje o módulo Marketing usa **exclusivamente** a `ANTHROPIC_API_KEY` da plataforma (hardcoded no servidor), e não tem postagem automática. O erro `401 Unauthorized` que aparece no print ocorre porque a chave do servidor não está configurada. A melhoria resolve isso e abre duas formas de uso.

  ---

  ### Modo 1 — IA gerenciada pela plataforma (SaaS)
  O cliente assina o módulo Marketing e **usa a chave da plataforma** sem precisar configurar nada. A plataforma cobra por uso (cobrança futura — pode começar com créditos pré-pagos ou incluso no plano).

  **Backend:**
  - `ANTHROPIC_API_KEY` no `.env` do servidor continua sendo a chave da plataforma.
  - Ao gerar um post, o backend verifica a precedência: **credencial BYOK da loja → fallback para chave da plataforma**.
  - Registrar consumo por loja (modelo + tokens entrada + tokens saída) em nova tabela `MarketingUsage` para billing futuro:
    ```
    MarketingUsage: id, loja_id, usuario_id, modelo, tokens_input, tokens_output, custo_usd, criado_em
    ```
  - Se a chave da plataforma não estiver disponível e a loja não tiver BYOK, retornar `503` com mensagem clara.

  ---

  ### Modo 2 — BYOK: o cliente usa a própria chave de IA (Bring Your Own Key)
  O gestor cadastra a **própria chave da Anthropic** (ou futuramente OpenAI/Gemini) nas Configurações. A plataforma usa essa chave ao chamar a IA — o custo cai na conta do próprio cliente.

  **Modelo (`apps/api/models.py`):**
  ```python
  class CredencialIA(Base):
      __tablename__ = "credenciais_ia"
      id: Mapped[str]            # UUID
      loja_id: Mapped[str]       # FK → Loja
      provedor: Mapped[str]      # "anthropic" | "openai" | "gemini"
      api_key_cifrada: Mapped[str]  # Fernet — mesma lógica das credenciais bancárias
      modelo_padrao: Mapped[str | None]  # ex: "claude-haiku-4-5-20251001"
      ativo: Mapped[bool]
      criado_em / atualizado_em
  ```
  Unique constraint: `(loja_id, provedor)`.

  **Endpoints (`apps/api/routers/configuracoes.py` ou novo `routers/credenciais_ia.py`):**
  - `GET /v1/configuracoes/credenciais-ia` — lista credenciais da loja (retorna provedor + modelo, **nunca** a key em texto claro; apenas flag `configurada: true`).
  - `POST /v1/configuracoes/credenciais-ia` — salva/atualiza `{ provedor, api_key, modelo_padrao }` — cifra com Fernet antes de persistir.
  - `DELETE /v1/configuracoes/credenciais-ia/{provedor}` — remove a credencial.
  - Valida a chave chamando o provedor antes de salvar (ex: `GET models` ou mensagem mínima com `max_tokens=1`).

  **Lógica de uso no `marketing.py`:**
  ```python
  async def _resolver_api_key(loja_id: str, db: AsyncSession) -> tuple[str, str]:
      """Retorna (api_key, provedor). BYOK tem prioridade; fallback é chave da plataforma."""
      credencial = await db.scalar(
          select(CredencialIA).where(CredencialIA.loja_id == loja_id, CredencialIA.ativo == True)
          .order_by(CredencialIA.atualizado_em.desc())
      )
      if credencial:
          return fernet.decrypt(credencial.api_key_cifrada), credencial.provedor
      if ANTHROPIC_API_KEY:
          return ANTHROPIC_API_KEY, "anthropic"
      raise HTTPException(503, "Nenhuma chave de IA configurada.")
  ```

  **Frontend — aba "IA" em Configurações (`apps/gestor/src/pages/Configuracoes.tsx`):**
  - Nova seção **"Inteligência Artificial"** (ou aba separada se já existirem abas).
  - Campos: `Provedor` (select: Anthropic / OpenAI / Google Gemini), `API Key` (input `type=password` com toggle olho), `Modelo padrão` (texto — ex: `claude-haiku-4-5-20251001`).
  - Badge de status: `Configurada ✓` / `Não configurada`.
  - Botão **Testar** que chama `POST /v1/configuracoes/credenciais-ia/testar` e exibe feedback inline.
  - Botão **Remover** com confirmação.
  - Nota informativa: _"Ao usar sua própria chave, o custo das chamadas de IA é cobrado diretamente na sua conta do provedor."_

  **Frontend — banner na página de Marketing:**
  - Quando a loja tem BYOK ativo: badge `Usando sua API` (cor neutra).
  - Quando está usando a plataforma: badge `IA da plataforma` (cor de destaque / gem).
  - Quando nenhuma chave disponível: bloco de erro com botão "Configurar chave de IA" linkando para `/configuracoes#ia`.

  ---

  ### Modo 3 — Postagem automática nas redes sociais
  > Depende dos Modos 1 ou 2 para gerar o texto. Depende de credenciais OAuth das redes sociais configuradas pelo gestor.

  **Redes suportadas (fase 1):** Instagram Business + Facebook Page (via Meta Graph API). WhatsApp Business API (fase 2). TikTok/X como fase 3.

  **Modelo (`apps/api/models.py`):**
  ```python
  class CredencialRedeSocial(Base):
      __tablename__ = "credenciais_rede_social"
      id: Mapped[str]
      loja_id: Mapped[str]
      rede: Mapped[str]           # "instagram" | "facebook" | "whatsapp" | "tiktok"
      access_token_cifrado: Mapped[str]   # Fernet
      refresh_token_cifrado: Mapped[str | None]
      token_expira_em: Mapped[datetime | None]
      page_id: Mapped[str | None]         # ID da página/conta de negócio
      instagram_account_id: Mapped[str | None]
      ativo: Mapped[bool]
      criado_em / atualizado_em
  ```

  **Fluxo de autenticação (OAuth 2.0 — Meta):**
  1. Gestor clica em "Conectar Instagram/Facebook" em Configurações.
  2. Frontend redireciona para `GET /v1/social-auth/meta/iniciar` → backend gera URL OAuth do Meta e redireciona.
  3. Meta redireciona para callback `GET /v1/social-auth/meta/callback?code=...` → backend troca code por `access_token` de longa duração (60 dias), cifra e salva em `CredencialRedeSocial`.
  4. Frontend volta para Configurações com status `Conectado ✓`.

  **Endpoints:**
  - `GET /v1/configuracoes/redes-sociais` — lista conexões ativas da loja (rede, page_id, expira_em, status).
  - `GET /v1/social-auth/{rede}/iniciar` — retorna URL OAuth para o frontend redirecionar.
  - `GET /v1/social-auth/{rede}/callback` — processa o code, salva token.
  - `DELETE /v1/configuracoes/redes-sociais/{rede}` — desconecta.
  - `POST /v1/marketing/publicar` — publica imediatamente o post gerado em uma ou mais redes.
  - `POST /v1/marketing/agendar` — agenda publicação futura (armazena em `PostAgendado`).

  **Modelo `PostAgendado`:**
  ```python
  class PostAgendado(Base):
      __tablename__ = "posts_agendados"
      id: Mapped[str]
      loja_id: Mapped[str]
      veiculo_id: Mapped[str | None]
      redes: Mapped[str]           # JSON array: ["instagram", "facebook"]
      texto: Mapped[str]
      hashtags: Mapped[str]        # JSON array
      midia_urls: Mapped[str | None]  # JSON array de URLs públicas das fotos do veículo
      status: Mapped[str]          # "agendado" | "publicado" | "falhou" | "cancelado"
      publicar_em: Mapped[datetime]
      publicado_em: Mapped[datetime | None]
      erro: Mapped[str | None]
      criado_em / atualizado_em
  ```

  **Worker de publicação:**
  - Tarefa periódica (APScheduler ou Celery beat) a cada 1 minuto: busca `PostAgendado` com `status="agendado"` e `publicar_em <= now()`.
  - Chama API da rede correspondente com o texto + foto do veículo (baixa da URL, envia como multipart).
  - Atualiza `status` para `"publicado"` ou `"falhou"` com mensagem de erro.

  **Frontend — integração na página de Marketing (`Marketing.tsx`):**
  - Após gerar o post, aparece painel "Publicar / Agendar":
    - Checkboxes das redes conectadas (com ícone e status da conexão).
    - Toggle "Publicar agora" / "Agendar para:" (datetime picker).
    - Botão **Publicar** → `POST /v1/marketing/publicar` ou `POST /v1/marketing/agendar`.
    - Seção "Histórico de posts" com tabela paginada: veículo, rede, status, data.
  - Se nenhuma rede conectada: card informativo "Conecte suas redes em Configurações → Redes Sociais".

  **Frontend — aba "Redes Sociais" em Configurações:**
  - Card por rede (Instagram, Facebook): ícone + nome + status (`Conectado ✓ · expira em X dias` / `Não conectado`).
  - Botão **Conectar** (inicia OAuth) ou **Desconectar** (com confirmação).
  - Aviso de renovação quando token expira em < 7 dias.

  ---

  ### Prioridade de implementação (ordem sugerida)
  1. **BYOK back + front** (Configurações → aba IA) — resolve o erro 401 imediatamente para lojas que têm chave própria.
  2. **Banner de modo ativo** na página de Marketing.
  3. **MarketingUsage** (logging de tokens) — necessário para billing no Modo 1.
  4. **OAuth Meta** (Instagram + Facebook) — fluxo de autenticação.
  5. **Publicação imediata** (`POST /v1/marketing/publicar`).
  6. **Agendamento + worker** (`PostAgendado` + APScheduler).
  7. **Histórico de posts** na página de Marketing.

  ### Validação
  - Loja com BYOK: POST em `/gerar-post` usa a chave da loja (confirmar via log); billing não é debitado da plataforma.
  - Loja sem BYOK: usa chave da plataforma; `MarketingUsage` registra tokens consumidos.
  - OAuth Meta: conectar conta → status "Conectado"; gerar post → publicar no Instagram → post aparece na conta; falha de token → status "falhou" com mensagem legível.
  - Sem rede conectada: botão "Publicar" desabilitado com tooltip "Conecte suas redes em Configurações".

- [x] **M008 — Fluxo "Vender veículo → gerar contrato" (somente gestor)** · verificado no código: `VenderModal` em `Estoque.tsx:1173` já executa a venda e redireciona para `/ferramentas/contratos?id={contratoId}`. Fluxo completo. _(confirmado 2026-06-28)_
- [x] **M016 — Precificação inteligente: FIPE + preço sugerido** _(2026-06-29)_ · `models.py` + `schemas.py` + `veiculos.py` + `VehicleIdentityFields.tsx` + `Estoque.tsx` + `veiculo.ts` · adicionados `fipe_marca_codigo/fipe_modelo_codigo/fipe_ano_codigo` no modelo; ao selecionar marca+modelo no catálogo, o componente carrega anos reais da FIPE com combustível; ao salvar veículo, códigos são gravados; endpoint `/precificacao` busca valor FIPE real e calcula margem + alerta de encalhe. Migração `a7c2e4f91b05` criada.
- [ ] **M017 — Pré-aprovação de crédito para o consumidor (vitrine)** · ideia aprovada, aguarda parceria com bancos; o motor de simulação já existe no gestor, falta apenas o fluxo consumer-facing na vitrine. Implementar quando houver integração formal com financiadoras. _(era 16)_
- [x] **M018 — Carteira do Proprietário (pós-venda)** _(2026-06-29)_ · Backend gestor (`/veiculos/{id}/venda`, `/comprador`, `/documentos`) + backend vitrine (`/vitrine/meus-veiculos`) já existiam; adicionado `valor_fipe_atual` (busca FIPE em paralelo via códigos M016) em `MeuVeiculoResponse` e exibição na tela `MeusVeiculos.tsx` da vitrine.
- [x] **M019 — Consulta de placa** · descartado; KePlaca já está integrado no sistema. _(era 18)_
- [x] **M021 — Ferramentas: submenu + páginas dedicadas (sem modal/mock)** · verificado: `Sidebar.tsx:154` já tem grupo expansível "Ferramentas" com submenu para Simulador/Contratos/Marketing; rotas dedicadas existem. _(confirmado 2026-06-28)_

---

## Concluídas

- [x] **M035 — `JWT_SECRET` abaixo do mínimo recomendado (29 < 32 bytes p/ HS256)** _(2026-07-02)_ · P3 (segurança) · `.env`, `.env.example`, `apps/api/config.py`
  - **Feito:** Adicionada validação de tamanho mínimo de 32 bytes para o `JWT_SECRET` em produção (`API_DEBUG=false`) no `config.py`. Atualizado `.env.example` documentando o requisito e sugerindo comando openssl.
- [x] **M002 — Chat da vitrine (`/mensagens`): dark hardcoded sobre tema claro → ilegível** · P1 · `apps/vitrine/src/pages/Mensagens.tsx` · trocado por tokens `--vt-*` do tema light. _(era 01)_
- [x] **M003 — Modal "Novo Lead": dropdown com cadastrados + botão "+" cadastrar na hora** · P1 · `apps/gestor/src/pages/CRM.tsx` (`NovoLeadModal`) · campos Cliente/Veículo deixaram de travar com banco vazio. _(era 02)_
- [x] **M004 — Modal "Novo Cliente": máscaras, validação e sanitização** · P1 · `apps/gestor/src/pages/CRM.tsx` (`ClienteModal`) · CPF/RG/UF corrigidos, limites e validação. _(era 03)_
- [x] **M005 — Modal "Config. Assistente de IA": consentimento fora do encaixe + responsividade** · P2 · `apps/gestor/src/pages/AssistenteIA.tsx`. _(era 04)_
- [x] **M006 — Toasts/alertas: baixo contraste (incl. info azul)** · P2 · `apps/gestor/src/styles/theme.css` `.sv-toast*` (componente `UIProvider.tsx`). _(era 05)_
- [x] **M007 — Vitrine: Perfil sai do bottom-nav e vira menu no avatar (trocar foto + sair)** · P2 · `apps/vitrine/src/pages/Feed.tsx` · **par da M001** — conferir se o padrão de dropdown ficou consistente entre vitrine e gestor. _(era 06)_
- [x] **M009 — Diretório de Parceiros (Filtros): texto/fundo hardcoded → ilegível no tema claro** · P2 · `apps/gestor/src/pages/RedeSocial.tsx`. _(era 07)_
- [x] **M010 — Modal "Novo Veículo": abas para custos extras (preparação, mecânico, rolos)** · P2 · `apps/gestor/src/pages/Estoque.tsx` (`VeiculoModal`). _(era 08)_
- [x] **M011 — Modais de cadastro: campos obrigatórios vazios com borda vermelha sutil** · P2 · `apps/gestor/src/pages/CRM.tsx` (`ClienteModal`/`NovoLeadModal`). _(era 09)_
- [x] **M012 — Equipe: seleção de módulos/permissões ao criar/editar vendedor** · P1 · `apps/gestor/src/pages/Equipe.tsx`. _(era 10)_
- [x] **M013 — Tela de Login: placeholder/texto sobrepondo os ícones de e-mail/senha** · P2 · `apps/gestor/src/styles/theme.css`. _(era 11)_
- [x] **M014 — Campos de e-mail: remoção incondicional de espaços + bloqueio da tecla espaço** · P2 · `apps/gestor/src/pages/Login.tsx`. _(era 12)_
- [x] **M015 — Diretório de Parceiros: redimensionar filtros + listagem em cards horizontais** · P2 · `apps/gestor/src/pages/RedeSocial.tsx`. _(era 13)_
- [x] **M020 — Unificar campos de veículo entre Estoque e Simulador** · `apps/gestor/src/lib/veiculo.ts` + `VehicleIdentityFields.tsx` (fonte única). tsc/build limpos; falta validação visual. _(era 19)_

- [x] **M044 — Modelos de Contrato Editáveis** · P2 (feature) · _(2026-07-05)_ · `apps/api/models.py`, `apps/api/routers/contratos.py`, `apps/api/schemas.py`, `apps/gestor/src/pages/ferramentas/Contratos.tsx`.

  ### Contexto
  Hoje `apps/api/routers/contratos.py` (`_gerar_html_contrato`, linhas 543-655) gera o HTML do contrato com f-strings Python chumbadas no código — texto fixo, 3 tipos hardcoded (`compra_venda`, `consignacao`, `garantia`), sem nenhuma forma de o usuário editar cláusulas. `apps/gestor/src/pages/ferramentas/Contratos.tsx` só permite escolher o tipo fixo ao criar contrato e trocar status depois; não há edição de texto. Objetivo: permitir que a loja crie/edite modelos de contrato livres (não presos aos 3 tipos), combinando texto fixo com variáveis do sistema (cliente, veículo, loja, valores) e campos personalizados preenchidos na hora de gerar o contrato.

  ### Decisões
  - **Modelos livres e ilimitados** — usuário nomeia e cria quantos quiser, não vinculados aos 3 tipos fixos atuais.
  - **Editor**: área `contentEditable` nativa (sem lib nova — projeto não tem rich-text instalado) + painel lateral de variáveis do sistema, clicáveis, inserem `{{cliente.nome}}` etc. no cursor.
  - **Variáveis**: catálogo fixo do sistema (`cliente.*`, `veiculo.*`, `loja.*`, `contrato.*`) **+ campos personalizados** que o autor do modelo define (chave + label); preenchidos pelo vendedor no momento de gerar o contrato (não no modelo).
  - **Motor de renderização**: migrar de f-string manual para **Jinja2** (`autoescape=True` obrigatório, evita XSS). Sintaxe `{{ }}` no editor mapeia 1:1 para o motor.
  - **Compatibilidade**: contratos existentes continuam usando `_gerar_html_contrato` legado (sem `template_id`) — não alterar essa função. Seed cria 3 templates padrão por loja (Compra e Venda, Consignação, Garantia) convertendo o HTML atual para Jinja2 — ponto de partida editável, não obrigatório.
  - **Localização UI**: nova aba "Modelos" dentro da página Contratos existente, ao lado da listagem atual.
  - **Isolamento multi-tenant**: toda query de `template_contrato` filtrada por `loja_id` (mesmo padrão de `test_tenant_isolation.py`).
  - Fora de escopo: rich-text avançado (Tiptap/Quill), versionamento de templates, condicionais/loops Jinja2 na UI, templates compartilhados entre lojas.

  ### Modelo de dados
  - Nova tabela `template_contrato`: `id`, `loja_id` (FK `loja.id`, cascade), `nome`, `conteudo_html` (Text, placeholders Jinja2), `campos_extras` (JSON: `[{chave, label}]`), `ativo`, `created_at`, `updated_at`.
  - `Contrato` ganha `template_id` (FK nullable → `template_contrato.id`, `ON DELETE SET NULL`) e `dados_extras` (Text/JSON nullable — valores preenchidos pelo vendedor para os campos personalizados daquele contrato).

  ### Backend
  - `_render_template_contrato(template, contrato, loja)`: monta contexto (`cliente.*`, `veiculo.*`, `loja.*`, `contrato.*` + `dados_extras`) e renderiza `Template(conteudo_html).render(**contexto)` via `Environment(autoescape=True)`.
  - `GET /contratos/{id}/pdf` bifurca: `template_id` setado → `_render_template_contrato`; `template_id` nulo → `_gerar_html_contrato` legado (inalterado).
  - Endpoints novos em `apps/api/routers/contratos.py`: `GET/POST /templates-contrato`, `GET/PATCH/DELETE /templates-contrato/{id}` (delete = soft, `ativo=false`), `POST /templates-contrato/{id}/duplicar`.
  - `POST /contratos` aceita `template_id` opcional e `dados_extras` (dict) quando o template tem `campos_extras`.
  - Migração Alembic: `template_contrato` + colunas novas em `contrato`; segunda migração de seed cria os 3 templates padrão (HTML atual convertido para `{{ }}` Jinja2) para cada loja existente.
  - Dependência nova: `jinja2>=3.1.0` (adicionar a `apps/api/requirements.txt`).

  ### Frontend (`apps/gestor/src/pages/ferramentas/Contratos.tsx`)
  - Abas "Contratos" / "Modelos" no topo da página (extrair corpo atual para `ContratosTabContent`, `ContratosPage` vira orquestrador).
  - `ModelosTab`: grid de cards (nome, nº de campos personalizados, ações editar/duplicar/excluir), botão "+ Novo Modelo".
  - `EditorTemplateModal`: campo nome + editor `contentEditable` + painel lateral com catálogo de variáveis por grupo (Cliente/Veículo/Loja/Contrato·Valores), clique insere placeholder no cursor + seção de campos personalizados (chave/label, adicionar/remover).
  - `NovoContratoModal`: select "Modelo de Contrato" (busca `GET /templates-contrato`); se o modelo tem `campos_extras`, renderiza inputs dinâmicos; `POST /contratos` passa a enviar `template_id`/`dados_extras`.

  ### Plano de execução (tasks, ordem de dependência)
  1. Migração Alembic — tabela `template_contrato` + colunas em `contrato`.
  2. Model `TemplateContrato` (SQLAlchemy) + colunas/relationship em `Contrato`.
  3. Schemas Pydantic (`TemplateContratoCreate/Update/Response/ListResponse`) + `ContratoCreateRequest.template_id/dados_extras`.
  4. Motor Jinja2 (`_render_template_contrato`) + bifurcação no endpoint `/pdf`.
  5. CRUD `/templates-contrato` + `criar_contrato` aceitando `template_id`/`dados_extras` — com teste de isolamento multi-tenant (`test_templates_contrato.py`, cobrindo CRUD e que loja A não acessa template da loja B).
  6. Migração de seed — 3 templates padrão por loja existente (Compra e Venda, Consignação, Garantia).
  7. Frontend — aba "Modelos" + `EditorTemplateModal` + catálogo de variáveis.
  8. Frontend — `NovoContratoModal` com seletor de template + campos extras dinâmicos.
  9. Teste end-to-end (`test_render_template_contrato.py`): contrato sem `template_id` continua gerando o HTML legado idêntico; contrato com `template_id` usa Jinja2 e não contém marcadores do gerador antigo.

  ### Validação
  `tsc -b` limpo em `apps/gestor`; suíte `apps/api/tests/` completa verde (sem regressão em `test_tenant_isolation.py`/`test_venda_composta.py`); criar modelo → inserir variável → salvar → criar contrato usando o modelo → baixar PDF com dados corretos.

- [x] **M045 — Credenciais Bancárias (Simulador): paridade com SimuladorFacil** · P3 (dívida técnica / paridade) · _(2026-07-05, verificado já implementado)_ · Investigação em `apps/api/routers/configuracoes.py` confirmou que bancos corretos (bv/c6/itau/santander), catálogo único (`GET /configuracoes/bancos` + `simulador/bancos_catalogo.py`), mascaramento de senha e teste de conexão real (Selenium via `credential_validator.py`) já estão implementados ponta a ponta. Único gap restante da spec original (limite de 2 bancos no plano free) não se aplica — hub não tem sistema de planos/assinaturas.

  ### Contexto
  A tela Configurações > Credenciais Bancárias (Simulador) do hub (`apps/gestor/src/pages/Configuracoes.tsx`) replica uma funcionalidade que já existe e evoluiu no projeto original `SimuladorFacil`. A versão portada para o hub ficou incompleta: faltam bancos, falta validação de credencial, e a lista de bancos está hardcoded em vez de vir de uma fonte única.

  ### Estado atual — SimuladorFacil (fonte da verdade)
  - `SimuladorFacil/backend/app/models/bank.py` — tabela `banks` (nome, código, logo, tier free/paid, ativo): bancos são **dados**, não enum fixo. `GET /bancos` lista os 4 bancos com `tier`.
  - `SimuladorFacil/backend/app/models/bank_credential.py` — `BankCredential`: `user_id` (FK `users.id` — escopo **por usuário**, não por loja/empresa), `bank_code`, `username_encrypted`, `password_encrypted`, `is_valid`. Suporta 4 bancos: **bv, c6, itau, santander**.
  - `app/schemas/bank_credential.py` + `app/api/config.py` — `POST /credenciais` upsert por `(user_id, bank_code)`, criptografa antes de salvar, **mascara senha como `••••••••` no update** (não sobrescreve se vier mascarado), **limita plano free a 2 bancos**.
  - Criptografia: `app/utils/security.py`, `CryptoManager` — Fernet com chave via PBKDF2-HMAC-SHA256 (100k iterações) a partir de `SECRET_KEY`.
  - `app/bancos/{bv,c6,itau,santander}.py` — motor de automação Selenium por banco, mesmo schema usuário+senha.
  - `app/automation/credential_validator.py` — valida a credencial de fato (login real no site do banco), síncrono (Celery) e assíncrono. **Não é chamado por nenhum endpoint hoje** — infraestrutura pronta mas desconectada. Dynamic import só cobre bv/c6/santander — itaú tem motor próprio mas não está plugado.
  - PAN e Creditas (`v2_motors/banks/motor_pan.py`, `motor_creditas.py`) são família **separada**: autenticam via env vars (`PAN_API_KEY`/`SECRET`, `CREDITAS_API_KEY`), sem tela de cadastro de credencial de usuário, não aparecem em `BankCredential` — é integração de API/token a nível de aplicação, não "banco com login".

  ### Estado atual — Hub (`apps/api`, `apps/gestor`)
  - `apps/api/models.py` — enum `BancoSimulador` fixo: **bv, pan, creditas** — mistura um banco real (bv) com dois nomes que no Simulador são integrações de API sem login (pan, creditas), e omite os 3 bancos de login real (c6, itau, santander).
  - `apps/api/routers/configuracoes.py` (`GET`/`POST /v1/configuracoes/credenciais_banco`) — escopo por **loja ou vendedor** (`usuario_id` nullable), diferente do Simulador (só usuário) — divergência de modelo, precisa ser decisão consciente. Salva usuário+senha cifrados (Fernet), sem validação prévia contra o banco real.
  - `apps/gestor/src/pages/Configuracoes.tsx:395` — lista de bancos hardcoded de novo no front: `['bv', 'pan', 'creditas']`, duplicando e dessincronizando a fonte do enum do backend.

  ### Gaps identificados
  1. **Bancos errados/incompletos** — hub tem BV/PAN/Creditas; deveria ter os bancos reais de login (BV/C6/Itaú/Santander), com PAN/Creditas fora do modelo de credencial (são integração de API via `.env`).
  2. **Sem teste de conexão/validação real** — hub salva usuário+senha sem nunca confirmar que funcionam no banco. Simulador tem `credential_validator.py` pronto mas desconectado — portar é chance de corrigir na fonte.
  3. **Lista de bancos hardcoded em 2 lugares** (front + back) em vez de 1 fonte única (endpoint `GET /bancos` como no Simulador).
  4. **Sem mascaramento de senha em update** — risco de sobrescrever credencial válida por engano com o valor mascarado `••••••••`.
  5. **Sem limite por plano** — Simulador limita 2 bancos no free; avaliar se aplica ao hub.
  6. **Escopo de credencial diferente** (loja/vendedor no hub vs usuário no Simulador) — pode ser intencional (multi-tenant B2B), mas precisa ser decisão explícita.
  7. **"Status: Não configurado" não reflete validação real** — hoje só indica que existe uma linha cifrada salva.

  ### Proposta de ajuste
  - Alinhar lista definitiva de bancos suportados: PAN/Creditas saem do modelo de credencial-com-login (viram integração de API/env); C6/Itaú/Santander entram como bancos de login real.
  - Portar `credential_validator.py` para o hub **e** conectá-lo ao endpoint de salvar, expondo botão "Testar conexão" antes de "Salvar credencial cifrada".
  - Extrair lista de bancos para fonte única (`GET /v1/configuracoes/bancos` ou constante compartilhada) consumida por front e back.
  - Implementar mascaramento de senha (`••••••••`) no update.
  - Atualizar "Status: Não configurado" para refletir resultado real do teste de conexão.
  - Documentar/alinhar a decisão de escopo (loja/vendedor vs usuário).

  ### Por que importa
  Sintoma de um problema recorrente: features portadas do SimuladorFacil para o hub sem checagem de paridade campo-a-campo.

---

## Padrões a vigiar
- **Tokens, nunca hardcode** — gestor usa `--sv-*` (dark/light); vitrine usa `--vt-*` (light). Não misturar nem cravar `#hex`/`rgba()`. _(ver M002, M006, M009, M013)_
- **Sem ação fake** — nada de botão/menu que só dispara toast "em breve"; entregar comportamento real ou estado vazio honesto. _(ver M001, M007)_
- **Validação + sanitização de formulário** — máscaras, limites e feedback visual (borda vermelha) em todo modal de cadastro. _(ver M004, M011)_
