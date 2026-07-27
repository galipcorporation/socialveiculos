"""
Social Veículos — Modelos de contrato entregues prontos para a loja.

Fonte única dos modelos padrão. Consumido por:
  * `routers/admin.py` (semeia ao criar loja nova);
  * `seed.py` (ambiente de desenvolvimento);
  * migrations de seed (que importam `MODELOS_PADRAO` para backfill).

Os modelos são HTML do RichEditor (TipTap) e usam as variáveis resolvidas em
`routers/contratos.py::_render_template_contrato`. Nada de `[colchete]` em
branco: cada campo é uma variável do sistema, e o que a loja precisa decidir
caso a caso vira `campos_extras` (preenchidos na geração do contrato).
"""

import json
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


# ═══════════════════════════════════════════════════════════════
# ── CAMPOS EXTRAS (perguntados na hora de gerar o contrato)
# ═══════════════════════════════════════════════════════════════

_CAMPOS_COMPRA_PF = [
    {"chave": "forma_pagamento", "label": "Forma de pagamento", "tipo": "texto",
     "padrao": "à vista, via transferência bancária/PIX na conta indicada do VENDEDOR, "
               "na data de assinatura deste instrumento"},
    {"chave": "banco_vendedor", "label": "Banco do vendedor", "tipo": "texto"},
    {"chave": "agencia_vendedor", "label": "Agência", "tipo": "texto"},
    {"chave": "conta_vendedor", "label": "Conta", "tipo": "texto"},
    {"chave": "pix_vendedor", "label": "Chave PIX do vendedor", "tipo": "texto"},
    {"chave": "ressalvas_estado", "label": "Ressalvas sobre o estado do veículo", "tipo": "texto",
     "padrao": "nenhuma ressalva apontada pelas partes"},
    {"chave": "multa_percentual", "label": "Multa rescisória (%)", "tipo": "numero", "padrao": "10"},
    {"chave": "foro_comarca", "label": "Foro (comarca)", "tipo": "texto"},
]

_CAMPOS_VENDA_CDC = [
    {"chave": "entrada_forma", "label": "Forma de pagamento da entrada", "tipo": "texto",
     "padrao": "PIX / transferência bancária"},
    {"chave": "entrada_data", "label": "Data da entrada", "tipo": "data"},
    {"chave": "valor_troca", "label": "Valor do veículo na troca", "tipo": "numero",
     "padrao": "R$ 0,00"},
    {"chave": "veiculo_troca", "label": "Veículo recebido na troca", "tipo": "texto",
     "padrao": "não houve troca"},
    {"chave": "valor_financiado", "label": "Valor financiado", "tipo": "numero", "padrao": "R$ 0,00"},
    {"chave": "banco_financiamento", "label": "Banco / financeira", "tipo": "texto",
     "padrao": "não houve financiamento"},
    {"chave": "saldo_remanescente", "label": "Saldo remanescente", "tipo": "numero",
     "padrao": "R$ 0,00"},
    {"chave": "saldo_condicoes", "label": "Condições do saldo", "tipo": "texto",
     "padrao": "não há saldo remanescente"},
    {"chave": "garantia_dias", "label": "Prazo da garantia legal (dias)", "tipo": "numero",
     "padrao": "90"},
    {"chave": "garantia_estendida", "label": "Garantia estendida (cobertura)", "tipo": "texto",
     "padrao": "não contratada"},
    {"chave": "reparos_combinados", "label": "Reparos combinados na venda", "tipo": "texto",
     "padrao": "nenhum reparo combinado"},
    {"chave": "entrega_data", "label": "Data da entrega do veículo", "tipo": "data"},
    {"chave": "entrega_hora", "label": "Hora da entrega", "tipo": "texto"},
    {"chave": "multa_percentual", "label": "Multa rescisória (%)", "tipo": "numero", "padrao": "10"},
]


