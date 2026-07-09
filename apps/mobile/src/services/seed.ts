// Seed de demonstração — dados fake realistas (mercado BR).
// Datas relativas a "agora" para o app parecer sempre vivo.

import type {
  Cliente, ConfiguracaoFiscal, Conversa, CredencialBanco, CredencialDetran, CredencialIA,
  Esteira, Interacao, Lancamento, Lead, Membro, Mensagem, Notificacao, PerfilLoja,
  RedeSocialStatus, Veiculo,
} from './types'

export const LOJA_ID = 'loja-demo-001'
export const LOJA_NOME = 'Auto Premium Veículos'

const now = Date.now()
const diasAtras = (d: number, horaOffsetMin = 0) =>
  new Date(now - d * 86_400_000 - horaOffsetMin * 60_000).toISOString()
const minAtras = (m: number) => new Date(now - m * 60_000).toISOString()

let seq = 0
const id = (prefix: string) => `${prefix}-${String(++seq).padStart(3, '0')}`

// ── Veículos ───────────────────────────────────────────────
interface VSeed {
  marca: string; modelo: string; versao?: string; ano: number; anoFab?: number
  km: number; cor: string; cambio?: string; comb?: string; portas?: number
  preco: number; custo: number; status: Veiculo['status']; placa?: string
  tipo?: Veiculo['tipo']; publicado?: boolean; opcionais?: string; desc?: string
  dias: number
}

