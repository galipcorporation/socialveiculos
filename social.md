MASTER PROMPT — SOCIAL VEÍCULOS

Você é uma equipe completa composta por:

CTO especialista em SaaS
Software Architect
Enterprise Solution Architect
Product Manager Sênior
UX Engineer
Security Architect
DevOps Architect
Data Architect
Especialista em Marketplace
Especialista em Redes Sociais
Especialista em CRM
Especialista em Sistemas Automotivos
Especialista em Escalabilidade Cloud

Sua missão é projetar o produto descrito abaixo como se fosse uma startup financiada e prestes a entrar em produção.

CONTEXTO

Estou criando um produto chamado:

SOCIAL VEÍCULOS

Sou UX Designer.

NÃO sou programador.

Portanto:

Não assuma conhecimento técnico.
Explique decisões importantes.
Questione premissas quando necessário.
Identifique falhas e lacunas.
Não escreva código inicialmente.
Priorize arquitetura, produto e estratégia.

O objetivo é criar um sistema robusto, escalável, seguro e preparado para crescimento nacional.

DOCUMENTO DE PRODUTO


## 1. A ideia em uma frase

Uma plataforma que une **duas frentes**:
1. **Gestor (B2B)** — um sistema de gestão e rede social profissional para **lojas e revendas de veículos** administrarem estoque, clientes, vendas e negociarem entre si.
2. **Vitrine (B2C)** — uma **rede social pública de compra e venda de carros** (estilo Instagram/Facebook, nichada em veículos) onde o **consumidor final** descobre carros e fala direto com as lojas.

As duas frentes compartilham os mesmos dados (os carros que a loja cadastra no Gestor podem aparecer na Vitrine), mas são **experiências separadas**, para públicos diferentes.

---

## 2. Os dois mundos (separação fundamental)

| | **Gestor (B2B)** | **Vitrine (B2C)** |
|---|---|---|
| Público | Lojista, gestor, vendedor | Consumidor final (pessoa física) |
| Acesso | Login obrigatório | Navegação livre; login só para interagir |
| Identidade visual | Painel de trabalho (denso, produtivo) | Rede social (leve, visual, "rolável") |
| O que faz | Gerencia o negócio | Descobre e conversa sobre carros |

Regra de ouro: **nunca vazar dado de loja para o consumidor.** Preço de custo, valor de repasse, margem, dados internos de funil — jamais aparecem na Vitrine. O cliente vê só o preço de venda público e a ficha do carro.

---

## 3. Papéis de usuário

- **Gestor da loja** — dono/administrador. Acesso total ao Gestor da sua loja: estoque, equipe, financeiro, configurações.
- **Vendedor** — membro da equipe da loja. Acesso operacional (estoque, leads, negociações), com permissões mais restritas que o gestor (algumas ações exigem aprovação do gestor).
- **Cliente (pessoa física)** — consumidor na Vitrine. Conta **leve**: serve só para favoritar carros, conversar com lojas e ver histórico. **Nunca anuncia, nunca posta, não tem perfil público.**
- **Administrador da plataforma** — opera o SaaS como um todo (lojas cadastradas, métricas globais, auditoria). Papel acima das lojas.

Multi-loja (multitenant): cada loja é um ambiente isolado. Um vendedor pertence a uma loja e só enxerga os dados dela.

---

## 4. Gestor (B2B) — regras de negócio

### 4.1 Estoque de veículos
- CRUD completo de veículos (criar, editar, excluir, listar).
- Cada veículo tem status: **disponível, reservado, vendido, repasse, inativo**. Troca de status rápida.
- Filtros por status, preço, km, ano; busca por placa, marca, modelo.
- Upload de fotos e vídeos do veículo (mídia é unificada — foto e vídeo tratados como "mídia", nunca em campos separados).
- **Busca por placa**: ao digitar a placa, o sistema consulta uma fonte externa e preenche marca/modelo/ano automaticamente (integração plugável; enquanto não houver provedor configurado, o campo fica manual, sem inventar dados).
- **Catálogo canônico**: marca e modelo seguem um catálogo abrangente padrão do mercado brasileiro (estilo tabela FIPE), para padronizar nomes.
- **Publicar na Vitrine**: cada veículo tem um interruptor "publicar no marketplace/feed público". Só veículos publicados aparecem na Vitrine B2C.

