"""
Social Veículos — Rotas do Simulador de Crédito V2 — Tarefa 17
Protegido por paywall do Módulo SIMULADOR.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import Simulacao, SimulacaoResultado, Veiculo, ClientePF
from schemas import SimulacaoRequest, SimulacaoResponse
from modulos import exige_modulo, Modulo
from simulador.orquestrador import orquestrador_v2
from simulador.banks.base_motor import SimulationInput

router = APIRouter(prefix="/v1/simulador", tags=["Simulador de Crédito"])


@router.post(
    "",
    response_model=SimulacaoResponse,
    dependencies=[Depends(exige_modulo(Modulo.SIMULADOR))]
)
async def simular_credito(
    data: SimulacaoRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """
    Executa simulação de crédito V2 nos bancos solicitados.
    """
    if not data.bancos:
        raise HTTPException(status_code=400, detail="Selecione ao menos um banco.")

    # 1. Recuperar Veículo
    placa = "ABC1234"
    valor_veiculo = 50000.0
    ano_modelo = 2020
    marca = "GENERIC"
    modelo = "CAR"
    tipo = "carro"

    if data.veiculo_id:
        res_v = await db.execute(select(Veiculo).where(Veiculo.id == data.veiculo_id, Veiculo.loja_id == context.loja_id))
        veiculo = res_v.scalar_one_or_none()
        if veiculo:
            placa = veiculo.placa or placa
            valor_veiculo = veiculo.preco_venda or valor_veiculo
            ano_modelo = veiculo.ano_modelo or ano_modelo
            marca = veiculo.marca or marca
            modelo = veiculo.modelo or modelo
            tipo = veiculo.tipo or tipo

    if data.veiculo_dados:
        placa = data.veiculo_dados.get("placa", placa)
        valor_veiculo = data.veiculo_dados.get("valor_veiculo", valor_veiculo)
        ano_modelo = data.veiculo_dados.get("ano_modelo", ano_modelo)
        marca = data.veiculo_dados.get("marca", marca)
        modelo = data.veiculo_dados.get("modelo", modelo)

    # 2. Recuperar Cliente
    cpf = "00000000000"
    nome = "Cliente Sem Nome"
    nascimento = "01/01/1990"
    telefone = "11999999999"
    email = "cliente@example.com"

    if data.cliente_id:
        res_c = await db.execute(select(ClientePF).where(ClientePF.id == data.cliente_id, ClientePF.loja_id == context.loja_id))
        cliente = res_c.scalar_one_or_none()
        if cliente:
            cpf = cliente.cpf or cpf
            nome = cliente.nome or nome
            nascimento = cliente.data_nascimento.strftime("%d/%m/%Y") if cliente.data_nascimento else nascimento
            telefone = cliente.telefone or telefone
            email = cliente.email or email

    if data.cliente_dados:
        cpf = data.cliente_dados.get("cpf", cpf)
        nome = data.cliente_dados.get("nome", nome)
        nascimento = data.cliente_dados.get("nascimento", nascimento)
        telefone = data.cliente_dados.get("telefone", telefone)
        email = data.cliente_dados.get("email", email)

    input_data = SimulationInput(
        cpf=cpf,
        nome=nome,
        nascimento=nascimento,
        telefone=telefone,
        email=email,
        placa=placa,
        valor_veiculo=valor_veiculo,
        ano_modelo=ano_modelo,
        marca=marca,
        modelo=modelo,
        tipo_veiculo=tipo,
        entrada=data.entrada
    )

    # 3. Credenciais dos motores V2 (API REST: bv/pan) não vêm de CredencialBanco —
    # essa tabela é exclusiva das credenciais de login (usuário/senha) validadas via Selenium
    # na tela de Configurações > Credenciais Bancárias. Motores V2 seguem sem simulação até
    # ganharem fonte própria (env vars ou tabela dedicada); sem credenciais, retornam erro.
    credentials_map: dict = {}

    # 4. Criar registro de simulação
    simulacao = Simulacao(
        loja_id=context.loja_id,
        veiculo_id=data.veiculo_id,
        cliente_id=data.cliente_id,
        criado_por_id=context.usuario.id,
        entrada=data.entrada,
        prazo_desejado=data.prazo_desejado,
        status="pendente",
        lead_id=data.lead_id
    )
    db.add(simulacao)
    await db.flush()

    # 5. Executar V2 via Orquestrador
    results = await orquestrador_v2.executar_simulacao_paralela(
        bancos_solicitados=data.bancos,
        input_data=input_data,
        credentials_map=credentials_map
    )

    # 6. Salvar resultados
    # O motor V2 retorna status em inglês; o enum/DB usa português.
    _STATUS_MAP = {
        "approved": "aprovado",
        "denied": "negado",
        "error": "erro",
        "mock": "mock",
        "browser": "browser",
    }
    for code, out in results.items():
        sr = SimulacaoResultado(
            simulacao_id=simulacao.id,
            banco=code,
            status=_STATUS_MAP.get(out.status, "erro"),
            parcela=out.monthly_payment,
            taxa=out.interest_rate,
            total=out.total_amount,
            prazo=out.term_months,
            erro=out.error_message,
            tempo_ms=out.execution_time_ms,
            raw_response=json.dumps(out.raw_response) if out.raw_response else None
        )
        db.add(sr)
    
    simulacao.status = "concluida"
    await db.commit()

    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(Simulacao)
        .options(selectinload(Simulacao.resultados))
        .where(Simulacao.id == simulacao.id)
    )
    simulacao = res.scalar_one()

    return simulacao


@router.get(
    "/{id}",
    response_model=SimulacaoResponse,
    dependencies=[Depends(exige_modulo(Modulo.SIMULADOR))]
)
async def obter_simulacao(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(Simulacao)
        .options(selectinload(Simulacao.resultados))
        .where(Simulacao.id == id, Simulacao.loja_id == context.loja_id)
    )
    sim = res.scalar_one_or_none()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulação não encontrada.")
    return sim
