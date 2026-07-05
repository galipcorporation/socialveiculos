"""Seed de 3 templates de contrato padrão (Compra e Venda, Consignação, Garantia) por loja existente

Revision ID: b2d4f803c615
Revises: a1c3e7f92b04
Create Date: 2026-07-05 00:05:00.000000
"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision: str = 'b2d4f803c615'
down_revision: Union[str, None] = 'a1c3e7f92b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TEMPLATES = {
    "Compra e Venda (padrão)": """<h1>CONTRATO DE COMPRA E VENDA DE VEÍCULO</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<h2>VENDEDOR (LOJA)</h2>
<p>{{loja.nome}} — CNPJ {{loja.cnpj}} — {{loja.endereco}}, {{loja.cidade}} - {{loja.estado}}</p>
<h2>COMPRADOR</h2>
<p>{{cliente.nome}} — CPF {{cliente.cpf}} — {{cliente.endereco}}, {{cliente.cidade}} - {{cliente.estado}}</p>
<h2>VEÍCULO</h2>
<p>{{veiculo.marca}} {{veiculo.modelo}} {{veiculo.versao}} — {{veiculo.ano_fabricacao}}/{{veiculo.ano_modelo}} — Placa {{veiculo.placa}}</p>
<h2>CONDIÇÕES</h2>
<p>Valor da Venda: {{contrato.valor_venda}} — Entrada: {{contrato.valor_entrada}} — Parcelas: {{contrato.parcelas}}x</p>
<h2>CLÁUSULAS</h2>
<p>1. O VENDEDOR declara que o veículo descrito acima é de sua propriedade, livre e desembaraçado de quaisquer ônus.</p>
<p>2. O COMPRADOR declara ter examinado o veículo e estar de acordo com suas condições.</p>
<p>3. A transferência de propriedade junto ao DETRAN é de responsabilidade do COMPRADOR, devendo ser realizada no prazo máximo de 30 dias.</p>
<p>4. O VENDEDOR se responsabiliza por quaisquer multas e infrações anteriores à data deste contrato.</p>
<p>5. Este contrato é firmado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores.</p>""",
    "Consignação (padrão)": """<h1>TERMO DE CONSIGNAÇÃO DE VEÍCULO</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<h2>CONSIGNATÁRIO (LOJA)</h2>
<p>{{loja.nome}} — CNPJ {{loja.cnpj}} — {{loja.endereco}}, {{loja.cidade}} - {{loja.estado}}</p>
<h2>CONSIGNANTE</h2>
<p>{{cliente.nome}} — CPF {{cliente.cpf}}</p>
<h2>VEÍCULO</h2>
<p>{{veiculo.marca}} {{veiculo.modelo}} {{veiculo.versao}} — Placa {{veiculo.placa}}</p>
<h2>CONDIÇÕES</h2>
<p>Valor de referência: {{contrato.valor_venda}}</p>
<h2>CLÁUSULAS</h2>
<p>1. O veículo permanece em consignação até a efetiva venda ou devolução ao CONSIGNANTE.</p>
<p>2. A LOJA não se responsabiliza por danos decorrentes de uso indevido durante o período de exposição.</p>""",
    "Garantia (padrão)": """<h1>TERMO DE GARANTIA DE VEÍCULO</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<h2>VENDEDOR (LOJA)</h2>
<p>{{loja.nome}} — CNPJ {{loja.cnpj}}</p>
<h2>COMPRADOR</h2>
<p>{{cliente.nome}} — CPF {{cliente.cpf}}</p>
<h2>VEÍCULO</h2>
<p>{{veiculo.marca}} {{veiculo.modelo}} — Placa {{veiculo.placa}}</p>
<h2>CLÁUSULAS</h2>
<p>1. A LOJA garante o veículo pelo prazo e condições descritas nas observações deste contrato.</p>
<p>2. {{contrato.observacoes}}</p>""",
}


def upgrade() -> None:
    conn = op.get_bind()
    lojas = conn.execute(sa.text("SELECT id FROM loja")).fetchall()
    now = datetime.now(timezone.utc)

    template_table = sa.table(
        'template_contrato',
        sa.column('id', sa.String),
        sa.column('loja_id', sa.String),
        sa.column('nome', sa.String),
        sa.column('conteudo_html', sa.Text),
        sa.column('campos_extras', sa.Text),
        sa.column('ativo', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )

    rows = []
    for (loja_id,) in lojas:
        for nome, conteudo in _TEMPLATES.items():
            rows.append({
                'id': uuid.uuid4().hex,
                'loja_id': loja_id,
                'nome': nome,
                'conteudo_html': conteudo,
                'campos_extras': None,
                'ativo': True,
                'created_at': now,
                'updated_at': now,
            })

    if rows:
        op.bulk_insert(template_table, rows)


def downgrade() -> None:
    conn = op.get_bind()
    nomes = tuple(_TEMPLATES.keys())
    conn.execute(
        sa.text("DELETE FROM template_contrato WHERE nome IN :nomes").bindparams(
            sa.bindparam('nomes', expanding=True)
        ),
        {"nomes": list(nomes)},
    )
