AURA — ASSISTENTE INTERNA DO LOJISTA

Documento de produto e arquitetura
Social Veículos · Módulo AURA

Este documento é o par de `social.md`. Enquanto `social.md` descreve o produto inteiro, este descreve **uma feature só**: a AURA. Ele é escrito para ser lido por quem não programa e executado por quem programa. Não contém código.

---

## 1. A AURA em uma frase

**A AURA é a inteligência interna da loja: um interlocutor que o gestor e o vendedor chamam pelo nome, dentro do chat que já usam, para perguntar qualquer coisa sobre o próprio negócio — o estoque, os parceiros de repasse, os clientes no funil, os números do mês e as ferramentas do sistema — e receber uma resposta única, com a conta já feita e o caminho para agir.**

O teste da ideia é este diálogo:

> **Gestor:** fala AURA, meu cliente está querendo uma Hilux com até 45 mil km na cor preta
>
> **AURA:** Fala, Victor. No seu estoque tem uma Hilux SRV 2021, **branca, 62 mil km**, R$ 248.000 — é a mais próxima que você tem, mas foge na cor e na quilometragem. Se fechar nela, sua comissão fica em **R$ 7.440** (3%).
>
> Fui olhar no repasse: a **Garagem Norte**, aqui em Uberlândia, tem uma **Hilux SRX 2021 preta com 40 mil km**. O repasse dela está em **R$ 231.000**.
>
> [ Ver a Hilux branca ] [ Ver o repasse da Garagem Norte ] [ Abrir proposta de repasse ]

Isso é a AURA. Uma pergunta em português, duas buscas em bases diferentes, uma resposta só, e o botão para o próximo passo.

### 1.1 O que a AURA não é

Esta seção existe porque o sistema já tem um recurso chamado "Assistente de IA", e confundir os dois quebra o produto.

| | **Assistente de IA (já existe)** | **AURA (este documento)** |
|---|---|---|
| Com quem fala | Com o **cliente final**, pelo WhatsApp | Com o **gestor e o vendedor**, dentro do sistema |
| Papel | Responde no lugar do vendedor | Responde **para** o vendedor |
| Tom | O tom do vendedor, imitado | O tom da AURA, adaptado a quem pergunta |
| Onde vive | Aba Assistente, ligada ao WhatsApp | Conversa fixa no chat do painel |
| Pode errar? | Erro vira mensagem enviada a um cliente | Erro vira informação ruim, revisável antes de agir |
| Arquivo | `apps/api/assistente/motor.py` | Módulo novo |

Além disso, a AURA **não**:

- não fala com o consumidor final, em nenhuma hipótese;
- não anuncia, não publica, não posta;
- não escreve nada no banco de dados por conta própria (ver seção 8);
- não substitui o vendedor numa negociação — ela municia o vendedor.

**Regra de ouro desta feature:** a AURA responde **exatamente dentro** do que a pessoa que perguntou já poderia ver clicando pelo sistema. Nem um dado a mais. Se um vendedor não enxerga o financeiro da loja no menu, ele também não enxerga pela AURA.

---

## 2. Por que dentro do chat, e não num balãozinho flutuante

A saída óbvia seria um botão flutuante no canto da tela. Foi descartada, por quatro razões.

**Primeiro, o lugar já existe.** O painel já tem uma área de mensagens, com conversas de parceiros B2B e de clientes B2C, contador de não-lidas na barra lateral e conexão em tempo real. A AURA entra ali como **mais uma conversa — fixada no topo, sempre a primeira**. Ninguém precisa aprender uma interface nova; a pessoa clica em Mensagens e a AURA é o primeiro nome da lista, como um colega que está sempre online.

**Segundo, o histórico vem de graça.** Conversa com a AURA é conversa: rola para cima, procura o que ela respondeu semana passada, retoma de onde parou. Um balãozinho flutuante costuma nascer sem memória e morrer a cada recarga de página.

**Terceiro, não briga com o que já existe.** O painel já tem uma paleta de comandos no Ctrl+K, que serve para *navegar rápido*. A AURA serve para *pensar junto*. São gestos diferentes, e colocá-los em lugares diferentes deixa isso claro.

**Quarto, o mobile ganha de brinde.** O aplicativo já tem uma aba de chat. A AURA aparece nela sem inventar nenhum elemento de interface novo — e o app já tem, inclusive, um botão flutuante arrastável para quem quiser um atalho por cima.

### 2.1 A conversa fixada

- Aparece no **topo da lista de conversas**, sempre, em toda loja, para todo usuário B2B — é o "chumbado em todos os clientes".
- Tem avatar e identidade próprios, distintos de uma loja parceira ou de um cliente.
- **É por usuário, não por loja.** O gestor e cada vendedor têm a sua própria conversa com a AURA. Ninguém lê a conversa do outro — nem o gestor lê a do vendedor.
- Não tem contador de não-lidas (a AURA não puxa assunto sozinha na v1 — ver seção 17, Release 3).
- Não pode ser arquivada nem excluída; pode ser silenciada.

### 2.2 A tensão entre "chumbado em todos" e "módulo pago"

O pedido original é que a AURA esteja em todos os clientes. A decisão comercial é que ela seja parte do módulo premium `assistente_ia`, que já existe e já tem o bloqueio de cobrança implementado.

Os dois convivem assim:

| Situação da loja | O que acontece |
|---|---|
| Módulo `assistente_ia` contratado e assinatura em dia | Conversa fixada, funcionando |
| Módulo não contratado | Conversa fixada, **visível**, com uma mensagem de apresentação da AURA e um botão de contratar. Perguntar responde o convite, não a resposta |
| Módulo contratado, assinatura suspensa ou vencida | Mesmo tratamento acima, com aviso de pendência |
| Vendedor sem permissão individual liberada pelo gestor | Conversa não aparece |

Ou seja: **a AURA é visível para todos e responde para quem contratou.** A presença permanente é o que vende o módulo.

---

## 3. Personas e jornadas

### 3.1 Gestor da loja