const veiculosSeed: VSeed[] = [
  { marca: 'Toyota', modelo: 'Corolla Cross', versao: 'XRE 2.0 Flex', ano: 2023, km: 28500, cor: 'Branco Polar', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 152900, custo: 138000, status: 'disponivel', placa: 'RVB2C34', publicado: true, opcionais: 'Central multimídia 9", ACC, teto solar, rodas 18"', desc: 'Único dono, revisões na concessionária, laudo cautelar aprovado.', dias: 12 },
  { marca: 'Honda', modelo: 'Civic', versao: 'Touring 1.5 Turbo', ano: 2022, km: 41200, cor: 'Cinza Grafite', cambio: 'Automático CVT', comb: 'Gasolina', portas: 4, preco: 146500, custo: 131000, status: 'disponivel', placa: 'QXM8D12', publicado: true, opcionais: 'Honda Sensing, bancos em couro, sunroof', dias: 20 },
  { marca: 'Jeep', modelo: 'Compass', versao: 'Longitude T270', ano: 2023, km: 22100, cor: 'Preto Carbon', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 139900, custo: 124500, status: 'reservado', placa: 'RTA5F67', publicado: true, opcionais: 'Pacote Adventure, central 10", câmera 360°', dias: 8 },
  { marca: 'Volkswagen', modelo: 'T-Cross', versao: 'Highline 1.4 TSI', ano: 2022, km: 35400, cor: 'Azul Norway', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 118900, custo: 105000, status: 'disponivel', placa: 'RKP3G89', publicado: true, dias: 30 },
  { marca: 'Hyundai', modelo: 'Creta', versao: 'Ultimate 2.0', ano: 2023, km: 18900, cor: 'Prata Sand', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 132500, custo: 119000, status: 'disponivel', placa: 'SBC7H21', publicado: false, opcionais: 'Teto panorâmico, ADAS completo', dias: 5 },
  { marca: 'Chevrolet', modelo: 'Onix', versao: 'Premier 1.0 Turbo', ano: 2022, km: 44800, cor: 'Vermelho Chili', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 82900, custo: 72500, status: 'disponivel', placa: 'QPU4J55', publicado: true, dias: 45 },
  { marca: 'Fiat', modelo: 'Toro', versao: 'Volcano 2.0 Diesel 4x4', ano: 2021, km: 68300, cor: 'Cinza Silverstone', cambio: 'Automático 9M', comb: 'Diesel', portas: 4, preco: 129900, custo: 115000, status: 'disponivel', placa: 'RFD9K10', publicado: true, opcionais: 'Capota marítima, santo antônio, multimídia', dias: 60 },
  { marca: 'Fiat', modelo: 'Argo', versao: 'Drive 1.3', ano: 2023, km: 15200, cor: 'Branco Banchisa', cambio: 'Manual', comb: 'Flex', portas: 4, preco: 74900, custo: 66000, status: 'disponivel', placa: 'SDE2L33', publicado: true, dias: 15 },
  { marca: 'Hyundai', modelo: 'HB20', versao: 'Comfort Plus 1.0 TGDI', ano: 2022, km: 39500, cor: 'Prata Metal', cambio: 'Manual', comb: 'Flex', portas: 4, preco: 69900, custo: 61000, status: 'vendido', placa: 'QWE6M78', publicado: false, dias: 90 },
  { marca: 'Volkswagen', modelo: 'Polo', versao: 'TSI 1.0 128cv', ano: 2023, km: 21700, cor: 'Cinza Platinum', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 89900, custo: 79500, status: 'disponivel', placa: 'RRG1N90', publicado: true, dias: 25 },
  { marca: 'Toyota', modelo: 'Hilux', versao: 'SRX 2.8 Diesel 4x4', ano: 2022, km: 55600, cor: 'Branco Perolizado', cambio: 'Automático 6M', comb: 'Diesel', portas: 4, preco: 239900, custo: 215000, status: 'reservado', placa: 'RHT8P44', publicado: true, opcionais: 'Kit multimídia premium, protetor de caçamba', dias: 18 },
  { marca: 'Renault', modelo: 'Kwid', versao: 'Zen 1.0', ano: 2023, km: 12400, cor: 'Laranja Ocre', cambio: 'Manual', comb: 'Flex', portas: 4, preco: 58900, custo: 51500, status: 'disponivel', placa: 'SFJ4Q12', publicado: true, dias: 10 },
  { marca: 'Nissan', modelo: 'Kicks', versao: 'Exclusive 1.6 CVT', ano: 2022, km: 33800, cor: 'Cinza Grafite', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 104900, custo: 92000, status: 'disponivel', placa: 'QZK7R56', publicado: false, dias: 38 },
  { marca: 'BMW', modelo: '320i', versao: 'M Sport 2.0 Turbo', ano: 2021, km: 47900, cor: 'Azul Portimao', cambio: 'Automático 8M', comb: 'Gasolina', portas: 4, preco: 219900, custo: 196000, status: 'disponivel', placa: 'RBM3S21', publicado: true, opcionais: 'Head-up display, teto solar, som Harman Kardon', desc: 'Blindado nível III-A, laudo e manutenção em dia.', dias: 50 },
  { marca: 'Honda', modelo: 'HR-V', versao: 'EXL 1.5', ano: 2023, km: 19800, cor: 'Preto Cristal', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 142900, custo: 128500, status: 'vendido', placa: 'SGN9T87', publicado: false, dias: 75 },
  { marca: 'Honda', modelo: 'CB 500F', ano: 2022, km: 14300, cor: 'Vermelho', comb: 'Gasolina', preco: 38900, custo: 33500, status: 'disponivel', placa: 'RMT2U65', tipo: 'moto', publicado: true, dias: 22 },
  { marca: 'Yamaha', modelo: 'MT-03', ano: 2023, km: 8900, cor: 'Azul Racing', comb: 'Gasolina', preco: 31500, custo: 27000, status: 'disponivel', placa: 'SHY5V43', tipo: 'moto', publicado: true, dias: 14 },
  { marca: 'Fiat', modelo: 'Mobi', versao: 'Like 1.0', ano: 2022, km: 28700, cor: 'Branco', cambio: 'Manual', comb: 'Flex', portas: 4, preco: 52900, custo: 46000, status: 'repasse', placa: 'QCV8W99', publicado: false, dias: 55 },
  { marca: 'Chevrolet', modelo: 'Tracker', versao: 'Premier 1.2 Turbo', ano: 2023, km: 16500, cor: 'Vermelho Carmim', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 127900, custo: 114000, status: 'disponivel', placa: 'SJP1X28', publicado: true, dias: 7 },
  { marca: 'Ford', modelo: 'Ranger', versao: 'Limited 3.0 V6 Diesel', ano: 2024, km: 9800, cor: 'Cinza Moscou', cambio: 'Automático 10M', comb: 'Diesel', portas: 4, preco: 289900, custo: 262000, status: 'disponivel', placa: 'SKQ6Y14', publicado: true, opcionais: 'Pacote tecnológico, som B&O', dias: 3 },
  { marca: 'Peugeot', modelo: '208', versao: 'Griffe 1.0 Turbo', ano: 2023, km: 17600, cor: 'Branco Nacré', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 86900, custo: 76500, status: 'inativo', placa: 'SLR3Z67', publicado: false, dias: 40 },
  { marca: 'Volkswagen', modelo: 'Nivus', versao: 'Highline 1.0 TSI', ano: 2022, km: 31200, cor: 'Cinza Platinum', cambio: 'Automático 6M', comb: 'Flex', portas: 4, preco: 109900, custo: 97000, status: 'vendido', placa: 'RNV7A31', publicado: false, dias: 100 },
]

