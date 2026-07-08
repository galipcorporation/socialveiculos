# Social Veículos — Mobile (Gestor)

App mobile (Expo / React Native) do gestor de lojas. Recria a experiência do
WebGestor (`apps/gestor`) mobile-first, com a mesma paleta **Social Velocity**
(tokens em `src/theme/tokens.ts`, light + dark).

## Rodar

```bash
pnpm --filter @sv/mobile start   # Expo Dev Server (Expo Go / dev build)
```

Login demo: `gestor@autopremium.com.br` / `demo123` (gestor) ou
`paulo@autopremium.com.br` / `demo123` (vendedor — dashboard com escopo próprio).

## Arquitetura

```
src/
  theme/        tokens (--sv-* portados) + ThemeProvider (system/light/dark persistido)
  lib/          format.ts (BRL, datas, máscaras), api.ts (client HTTP pronto p/ API real)
  services/     CAMADA DE DADOS — hoje mock, amanhã API real
    types.ts    modelos de domínio (mesmas shapes do apps/api)
    seed.ts     dados fake realistas (veículos, leads, chat, esteiras, financeiro)
    db.ts       "banco" local: AsyncStorage + latência simulada
    *.ts        um service por domínio (veiculos, leads, chat, esteira, financeiro…)
  components/
    ui/         design system: Button, Card, Badge, Input, Sheet, Skeleton, Toast…
    charts/     BarChart (série única, tap = tooltip)
  navigation/   RootNavigator (auth gate) + MainTabs (Início/Estoque/CRM/Chat/Mais)
  screens/      uma pasta por módulo
```

## Trocar mock → API real

As telas **só** conhecem os services (`src/services/index.ts`). Para plugar o
backend: reimplementar cada service usando `src/lib/api.ts` (client com refresh
token e header `X-Loja-Id` já pronto) mantendo as assinaturas. Nada muda nas
telas, hooks ou navegação. O login mock em `services/auth.ts` vira
`api.post('/auth/login')` com o mesmo contrato.

## Módulos

- **Início** — KPIs (escopo gestor × vendedor), vendas 6 meses, ações rápidas, alertas
- **Estoque** — busca + filtros por status, detalhe com specs/margem/vitrine,
  cadastro com campos por tipo de veículo (carro/moto/barco/…), fotos da galeria,
  registrar venda (abre esteira + lançamentos)
- **CRM** — funil por etapas, detalhe do lead com timeline, ligar/WhatsApp,
  proposta, novo lead
- **Chat** — conversas (vitrine/WhatsApp) + thread com envio otimista
- **Pós-venda** — esteira contrato→pagamento→documentos→transferência com checklist
- **Comissões** — vendas do usuário, pendentes/pagas
- **Financeiro** (gestor) — saldo do mês, receitas/despesas/comissões, lançamentos
- **Equipe** (gestor) — membros, % de comissão, ativar/desativar
- **Simulador** — parcelas Price, compartilhar simulação
- **Configurações** — tema, restaurar dados demo

Área administrativa da plataforma fica fora do escopo mobile (decisão de produto).
