# Implementação — Usabilidade do App Mobile (painel lojista)

> Baseado em `documentos/usabilidade_mobile.md` (dev-master, 2026-07-09). Este spec fecha as 3 perguntas em aberto do doc original e detalha a implementação técnica de todas as 6 fases.

## Decisões (perguntas em aberto do doc original)

1. **Tab dedicada por papel** — não agora. O hub "Mais" reorganizado (grade de atalhos + lista agrupada) é suficiente; tab dedicada fica descartada, não apenas adiada.
2. **Aprovação de venda pelo gestor** — não. Vendedor registra venda sozinho, como hoje.
3. **Cadastro rápido por placa** — sempre entra como rascunho/inativo (`ativo=false`), nunca publica direto na vitrine.

## Decisões técnicas adicionais (levantadas durante investigação de código)

- **Etapa "ganho" não existe** em `EtapaLead` — as etapas são `lead | proposta | negociacao | fechamento | perdido`. Todo o design usa `'fechamento'` como o gatilho de "lead ganho".
- **`lead_id` será adicionado** em `EsteiraPosVenda` (nullable, FK) via migration — permite rastrear formalmente que uma venda se originou de um lead.
- **Contratos/NotasFiscais ganham filtro por parâmetro de rota** (`contratoId` opcional) — não é só navegação cega.
- **Notificações acionáveis reusam o campo `link` já existente** no model `Notificacao` — sem migração de coluna nova; padroniza-se o formato do valor gravado nesse campo (`tipo:id`) nos 6 pontos de criação no backend, e o mobile parseia esse valor para navegar.

---

## Fase 1 — Fluxo de venda ponta a ponta

**Backend (`apps/api`)**
- Migration: adicionar coluna `lead_id` (String(36), FK `lead.id`, nullable=True) em `EsteiraPosVenda` (`models.py`).
- `schemas.py`: `VenderVeiculoRequest` ganha `lead_id: Optional[str] = None`; `VenderVeiculoResponse` ganha `lead_id: Optional[str] = None`.
- `routers/contratos.py` (`vender_veiculo`): ao montar `EsteiraPosVenda(...)`, gravar `lead_id=body.lead_id` quando presente.

**Mobile (`apps/mobile`)**
- Extrair o sheet inline de `VeiculoDetalheScreen.tsx:567` para `apps/mobile/src/components/RegistrarVendaSheet.tsx`. Props: `veiculo: Veiculo | undefined`, `visible: boolean`, `onClose: () => void`, `compradorInicial?: string`, `leadId?: string`. Se `veiculo` vier undefined, o sheet precisa de um seletor de veículo (novo — hoje sempre recebe veículo certo). `VeiculoDetalheScreen` passa a importar e usar o componente extraído sem mudança de comportamento.
- `LeadDetalheScreen.tsx`: no `onSuccess` de `etapaMut`, se `l.etapa === 'fechamento'`, abrir `RegistrarVendaSheet` com `veiculo = lead.veiculo`, `compradorInicial = lead.nome` (ou campo equivalente do lead), `leadId = lead.id`.
- `EsteiraDetalheScreen.tsx`: nos cards de categoria `contrato` e `documento` (linha ~174-204), adicionar botão contextual "Gerar contrato" / "Emitir NF-e" que navega `navigation.navigate('Contratos', { contratoId: esteira.contrato_id })` / `navigation.navigate('NotasFiscais', { contratoId: esteira.contrato_id })`.
- `types.ts`: rotas `Contratos` e `NotasFiscais` passam a aceitar `{ contratoId?: string } | undefined`.
- `ContratosScreen.tsx` / `NotasFiscaisScreen.tsx`: ler `route.params?.contratoId`; se presente, dar destaque visual (scroll automático + highlight) ao item correspondente na lista já carregada.
- `DashboardScreen.tsx`: novo card "Vendas em andamento (N)" usando `esteiraService.listar()` filtrado client-side por `estagio !== 'concluido'`. Se N=1, navega direto pra `EsteiraDetalhe`; se N>1, navega pra `PosVenda`.

**Aceite:** do lead em "Fechamento" até a esteira aberta, sem passar pelo Estoque; card de vendas em andamento aparece no dashboard quando há esteira aberta.

---

## Fase 2 — Módulos do vendedor