Dono ou administrador. Enxerga tudo da própria loja: estoque, equipe, funil, financeiro, comissões, repasse.

O que ele pergunta, no dia a dia:

- "quanto eu tenho parado no pátio há mais de 90 dias?"
- "qual vendedor mais fechou esse mês?"
- "meu cliente quer uma Hilux preta com até 45 mil km"
- "quanto sobra pra mim se eu vender a Ranger por 210?"
- "tem alguém no funil parado há mais de uma semana?"

### 3.2 Vendedor

Membro da equipe. Enxerga estoque, clientes e o próprio funil. Financeiro e comissões dos colegas ficam fora — a não ser que o gestor libere.

O que ele pergunta:

- "quais carros eu tenho até 80 mil que aceitam troca?"
- "quanto eu ganho se fechar essa Compass?"
- "esse cliente já falou com a gente antes?"
- "como eu emito o contrato de venda?"
- "o financiamento dele reprovou em qual banco?"

Quando o vendedor pergunta algo fora do seu alcance — "quanto a loja faturou esse mês?" — a AURA **não inventa e não nega com grosseria**. Ela diz que esse dado é do gestor e oferece o que ela pode: o resultado dele.

### 3.3 Administrador da plataforma

Fora do escopo da v1. Quando o admin entra numa loja pelo seletor de loja, a AURA responde **como se fosse aquela loja** — nunca com visão global do SaaS. Uma AURA para o admin, com visão de plataforma, é assunto de outro documento.

### 3.4 Cliente final

**Nunca.** A AURA não existe na Vitrine B2C, não tem endereço público e não responde a quem não tem vínculo B2B ativo. Esta é uma regra de segurança, não uma decisão de escopo.

---

## 4. Os quatro domínios de resposta

Toda pergunta feita à AURA cai em um destes quatro grupos. Fora deles, ela declina.

### 4.1 Estoque próprio

Tudo que a loja tem cadastrado: marca, modelo, versão, ano, quilometragem, cor, câmbio, combustível, carroceria, portas, opcionais, fotos, placa, status, preço de venda, preço de custo, valor de repasse, código FIPE, há quanto tempo está no pátio.

Perguntas típicas: busca por características, carro parado, faixa de preço, o que sai e o que encalha.

### 4.2 Repasse de parceiros

O que as outras lojas publicaram no feed de repasse. Este é o domínio mais delicado, porque envolve dado de terceiro.

**O que a AURA revela sobre um veículo de parceiro:**

- ficha completa do veículo — marca, modelo, versão, ano, quilometragem, cor, câmbio, combustível, opcionais, fotos;
- **o valor de repasse** pedido pelo parceiro (é dado B2B legítimo: o parceiro publicou justamente para ser visto por outros lojistas);
- nome, cidade e distância aproximada da loja parceira;
- há quanto tempo o repasse está publicado.

**O que a AURA nunca revela:**

- o preço de custo do parceiro;
- qualquer margem, lucro ou desconto calculado sobre o negócio do parceiro;
- dados de clientes, funil ou financeiro do parceiro;
- veículo de outra loja que **não** esteja publicado no feed de repasse.

Note a diferença em relação ao diálogo que originou este documento. A ideia inicial era a AURA dizer que o parceiro "está com uma margem boa de trabalhar". Isso foi **descartado**: a AURA não estima a margem alheia, porque ela não conhece o custo do parceiro e qualquer número seria chute. Ela entrega a ficha e o valor de repasse, e a conta de quanto dá para trabalhar é do lojista — que é quem sabe por quanto revende na praça dele.

### 4.3 CRM e negociação

Clientes, leads, etapa no funil, propostas, simulações de crédito e seus resultados por banco, histórico de conversas, motivo de perda, pós-venda.

Perguntas típicas: quem está parado, quem está quente, o que já foi oferecido a este cliente, qual banco aprovou e com que parcela.

### 4.4 Ferramentas do sistema

A AURA sabe explicar o próprio produto: como cadastrar um veículo pela placa, como publicar na vitrine, como gerar um contrato, como rodar uma simulação em vários bancos, como criar um post de marketing a partir do estoque, o que muda entre os status do veículo, como funciona a aprovação do gestor para uma exclusão.

Este domínio é o de menor risco e o de maior valor percebido no primeiro dia de uso — é o que faz a AURA parecer útil antes mesmo de a loja ter estoque volumoso.

### 4.5 Fora de escopo

Perguntas sobre outras lojas, sobre a plataforma, sobre assuntos gerais do mundo, ou pedidos para escrever textos que não sejam ligados ao negócio da loja. A AURA responde que não é a ferramenta certa e sugere onde ir.

---

## 5. Diálogos de referência

Estes diálogos são a especificação do comportamento. Um desenvolvedor deve conseguir olhar para eles e saber se implementou certo. A coluna "por trás" descreve o que a AURA consultou, e não aparece para o usuário.

### 5.1 Busca cruzada — o caso que originou o produto

> **Gestor:** fala AURA meu cliente está querendo uma Hilux com até 45mil km na cor preta

*Por trás:* interpreta modelo = Hilux, quilometragem máxima = 45.000, cor = preta. Busca no estoque da loja — nenhum resultado exato, então relaxa a cor e a quilometragem e traz a mais próxima. Busca no feed de repasse com os filtros originais. Ordena parceiros por proximidade. Busca o percentual de comissão do usuário.

> **AURA:** Fala, Victor. Exata assim — preta e com até 45 mil — você não tem. O mais perto no seu pátio é uma **Hilux SRV 2021, branca, 62 mil km, R$ 248.000**. Fugiu na cor e rodou mais, mas é Hilux e está pronta pra sair. Fechando nela, sua comissão é de **R$ 7.440**.
>
> Agora, no repasse eu achei o que ele pediu: a **Garagem Norte** — 3 km daqui, aqui em Uberlândia mesmo — tem uma **Hilux SRX 2021 preta com 40 mil km**, repasse a **R$ 231.000**. Publicada há 6 dias.
>
> [ Ver a Hilux branca ] [ Ver o repasse ] [ Abrir proposta pra Garagem Norte ]

