# Vitrine B2C mobile (M045 — fase 2) — Design

**Data:** 2026-07-09
**Escopo:** app do comprador final (B2C) dentro do `apps/mobile` existente, mock-first, paridade com a `apps/vitrine` web (Feed, Detalhe, Favoritos, Perfil da Loja, Chat, Perfil PF).
**Decisões batidas com o usuário:** mesmo app (fluxo por tipo de conta) · feed público + gate de login por ação · núcleo do comprador (sem C2C "anunciar meu carro" nesta fase) · feed de cards roláveis (estilo timeline).

## 1. Arquitetura — fluxo por tipo de conta no mesmo app

O `authStore.user.papel` já suporta `'cliente'`. Introduzimos um **modo de experiência** persistido (`experienciaStore`: `'comprador' | 'lojista' | null`) escolhido no primeiro boot.

`RootNavigator` decide a árvore de navegação:
- `experiencia === null` → **EscolhaExperienciaScreen** (Sou comprador / Sou lojista). Persiste a escolha.
- `experiencia === 'lojista'` → fluxo atual: não-autenticado → `LoginScreen`; autenticado (gestor/vendedor) → `MainTabs` (Gestor B2B, intacto).
- `experiencia === 'comprador'` → **`VitrineTabs`** sempre (feed **público**, sem exigir login). Login do comprador só é solicitado por ação (favoritar/conversar/perfil) via **LoginSheet** (bottom sheet).

Trocar de experiência: opção no Perfil da vitrine ("Sou lojista →") e no menu Mais do gestor ("Ver como comprador →"), que reseta o `experienciaStore`.

**Isolamento:** tudo B2C em `screens/vitrine/*` e `services/vitrine.ts` (+ tipos em `services/types.ts`). Zero alteração de comportamento no Gestor. Reuso total do UI kit e tema.

## 2. Autenticação do comprador (mock)

- `authStore` ganha suporte a login de `cliente` (novo método `loginCliente(user)` — na verdade reusa o `login` existente com um `User` de papel `cliente`, sem loja_id).
- Conta PF demo: `vitrineService.loginDemo()` retorna um `User { papel: 'cliente' }` (nome "Comprador Demo", e-mail `vitrine@demo.com`) — alinhado às credenciais de dev registradas.
- `LoginSheet` (bottom sheet): campos nome/e-mail (cadastro leve) + botão "Entrar com conta demo". Ao concluir, seta o auth e re-executa a ação pendente (favoritar/abrir chat).
- **Gate helper** `useGateLogin()`: hook que, se não autenticado como cliente, abre o LoginSheet e retorna `false`; se autenticado, retorna `true`. Cada ação protegida chama o gate antes de agir.

## 3. Dados mock (multi-loja)

A vitrine mostra veículos de **várias lojas**, diferente do Gestor (uma loja). `services/vitrine.ts` tem seed próprio in-memory:
- **6 lojas fictícias** (nome, cidade/UF, logo=avatar por inicial, whatsapp, verificada) — reusa nomes do diretório de parceiros do M055 para coerência (Auto Premium, Garagem RS Motors, AutoCenter Canoas, Premium Motors, Sul Veículos + 1).
- **~18 anúncios** distribuídos entre as lojas (marca/modelo/versão/ano/km/cor/preço/foto placeholder/loja). Reaproveita o shape dos veículos do seed do gestor, acrescentando `loja_nome/loja_cidade/loja_uf/loja_whatsapp/loja_verificada/total_favoritos/favoritado_por_mim`.
- **Favoritos**: estado em memória de sessão (`Set<id>`), alternável.
- **Chat B2C**: conversas comprador↔loja (mock), mesma UX da `ConversaScreen` do gestor reusada; mensagens in-memory.

Fotos: como o seed não tem URLs reais, reuso o padrão `VehiclePhoto` (placeholder gradiente + ícone por tipo) já usado no app — nunca imagem quebrada.

## 4. Navegação — VitrineTabs (4 abas)

1. **Feed** (`FeedScreen`) — cards roláveis: foto grande, loja (avatar+nome+verificada), marca/modelo/versão, ano·km·cor, preço, botão favoritar (coração). Filtros rápidos por chips (Todos/Ofertas/Novidades/SUVs…). Toque no card → CarroDetalhe. Toque na loja → PerfilLoja.
2. **Buscar** (`BuscarScreen`) — SearchBar + resultados (mesmo card). Sub-aba/segmento "Favoritos" (lista dos favoritados; se não logado, empty state com CTA de login).
3. **Mensagens** (`MensagensScreen`) — lista de conversas com lojas (gate: se não logado, empty + login). Abre `ConversaVitrineScreen`.
4. **Perfil** (`PerfilScreen`) — se logado: dados da conta PF + favoritos + sair; se não: card "Entre para salvar favoritos e conversar" + botão login. Sempre: tema (claro/escuro/sistema, reusa a lógica das Configurações), "Sou lojista →" (troca de experiência), Sobre.

**Stack screens** (fora das tabs): `CarroDetalhe` (galeria + specs + loja + botões "Conversar" e "WhatsApp" com gate no chat), `PerfilLoja` (cabeçalho da loja + grid de veículos dela + seguir/whatsapp), `ConversaVitrine` (chat comprador↔loja).

## 5. Componentes reutilizados

Card, ListRow, Sheet/OptionSheet, FilterChips, SegmentedControl, SearchBar, Avatar, Badge, Button, Input, EmptyState, ErrorState, SkeletonCard, Txt, useToast, VehiclePhoto. Tema e tokens idênticos. Nenhum design system novo (a vitrine web usa `--vt-*`, mas no mobile mantemos o tema único do app — o usuário aprovou "reuso total do UI kit").

## 6. Fora de escopo (fases futuras)

- C2C "anunciar meu carro" (MeusVeiculos) — próxima fase.
- Stories (a web tem; adiar).
- Pré-aprovação de crédito na vitrine ([[M017]], travado por parceria bancária).
- Push, câmera, deep links.

## 7. Validação

- `tsc --noEmit` limpo em `apps/mobile`.
- Fluxo manual (lógico): escolher comprador → feed abre sem login → favoritar dispara LoginSheet → login demo → favorita → aparece em Favoritos → abrir carro → Conversar → chat → trocar p/ lojista volta ao login do gestor.
- Gestor B2B inalterado (mesma árvore quando experiencia='lojista').

## 8. Faseamento da implementação

1. `experienciaStore` + `EscolhaExperienciaScreen` + refator do `RootNavigator`.
2. `authStore.loginCliente` + `vitrineService` (seed multi-loja, favoritos, chat, lojas) + tipos.
3. `LoginSheet` + `useGateLogin`.
4. `VitrineTabs` + Feed + Buscar/Favoritos + Mensagens + Perfil.
5. Stack: CarroDetalhe + PerfilLoja + ConversaVitrine.
6. Validação tsc + MELHORIAS.md (novo item) + memória.
