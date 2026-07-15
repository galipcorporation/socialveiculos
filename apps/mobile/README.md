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
  lib/          format.ts (BRL, datas, máscaras), api.ts (client HTTP — refresh token + X-Loja-Id)
  services/     CAMADA DE DADOS — API real (apps/api), um service por domínio
    types.ts    modelos de domínio (mesmas shapes do apps/api)
    *.ts        veiculos, leads, chat, esteira, financeiro, assistente… (todos via lib/api)
  components/
    ui/         design system: Button, Card, Badge, Input, Sheet, Skeleton, Toast…
    charts/     BarChart (série única, tap = tooltip)
  navigation/   RootNavigator (auth gate) + MainTabs (Início/Estoque/CRM/Chat/Mais)
  screens/      uma pasta por módulo
```

## Camada de dados

As telas **só** conhecem os services (`src/services/index.ts`); toda a comunicação
com o backend passa por `src/lib/api.ts` (client com refresh token e header
`X-Loja-Id`). A API-alvo é definida por `EXPO_PUBLIC_API_URL` (fallback
`http://localhost:8000/v1` em dev). Nos builds EAS a URL vem do `eas.json`.

## Build do APK (EAS)

APK instalável direto no celular (não precisa Play Store):

```bash
cd apps/mobile
npx eas-cli build --profile preview --platform android           # build na nuvem Expo (conta na cota mensal)
npx eas-cli build --profile preview --platform android --local   # build na sua máquina (NÃO conta na cota; exige Android SDK + JDK)
```

O profile `preview` gera `.apk` e injeta `EXPO_PUBLIC_API_URL` apontando para a
API de produção (Fly). `production` gera `.aab` (só Play Store, não instala direto).

### Versão (controle manual)

`appVersionSource: "local"` no `eas.json` → a versão é controlada **à mão** no
`app.json`, então você vê o número no arquivo (útil com a cota mensal da Expo):

- `expo.version` (`1.0.0`) → versão visível ao usuário; bumpe a cada release (1.0.1, 1.1.0…).
- `expo.android.versionCode` (inteiro) → **incremente +1 a cada APK** que for instalar/distribuir.
  Se dois APKs tiverem o mesmo `versionCode`, o Android trata como a mesma build.

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