Repare no que a resposta faz: admite a ausência antes de oferecer o substituto, mostra a conta que interessa ao vendedor (a comissão dele), entrega o dado do parceiro sem opinar sobre a margem alheia, e termina em ação.

### 5.2 Comissão

> **Vendedor:** quanto eu ganho se eu fechar a Compass por 142?

*Por trás:* identifica o veículo pelo apelido, busca o percentual de comissão do vínculo do vendedor — com queda para o padrão da loja quando não há override.

> **AURA:** Na Compass Longitude 2022, fechando a R$ 142.000, sua comissão sai em **R$ 4.260** — são 3%, que é o seu percentual. Se precisar dar desconto até R$ 138.000, cai pra R$ 4.140.

### 5.3 Funil parado

> **Gestor:** tem alguém encostado no funil?

*Por trás:* leads não movimentados há mais de 7 dias, fora das etapas Fechamento e Perdido.

> **AURA:** Tem quatro. O mais preocupante é o **Rodrigo Alves** — está em Negociação desde o dia 12, sem nenhum movimento há 19 dias, numa proposta de R$ 89.000 pelo Onix. Depois vêm Marina (Proposta, 11 dias), Cleber (Lead, 9 dias) e Tatiane (Proposta, 8 dias).
>
> [ Abrir o funil ] [ Ver o Rodrigo ]

### 5.4 Crédito

> **Vendedor:** o financiamento do Rodrigo saiu?

*Por trás:* localiza o cliente, busca a simulação mais recente e os resultados por banco.

> **AURA:** Saiu, na simulação de 20 de julho — entrada de R$ 15.000 em 48 meses. **Aprovado no Santander**: parcela de R$ 2.180 em 48x, taxa de 1,79% ao mês. No Bradesco e no Itaú veio negado. Ele ainda não foi comunicado pelo sistema.

### 5.5 Ferramenta

> **Vendedor:** como eu emito o contrato dessa venda?

> **AURA:** Pelo módulo Contratos. O caminho é: abrir o veículo no Estoque, marcar como vendido e escolher o comprador — aí o botão de gerar contrato aparece. O modelo já vem com o cabeçalho e o rodapé da loja preenchidos, e as variáveis do veículo e do cliente entram sozinhas. Antes de emitir, confira o CPF do comprador; sem ele o contrato sai com o campo em branco.
>
> [ Ir para o Estoque ]

### 5.6 Pergunta fora do alcance do papel

> **Vendedor:** quanto a loja faturou esse mês?

> **AURA:** Esse número é do painel financeiro, que fica com o gestor — não tenho como te mostrar. O que eu consigo te dar é o **seu** resultado: você fechou 3 vendas em julho, somando R$ 11.870 em comissão.

### 5.7 Quando não há dado

> **Gestor:** tem alguma Ranger no repasse?

> **AURA:** Nenhuma Ranger publicada no repasse hoje, nem aqui na região nem no estado. No seu estoque também não tem. Se quiser, é só me chamar de novo daqui uns dias — ou dá pra publicar uma procura no feed B2B.

A AURA **nunca** preenche o vazio com um veículo parecido sem avisar que é parecido, e nunca inventa um parceiro.

---

## 6. Anatomia de uma busca

O que acontece entre a frase do usuário e a resposta na tela. São seis passos.

### Passo 1 — Entender a frase

A frase vira um conjunto de critérios estruturados: modelo, marca, ano, faixa de quilometragem, cor, câmbio, combustível, faixa de preço, carroceria, opcionais. "Até 45 mil km" vira um teto; "na cor preta" vira uma cor; "Hilux" vira um modelo do catálogo canônico.

Três cuidados obrigatórios:

- **Apelido de carro é regra do Brasil, não do dicionário.** "Corolla Cross", "Compass", "Hilux", "Strada" — o catálogo de marcas e modelos que o sistema já tem é a fonte de verdade para casar o que a pessoa falou com o que existe cadastrado.
- **Ambiguidade se pergunta, não se adivinha.** "Um carro bom pra família até 100 mil" não vira busca; vira uma pergunta de volta: sete lugares ou cinco? automático?
- **Quem pergunta define o teto.** Os critérios extraídos entram numa busca que **já nasce filtrada pela loja e pelo papel** do usuário. A frase nunca escolhe o escopo.

### Passo 2 — Buscar no estoque próprio

Busca direta na base de veículos da loja, com os filtros do passo 1. Esta busca é determinística: é uma consulta com filtros, igual à que a tela de Estoque já faz. Nada de IA aqui — o número que a AURA fala tem que ser o mesmo número que a tela mostra.

### Passo 3 — Relaxar, se preciso

Se não há resultado exato, a busca é refeita afrouxando critérios numa ordem definida — e a AURA **sempre diz o que afrouxou**:

1. cor (é o critério que mais muda de ideia numa negociação);
2. quilometragem (afrouxa em 30%);
3. ano (um para cada lado);
4. versão dentro do mesmo modelo;
5. modelo dentro da mesma categoria e faixa de preço.

Nunca se afrouxa preço para cima sem avisar, e nunca se troca o segmento do veículo.

### Passo 4 — Buscar no repasse dos parceiros

Mesma coisa, na base de publicações de repasse ativas, com os critérios **originais** — não os relaxados. É justamente esse contraste que produz a resposta boa: *"o seu não bate, mas o do parceiro bate."*

O sistema já tem essa busca implementada, com filtros de marca, modelo, ano, preço, combustível, cidade e estado, e já excluindo a própria loja do resultado.

### Passo 5 — Ordenar por proximidade

O resultado de parceiros é ordenado do mais perto para o mais longe. **E aqui está o maior obstáculo técnico deste documento:** hoje a loja tem endereço, cidade, estado e CEP, mas **não tem coordenada geográfica**. Não existe como calcular "3 km" com o que está no banco.

