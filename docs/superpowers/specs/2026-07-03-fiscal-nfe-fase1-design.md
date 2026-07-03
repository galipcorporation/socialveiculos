# Fiscal / NF-e — Fase 1 (MVP) — Design

> Implementa M039 do `documentos/tarefa/MELHORIAS.md`. Escopo: **NF-e de venda (saída) em homologação**, via gateway **Focus NFe**, custo **absorvido pela plataforma** (módulo pago), certificado A1 **cifrado na própria plataforma**.

## Contexto

Hoje a "nota fiscal" na Esteira Pós-venda é só um documento anexado manualmente (`TipoDocumentoVeiculo.NOTA_FISCAL`, item de checklist `nota_entregue`). Não existe emissão fiscal real. Esta fase entrega o fluxo mínimo: configurar dados fiscais + certificado A1 + credencial do gateway → emitir NF-e a partir de uma venda (`vender_veiculo`) → acompanhar autorização → anexar DANFE/XML na Carteira do Proprietário e marcar `nota_entregue` automaticamente.

Decisões já batidas com o usuário:
- **Gateway:** Focus NFe.
- **Custo:** absorvido pela plataforma (conta mestre no Focus NFe); módulo `fiscal` é pago via assinatura (mesmo mecanismo de `ModuloHabilitado`/`exige_modulo`).
- **Certificado A1:** upload do `.pfx` + senha, cifrados com Fernet (mesmo padrão de `CredencialDetran`/`CredencialIA`), armazenados na plataforma.
- **Escopo:** só NF-e de **saída (venda)**, ambiente **homologação**. Sem cancelamento/CC-e/entrada nesta fase (ficam para Fase 2, já documentada no MELHORIAS.md).

## Modelo de dados

### `ConfiguracaoFiscal` (1:1 com `Loja`)
```python
class ConfiguracaoFiscal(Base):
    __tablename__ = "configuracao_fiscal"
    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False, unique=True)

    inscricao_estadual = Column(String(20), nullable=True)
    regime_tributario = Column(String(20), nullable=False, default="simples")  # simples|presumido|real
    cnae = Column(String(10), nullable=True)

    certificado_a1_cifrado = Column(Text, nullable=True)     # Fernet, .pfx em base64
    certificado_senha_cifrada = Column(Text, nullable=True)  # Fernet
    certificado_validade = Column(DateTime, nullable=True)

    serie_nfe = Column(String(3), nullable=False, default="1")
    proximo_numero = Column(Integer, nullable=False, default=1)
    ambiente = Column(String(15), nullable=False, default="homologacao")  # homologacao|producao

    focus_nfe_token_cifrado = Column(Text, nullable=True)  # Fernet — token da conta mestre alocado à loja (ver "Modelo de token" abaixo)

    natureza_operacao = Column(String(60), nullable=False, default="Venda de veículo usado")
    cfop_venda = Column(String(4), nullable=False, default="5102")
    ncm_padrao = Column(String(8), nullable=False, default="87032310")
    csosn = Column(String(4), nullable=True)  # Simples Nacional
    cst = Column(String(3), nullable=True)    # Presumido/Real
    origem_mercadoria = Column(String(1), nullable=False, default="0")

    ativo = Column(Boolean, default=False)  # True só após certificado + config mínima completos
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("loja_id", name="uq_configuracao_fiscal_loja"),)
```

**Nota de decisão:** Focus NFe usa um modelo de "empresas" dentro de uma conta — cada CNPJ (loja) é cadastrado como uma empresa na nossa conta mestre via API (`POST /v2/empresas`), retornando um `token` próprio daquela empresa. É esse token (não um token compartilhado) que fica em `focus_nfe_token_cifrado`. Isso mantém isolamento por loja mesmo com custo centralizado.

### `NotaFiscal`
```python
class NotaFiscal(Base):
    __tablename__ = "nota_fiscal"
    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    contrato_id = Column(String(36), ForeignKey("contrato.id", ondelete="SET NULL"), nullable=True)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    cliente_id = Column(String(36), ForeignKey("cliente.id", ondelete="SET NULL"), nullable=True)

    tipo = Column(String(10), nullable=False, default="saida")  # só "saida" na Fase 1
    ambiente = Column(String(15), nullable=False)
    modelo = Column(String(2), nullable=False, default="55")
    serie = Column(String(3), nullable=False)
    numero = Column(Integer, nullable=False)

    focus_nfe_ref = Column(String(60), nullable=False, unique=True)  # "ref" que enviamos ao Focus (idempotência)
    chave_acesso = Column(String(44), nullable=True)
    protocolo = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="processando")
    # processando | autorizada | rejeitada | erro

    valor_total = Column(Numeric(12, 2), nullable=False)
    impostos_json = Column(Text, nullable=True)  # breakdown retornado pelo Focus

    xml_url = Column(String(500), nullable=True)
    danfe_pdf_url = Column(String(500), nullable=True)
    motivo_rejeicao = Column(Text, nullable=True)

    emitida_em = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (Index("ix_nota_fiscal_loja", "loja_id"),)
```

`focus_nfe_ref` é a chave de idempotência exigida pela API do Focus (evita emitir duas notas em retry); geramos como `f"sv-{loja_id[:8]}-{contrato_id}"`.

Migração idempotente seguindo o padrão de `b8e2f1a3c9d0` (`_has_table` guard), encadeada no head atual do alembic.

## Integração com o gateway (Focus NFe)