### 4.2 Clientes e leads
- Cadastro, edição e exclusão de clientes (nome, CPF, telefone, etc.).
- Filtros por nome, CPF, telefone.
- Clientes e leads se vinculam a veículos e negociações.

### 4.3 Funil comercial (CRM / Kanban)
- Quadro Kanban com colunas: **Lead → Proposta → Negociação → Fechamento → Perdido**.
- Arrastar cards entre colunas.
- Criar propostas vinculando cliente + veículo. Modal de detalhes da negociação.
- Toda conversa iniciada por um cliente na Vitrine **vira um lead** aqui automaticamente.

### 4.4 Rede social B2B (entre lojistas)
- **Feed de repasses**: lojas publicam veículos para repasse/negociação entre si. Curtir, comentar, criar post.
- Proposta direta de repasse entre lojas.
- **Chat B2B em tempo real** entre lojistas.
- **Diretório de parceiros**: encontrar e conectar com outras lojas, com filtros.
- Importante: este feed B2B é **separado** do feed público B2C. Mesmo conceito visual, públicos e regras diferentes. O feed B2B pode expor dados de repasse (entre profissionais); o B2C nunca.

### 4.5 Painéis e métricas
- **Dashboard** da loja: KPIs reais (estoque ativo, leads ativos, receita/vendas do mês, simulações), alertas e ações rápidas.
- **Métricas**: gráficos de desempenho (vendas, estoque, ranking de veículos, resumo financeiro).
- **Financeiro**: receitas, despesas, saldo, comissões, custo de estoque.
- **Equipe**: gestão de membros e permissões.
- **Perfil/Configurações**: dados da loja e do usuário.

### 4.6 Módulos premium (paywall por assinatura)
A plataforma é um SaaS modular. O plano básico é o Gestor; recursos avançados são desbloqueados por assinatura:
- **Contratos** — geração inteligente de contratos e termos de garantia, com leitura/OCR de documentos.
- **Simulador** — simulação de financiamento em múltiplos bancos, com impressão de proposta.
- **Marketing** — geração de posts e criativos para redes sociais a partir do estoque, com um clique.
- **Login único (SSO)**: o usuário entra uma vez no Gestor; ao abrir um módulo premium, é autenticado e redirecionado sem refazer login.

Regra comercial: vender por módulo **não** significa operar tudo separado. A experiência é unificada; landings e subdomínios podem existir sem fragmentar o produto.

---

## 5. Vitrine (B2C) — regras de negócio

### 5.1 O feed (coração do produto)
- A unidade central rolável é o **carro (anúncio)**, não "posts". É um marketplace visual, infinito, estilo rede social.
- **Quem anuncia**: somente lojas (os "vendedores oficiais"). Pessoa física nunca anuncia. Um carro publicado no estoque do Gestor aparece aqui.
- **Visitante deslogado**: vê o feed **livremente e por completo** — feed infinito puro, **sem filtros, sem busca, sem chips**. Experiência de descoberta sem barreira.
- **Depois de logar**: aparecem busca e filtros (chips de categoria/marca, faixa de preço, etc.).

### 5.2 Gate de login (só para interagir)
- Navegar é livre. **Login é obrigatório apenas para INTERAGIR**: favoritar, conversar com a loja, ver telefone/contato.
- O login aparece como **modal** (não página dedicada), disparado quando o visitante tenta interagir (ou após rolar bastante o feed).
- Conta de cliente é **leve**: cadastro simples (nome, e-mail/telefone, ou login social).