A saída, em duas etapas:

| Etapa | Como ordena | O que a AURA diz |
|---|---|---|
| **v1** | mesma cidade → mesmo estado → resto do país | "aqui em Uberlândia mesmo", "em Uberaba", "em SP" |
| **v2** | distância real, depois de geocodificar o CEP das lojas | "a 3 km", "a 40 minutos daqui" |

A v1 já entrega a maior parte do valor — na prática, o que o lojista quer saber é se dá para buscar o carro hoje. A v2 é um refinamento, e depende de uma decisão pendente registrada na seção 14.

### Passo 6 — Redigir a resposta

Só agora a IA entra. Ela recebe os resultados **já buscados e já filtrados** e escreve o texto — no tom da AURA, ajustado ao jeito daquele usuário (seção 7), com as contas que interessam (comissão do vendedor, tempo de pátio) e com os atalhos no fim.

**Regra de ouro da busca:** a IA **redige**, ela não **procura**. Todo número, todo nome de carro, todo valor que aparece na resposta veio de uma consulta ao banco, não da cabeça do modelo. Se o dado não veio da consulta, ele não pode aparecer no texto.

---

## 7. Memória e aprendizado

A AURA precisa melhorar com o uso. Isso se divide em três camadas, com donos e riscos diferentes.

### 7.1 Camada 1 — Perfil de estilo (por usuário)

Como aquela pessoa fala e como quer ser respondida: formal ou "fala, chefe"; resposta curta ou detalhada; se gosta ou não de emoji; se quer o número da comissão sempre ou só quando pergunta; se prefere o valor cheio ou arredondado.

Isso se forma sozinho, ao longo das conversas, e vira um resumo curto em texto — não uma gravação, não uma transcrição.

**Este perfil é separado do perfil de voz que já existe no assistente de WhatsApp.** São coisas diferentes: aquele é o tom com que o vendedor fala **com o cliente**; este é o tom com que ele quer que a AURA fale **com ele**. Misturar os dois faria a AURA tratar o próprio gestor como se fosse um lead.

O usuário pode ver esse resumo, editar e apagar — é uma exigência de LGPD e também de confiança.

### 7.2 Camada 2 — Memória de fatos da loja (por loja)

Coisas verdadeiras sobre aquele negócio, que não estão em nenhum campo do banco: "essa loja não trabalha com moto", "aqui a gente não aceita troca com financiamento em aberto", "o Seu Jorge é quem decide desconto acima de 5 mil", "nossa praça puxa muito picape".

Parte vem do gestor escrevendo direto; parte a AURA aprende de padrões repetidos, e **sempre confirma antes de guardar**: *"Reparei que você recusa troca com financiamento em aberto. Quer que eu guarde isso como regra da loja?"*

É compartilhada entre todos da loja e só o gestor edita.

### 7.3 Camada 3 — Memória de negociações (por loja)

O histórico do que já rolou: quais argumentos fecharam venda, quais objeções aparecem sempre, qual desconto costuma destravar, quais carros encalham e por quê.

Alimenta respostas do tipo: *"os últimos três clientes que reclamaram do preço dessa Compass fecharam com R$ 3.000 de desconto"*.

Esta camada é a que mais depende de volume — só fica boa depois de alguns meses de uso. Por isso ela é a última do roadmap.

### 7.4 Como as três funcionam por baixo

Cada pedaço de memória vira um registro com um **vetor** — uma representação numérica do significado do texto — armazenado numa tabela do próprio PostgreSQL, com a extensão `pgvector`. Quando o usuário pergunta algo, a pergunta também vira vetor, e o sistema traz os registros de significado mais próximo para incluir no contexto da resposta.

Por que assim, e não com um serviço de busca vetorial dedicado:

| | pgvector no banco atual | Serviço dedicado |
|---|---|---|
| Infra nova | nenhuma | mais um serviço, mais uma conta, mais um ponto de falha |
| Isolamento por loja | na mesma consulta, com o mesmo filtro de sempre | precisa ser reimplementado do zero, e um erro vaza dado entre lojas |
| Backup | junto com o banco | separado |
| Custo | quase nulo | recorrente |
| Teto | milhões de registros, o que é muito acima do horizonte | bilhões |

Na escala prevista — 10 mil lojas na fase 3 — o banco atual dá conta com folga. A decisão segue o princípio de menor complexidade estabelecido em `social.md`. Se um dia o volume justificar, a troca é localizada.

**Cuidado obrigatório:** o ambiente de desenvolvimento roda SQLite e a produção roda PostgreSQL. `pgvector` só existe no PostgreSQL. A memória vetorial precisa degradar com elegância no ambiente local — sem vetores, funcionando pela busca de texto comum — ou o time perde a capacidade de rodar o projeto na máquina.

### 7.5 O que a memória nunca guarda

Dado pessoal de cliente final (CPF, telefone, endereço, renda), senha, credencial, número de cartão, e conteúdo de conversa de outra loja. A memória guarda **padrão e preferência**, não **cadastro**.

---

## 8. O que a AURA nunca faz

Esta seção é a fronteira de segurança do módulo. Cada item aqui é um teste automatizado a ser escrito.

1. **Não escreve no banco.** A AURA lê e sugere. Todo botão que ela oferece leva o usuário para a tela onde ele mesmo executa a ação, com o formulário já preenchido. Não existe "a AURA criou um lead", "a AURA mandou uma proposta", "a AURA moveu um card".
2. **Não atravessa a fronteira da loja.** Toda consulta nasce com o identificador da loja do contexto. Não há pergunta, por mais bem formulada, que faça a AURA responder sobre o estoque, o funil ou o financeiro de outra loja — exceto o que está publicamente publicado no feed de repasse.
3. **Não atravessa a fronteira do papel.** Se a permissão do usuário não alcança um recurso, a AURA não alcança tampouco. A verificação é a mesma do resto do sistema, não uma cópia.
4. **Não expõe custo alheio.** Preço de custo e margem de terceiro estão fora, sempre. O valor de repasse está dentro, porque foi o parceiro que publicou.
5. **Não inventa.** Se o veículo não está no resultado da busca, ele não existe na resposta. Se a taxa não veio da simulação, ela não é citada. Se a AURA não sabe, ela diz que não sabe.
6. **Não fala com cliente final.** Nem por engano, nem por link compartilhado, nem por copiar e colar automático.
7. **Não guarda o que não precisa.** Ver 7.5.
8. **Não some com o rastro.** Toda pergunta e toda resposta ficam registradas, com quem perguntou, quando, o que foi consultado e quanto custou.

