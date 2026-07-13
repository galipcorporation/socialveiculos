# Mobile: limpeza de copy demo/B2B + config de build de produção

Data: 2026-07-13

## Objetivo

Preparar o app mobile (`apps/mobile`) para a versão que vai ao ar, removendo
textos e fluxos de "conta demo"/"ambiente de demonstração" e o jargão "B2B"
visível ao usuário final, e corrigindo a config de build de produção que hoje
aponta para `localhost` por falta de env var.

## Mudanças de copy/UI

- `src/screens/auth/LoginScreen.tsx`: remove botão "Explorar com conta demo",
  a função `entrarDemo`, e o texto "Ambiente de demonstração — dados fictícios".
- `src/components/LoginSheet.tsx`: remove botão "Entrar com conta demo" e a
  chamada equivalente.
- `src/services/auth.ts`: remove `credenciaisDemo()` (fica sem uso após as
  duas remoções acima).
- `src/screens/vitrine/PerfilScreen.tsx`: "Social Veículos · Vitrine ·
  ambiente de demonstração" → "Social Veículos · Vitrine".
- `src/screens/mais/MaisScreen.tsx`: remove "ambiente de demonstração" do
  rodapé e do subtitle "Tema, dados de demonstração".
- `src/screens/mais/ConfiguracoesScreen.tsx`: "0.1.0 (demo)" → "0.1.0".
- `src/screens/chat/ChatScreen.tsx`: "repasses B2B" → "repasses entre lojas".
- `src/screens/ferramentas/ContratosScreen.tsx`: reescreve a mensagem de PDF
  indisponível offline sem a palavra "demonstração" (é uma limitação técnica
  real, não relacionada a conta demo).

Fora de escopo: comentários técnicos internos que mencionam B2B em
`experienciaStore.ts` e `services/types.ts` (não são texto de UI).

## Config de build

`eas.json`: bloco `build.production` não define `EXPO_PUBLIC_API_URL` (só
`preview` define). Sem essa env var, o app buildado para produção cai no
fallback `http://localhost:8000/v1` (`src/lib/api.ts:5`) e não funciona.
Adicionar ao bloco `production`:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://socialveiculos-api.fly.dev/v1"
}
```

Mesmo valor já usado em `preview`.

## Fora de escopo

- Mocks de dados: não há mocks ativos no mobile — `authService` e demais
  services já falam com a API real. Nenhuma mudança necessária aqui.
- Nome do app, ícones, versão em `app.json`: já configurados corretamente.