export function buildVeiculos(): Veiculo[] {
  return veiculosSeed.map((v) => {
    const vid = id('vei')
    return {
      id: vid,
      loja_id: LOJA_ID,
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao,
      ano_fabricacao: v.anoFab ?? v.ano - (v.km > 20000 ? 1 : 0),
      ano_modelo: v.ano,
      km: v.km,
      cor: v.cor,
      cambio: v.cambio,
      combustivel: v.comb,
      tipo: v.tipo ?? 'carro',
      portas: v.portas,
      preco_venda: v.preco,
      preco_custo: v.custo,
      status: v.status,
      publicado_marketplace: v.publicado ?? false,
      publicar_rede_social: v.publicado ?? false,
      descricao: v.desc,
      opcionais: v.opcionais,
      created_at: diasAtras(v.dias),
      updated_at: diasAtras(Math.max(0, v.dias - 2)),
      midias: [],
    }
  })
}

// ── Clientes + Leads ───────────────────────────────────────
const clientesSeed = [
  { nome: 'Marcos Andrade', tel: '51999812345', email: 'marcos.andrade@gmail.com', cidade: 'Porto Alegre' },
  { nome: 'Juliana Ferreira', tel: '51998234567', email: 'ju.ferreira@hotmail.com', cidade: 'Canoas' },
  { nome: 'Carlos Eduardo Souza', tel: '51997456789', email: 'cadu.souza@gmail.com', cidade: 'Porto Alegre' },
  { nome: 'Patrícia Lima', tel: '51996678901', email: 'patricia.lima@outlook.com', cidade: 'Gravataí' },
  { nome: 'Roberto Nascimento', tel: '51995890123', cidade: 'Viamão' },
  { nome: 'Fernanda Costa', tel: '51994012345', email: 'fe.costa@gmail.com', cidade: 'Porto Alegre' },
  { nome: 'André Oliveira', tel: '51993234567', cidade: 'Alvorada' },
  { nome: 'Camila Rodrigues', tel: '51992456789', email: 'camila.rdgs@gmail.com', cidade: 'Cachoeirinha' },
  { nome: 'Luiz Henrique Ramos', tel: '51991678901', cidade: 'Porto Alegre' },
  { nome: 'Beatriz Santana', tel: '51990890123', email: 'bia.santana@yahoo.com', cidade: 'São Leopoldo' },
  { nome: 'Eduardo Martins', tel: '51989012345', cidade: 'Novo Hamburgo' },
  { nome: 'Vanessa Pereira', tel: '51988234567', email: 'van.pereira@gmail.com', cidade: 'Porto Alegre' },
]

export function buildClientes(): Cliente[] {
  return clientesSeed.map((c, i) => ({
    id: id('cli'),
    loja_id: LOJA_ID,
    nome: c.nome,
    telefone: c.tel,
    email: c.email,
    cidade: c.cidade,
    created_at: diasAtras(60 - i * 4),
  }))
}

interface LeadSeed {
  cliente: number; veiculo?: number; etapa: Lead['etapa']; origem: Lead['origem']
  proposta?: number; obs?: string; dias: number
  interacoes?: { tipo: Interacao['tipo']; texto: string; diasAtras: number }[]
}

