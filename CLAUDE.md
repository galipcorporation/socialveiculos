# SocialVeiculos — Regras do projeto

## Documentação (OBRIGATÓRIO — tem precedência sobre qualquer skill)

- **NUNCA criar arquivos de spec/design/plano automaticamente** a partir de um pedido do usuário. Só criar documento quando ele pedir explicitamente ("cria um TDD", "documenta o plano").
- **NUNCA criar `docs/`, `docs/superpowers/` ou qualquer pasta de documentação na raiz** — mesmo que uma skill (superpowers brainstorming/writing-plans) mande salvar lá. Se a skill exigir salvar um doc, o caminho é `documentos/tarefa/specs/AAAA-MM-DD-assunto.md`.
- Estrutura da documentação: ver [documentos/README.md](documentos/README.md). Trabalho vivo em `documentos/tarefa/`, planos em `documentos/planos/`, encerrados em `documentos/historico/`.
- Bugs → `documentos/tarefa/BUGS.md` · Melhorias → `documentos/tarefa/MELHORIAS.md` (registros contínuos, não criar arquivos soltos).

## Antes de mexer em banco, migrations ou deploy

Ler `documentos/tarefa/ARMADILHAS-PRODUCAO.md` — quatro coisas já quebraram produção (datetime aware, migrations SQLite-only, deploy Vercel fora da raiz, storage sem os secrets S3 caindo em disco efêmero) e a mensagem de erro de cada uma engana.