- `MaisScreen.tsx`: trocar `const gestor = user?.papel !== 'vendedor'` por `const gestor = user?.papel === 'gestor'`.
- Aplicar `parseModulos(user?.modulos)` (já existe em `lib/modulos.ts`) para decidir quais itens de "Ferramentas"/"Gestão" aparecem — cada item mapeado para seu `ModuloKey` (`simulador`, `crm`, `estoque`, `contratos`, `marketing`, `assistente`, `fiscal`, `site`).
- `DashboardScreen.tsx`: mesma lógica aplicada às ações rápidas (ex: ocultar "Simular" se módulo `simulador` não estiver liberado).

**Aceite:** vendedor sem módulo "simulador" não vê Simulador em nenhum lugar do app (Mais nem ações rápidas).

---

## Fase 3 — Mais reorganizado + CRM ágil

**Requer mockup aprovado antes de codar** (skill `mockup-front`), conforme já indicado no doc original e nas convenções do projeto.

- `MaisScreen.tsx`: topo vira grade de atalhos grandes (4 itens conforme papel — vendedor: Simulador/Assistente IA/Comissões/FIPE; gestor: Financeiro/Equipe/Pós-venda/Marketing), lista agrupada abaixo mantendo todos os itens (só reordenar, nada some), "Conta" no fim.
- `CrmScreen.tsx`: adicionar `SearchBar` (mesmo padrão de `EstoqueScreen.tsx`) filtrando por nome/veículo/telefone; long-press no `LeadCard` abre o `OptionSheet` de etapa direto da lista; renomear chip `'ativos'`/"Funil" → "Ativos"; dar destaque à carteira de Clientes (chip fixo no CRM).

**Aceite:** mockup aprovado antes; depois, hub Mais e CRM navegáveis sem perda de nenhum item existente.

---

## Fase 4 — Notificações acionáveis

- Backend: padronizar o valor gravado em `Notificacao.link` nos 6 pontos de criação (`esteira_worker.py:103`, `b2b.py:393,1108,1228,1241`, `vitrine_interativo.py:450`) para um formato `"<tipo>:<id>"` reconhecível pelo mobile (ex: `"esteira:abc123"`, `"lead:xyz789"`, `"chat:def456"`).
- Mobile: no sheet de notificações do `DashboardScreen.tsx`, ao tocar num item, parsear `link`, mapear prefixo → rota (`esteira` → `EsteiraDetalhe`, `lead` → `LeadDetalhe`, `chat` → tela de chat correspondente), navegar, e chamar `marcarLida` em paralelo.

**Aceite:** tocar num alerta navega ao objeto relacionado (esteira, lead ou chat) e marca como lida.

---

## Fase 5 — Cadastro rápido por placa

- `VeiculoFormScreen.tsx`: modo "cadastro rápido" no fluxo de criação — campos tipo + placa (com consulta KePlaca já existente, endpoint `/veiculos/consulta-placa/{placa}`) + preço + fotos. Salva com o campo de publicação (switch "publicar na vitrine", linha ~436) forçado a `false`/inativo.
- Demais campos (versão, km, câmbio, combustível, opcionais, descrição etc.) migram para seções em acordeão, editáveis depois na tela de edição do mesmo veículo.

**Aceite:** veículo cadastrado com ≤6 campos + fotos, sempre como rascunho/inativo.

---

## Fase 6 — Polimentos

- `DashboardScreen.tsx`: avatar navega para aba "Mais" (perfil), não para Configurações.
- `EquipeScreen.tsx`: switch ativo/inativo (linha ~120) passa a abrir um `Sheet` de confirmação antes de chamar `ativoMut.mutate()`.
- `MembroFormSheet` (dentro de `EquipeScreen.tsx`): descrição de 1 linha por módulo na lista de toggles; botão/preset "Padrão vendedor" que marca de uma vez `estoque+crm+simulador+assistente`.

**Aceite:** sem critério de teste automatizado — validação visual/manual.

---

## Riscos (herdados do doc original, confirmados)

- `user.modulos` já vem no payload de login do mobile (confirmado — `authStore.ts` já tipa o campo). Sem risco aqui.
- Reorganizar "Mais" não remove nenhum item, só reordena/agrupa.
- KePlaca no mobile reusa o endpoint server-side já existente (`apps/api/routers/veiculos.py`), sem scraping no app.
- Migration de `lead_id` em `EsteiraPosVenda` é aditiva (coluna nullable) — sem impacto em dados existentes.

## Fora de escopo

- Tab dedicada por papel ("Vendas"/"Loja") — descartada nesta rodada.
- Aprovação de venda pelo gestor — não implementada.
- Publicação direta na vitrine pelo cadastro rápido — não implementada (sempre rascunho).