# ═══════════════════════════════════════════════════════════════
# ── MODELO 1 — COMPRA DE VEÍCULO DE PESSOA FÍSICA
# ═══════════════════════════════════════════════════════════════

_HTML_COMPRA_PF = """<h1>CONTRATO DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<p>Por este instrumento particular de compra e venda de veículo automotor usado, de um lado:</p>
<h2>COMPRADOR (LOJISTA)</h2>
<p><strong>Razão Social:</strong> {{loja.nome}}<br>
<strong>CNPJ:</strong> {{loja.cnpj}}<br>
<strong>Inscrição Estadual:</strong> {{loja.inscricao_estadual}}<br>
<strong>Endereço:</strong> {{loja.endereco}}, {{loja.cidade}} - {{loja.estado}}, CEP {{loja.cep}}<br>
<strong>Telefone / E-mail:</strong> {{loja.telefone}} / {{loja.email}}<br>
<strong>Neste ato representada por:</strong> {{loja.representante_nome}}, portador do CPF nº {{loja.representante_cpf}} e RG nº {{loja.representante_rg}}.</p>
<h2>VENDEDOR (PESSOA FÍSICA)</h2>
<p><strong>Nome Completo:</strong> {{cliente.nome}}<br>
<strong>Nacionalidade:</strong> {{cliente.nacionalidade}} | <strong>Estado Civil:</strong> {{cliente.estado_civil}} | <strong>Profissão:</strong> {{cliente.profissao}}<br>
<strong>CPF:</strong> {{cliente.cpf}} | <strong>RG:</strong> {{cliente.rg}}<br>
<strong>Endereço:</strong> {{cliente.endereco}}, {{cliente.cidade}} - {{cliente.estado}}<br>
<strong>Telefone / E-mail:</strong> {{cliente.telefone}} / {{cliente.email}}<br>
<strong>Dados Bancários para Pagamento:</strong> Banco {{banco_vendedor}}, Agência {{agencia_vendedor}}, Conta {{conta_vendedor}}, Chave PIX: {{pix_vendedor}}.</p>
<p>Têm entre si, justo e contratado, o presente <strong>Contrato de Compra de Veículo Usado</strong>, mediante as cláusulas e condições a seguir expostas:</p>
<h2>CLÁUSULA PRIMEIRA – DO OBJETO</h2>
<p>1.1. O <strong>VENDEDOR</strong> declara ser o legítimo proprietário e possuidor do veículo automotor usado abaixo discriminado, livre e desembaraçado de quaisquer ônus judiciais ou extrajudiciais:</p>
<p><strong>Marca/Modelo:</strong> {{veiculo.marca}} {{veiculo.modelo}} {{veiculo.versao}}<br>
<strong>Ano de Fabricação / Modelo:</strong> {{veiculo.ano_fabricacao}} / {{veiculo.ano_modelo}}<br>
<strong>Cor:</strong> {{veiculo.cor}}<br>
<strong>Placa:</strong> {{veiculo.placa}}<br>
<strong>Chassi:</strong> {{veiculo.chassi}}<br>
<strong>RENAVAM:</strong> {{veiculo.renavam}}<br>
<strong>Combustível:</strong> {{veiculo.combustivel}}<br>
<strong>Quilometragem Atual:</strong> {{veiculo.km}} km</p>
<h2>CLÁUSULA SEGUNDA – DO PREÇO E DA FORMA DE PAGAMENTO</h2>
<p>2.1. O valor total ajustado pela compra do veículo é de <strong>{{contrato.valor_venda}}</strong> ({{contrato.valor_venda_extenso}}), que o <strong>COMPRADOR</strong> pagará ao <strong>VENDEDOR</strong> da seguinte forma: {{forma_pagamento}}</p>
<p>2.2. O pagamento integral servirá como quitação definitiva e irrevogável do valor avençado após a devida compensação bancária.</p>
<h2>CLÁUSULA TERCEIRA – DAS DECLARAÇÕES E GARANTIAS DO VENDEDOR</h2>
<p>3.1. O <strong>VENDEDOR</strong> declara expressamente sob as penas da lei que:</p>
<p><strong>a)</strong> O veículo encontra-se livre e desembaraçado de quaisquer débitos referentes a IPVA, DPVAT, licenciamento, multas de trânsito ou encargos pendentes até a data do recebimento e posse pelo COMPRADOR.</p>
<p><strong>b)</strong> Não pesam sobre o veículo restrições judiciais (Renajud), administrativas, financeiras (gravame/alienação fiduciária), de penhora, busca e apreensão ou impedimentos de transferência.</p>
<p><strong>c)</strong> O veículo não é proveniente de leilão, salvados de seguradora, sinistro de perda total, e não possui remarcação de chassi ou adulteração de hodômetro, salvo se devidamente especificado na Cláusula Quinta.</p>
<p>3.2. Caso surjam multas de trânsito ou débitos anteriores à data de entrega do veículo, a responsabilidade financeira e de pontuação na CNH será exclusiva do <strong>VENDEDOR</strong>, autorizando-se o COMPRADOR a descontar os respectivos valores de pagamentos pendentes ou cobrar do VENDEDOR regressivamente.</p>
<h2>CLÁUSULA QUARTA – DA TRANSFERÊNCIA E DOCUMENTAÇÃO</h2>
<p>4.1. O <strong>VENDEDOR</strong> compromete-se a entregar ao <strong>COMPRADOR</strong>, no ato do pagamento:</p>
<p><strong>a)</strong> A Autorização para Transferência de Propriedade do Veículo (ATPV-e) ou CRV/DUT devidamente assinado, com firma reconhecida por autenticidade (ou assinatura digital pelo gov.br/SNE, quando aplicável).</p>
<p><strong>b)</strong> O comprovante de licenciamento atualizado (CRLV-e).</p>
<p><strong>c)</strong> Todas as chaves do veículo (principal e reserva) e manual do proprietário, caso existentes.</p>
<p>4.2. O <strong>VENDEDOR</strong> compromete-se a efetuar a Comunicação de Venda junto ao órgão executivo de trânsito (DETRAN) no prazo legal de 60 (sessenta) dias.</p>
<h2>CLÁUSULA QUINTA – DA VISTORIA, LAUDO CAUTELAR E ESTADO DO VEÍCULO</h2>
<p>5.1. A efetivação da compra fica condicionada à aprovação do veículo em exame de <strong>Vistoria Cautelar / Laudo Estrutural</strong> realizado por empresa credenciada de vistoria (ECV) contratada pelo COMPRADOR.</p>
<p>5.2. O COMPRADOR declara ter vistoriado o veículo e ter conhecimento de seu estado de conservação mecânica, estética e estrutural.</p>
<p>5.3. Ressalvas e observações sobre o estado do veículo: {{ressalvas_estado}}</p>
<h2>CLÁUSULA SEXTA – DA MULTA E RESCISÃO</h2>
<p>6.1. O descumprimento de qualquer uma das cláusulas pactuadas neste contrato ensejará a rescisão de pleno direito, ficando a parte infratora sujeita ao pagamento de multa penal compensatória equivalente a <strong>{{multa_percentual}}%</strong> sobre o valor total do contrato, além de perdas e danos comprovados.</p>
<h2>CLÁUSULA SÉTIMA – DO FORO</h2>
<p>7.1. Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o Foro da Comarca de <strong>{{foro_comarca or loja.cidade ~ ' - ' ~ loja.estado}}</strong>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
<p>E, por estarem assim justos e contratados, assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas.</p>
<p>{{loja.cidade}} - {{loja.estado}}, {{contrato.data_extenso}}.</p>
<p>________________________________________________________<br>
<strong>{{loja.nome}}</strong><br>
COMPRADOR (LOJISTA)</p>
<p>________________________________________________________<br>
<strong>{{cliente.nome}}</strong><br>
VENDEDOR (PESSOA FÍSICA)</p>
<p><strong>TESTEMUNHAS:</strong></p>
<p>1. ______________________________________ &nbsp; Nome: &nbsp; CPF:</p>
<p>2. ______________________________________ &nbsp; Nome: &nbsp; CPF:</p>"""