const leadsSeed: LeadSeed[] = [
  { cliente: 0, veiculo: 0, etapa: 'negociacao', origem: 'vitrine', proposta: 148000, obs: 'Quer incluir Onix 2019 na troca.', dias: 6, interacoes: [
    { tipo: 'sistema', texto: 'Lead criado a partir da vitrine', diasAtras: 6 },
    { tipo: 'whatsapp', texto: 'Cliente perguntou sobre revisões e aceitação de troca.', diasAtras: 5 },
    { tipo: 'proposta', texto: 'Proposta enviada: R$ 148.000 com troca avaliada em R$ 52.000.', diasAtras: 3 },
    { tipo: 'ligacao', texto: 'Ligação de follow-up — vai decidir até sexta.', diasAtras: 1 },
  ]},
  { cliente: 1, veiculo: 2, etapa: 'fechamento', origem: 'whatsapp', proposta: 137500, obs: 'Financiamento aprovado pelo BV.', dias: 10, interacoes: [
    { tipo: 'whatsapp', texto: 'Primeiro contato pelo WhatsApp da loja.', diasAtras: 10 },
    { tipo: 'visita', texto: 'Test drive realizado, gostou muito do carro.', diasAtras: 7 },
    { tipo: 'proposta', texto: 'Financiamento 48x aprovado, entrada de R$ 40.000.', diasAtras: 2 },
  ]},
  { cliente: 2, veiculo: 13, etapa: 'proposta', origem: 'simulador', proposta: 210000, dias: 4, interacoes: [
    { tipo: 'sistema', texto: 'Simulação de financiamento realizada no site.', diasAtras: 4 },
    { tipo: 'proposta', texto: 'Enviada proposta com parcela de R$ 3.890 em 60x.', diasAtras: 2 },
  ]},
  { cliente: 3, veiculo: 4, etapa: 'lead', origem: 'vitrine', dias: 1, interacoes: [
    { tipo: 'sistema', texto: 'Lead criado a partir da vitrine', diasAtras: 1 },
  ]},
  { cliente: 4, veiculo: 6, etapa: 'lead', origem: 'whatsapp', dias: 0, interacoes: [
    { tipo: 'whatsapp', texto: 'Perguntou se a Toro aceita troca por Strada 2020.', diasAtras: 0 },
  ]},
  { cliente: 5, veiculo: 10, etapa: 'negociacao', origem: 'manual', proposta: 232000, obs: 'Cliente antigo da loja, 3º carro comprado aqui.', dias: 9, interacoes: [
    { tipo: 'nota', texto: 'Cliente indicado pelo Sr. Marcos, atendimento prioritário.', diasAtras: 9 },
    { tipo: 'visita', texto: 'Veio ver a Hilux, negociando valor da troca.', diasAtras: 4 },
  ]},
  { cliente: 6, veiculo: 5, etapa: 'proposta', origem: 'vitrine', proposta: 79900, dias: 3, interacoes: [
    { tipo: 'proposta', texto: 'Proposta à vista com 3% de desconto.', diasAtras: 1 },
  ]},
  { cliente: 7, veiculo: 16, etapa: 'lead', origem: 'vitrine', dias: 2, interacoes: [
    { tipo: 'sistema', texto: 'Lead criado a partir da vitrine', diasAtras: 2 },
  ]},
  { cliente: 8, veiculo: 8, etapa: 'fechamento', origem: 'manual', proposta: 68500, obs: 'Fechado! Aguardando pagamento do sinal.', dias: 15, interacoes: [
    { tipo: 'visita', texto: 'Fechou negócio no valor de R$ 68.500.', diasAtras: 3 },
  ]},
  { cliente: 9, veiculo: 12, etapa: 'perdido', origem: 'simulador', obs: 'Comprou em outra loja — preço.', dias: 20, interacoes: [
    { tipo: 'nota', texto: 'Cliente informou que encontrou Kicks mais barato em Canoas.', diasAtras: 8 },
  ]},
  { cliente: 10, veiculo: 18, etapa: 'proposta', origem: 'whatsapp', proposta: 124900, dias: 5, interacoes: [
    { tipo: 'whatsapp', texto: 'Interessado no Tracker, pediu fotos adicionais.', diasAtras: 5 },
    { tipo: 'proposta', texto: 'Proposta enviada por WhatsApp.', diasAtras: 2 },
  ]},
  { cliente: 11, etapa: 'lead', origem: 'manual', obs: 'Procura SUV automático até R$ 120 mil.', dias: 1, interacoes: [
    { tipo: 'nota', texto: 'Sem veículo específico — apresentar T-Cross e Kicks.', diasAtras: 1 },
  ]},
]

export function buildLeads(clientes: Cliente[], veiculos: Veiculo[]): Lead[] {
  return leadsSeed.map((l) => {
    const lid = id('lead')
    const interacoes: Interacao[] = (l.interacoes ?? []).map((i) => ({
      id: id('int'),
      lead_id: lid,
      tipo: i.tipo,
      texto: i.texto,
      autor: i.tipo === 'sistema' ? undefined : 'Você',
      created_at: diasAtras(i.diasAtras, Math.floor(Math.random() * 300)),
    }))
    return {
      id: lid,
      loja_id: LOJA_ID,
      cliente_id: clientes[l.cliente].id,
      veiculo_id: l.veiculo != null ? veiculos[l.veiculo].id : undefined,
      etapa: l.etapa,
      origem: l.origem,
      valor_proposta: l.proposta,
      observacoes: l.obs,
      interacoes,
      created_at: diasAtras(l.dias, 120),
      updated_at: diasAtras(Math.max(0, l.dias - 1)),
    }
  })
}