### 5.3 O card do carro (rico)
Cada anúncio no feed mostra:
- Cabeçalho social: avatar + nome da loja + localização + "há X tempo".
- Mídia do carro (fotos/vídeo) com navegação (setas, indicadores).
- Selos quando aplicável: "Destaque", "Aceita troca".
- Título (marca/modelo/ano) e **preço de venda** em destaque.
- Ficha rápida: câmbio, combustível, cor, tipo.
- Ações: **favoritar** (com contador real de quantas pessoas favoritaram), **conversar/negociar**, compartilhar, e atalho de **WhatsApp** da loja.

### 5.4 Stories / atalhos de descoberta
No topo do feed, atalhos rápidos que **filtram** o feed: "Ofertas" (mais baratos), "Novidades" (mais recentes), "Destaques" (em destaque).

### 5.5 Página do carro e página da loja
- **Página do carro**: galeria, ficha técnica completa, descrição, opcionais, veículos similares, e o canal para conversar/enviar proposta. Deve ser amigável a buscadores (bom para SEO — título e descrição ricos por carro).
- **Página da loja (vitrine da loja)**: lista de carros à venda daquela loja, com sua identidade (nome, logo, localização, selo de verificada).

### 5.6 Conversa e ponte com WhatsApp
- A conversa **nasce no chat interno** da plataforma — e isso **gera um lead no CRM** da loja automaticamente.
- A loja pode continuar o atendimento pelo **WhatsApp** (ponte/atalho), partindo do contexto do carro.

### 5.7 Multi-domínio
- A Vitrine pode rodar em **domínio próprio**, separado do Gestor. Quem acessa o domínio da vitrine vê a experiência do consumidor; quem acessa o domínio do Gestor vê o painel da loja. Os dois nunca se misturam visualmente.

---

## 6. Princípios de experiência e marca

- **Elegância visual é requisito, não enfeite.** A referência de qualidade é uma rede social moderna e polida (cards com profundidade, hover suave, microinterações, tipografia hierarquizada). Botões devem parecer clicáveis (cursor, hover), nada de tela "morta".
- **Mídia unificada**: foto e vídeo são "mídia" — sempre um único campo/botão, nunca separados.
- **Placeholders dignos**: carro sem foto mostra um placeholder estilizado (ícone + gradiente), nunca um texto cru "sem foto".
- **Sem dados falsos**: telas exibem dados reais ou estado vazio limpo. Nada de números inventados de exemplo em produção.
- **Tema claro/escuro** suportado.
- **Mobile-first** na Vitrine: navegação inferior (Explorar / Favoritos / Mensagens / Perfil).

---

## 7. Glossário rápido

- **Loja / revenda / garagem** — o cliente pagante do SaaS (B2B).
- **Vendedor oficial** — loja habilitada a anunciar na Vitrine.
- **Cliente / PF** — consumidor final na Vitrine (B2C).
- **Repasse** — venda de veículo entre lojas (mercado profissional, no feed B2B).
- **Lead** — potencial comprador no funil do CRM. Toda conversa B2C iniciada vira lead.
- **Publicar no marketplace** — interruptor que leva um veículo do estoque para a Vitrine pública.



RESTRIÇÕES IMPORTANTES

O projeto deve seguir os seguintes princípios:

Simplicidade

Escolha sempre:

menor complexidade
menor custo operacional
menor curva de manutenção

sem comprometer escalabilidade.

Escalabilidade

A arquitetura deve suportar:

Fase 1

100 lojas
500 usuários simultâneos

Fase 2

1.000 lojas
10.000 usuários simultâneos

Fase 3

10.000 lojas
100.000 usuários simultâneos

sem necessidade de reconstrução completa.

Segurança

Projetar desde o início:

Multi-tenancy seguro
Isolamento de dados
LGPD
Auditoria
Rate Limiting
Logs
Proteção OWASP
Criptografia
Gestão de sessões
Recuperação de conta
MFA futuro
Mobile First Future

Mesmo começando pelo web:

backend deve servir web e app
evitar dependência do frontend
APIs reutilizáveis
preparado para Android e iOS
SEO First

A Vitrine B2C deve ser extremamente amigável para mecanismos de busca.

ENTREGÁVEIS OBRIGATÓRIOS

Produza os documentos abaixo.

1. PRODUCT REQUIREMENTS DOCUMENT (PRD)

Gerar um PRD completo contendo:

visão do produto
objetivos
métricas
personas
jornadas
funcionalidades
regras de negócio
dependências
critérios de aceite
2. GAP ANALYSIS

Analise todo o documento.

Liste:

ambiguidades
conflitos
informações faltantes
decisões pendentes

Crie uma tabela:

| Tema | Problema | Impacto | Recomendação |

Não assuma respostas.

3. DOMAIN MODEL

Mapeie todos os domínios do negócio.

Exemplo:

Estoque
CRM
Marketplace
Chat
Financeiro
Assinaturas
Usuários
Permissões

Mostre relacionamentos.

4. EVENT STORMING

Mapeie:

Eventos:

Veículo cadastrado
Veículo publicado
Lead criado
Chat iniciado
Favorito criado

Comandos

Agregados

Regras

Dependências

5. ARQUITETURA DE SOFTWARE

Proponha arquitetura moderna.

Justifique:

Frontend
Backend
Banco
Cache
Busca
Storage
Mensageria

Explique vantagens e desvantagens.

6. MULTITENANCY

Defina:

estratégia recomendada
isolamento
segurança
escalabilidade

Explique por que foi escolhida.

7. MODELAGEM DE DADOS

Liste entidades completas.

Incluindo:

Usuário

Loja

Veículo

Lead

Cliente

Negociação

Mensagem

Chat

Favorito

Publicação

Comentário

Assinatura

Plano

Pagamento

Financeiro

Comissão

Permissão

Log

Auditoria

etc.

Mostrar relacionamentos.

8. MATRIZ DE PERMISSÕES

Criar tabela completa para:

Administrador Plataforma

Gestor

Vendedor

Cliente

Definindo:

Criar

Editar

Excluir

Visualizar

Aprovar

Publicar

Administrar

9. ROADMAP

Separar em:

MVP

Release 2

Release 3

Release 4

Release 5

Indicando:

valor entregue
dependências
riscos
10. SEGURANÇA

Gerar documento completo contendo:

autenticação
autorização
auditoria
LGPD
retenção de dados
backup
recuperação
antifraude
proteção contra abuso
11. DEVOPS

Definir:

ambientes
CI/CD
observabilidade
monitoramento
logs
alertas
12. API STRATEGY

Definir:

APIs públicas
APIs privadas
versionamento
documentação
13. MOBILE STRATEGY

Explicar:

Como desenvolver web agora sem gerar retrabalho para aplicativo depois.

14. RISK REGISTER

Criar tabela contendo:

| Risco | Probabilidade | Impacto | Mitigação |

15. ARQUITETURE DECISION RECORDS (ADR)

Registrar decisões arquiteturais.

Para cada decisão:

contexto
alternativas
decisão
consequências
16. PLANO DE EXECUÇÃO

Ao final gerar:

Fase 1

Fase 2

Fase 3

Fase 4

Com:

duração estimada
equipe necessária
prioridade
PROIBIDO

Não gerar código.

Não escolher tecnologias apenas por popularidade.

Não criar microserviços sem justificativa.

Não criar arquitetura complexa desnecessária.

Não inventar requisitos ausentes.

Não ignorar gaps do produto.

RESULTADO ESPERADO

Produzir documentação equivalente ao trabalho de:

CTO
Product Manager
Software Architect
Tech Lead