---

## 9. Domínio e eventos

### 9.1 Onde a AURA se encaixa no domínio existente

A AURA é um domínio **de leitura** que atravessa quase todos os outros. Ela não possui dado de negócio; ela consulta.

| Domínio existente | Relação da AURA |
|---|---|
| Estoque | lê veículos, mídias, catálogo, preços |
| Marketplace / Repasse | lê publicações B2B ativas de parceiros |
| CRM | lê clientes, leads, negociações, simulações |
| Financeiro | lê comissões e lançamentos — só para quem pode |
| Usuários e Permissões | herda papel, vínculo e módulos liberados |
| Chat | **vive dentro**: a conversa da AURA é uma conversa |
| Assinaturas | é bloqueada pelo módulo `assistente_ia` |
| Auditoria | escreve registro de cada interação |

O único dado que a AURA **possui** é a própria conversa e as três camadas de memória.

### 9.2 Eventos

| Evento | Quando acontece | O que dispara |
|---|---|---|
| `aura_pergunta_recebida` | usuário envia mensagem | interpretação e busca |
| `aura_busca_executada` | uma consulta ao estoque ou ao repasse termina | registro do que foi consultado, para auditoria |
| `aura_resposta_entregue` | resposta aparece na tela | contabilização de tokens e custo |
| `aura_atalho_seguido` | usuário clica num botão sugerido | métrica de utilidade — o indicador mais importante do produto |
| `aura_resposta_avaliada` | usuário marca a resposta como útil ou não | insumo de melhoria |
| `aura_memoria_confirmada` | gestor aceita guardar um fato da loja | grava na memória da loja |
| `aura_cota_esgotada` | loja atinge o teto do mês | bloqueia com aviso |

### 9.3 Comandos

Perguntar. Avaliar uma resposta. Confirmar ou recusar um fato de memória. Editar ou apagar o perfil de estilo. Limpar o histórico da conversa. Silenciar. Nada mais — coerente com a decisão de somente leitura.

---

## 10. Modelagem de dados

Cinco estruturas novas. Descritas em prosa; o desenho técnico fica com quem implementa.

### 10.1 Conversa da AURA

Uma por usuário por loja. Guarda o vínculo com a loja e com o usuário, quando foi criada, quando teve a última mensagem, e se está silenciada.

**Decisão a registrar:** o chat existente hoje distingue conversa de cliente e conversa de parceiro. A conversa da AURA não é nenhuma das duas — ela não tem dois lados humanos, não tem proposta vinculada, não tem status de negociação, e é privada por usuário e não por loja. **Recomendação: tabela própria**, e não um terceiro tipo na tabela de conversas existente. Enfiar a AURA lá dentro obrigaria a deixar quase todos os campos vazios e a colocar exceções em todas as telas que hoje listam conversas. O custo de uma tabela nova é menor que o custo dessas exceções. Ver ADR-3.

### 10.2 Mensagem da AURA

Cada turno da conversa. Guarda: de quem é (usuário ou AURA), o texto, os atalhos oferecidos, quais buscas foram feitas para produzir aquela resposta, quanto custou em tokens, quanto tempo levou, e a avaliação do usuário quando houver.

O registro das buscas é o que permite responder, meses depois, "por que a AURA disse isso?".

### 10.3 Perfil de estilo do usuário

Um por usuário por loja. Guarda o resumo em texto de como a pessoa fala e quer ser respondida, quando foi atualizado pela última vez, e se o usuário desligou o aprendizado.

### 10.4 Memória da loja

Vários registros por loja. Cada um com: o texto do fato, de onde veio (o gestor escreveu ou a AURA sugeriu e foi confirmado), quem confirmou, quando, o vetor correspondente, e se ainda está ativo.

### 10.5 Índice de busca semântica

Registros derivados do estoque e das negociações, cada um com seu vetor, o vínculo com a loja e a referência ao registro original. É reconstruível: se for perdido, gera de novo a partir do banco. Isso importa para o plano de backup — esta tabela não precisa entrar nele.

### 10.6 O que muda no que já existe

Muito pouco, e é intencional:

- a telemetria de consumo de IA que já existe ganha mais um valor no campo que identifica a funcionalidade — o painel de consumo do admin passa a mostrar a AURA sem nenhuma alteração de tela;
- a loja ganha coordenadas geográficas, na fase 2, para a ordenação por distância;
- o resto — permissões, módulos, auditoria, contexto de loja — é usado como está.

---

## 11. Arquitetura

### 11.1 Princípio

**Nada de novo no stack.** A AURA é construída inteiramente com peças que já estão no projeto e em produção. A única adição de infraestrutura é uma extensão do PostgreSQL que já roda.

### 11.2 As peças e de onde vêm