# ═══════════════════════════════════════════════════════════════
# ── MODELO 2 — VENDA PARA CONSUMIDOR FINAL (CDC)
# ═══════════════════════════════════════════════════════════════

_HTML_VENDA_CDC = """<h1>CONTRATO DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR COM GARANTIA LEGAL</h1>
<p>Nº {{contrato.numero}} — {{contrato.data}}</p>
<p>Por este instrumento particular, de um lado:</p>
<h2>VENDEDOR (LOJISTA)</h2>
<p><strong>Razão Social:</strong> {{loja.nome}}<br>
<strong>CNPJ:</strong> {{loja.cnpj}}<br>
<strong>Inscrição Estadual:</strong> {{loja.inscricao_estadual}}<br>
<strong>Endereço:</strong> {{loja.endereco}}, {{loja.cidade}} - {{loja.estado}}, CEP {{loja.cep}}<br>
<strong>Telefone / E-mail:</strong> {{loja.telefone}} / {{loja.email}}</p>
<h2>COMPRADOR (CONSUMIDOR FINAL)</h2>
<p><strong>Nome Completo:</strong> {{cliente.nome}}<br>
<strong>Nacionalidade:</strong> {{cliente.nacionalidade}} | <strong>Estado Civil:</strong> {{cliente.estado_civil}} | <strong>Profissão:</strong> {{cliente.profissao}}<br>
<strong>CPF:</strong> {{cliente.cpf}} | <strong>RG:</strong> {{cliente.rg}}<br>
<strong>Endereço:</strong> {{cliente.endereco}}, {{cliente.cidade}} - {{cliente.estado}}<br>
<strong>Telefone / E-mail:</strong> {{cliente.telefone}} / {{cliente.email}}<br>
<strong>Nº CNH e Categoria:</strong> {{cliente.cnh}} - Cat. {{cliente.cnh_categoria}}</p>
<p>Têm entre si justo e acordado o presente <strong>Contrato de Venda de Veículo Usado com Garantia Legal</strong>, regido pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pelo Código de Trânsito Brasileiro (Lei nº 9.503/1997), mediante as cláusulas a seguir:</p>
<h2>CLÁUSULA PRIMEIRA – DO VEÍCULO OBJETO DA VENDA</h2>
<p>1.1. O <strong>VENDEDOR</strong> vende ao <strong>COMPRADOR</strong> o seguinte veículo automotor seminovo/usado de sua propriedade/estoque:</p>
<p><strong>Marca/Modelo:</strong> {{veiculo.marca}} {{veiculo.modelo}} {{veiculo.versao}}<br>
<strong>Ano de Fabricação / Modelo:</strong> {{veiculo.ano_fabricacao}} / {{veiculo.ano_modelo}}<br>
<strong>Cor:</strong> {{veiculo.cor}}<br>
<strong>Placa:</strong> {{veiculo.placa}}<br>
<strong>Chassi:</strong> {{veiculo.chassi}}<br>
<strong>RENAVAM:</strong> {{veiculo.renavam}}<br>
<strong>Quilometragem de Entrega:</strong> {{veiculo.km}} km</p>
<h2>CLÁUSULA SEGUNDA – DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO</h2>
<p>2.1. O preço ajustado para a compra do veículo é de <strong>{{contrato.valor_venda}}</strong> ({{contrato.valor_venda_extenso}}), composto pelas seguintes modalidades de pagamento:</p>
<p><strong>a) Sinal / Entrada:</strong> {{contrato.valor_entrada}} via {{entrada_forma}} pago em {{entrada_data or contrato.data}}.</p>
<p><strong>b) Veículo Usado na Troca (se houver):</strong> {{valor_troca}}, referente ao veículo {{veiculo_troca}}, aceito conforme avaliação técnica prévia.</p>
<p><strong>c) Financiamento Bancário:</strong> {{valor_financiado}}, a ser quitado mediante operação de crédito financiada junto à instituição financeira {{banco_financiamento}}, sujeita à aprovação de crédito, em {{contrato.parcelas}} parcelas.</p>
<p><strong>d) Saldo Remanescente:</strong> {{saldo_remanescente}}, a ser pago conforme: {{saldo_condicoes}}</p>
<p>2.2. A entrega das chaves e posse do veículo fica condicionada à aprovação/liberação efetiva dos recursos e compensação integral dos valores estipulados acima.</p>
<h2>CLÁUSULA TERCEIRA – DA GARANTIA LEGAL E DAS CONDIÇÕES DO VEÍCULO</h2>
<p>3.1. <strong>Garantia Legal (Art. 26 do CDC):</strong> O <strong>VENDEDOR</strong> concede ao <strong>COMPRADOR</strong> a garantia legal pelo prazo de <strong>{{garantia_dias}} dias</strong>, a contar da data da entrega efetiva do veículo, cobrindo defeitos e vícios ocultos referentes aos componentes essenciais do grupo motopropulsor (<strong>Motor e Câmbio</strong>).</p>
<p>3.2. <strong>Garantia Estendida (se contratada):</strong> {{garantia_estendida}}</p>
<p>3.3. <strong>Exclusões de Garantia:</strong> Não estão cobertos pela garantia:</p>
<p><strong>a)</strong> Itens de desgaste natural decorrentes de uso normal, tais como: pneus, pastilhas/discos de freio, palhetas, lâmpadas, amortecedores, embreagem, correias, alinhamento/balanceamento, fluidos e óleos.</p>
<p><strong>b)</strong> Danos causados por mau uso, sinistros, enchentes, imperícia do condutor, modificações mecânicas/estéticas não autorizadas ou falta de manutenção preventiva recomendada pelo fabricante.</p>
<p><strong>c)</strong> Reparos executados em oficinas não credenciadas/autorizadas expressamente pelo VENDEDOR durante o período de garantia legal.</p>
<p>3.4. <strong>Termo de Vistoria e Ciência do Estado do Veículo:</strong> O COMPRADOR declara ter efetuado o <em>test-drive</em>, inspecionado o veículo e aceito o estado de conservação em que o mesmo se encontra. Reparos combinados no ato da venda: {{reparos_combinados}}</p>
<h2>CLÁUSULA QUARTA – DA TRANSFERÊNCIA DE PROPRIEDADE E PRAZOS</h2>
<p>4.1. Conforme estabelece o Art. 123 do Código de Trânsito Brasileiro (CTB), o <strong>COMPRADOR</strong> assume a obrigação e o compromisso formal de efetuar a transferência da propriedade do veículo para o seu nome perante o DETRAN no prazo máximo e improrrogável de <strong>30 (trinta) dias</strong> a contar da data de emissão do documento de transferência (ATPV-e).</p>
<p>4.2. O COMPRADOR é o único responsável pelo pagamento das taxas estaduais de transferência, emissão de novo CRV/CRLV-e, vistoria de transferência e confecção de placas no padrão Mercosul (se necessário).</p>
<p>4.3. Decorrido o prazo de 30 dias sem que o COMPRADOR tenha finalizado a transferência, o VENDEDOR fica autorizado a requerer o bloqueio administrativo do veículo junto ao DETRAN, cobrando do COMPRADOR os custos administrativos incorridos.</p>
<h2>CLÁUSULA QUINTA – DAS INFRAÇÕES DE TRÂNSITO E RESPONSABILIDADE CIVIL</h2>
<p>5.1. A partir do momento da entrega e posse do veículo (<strong>Data: {{entrega_data or contrato.data}} às {{entrega_hora or '__:__'}} horas</strong>), o <strong>COMPRADOR</strong> assume total e irrestrita responsabilidade civil, criminal e administrativa sobre o uso do veículo.</p>
<p>5.2. Todas as infrações de trânsito, multas, pontuações na CNH e encargos gerados a partir da data e horário estipulados no item 5.1 serão de inteira responsabilidade do <strong>COMPRADOR</strong>, devendo este indicar o real condutor ou ressarcir imediatamente o VENDEDOR caso a notificação seja emitida em nome da loja.</p>
<h2>CLÁUSULA SEXTA – DA RESCISÃO E CLÁUSULA PENAL</h2>
<p>6.1. Caso o COMPRADOR desista da compra por motivos alheios à responsabilidade da loja após a assinatura deste contrato e reserva do veículo, ou na hipótese de inadimplemento do financiamento, incidirá multa rescisória de <strong>{{multa_percentual}}%</strong> sobre o valor total do negócio a título de perdas, danos e retenção de custos operacionais.</p>
<h2>CLÁUSULA SÉTIMA – DO FORO</h2>
<p>7.1. Para dirimir quaisquer controvérsias decorrentes deste contrato, fica eleito o Foro da Comarca do domicílio do <strong>COMPRADOR</strong>, nos termos do Art. 101, I, do Código de Defesa do Consumidor.</p>
<p>E por estarem em perfeito acordo, as partes assinam o presente contrato em 02 (duas) vias de igual teor e forma.</p>
<p>{{loja.cidade}} - {{loja.estado}}, {{contrato.data_extenso}}.</p>
<p>________________________________________________________<br>
<strong>{{loja.nome}}</strong><br>
VENDEDOR (LOJISTA)</p>
<p>________________________________________________________<br>
<strong>{{cliente.nome}}</strong><br>
COMPRADOR (CONSUMIDOR)</p>
<p><strong>TESTEMUNHAS:</strong></p>
<p>1. ______________________________________ &nbsp; Nome: &nbsp; CPF:</p>
<p>2. ______________________________________ &nbsp; Nome: &nbsp; CPF:</p>"""