// ── Chat ───────────────────────────────────────────────────
export function buildConversas(): { conversas: Conversa[]; mensagens: Mensagem[] } {
  const defs = [
    {
      nome: 'Marcos Andrade', tel: '51999812345', veiculo: 'Toyota Corolla Cross XRE', canal: 'whatsapp' as const, naoLidas: 2,
      msgs: [
        { autor: 'cliente' as const, texto: 'Boa tarde! O Corolla Cross ainda está disponível?', min: 260 },
        { autor: 'loja' as const, texto: 'Boa tarde, Marcos! Está sim, quer agendar uma visita?', min: 250 },
        { autor: 'cliente' as const, texto: 'Quero sim. Vocês aceitam meu Onix 2019 na troca?', min: 240 },
        { autor: 'loja' as const, texto: 'Aceitamos! Traz ele junto que fazemos a avaliação na hora.', min: 235 },
        { autor: 'cliente' as const, texto: 'Perfeito. Posso ir amanhã às 10h?', min: 30 },
        { autor: 'cliente' as const, texto: 'Ah, e o carro tem laudo cautelar?', min: 28 },
      ],
    },
    {
      nome: 'Juliana Ferreira', tel: '51998234567', veiculo: 'Jeep Compass Longitude', canal: 'whatsapp' as const, naoLidas: 0,
      msgs: [
        { autor: 'cliente' as const, texto: 'Oi! O financiamento foi aprovado?', min: 1500 },
        { autor: 'loja' as const, texto: 'Oi Juliana! Aprovado sim 🎉 Entrada de R$ 40 mil e 48x de R$ 2.590.', min: 1480 },
        { autor: 'cliente' as const, texto: 'Que ótimo!! Quando posso assinar?', min: 1470 },
        { autor: 'loja' as const, texto: 'Podemos agendar para quinta às 14h, o contrato já estará pronto.', min: 1460 },
        { autor: 'cliente' as const, texto: 'Fechado! Até quinta 😊', min: 1450 },
      ],
    },
    {
      nome: 'Camila Rodrigues', tel: '51992456789', veiculo: 'Honda CB 500F', canal: 'chat' as const, naoLidas: 1,
      msgs: [
        { autor: 'cliente' as const, texto: 'Olá, vi a CB 500F na vitrine de vocês. Ela é a versão com ABS?', min: 90 },
        { autor: 'loja' as const, texto: 'Olá Camila! Sim, ABS de série nas duas rodas.', min: 75 },
        { autor: 'cliente' as const, texto: 'Vocês fazem entrega para Cachoeirinha?', min: 12 },
      ],
    },
    {
      nome: 'Roberto Nascimento', tel: '51995890123', veiculo: 'Fiat Toro Volcano', canal: 'whatsapp' as const, naoLidas: 0,
      msgs: [
        { autor: 'cliente' as const, texto: 'A Toro aceita troca por uma Strada 2020?', min: 2900 },
        { autor: 'loja' as const, texto: 'Aceita sim, Roberto! Qual a versão e km da sua Strada?', min: 2880 },
        { autor: 'cliente' as const, texto: 'Freedom 1.3, 45 mil km. Mando fotos à noite.', min: 2870 },
      ],
    },
    {
      nome: 'Beatriz Santana', tel: '51990890123', veiculo: 'Nissan Kicks Exclusive', canal: 'chat' as const, naoLidas: 0,
      msgs: [
        { autor: 'cliente' as const, texto: 'Qual o melhor preço à vista no Kicks?', min: 12000 },
        { autor: 'loja' as const, texto: 'Consigo fazer R$ 101.900 à vista, Beatriz.', min: 11950 },
        { autor: 'cliente' as const, texto: 'Obrigada, vou pensar!', min: 11900 },
      ],
    },
  ]

  const conversas: Conversa[] = []
  const mensagens: Mensagem[] = []
  for (const d of defs) {
    const cid = id('conv')
    d.msgs.forEach((m, i) => {
      mensagens.push({
        id: id('msg'),
        conversa_id: cid,
        autor: m.autor,
        texto: m.texto,
        created_at: minAtras(m.min),
        lida: i < d.msgs.length - d.naoLidas,
      })
    })
    const ultima = d.msgs[d.msgs.length - 1]
    conversas.push({
      id: cid,
      tipo: 'cliente',
      cliente_nome: d.nome,
      cliente_telefone: d.tel,
      veiculo_interesse: d.veiculo,
      canal: d.canal,
      ultima_mensagem: ultima.texto,
      ultima_mensagem_em: minAtras(ultima.min),
      nao_lidas: d.naoLidas,
    })
  }
  return { conversas, mensagens }
}