| Peça | O que já existe | O que muda |
|---|---|---|
| Chamada ao modelo de IA | rotina com cadeia de provedores Groq → OpenAI → Anthropic, com retentativa, em `apps/api/routers/marketing.py` | é promovida a utilitário compartilhado; a AURA não cria um segundo cliente de IA |
| Chave por loja (BYOK) | loja cadastra a própria chave, cifrada, com validação contra o provedor, em `apps/api/routers/credenciais_ia.py` | usada como está |
| Contagem de tokens e custo | tabela de consumo por chamada, com painel no admin | ganha o valor "aura" no campo de funcionalidade |
| Bloqueio comercial | gate do módulo `assistente_ia`, com resposta de pagamento requerido, em `apps/api/modulos.py` | usado como está |
| Permissões por papel | matriz de papel × recurso × ação em `apps/api/rbac.py` | usada como está, em cada consulta que a AURA faz |
| Contexto da loja | dependência que resolve usuário, vínculo e loja a cada requisição, em `apps/api/deps.py` | usada como está |
| Busca no repasse | listagem com filtros e exclusão da própria loja, em `apps/api/routers/b2b.py` | a lógica de filtro é extraída para ser chamada também pela AURA |
| Comissão | percentual padrão da loja com override por membro; cálculo real em `apps/api/routers/contratos.py` | reaproveitado, não recalculado por fora |
| Tempo real | conexão persistente de chat com reconexão e batimento, em `apps/gestor/src/lib/ws.ts` e equivalentes | reaproveitada para entregar a resposta |
| Estilo de chat | conjunto de estilos já pronto em `apps/gestor/src/styles/theme.css` | reaproveitado; a AURA ganha só a identidade visual própria |
| Trabalho em segundo plano | laços assíncronos iniciados junto com a aplicação, em `apps/api/main.py` | indexação de vetores entra como mais um |

### 11.3 O caminho de uma pergunta

1. O usuário digita na conversa da AURA.
2. A mensagem chega à API pelo mesmo canal do chat.
3. O sistema resolve quem é, de qual loja, com qual papel e com quais módulos — antes de qualquer outra coisa.
4. A pergunta é interpretada e vira critérios.
5. As buscas rodam, **todas** com o filtro de loja e de papel aplicado na origem.
6. A memória relevante é recuperada.
7. Tudo isso é montado num contexto e enviado ao modelo, que **só redige**.
8. A resposta volta pelo canal de tempo real, é gravada, e o consumo é contabilizado.
9. O registro de auditoria é escrito.

### 11.4 Uma limitação a assumir de olhos abertos

Hoje o projeto não tem entrega de resposta em pedaços — nenhuma chamada de IA no sistema é transmitida palavra a palavra. A resposta da AURA, portanto, **aparece de uma vez**, depois de alguns segundos de espera.

Isso é aceitável na v1 desde que a interface seja honesta: um indicador de "AURA está consultando o estoque..." que mude conforme o passo, para que a espera tenha explicação. A transmissão progressiva entra no roadmap como melhoria de percepção, não como correção de defeito.

### 11.5 Outra limitação

O trabalho em segundo plano do projeto roda dentro do próprio processo da API, sem fila durável. Se a aplicação reiniciar no meio de uma indexação, aquele lote se perde.

Para a AURA isso é tolerável, porque o índice é reconstruível a partir do banco: basta o laço de indexação sempre procurar o que ainda não foi indexado, em vez de assumir que terminou. É uma decisão de desenho, não uma dívida.

---

## 12. Matriz de permissões

O que cada papel pode perguntar à AURA.

| Assunto | Admin plataforma | Gestor | Vendedor | Cliente |
|---|:---:|:---:|:---:|:---:|
| Estoque da loja | sim, na loja selecionada | sim | sim | não |
| Preço de custo e margem própria | sim | sim | não¹ | não |
| Repasse de parceiros (ficha + valor) | sim | sim | sim | não |
| Custo ou margem de parceiro | não | não | não | não |
| Clientes e leads da loja | sim | sim | sim | não |
| Financeiro da loja | sim | sim | não¹ | não |
| Comissão própria | — | sim | sim | não |
| Comissão de terceiros | sim | sim | não | não |
| Equipe e permissões | sim | sim | não | não |
| Como usar as ferramentas | sim | sim | sim | não |
| Editar memória da loja | sim | sim | não | não |
| Editar o próprio perfil de estilo | sim | sim | sim | — |
| Ler conversa da AURA de outra pessoa | não | não | não | não |
| Qualquer coisa de outra loja | não² | não | não | não |

¹ a menos que o gestor libere o módulo correspondente para aquele vendedor, exatamente como já funciona hoje.
² o admin opera **dentro** de uma loja por vez, pelo seletor de loja. Não existe AURA com visão global na v1.

**A conversa da AURA é privada por pessoa.** O gestor não lê o que o vendedor perguntou. Isso é deliberado: uma AURA vigiada não é usada com sinceridade, e uma AURA usada sem sinceridade não aprende nada.

---

## 13. Segurança, privacidade e custo

### 13.1 Isolamento

O risco central deste módulo é vazamento entre lojas. O sistema hoje isola por coluna e filtro em consulta, na camada de aplicação — não há isolamento imposto pelo banco. Isso funciona porque cada consulta é escrita à mão com o filtro.

A AURA aumenta o risco, porque a pergunta é livre. A mitigação é estrutural: **a AURA nunca monta consulta a partir do texto do usuário.** A frase vira critérios de um conjunto fechado, e esses critérios entram em consultas prontas e revisadas, que já nascem filtradas. O usuário escolhe *o que* buscar; ele nunca escolhe *onde*.

Isto precisa de teste automatizado dedicado, no mesmo espírito dos testes de isolamento que o projeto já tem.

### 13.2 LGPD

- Perfil de estilo e memória de loja são visíveis, editáveis e apagáveis pelo dono.
- O aprendizado pode ser desligado por usuário, sem desligar a AURA.
- Nenhum dado pessoal de cliente final entra na memória de longo prazo.
- Conteúdo de conversa com a AURA não é usado para treinar nada fora da própria loja — nem entre lojas, nem para a plataforma.
- Retenção sugerida: conversa por 12 meses, memória enquanto a loja quiser, registro de auditoria conforme a política que já existe.
- A exclusão da loja apaga tudo em cascata, como as demais entidades.

### 13.3 Custo

A AURA é o recurso mais caro do produto por natureza — ela é acionada muitas vezes ao dia, por muitos usuários.

Controles obrigatórios desde o primeiro dia:

- **cota mensal por loja**, contada em perguntas, visível para o gestor;
- **limite de frequência por usuário**, para conter uso automatizado;
- **contabilização de cada chamada** na telemetria que já existe;
- **teto de gasto por loja**, com aviso ao admin;
- **chave própria da loja (BYOK)** como caminho para quem quer usar sem limite, já implementado;
- **buscas antes do modelo**: como toda consulta é feita no banco e só a redação usa IA, o contexto enviado é pequeno e previsível — é isto que segura o custo.

### 13.4 Abuso

A AURA é uma porta para o modelo de IA. Precisa de: limite de tamanho da pergunta, limite de perguntas por minuto, recusa a pedidos que tentem fazê-la ignorar as próprias regras, e registro de tentativas suspeitas para o admin.

---

## 14. Gap analysis

Pontos que este documento **não** resolve e que precisam de decisão antes ou durante a implementação.

| Tema | Problema | Impacto | Recomendação |
|---|---|---|---|
| Geolocalização | Loja não tem coordenada; só cidade, estado e CEP. "Parceiro a 3 km" não é calculável | Alto — a proximidade é metade do valor da busca em parceiros | v1 ordena por cidade e estado. Decidir na v2 o serviço de geocodificação de CEP e quem paga por ele |
| Banco no desenvolvimento | Produção é PostgreSQL, desenvolvimento é SQLite; a extensão de vetores só existe no primeiro | Alto — sem tratamento, o time não roda o projeto localmente | Memória vetorial opcional: sem a extensão, cai para busca textual. Decidir se vale padronizar o ambiente local em PostgreSQL |
| Modelo de IA | O padrão hoje é um modelo rápido e barato. A AURA exige mais raciocínio para interpretar frases soltas | Médio — modelo fraco gera busca errada e resposta ruim | Testar interpretação e redação com modelos diferentes antes de fechar. Pode valer um modelo forte para interpretar e um barato para redigir |
| Cota | Não há número definido de perguntas por mês | Médio — sem teto, o custo é imprevisível | Medir num piloto de 3 a 5 lojas antes de publicar o limite |
| Apelidos e catálogo | O catálogo canônico pode não conter todos os apelidos usados na boca do lojista | Médio — busca falha por vocabulário | Montar dicionário de sinônimos alimentado pelas buscas que não retornaram nada |
| Vendedor e repasse | Não está definido se vendedor pode ver o feed de repasse ou se isso é do gestor | Médio — muda a resposta da AURA para metade dos usuários | Decisão do produto. Sugestão: vendedor vê a ficha e o valor; só o gestor abre proposta |
| Conversa em grupo | Não está definido se existe uma AURA da loja, com todo mundo junto | Baixo | Manter privado por usuário na v1 |
| Iniciativa | Não está definido se a AURA pode puxar assunto ("três carros passaram de 90 dias") | Médio — muda o produto de ferramenta para agente | Fase 3, com consentimento explícito e frequência controlada |
| Áudio | Não está definido se o usuário pode mandar áudio para a AURA | Baixo — a transcrição já existe no projeto | Fase 2; o caminho técnico já está pronto |
| Nome | "AURA" não foi verificado quanto a registro de marca | Baixo, mas trava lançamento se der errado | Verificar antes de expor na interface |

---

## 15. Decisões de arquitetura registradas

### ADR-1 — A AURA vive no chat existente

**Contexto:** era preciso escolher onde a AURA aparece no painel.
**Alternativas:** balão flutuante em todas as telas; página própria no menu; conversa fixada no chat; extensão da paleta de comandos.
**Decisão:** conversa fixada no topo do chat.
**Consequências:** ganha histórico, tempo real, contador e a lista de conversas sem escrever nada disso. Perde a onipresença de um balão em cada tela — mitigado no mobile pelo botão flutuante que já existe. Exige tratar a conversa da AURA como caso especial nas telas que listam conversas.

### ADR-2 — A IA redige, o banco busca

**Contexto:** era preciso decidir se o modelo de IA consulta o banco por conta própria ou se recebe resultados prontos.
**Alternativas:** dar ao modelo a capacidade de montar consultas; dar a ele um conjunto de ferramentas de busca; buscar antes e mandar o resultado pronto.
**Decisão:** buscar antes, com consultas prontas e revisadas, e mandar o resultado pronto para o modelo redigir.
**Consequências:** elimina a classe inteira de vazamento entre lojas por consulta manipulada; o número que a AURA fala é o mesmo que a tela mostra; o custo fica previsível. Em troca, a AURA só responde o que foi previsto — perguntas fora dos padrões implementados não são atendidas até alguém implementá-las.

### ADR-3 — Tabela própria para a conversa da AURA

**Contexto:** a tabela de conversas do chat já existe e atende cliente-loja e loja-loja.
**Alternativas:** adicionar um terceiro tipo à tabela existente; criar tabela própria.
**Decisão:** tabela própria.
**Consequências:** evita deixar quase todos os campos existentes vazios e evita espalhar exceções por todas as consultas de chat já escritas. Em troca, a lista de conversas na interface passa a juntar duas origens — custo pequeno e localizado, contra um risco disperso.

### ADR-4 — Vetores no PostgreSQL, não em serviço dedicado

**Contexto:** a memória semântica precisa de busca por significado.
**Alternativas:** extensão de vetores no banco atual; serviço dedicado; sem vetores.
**Decisão:** extensão no banco atual.
**Consequências:** zero infraestrutura nova, isolamento por loja na mesma consulta de sempre, backup unificado, custo próximo de zero. Em troca, exige tratar a ausência da extensão no ambiente de desenvolvimento, e um dia pode precisar migrar — o que só aconteceria muito além da fase 3.

### ADR-5 — Somente leitura na v1

**Contexto:** a AURA poderia criar lead, mover funil, abrir proposta.
**Alternativas:** só leitura; escrita com confirmação; escrita autônoma.
**Decisão:** só leitura, com atalhos que levam o usuário à tela de ação.
**Consequências:** nenhum estrago possível em dado de CRM ou financeiro; a confiança do lojista é conquistada antes de pedir mais poder. Em troca, o ganho de produtividade é menor do que poderia ser — o que é aceitável para uma v1 e está no roadmap.