# Nome → (html, campos_extras). Os nomes são a chave de idempotência do seed.
MODELOS_PADRAO: dict[str, tuple[str, list[dict]]] = {
    "Compra de Veículo — Pessoa Física (padrão)": (_HTML_COMPRA_PF, _CAMPOS_COMPRA_PF),
    "Venda ao Consumidor — CDC (padrão)": (_HTML_VENDA_CDC, _CAMPOS_VENDA_CDC),
}


async def semear_modelos_padrao(db: AsyncSession, loja_id: str) -> int:
    """Cria os modelos padrão que a loja ainda não tem. Retorna quantos criou.

    Idempotente pelo nome do modelo: rodar duas vezes não duplica. Não faz
    commit — quem chama controla a transação.
    """
    from models import TemplateContrato  # import local: evita ciclo com models

    existentes = await db.execute(
        select(TemplateContrato.nome).where(TemplateContrato.loja_id == loja_id)
    )
    ja_tem = set(existentes.scalars().all())

    criados = 0
    for nome, (html, campos) in MODELOS_PADRAO.items():
        if nome in ja_tem:
            continue
        db.add(TemplateContrato(
            loja_id=loja_id,
            nome=nome,
            conteudo_html=html,
            campos_extras=json.dumps(campos),
            ativo=True,
        ))
        criados += 1
    return criados


def html_do_modelo(nome: str) -> Optional[str]:
    """HTML de um modelo padrão pelo nome, ou None se não existir."""
    item = MODELOS_PADRAO.get(nome)
    return item[0] if item else None