// ── Chat B2B (parceiros / repasses) — M049 ─────────────────
export function buildConversasB2B(): { conversas: Conversa[]; mensagens: Mensagem[] } {
  const defs = [
    {
      loja: 'Garagem RS Motors', contato: 'Fábio (Garagem RS)', veiculo: 'Repasse — VW Nivus Highline', naoLidas: 1,
      msgs: [
        { autor: 'cliente' as const, texto: 'E aí! Tenho interesse no Nivus que você anunciou no feed de repasses.', min: 180 },
        { autor: 'loja' as const, texto: 'Opa Fábio! Está R$ 97 mil no repasse. Quer o laudo?', min: 170 },
        { autor: 'cliente' as const, texto: 'Manda sim. Consigo buscar aí em POA na sexta.', min: 20 },
      ],
    },
    {
      loja: 'AutoCenter Canoas', contato: 'Renata (AutoCenter)', veiculo: 'Repasse — Fiat Mobi Like', naoLidas: 0,
      msgs: [
        { autor: 'loja' as const, texto: 'Renata, fechou o Mobi? Posso segurar até amanhã.', min: 1400 },
        { autor: 'cliente' as const, texto: 'Fechado! Faço o PIX do sinal ainda hoje.', min: 1380 },
        { autor: 'loja' as const, texto: 'Combinado 👍 Já preparo a documentação do repasse.', min: 1370 },
      ],
    },
    {
      loja: 'Premium Motors Gravataí', contato: 'Jonas (Premium Motors)', veiculo: 'Parceria — troca de estoque', naoLidas: 2,
      msgs: [
        { autor: 'cliente' as const, texto: 'Bom dia! Vocês têm SUV compacto pra repasse essa semana?', min: 300 },
        { autor: 'loja' as const, texto: 'Bom dia Jonas! Tenho um T-Cross e um Kicks. Te mando as fotos.', min: 290 },
        { autor: 'cliente' as const, texto: 'Show. Qual o valor do T-Cross no repasse?', min: 15 },
        { autor: 'cliente' as const, texto: 'E aceita troca por um Onix 2021?', min: 14 },
      ],
    },
  ]

  const conversas: Conversa[] = []
  const mensagens: Mensagem[] = []
  for (const d of defs) {
    const cid = id('conv')
    d.msgs.forEach((m, i) => {
      mensagens.push({
        id: id('msg'),
        conversa_id: cid,
        autor: m.autor,
        texto: m.texto,
        created_at: minAtras(m.min),
        lida: i < d.msgs.length - d.naoLidas,
      })
    })
    const ultima = d.msgs[d.msgs.length - 1]
    conversas.push({
      id: cid,
      tipo: 'parceiro',
      cliente_nome: d.contato,
      loja_parceira_nome: d.loja,
      veiculo_interesse: d.veiculo,
      canal: 'chat',
      ultima_mensagem: ultima.texto,
      ultima_mensagem_em: minAtras(ultima.min),
      nao_lidas: d.naoLidas,
    })
  }
  return { conversas, mensagens }
}

// ── Pós-venda ──────────────────────────────────────────────
const CHECKLIST_PADRAO: { chave: string; titulo: string; categoria: 'contrato' | 'financeiro' | 'documento' | 'transferencia'; responsavel: 'loja' | 'comprador' }[] = [
  { chave: 'contrato_gerado', titulo: 'Gerar contrato de compra e venda', categoria: 'contrato', responsavel: 'loja' },
  { chave: 'contrato_assinado', titulo: 'Colher assinaturas do contrato', categoria: 'contrato', responsavel: 'loja' },
  { chave: 'pagamento_confirmado', titulo: 'Confirmar pagamento integral', categoria: 'financeiro', responsavel: 'loja' },
  { chave: 'recibo_emitido', titulo: 'Emitir recibo de quitação', categoria: 'financeiro', responsavel: 'loja' },
  { chave: 'crlv_entregue', titulo: 'Receber CRLV assinado', categoria: 'documento', responsavel: 'comprador' },
  { chave: 'vistoria', titulo: 'Vistoria de transferência', categoria: 'documento', responsavel: 'loja' },
  { chave: 'comunicacao_venda', titulo: 'Comunicar venda ao DETRAN', categoria: 'transferencia', responsavel: 'loja' },
  { chave: 'transferencia_concluida', titulo: 'Confirmar transferência de propriedade', categoria: 'transferencia', responsavel: 'comprador' },
]