### ADR-6 — Estilo próprio, separado do assistente de WhatsApp

**Contexto:** já existe um perfil de tom aprendido do áudio do vendedor.
**Alternativas:** reaproveitar aquele perfil; criar um próprio.
**Decisão:** perfil próprio.
**Consequências:** a AURA fala com o vendedor do jeito que **ele** quer ser tratado, e não do jeito que ele trata clientes. Em troca, é mais uma estrutura a manter, e o usuário pode estranhar ter dois lugares de configuração de tom — resolvido deixando claro na interface o que cada um faz.

---

## 16. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|:---:|:---:|---|
| Vazamento de dado entre lojas por pergunta manipulada | Baixa | **Crítico** | ADR-2: a pergunta nunca monta consulta. Testes dedicados de isolamento. Auditoria de tudo |
| AURA inventa veículo, preço ou taxa | Média | Alto | Redação restrita ao resultado da busca. Nada de número fora do contexto entregue. Avaliação pelo usuário como sinal de alerta |
| Custo de IA acima do previsto | **Alta** | Alto | Cota por loja, limite por usuário, teto de gasto, BYOK, contexto enxuto por desenho |
| Interpretação errada da frase gera busca errada | Média | Médio | Perguntar de volta quando ambíguo. Sempre dizer o que foi buscado. Dicionário de sinônimos alimentado pelas falhas |
| Resposta lenta demais e o vendedor desiste | Média | Médio | Indicador de progresso honesto por etapa. Transmissão progressiva no roadmap |
| Extensão de vetores indisponível no ambiente local trava o time | Média | Médio | Degradação para busca textual, decidida no desenho e não descoberta na hora |
| Lojista confunde a AURA com o assistente de WhatsApp | **Alta** | Baixo | Nome, avatar, lugar e texto de apresentação diferentes. Seção 1.1 vira material de treinamento |
| Vendedor sente vigilância e não usa | Média | Médio | Conversa privada por pessoa, dito explicitamente na primeira mensagem |
| A memória aprende algo errado e repete | Média | Médio | Fato de loja só entra com confirmação humana. Tudo visível e apagável |
| Dependência de um único provedor de IA | Baixa | Médio | Cadeia de provedores com queda automática já existe no projeto |

---

## 17. Roadmap

### MVP — a AURA que responde

**Valor:** o lojista pergunta em português e recebe resposta certa sobre o próprio estoque e sobre o repasse dos parceiros.

- Conversa fixada no chat do painel web, com identidade própria
- Bloqueio pelo módulo `assistente_ia`, com teaser para quem não contratou
- Interpretação de frase para critérios de busca de veículo
- Busca no estoque próprio, com relaxamento explicado
- Busca no repasse de parceiros, ordenada por cidade e estado
- Cálculo de comissão do vendedor, reaproveitando o cálculo real do sistema
- Domínio de ferramentas: a AURA explica como usar o sistema
- Atalhos ao fim da resposta
- Contabilização de consumo e cota por loja
- Auditoria completa
- Testes de isolamento entre lojas

**Depende de:** promover a rotina de chamada de IA a utilitário compartilhado; extrair a lógica de filtro do repasse.
**Risco principal:** qualidade da interpretação de frase. Mitigação: piloto com 3 a 5 lojas antes de liberar.

### Release 2 — a AURA que conhece você

**Valor:** as respostas param de ser genéricas.

- Perfil de estilo por usuário, visível e editável
- Memória de fatos da loja, com confirmação do gestor
- Extensão de vetores em produção, com queda para busca textual no desenvolvimento
- AURA no aplicativo, na aba de chat
- Pergunta por áudio, reaproveitando a transcrição que já existe
- Domínio de CRM: funil, clientes, simulações de crédito
- Geolocalização das lojas e ordenação por distância real

**Depende de:** MVP em produção com volume suficiente para avaliar. Decisão sobre geocodificação.

### Release 3 — a AURA que aprende com o negócio

**Valor:** ela deixa de responder e começa a orientar.

- Memória de negociações: o que fecha e o que trava naquela loja
- Domínio financeiro para o gestor
- Resposta em transmissão progressiva
- Iniciativa: a AURA avisa sobre carro parado, funil travado, oportunidade no repasse — com consentimento e frequência controlada
- Ações com confirmação: criar lead, mover funil, abrir proposta de repasse — revisitando o ADR-5

**Depende de:** meses de uso acumulado. Confiança estabelecida com os lojistas.
**Risco principal:** iniciativa mal calibrada vira spam e mata o produto. Mitigação: começar em uma notificação por semana, com desligamento em um clique.

---

## 18. Glossário

- **AURA** — a assistente interna descrita neste documento.
- **Assistente de IA** — o recurso que já existe, que responde clientes no WhatsApp. Coisa diferente.
- **Atalho** — botão que a AURA oferece ao fim da resposta, levando o usuário à tela onde ele executa a ação.
- **Conversa fixada** — a conversa da AURA no topo da lista de mensagens, presente em toda loja.
- **Domínio de resposta** — cada um dos quatro grupos de assunto que a AURA cobre.
- **Memória de estilo** — o resumo de como aquele usuário quer ser respondido.
- **Memória da loja** — fatos verdadeiros sobre o negócio que não cabem em nenhum campo do sistema.
- **Relaxamento** — afrouxar critérios de busca, na ordem definida, quando não há resultado exato.
- **Vetor** — representação numérica do significado de um texto, usada para encontrar coisas parecidas.

---

## 19. Nota sobre este arquivo

Este documento fica na **raiz do repositório**, ao lado de `social.md`, e não numa pasta de documentação. O motivo é prático: o arquivo `.gitignore` do projeto ignora a pasta `docs/`, então um documento colocado lá não seria versionado, não apareceria em revisão e se perderia na primeira máquina nova. Quem for reorganizar a documentação um dia precisa mudar o `.gitignore` antes de mover este arquivo.