Novo módulo `apps/api/fiscal_gateway.py` (paralelo a `detran_provider.py`):
- `async def emitir_nfe(config: ConfiguracaoFiscal, nota: dict) -> dict` — monta payload (dados do emitente da config + dados da venda) e chama `POST https://{homologacao|api}.focusnfe.com.br/v2/nfe?ref={ref}` com Basic Auth (`token:` como usuário, senha vazia — convenção do Focus).
- `async def consultar_nfe(config, ref) -> dict` — `GET /v2/nfe/{ref}`.
- Emissão é **assíncrona no Focus**: resposta imediata só confirma recebimento (`status: processando_autorizacao`); a autorização real chega por **webhook**.
- Webhook: `POST /v1/fiscal/webhook/focus` (sem auth de usuário — validado por segredo compartilhado configurado no Focus, análogo ao `webhook_secret` já usado para pagamentos). Atualiza `NotaFiscal.status`, e se `autorizada`: baixa XML/DANFE do Focus, sobe para `storage_provider` (extensão `.xml`/`.pdf`, este já suportado), grava URLs, cria `VeiculoDocumento` (tipo `NOTA_FISCAL`) e marca `ItemChecklist` `nota_entregue` como `CONCLUIDO` (reaproveitando a mesma sequência de `anexar_documento` em `esteira.py:409`).

## Endpoints (`apps/api/routers/fiscal.py`, novo)

Todos atrás de `Depends(exige_modulo(Modulo.FISCAL))` (novo valor no enum `Modulo` em `modulos.py`) + `exige_permissao` para escrita.

- `GET /v1/fiscal/config` — retorna config da loja (nunca a senha/token em claro; `certificado_configurado: bool`).
- `PUT /v1/fiscal/config` — salva campos fiscais (sem certificado).
- `POST /v1/fiscal/certificado` — `multipart/form-data` (arquivo `.pfx` + `senha`); cifra ambos, chama Focus (`POST /v2/empresas` ou `PUT` para atualizar certificado de uma empresa já cadastrada), extrai validade do certificado (via `cryptography.x509` a partir do `.pfx` — biblioteca já indireta via `httpx`/padrão do projeto, ver nota abaixo) e grava `certificado_validade`.
- `POST /v1/fiscal/notas` — `{contrato_id}` → carrega contrato+veículo+cliente+loja, valida `ConfiguracaoFiscal.ativo`, monta payload, chama `emitir_nfe`, persiste `NotaFiscal(status="processando")`.
- `GET /v1/fiscal/notas` — lista paginada (filtros período/status).
- `GET /v1/fiscal/notas/{id}` — detalhe.
- `POST /v1/fiscal/webhook/focus` — callback do gateway (ver acima).

**Nota técnica (certificado):** extrair a validade de um `.pfx` requer parsear o certificado X.509 (biblioteca `cryptography`, que é dependência transitiva comum em projetos com `httpx`/JWT — vou confirmar/adicionar em `requirements.txt` se ausente). Se o parse falhar ou a lib não estiver disponível no ambiente, a Fase 1 aceita gravar `certificado_validade=None` e depender da validação que o próprio Focus NFe retorna ao cadastrar o certificado (o Focus já rejeita certificado inválido/vencido na chamada de cadastro) — não é bloqueante para o MVP.

## Frontend (gestor)

**`apps/gestor/src/pages/ferramentas/Fiscal.tsx`** (novo, mesmo padrão de `Configuracoes.tsx`/aba DETRAN):
- Formulário de dados fiscais (IE, regime, CNAE, CFOP/NCM padrão — pré-preenchidos com defaults sensatos para veículo usado).
- Upload de certificado `.pfx` + senha (input `type=file` + `type=password`), alerta se validade < 30 dias.
- Badge de status: ambiente (homologação/produção), certificado configurado ✓/✗.
- Estado vazio honesto: sem certificado → módulo bloqueado com CTA, sem ação fake.

**`apps/gestor/src/pages/ferramentas/NotasFiscais.tsx`** (novo):
- Lista de `NotaFiscal` (status, chave de acesso, valor, data), botões baixar XML/DANFE.
- Filtro por período/status.

**Botão "Emitir NF-e"** no fluxo de venda: no modal/tela pós-venda (`Estoque.tsx` `VenderModal` ou na Esteira), condicionado a `modulo_ativo(FISCAL)` — chama `POST /v1/fiscal/notas`, mostra status "processando" até o webhook virar "autorizada" (polling simples de `GET /v1/fiscal/notas/{id}` a cada alguns segundos, sem WebSocket nesta fase).

## Gate por módulo

- Novo `Modulo.FISCAL = "fiscal"` em `apps/api/modulos.py`.
- Habilitação segue o mecanismo já existente de `ModuloHabilitado` via `routers/assinaturas.py` (contratar módulo no plano) — **sem** endpoint especial de admin nesta fase (mesmo caminho dos módulos existentes: Contratos/Simulador/Marketing).

## Fora de escopo (Fase 1)

Cancelamento de NF-e, carta de correção, NF-e de entrada (compra), perfis fiscais por UF além dos defaults, produção (fica em homologação), BYO-gateway.

## Validação

1. Loja com módulo `fiscal` habilitado configura IE/regime/CFOP + sobe certificado `.pfx` válido em homologação → `ConfiguracaoFiscal.ativo = true`.
2. Vender um veículo → botão "Emitir NF-e" no contrato → `POST /v1/fiscal/notas` cria nota com `status=processando`.
3. Webhook do Focus (simulado em homologação) chega com autorização → `status=autorizada`, `chave_acesso` de 44 dígitos, XML/DANFE gerados e anexados à Carteira do Proprietário, item `nota_entregue` da Esteira marcado `CONCLUIDO` automaticamente.
4. Loja sem módulo/config → botão "Emitir NF-e" mostra CTA de configuração, sem ação fake.
5. `pytest` da suíte de isolamento multi-tenant continua verde (nenhuma rota fiscal vaza entre lojas).