export function buildEsteiras(): Esteira[] {
  const defs = [
    { veiculo: 'Hyundai HB20 Comfort Plus', comprador: 'Luiz Henrique Ramos', vendedor: 'Paulo Mendes', valor: 68500, comissao: 1370, comissaoPaga: false, estagio: 'pagamento' as const, feitos: 2, dias: 3, vencido: false },
    { veiculo: 'Honda HR-V EXL', comprador: 'Fernanda Costa', vendedor: 'Ana Beatriz Silva', valor: 141000, comissao: 2820, comissaoPaga: false, estagio: 'documentos' as const, feitos: 4, dias: 8, vencido: true },
    { veiculo: 'VW Nivus Highline', comprador: 'André Oliveira', vendedor: 'Paulo Mendes', valor: 108500, comissao: 2170, comissaoPaga: true, estagio: 'transferencia' as const, feitos: 6, dias: 15, vencido: false },
    { veiculo: 'Jeep Compass Longitude', comprador: 'Juliana Ferreira', vendedor: 'Você', valor: 137500, comissao: 2750, comissaoPaga: false, estagio: 'contrato' as const, feitos: 1, dias: 1, vencido: false },
    { veiculo: 'Chevrolet Onix Premier', comprador: 'Vanessa Pereira', vendedor: 'Você', valor: 81200, comissao: 1624, comissaoPaga: true, estagio: 'concluido' as const, feitos: 8, dias: 32, vencido: false },
    { veiculo: 'Fiat Argo Drive', comprador: 'Eduardo Martins', vendedor: 'Você', valor: 72900, comissao: 1458, comissaoPaga: true, estagio: 'concluido' as const, feitos: 8, dias: 48, vencido: false },
  ]

  return defs.map((e) => {
    const eid = id('est')
    const itens = CHECKLIST_PADRAO.map((c, i) => {
      const concluido = i < e.feitos
      const emAndamento = i === e.feitos
      return {
        id: id('item'),
        chave: c.chave,
        titulo: c.titulo,
        categoria: c.categoria,
        responsavel: c.responsavel,
        status: concluido ? ('concluido' as const) : emAndamento ? ('em_andamento' as const) : ('pendente' as const),
        obrigatorio: true,
        prazo_em: !concluido && e.vencido && emAndamento ? diasAtras(2) : !concluido ? diasAtras(-3 - i) : null,
        vencido: !concluido && emAndamento && e.vencido,
        concluido_em: concluido ? diasAtras(e.dias - i) : null,
      }
    })
    return {
      id: eid,
      estagio: e.estagio,
      veiculo_nome: e.veiculo,
      comprador_nome: e.comprador,
      vendedor_nome: e.vendedor,
      valor_venda: e.valor,
      comissao_valor: e.comissao,
      comissao_paga: e.comissaoPaga,
      itens,
      aberta_em: diasAtras(e.dias),
      concluida_em: e.estagio === 'concluido' ? diasAtras(e.dias - 6) : null,
    }
  })
}

// ── Financeiro ─────────────────────────────────────────────
export function buildLancamentos(): Lancamento[] {
  const defs: { tipo: Lancamento['tipo']; desc: string; valor: number; dias: number; veiculo?: string; status?: 'pago' | 'pendente' }[] = [
    { tipo: 'receita', desc: 'Venda — Hyundai HB20 Comfort Plus', valor: 68500, dias: 3, veiculo: 'Hyundai HB20' },
    { tipo: 'receita', desc: 'Venda — Honda HR-V EXL', valor: 141000, dias: 8, veiculo: 'Honda HR-V' },
    { tipo: 'receita', desc: 'Venda — VW Nivus Highline', valor: 108500, dias: 15, veiculo: 'VW Nivus' },
    { tipo: 'receita', desc: 'Venda — Chevrolet Onix Premier', valor: 81200, dias: 32, veiculo: 'Chevrolet Onix' },
    { tipo: 'comissao', desc: 'Comissão — Paulo Mendes (HB20)', valor: 1370, dias: 2, status: 'pendente' },
    { tipo: 'comissao', desc: 'Comissão — Ana Beatriz (HR-V)', valor: 2820, dias: 7, status: 'pendente' },
    { tipo: 'comissao', desc: 'Comissão — Paulo Mendes (Nivus)', valor: 2170, dias: 12 },
    { tipo: 'despesa', desc: 'Documentação e despachante — HR-V', valor: 890, dias: 6, veiculo: 'Honda HR-V' },
    { tipo: 'despesa', desc: 'Higienização e polimento — Ranger', valor: 650, dias: 4, veiculo: 'Ford Ranger' },
    { tipo: 'despesa', desc: 'Anúncios patrocinados — plataformas', valor: 1200, dias: 10 },
    { tipo: 'despesa', desc: 'Revisão mecânica — Fiat Toro', valor: 1850, dias: 14, veiculo: 'Fiat Toro' },
    { tipo: 'despesa', desc: 'Aluguel do pátio — mensalidade', valor: 8500, dias: 20 },
    { tipo: 'despesa', desc: 'Troca de pneus — Onix Premier', valor: 2100, dias: 25, veiculo: 'Chevrolet Onix' },
    { tipo: 'receita', desc: 'Repasse — Fiat Mobi Like', valor: 48000, dias: 28, veiculo: 'Fiat Mobi', status: 'pendente' },
    { tipo: 'despesa', desc: 'Energia e internet — loja', valor: 780, dias: 30 },
  ]
  return defs.map((l) => ({
    id: id('lan'),
    loja_id: LOJA_ID,
    tipo: l.tipo,
    descricao: l.desc,
    valor: l.valor,
    data: diasAtras(l.dias),
    veiculo_nome: l.veiculo,
    status_pagamento: l.status ?? 'pago',
    created_at: diasAtras(l.dias),
  }))
}

// ── Equipe ─────────────────────────────────────────────────
export function buildEquipe(): Membro[] {
  return [
    { id: id('mem'), nome: 'Ricardo Almeida', email: 'gestor@autopremium.com.br', telefone: '51999001122', papel: 'gestor', ativo: true, percentual_comissao: null, vendas_mes: 2, created_at: diasAtras(400) },
    { id: id('mem'), nome: 'Paulo Mendes', email: 'paulo@autopremium.com.br', telefone: '51998112233', papel: 'vendedor', ativo: true, percentual_comissao: 2, vendas_mes: 2, created_at: diasAtras(300) },
    { id: id('mem'), nome: 'Ana Beatriz Silva', email: 'ana@autopremium.com.br', telefone: '51997223344', papel: 'vendedor', ativo: true, percentual_comissao: 2, vendas_mes: 1, created_at: diasAtras(220) },
    { id: id('mem'), nome: 'Diego Fontoura', email: 'diego@autopremium.com.br', telefone: '51996334455', papel: 'vendedor', ativo: false, percentual_comissao: 1.5, vendas_mes: 0, created_at: diasAtras(150) },
  ]
}

// ── Configurações da loja ──────────────────────────────────
export function buildPerfilLoja(): PerfilLoja {
  return {
    id: LOJA_ID,
    nome: LOJA_NOME,
    slug: 'auto-premium-veiculos',
    cnpj: '12345678000190',
    telefone: '5132001010',
    whatsapp: '51999887766',
    email: 'contato@autopremium.com.br',
    endereco: 'Av. Assis Brasil, 3200',
    cidade: 'Porto Alegre',
    estado: 'RS',
    cep: '91010000',
    percentual_comissao_padrao: 2,
    verificada: true,
    ativa: true,
  }
}

export const BANCOS_SUPORTADOS = [
  { codigo: 'bv', nome: 'BV Financeira' },
  { codigo: 'santander', nome: 'Santander' },
  { codigo: 'itau', nome: 'Itaú' },
  { codigo: 'bradesco', nome: 'Bradesco Financiamentos' },
  { codigo: 'panamericano', nome: 'BRB / PAN' },
  { codigo: 'omni', nome: 'Omni' },
]

export function buildCredenciaisBanco(): CredencialBanco[] {
  return [
    { id: id('cred'), banco: 'bv', escopo: 'loja', usuario_configurado: 'autopremium.bv', ativo: true, created_at: diasAtras(120) },
    { id: id('cred'), banco: 'santander', escopo: 'loja', usuario_configurado: 'ap_santander', ativo: true, created_at: diasAtras(90) },
  ]
}

export function buildCredenciaisIA(): CredencialIA[] {
  return [
    { id: id('cia'), provedor: 'anthropic', modelo_padrao: 'claude-haiku-4-5-20251001', configurada: true, ativo: true },
  ]
}

export function buildRedesSociais(): RedeSocialStatus[] {
  return [
    { rede: 'facebook', page_id: '102938475610293', token_expira_em: diasAtras(-45), conectada: true },
    { rede: 'instagram', instagram_account_id: '17841400000000000', token_expira_em: diasAtras(-45), conectada: true },
  ]
}

export function buildCredencialDetran(): CredencialDetran {
  return { configurada: true, api_url: 'https://api.consultaveicular.com.br/v2', ativo: true }
}

export function buildConfigFiscal(): ConfiguracaoFiscal {
  return {
    liberado: true,
    configurada: true,
    inscricao_estadual: '0961234567',
    regime_tributario: 'simples',
    cnae: '4511-1/02',
    ambiente: 'homologacao',
    certificado_configurado: true,
    certificado_validade: diasAtras(-240),
    ativo: true,
  }
}

// ── Notificações ───────────────────────────────────────────
export function buildNotificacoes(): Notificacao[] {
  return [
    { id: id('not'), titulo: 'Documento vencido', conteudo: 'CRLV da venda do HR-V está atrasado há 2 dias.', lida: false, created_at: minAtras(120) },
    { id: id('not'), titulo: 'Novo lead da vitrine', conteudo: 'Patrícia Lima demonstrou interesse no Hyundai Creta.', lida: false, created_at: minAtras(300) },
    { id: id('not'), titulo: 'Reserva expirando', conteudo: 'A reserva da Hilux SRX vence amanhã.', lida: false, created_at: minAtras(600) },
  ]
}
