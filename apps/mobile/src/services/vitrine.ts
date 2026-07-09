// Vitrine B2C (M045 fase 2) — mock multi-loja para o comprador final.
// Feed público, favoritos, chat comprador↔loja, perfil de loja. Estado em
// memória de sessão. Swap p/ API = reimplementar mantendo as assinaturas.

import { delay, novoId } from './db'
import type { User } from '../stores/authStore'
import type {
  AnuncioVitrine, ConversaVitrine, LojaVitrine, Mensagem, Midia, TipoVeiculo,
} from './types'

const now = Date.now()
const diasAtras = (d: number) => new Date(now - d * 86_400_000).toISOString()
const minAtras = (m: number) => new Date(now - m * 60_000).toISOString()

// ── Lojas (coerentes com o diretório de parceiros do M055) ──
const LOJAS: LojaVitrine[] = [
  { id: 'vl-1', nome: 'Auto Premium Veículos', cidade: 'Porto Alegre', estado: 'RS', whatsapp: '51999887766', verificada: true, total_veiculos: 0 },
  { id: 'vl-2', nome: 'Garagem RS Motors', cidade: 'Porto Alegre', estado: 'RS', whatsapp: '51999110022', verificada: true, total_veiculos: 0 },
  { id: 'vl-3', nome: 'AutoCenter Canoas', cidade: 'Canoas', estado: 'RS', whatsapp: '51998220033', verificada: true, total_veiculos: 0 },
  { id: 'vl-4', nome: 'Premium Motors Gravataí', cidade: 'Gravataí', estado: 'RS', whatsapp: '51997330044', verificada: false, total_veiculos: 0 },
  { id: 'vl-5', nome: 'Sul Veículos', cidade: 'São Leopoldo', estado: 'RS', whatsapp: '51996440055', verificada: true, total_veiculos: 0 },
  { id: 'vl-6', nome: 'Novo Rumo Automóveis', cidade: 'Novo Hamburgo', estado: 'RS', whatsapp: '51995550066', verificada: false, total_veiculos: 0 },
]

interface ASeed {
  loja: number; marca: string; modelo: string; versao?: string; tipo?: TipoVeiculo
  ano: number; km: number; cor: string; cambio?: string; comb?: string; portas?: number
  preco: number; oferta?: boolean; novidade?: boolean; favs: number; dias: number; desc?: string
}

const ANUNCIOS: ASeed[] = [
  { loja: 0, marca: 'Toyota', modelo: 'Corolla Cross', versao: 'XRE 2.0', ano: 2023, km: 28500, cor: 'Branco Polar', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 152900, novidade: true, favs: 12, dias: 2, desc: 'Único dono, revisões na concessionária, laudo aprovado.' },
  { loja: 1, marca: 'Honda', modelo: 'Civic', versao: 'Touring 1.5 Turbo', ano: 2022, km: 41200, cor: 'Cinza Grafite', cambio: 'Automático CVT', comb: 'Gasolina', portas: 4, preco: 146500, favs: 8, dias: 5 },
  { loja: 2, marca: 'Jeep', modelo: 'Compass', versao: 'Longitude T270', ano: 2023, km: 22100, cor: 'Preto Carbon', cambio: 'Automático', comb: 'Flex', portas: 4, preco: 139900, oferta: true, favs: 15, dias: 3 },
  { loja: 0, marca: 'Volkswagen', modelo: 'T-Cross', versao: 'Highline 1.4 TSI', ano: 2022, km: 35400, cor: 'Azul Norway', cambio: 'Automático', comb: 'Flex', portas: 4, preco: 118900, favs: 6, dias: 8 },
  { loja: 3, marca: 'Hyundai', modelo: 'Creta', versao: 'Ultimate 2.0', ano: 2023, km: 18900, cor: 'Prata Sand', cambio: 'Automático', comb: 'Flex', portas: 4, preco: 132500, novidade: true, favs: 9, dias: 1 },
  { loja: 4, marca: 'Chevrolet', modelo: 'Onix', versao: 'Premier 1.0 Turbo', ano: 2022, km: 44800, cor: 'Vermelho Chili', cambio: 'Automático', comb: 'Flex', portas: 4, preco: 82900, oferta: true, favs: 4, dias: 12 },
  { loja: 1, marca: 'Fiat', modelo: 'Toro', versao: 'Volcano 2.0 Diesel 4x4', ano: 2021, km: 68300, cor: 'Cinza Silverstone', cambio: 'Automático', comb: 'Diesel', portas: 4, preco: 129900, favs: 7, dias: 15 },
  { loja: 5, marca: 'Hyundai', modelo: 'HB20', versao: 'Comfort 1.0', ano: 2022, km: 39500, cor: 'Prata Metal', cambio: 'Manual', comb: 'Flex', portas: 4, preco: 69900, favs: 3, dias: 20 },
  { loja: 2, marca: 'Toyota', modelo: 'Hilux', versao: 'SRX 2.8 Diesel 4x4', ano: 2022, km: 55600, cor: 'Branco Perolizado', cambio: 'Automático', comb: 'Diesel', portas: 4, preco: 239900, favs: 18, dias: 6, desc: 'Kit multimídia premium, protetor de caçamba.' },
  { loja: 3, marca: 'Renault', modelo: 'Kwid', versao: 'Zen 1.0', ano: 2023, km: 12400, cor: 'Laranja Ocre', cambio: 'Manual', comb: 'Flex', portas: 4, preco: 58900, novidade: true, favs: 2, dias: 4 },
  { loja: 4, marca: 'BMW', modelo: '320i', versao: 'M Sport 2.0 Turbo', ano: 2021, km: 47900, cor: 'Azul Portimao', cambio: 'Automático', comb: 'Gasolina', portas: 4, preco: 219900, favs: 22, dias: 9, desc: 'Head-up display, teto solar, som Harman Kardon.' },
  { loja: 0, marca: 'Honda', modelo: 'HR-V', versao: 'EXL 1.5', ano: 2023, km: 19800, cor: 'Preto Cristal', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 142900, favs: 11, dias: 7 },
  { loja: 5, marca: 'Honda', modelo: 'CB 500F', tipo: 'moto', ano: 2022, km: 14300, cor: 'Vermelho', comb: 'Gasolina', preco: 38900, favs: 5, dias: 10 },
  { loja: 1, marca: 'Yamaha', modelo: 'MT-03', tipo: 'moto', ano: 2023, km: 8900, cor: 'Azul Racing', comb: 'Gasolina', preco: 31500, novidade: true, favs: 6, dias: 3 },
  { loja: 2, marca: 'Chevrolet', modelo: 'Tracker', versao: 'Premier 1.2 Turbo', ano: 2023, km: 16500, cor: 'Vermelho Carmim', cambio: 'Automático', comb: 'Flex', portas: 4, preco: 127900, favs: 8, dias: 5 },
  { loja: 4, marca: 'Ford', modelo: 'Ranger', versao: 'Limited 3.0 V6 Diesel', ano: 2024, km: 9800, cor: 'Cinza Moscou', cambio: 'Automático', comb: 'Diesel', portas: 4, preco: 289900, novidade: true, favs: 14, dias: 2, desc: 'Pacote tecnológico, som B&O.' },
  { loja: 3, marca: 'Peugeot', modelo: '208', versao: 'Griffe 1.0 Turbo', ano: 2023, km: 17600, cor: 'Branco Nacré', cambio: 'Automático CVT', comb: 'Flex', portas: 4, preco: 86900, oferta: true, favs: 3, dias: 11 },
  { loja: 5, marca: 'Volkswagen', modelo: 'Polo', versao: 'TSI 1.0 128cv', ano: 2023, km: 21700, cor: 'Cinza Platinum', cambio: 'Automático', comb: 'Flex', portas: 4, preco: 89900, favs: 7, dias: 6 },
]

function midiaVazia(): Midia[] { return [] }

let anuncios: AnuncioVitrine[] = ANUNCIOS.map((a) => {
  const loja = LOJAS[a.loja]
  return {
    id: novoId('anun'),
    loja_id: loja.id,
    loja_nome: loja.nome,
    loja_cidade: loja.cidade,
    loja_estado: loja.estado,
    loja_whatsapp: loja.whatsapp,
    loja_verificada: loja.verificada,
    marca: a.marca,
    modelo: a.modelo,
    versao: a.versao,
    tipo: a.tipo ?? 'carro',
    ano_fabricacao: a.ano - (a.km > 20000 ? 1 : 0),
    ano_modelo: a.ano,
    km: a.km,
    cor: a.cor,
    cambio: a.cambio,
    combustivel: a.comb,
    portas: a.portas,
    preco_venda: a.preco,
    descricao: a.desc,
    midias: midiaVazia(),
    oferta: a.oferta,
    novidade: a.novidade,
    total_favoritos: a.favs,
    favoritado_por_mim: false,
    created_at: diasAtras(a.dias),
  }
})

// contagem por loja
for (const l of LOJAS) l.total_veiculos = anuncios.filter((a) => a.loja_id === l.id).length

const favoritos = new Set<string>()

// ── Chat B2C (comprador ↔ loja) ─────────────────────────────
let conversas: ConversaVitrine[] = []
const mensagens: Mensagem[] = []

export type FiltroFeed = 'todos' | 'ofertas' | 'novidades' | 'carro' | 'moto'

export const FILTROS_FEED: { value: FiltroFeed; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ofertas', label: 'Ofertas' },
  { value: 'novidades', label: 'Novidades' },
  { value: 'carro', label: 'Carros' },
  { value: 'moto', label: 'Motos' },
]

function aplicarFav(a: AnuncioVitrine): AnuncioVitrine {
  const fav = favoritos.has(a.id)
  // a.total_favoritos é a base do seed; soma +1 quando o comprador favoritou.
  return { ...a, favoritado_por_mim: fav, total_favoritos: a.total_favoritos + (fav ? 1 : 0) }
}

export const vitrineService = {
  // Conta PF demo (comprador). Alinhado às credenciais de dev.
  loginDemo(): User {
    return {
      id: 'user-cliente-demo',
      nome: 'Comprador Demo',
      email: 'vitrine@demo.com',
      papel: 'cliente',
      ativo: true,
      mfa_ativo: false,
      loja_id: null,
    }
  },

  cadastrar(nome: string, email: string): User {
    return {
      id: novoId('cli'),
      nome: nome.trim() || 'Comprador',
      email: email.trim().toLowerCase(),
      papel: 'cliente',
      ativo: true,
      mfa_ativo: false,
      loja_id: null,
    }
  },

  async feed(filtro: FiltroFeed = 'todos', busca = ''): Promise<AnuncioVitrine[]> {
    await delay()
    let lista = anuncios.map(aplicarFav)
    if (filtro === 'ofertas') lista = lista.filter((a) => a.oferta)
    else if (filtro === 'novidades') lista = lista.filter((a) => a.novidade)
    else if (filtro === 'carro') lista = lista.filter((a) => a.tipo === 'carro')
    else if (filtro === 'moto') lista = lista.filter((a) => a.tipo === 'moto')
    const q = busca.trim().toLowerCase()
    if (q) {
      lista = lista.filter((a) =>
        [a.marca, a.modelo, a.versao, a.cor, a.loja_nome, String(a.ano_modelo)]
          .filter(Boolean)
          .some((c) => String(c).toLowerCase().includes(q)),
      )
    }
    return lista.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async detalhe(id: string): Promise<AnuncioVitrine | undefined> {
    await delay(120, 260)
    const a = anuncios.find((x) => x.id === id)
    return a ? aplicarFav(a) : undefined
  },

  async favoritos(): Promise<AnuncioVitrine[]> {
    await delay()
    return anuncios.filter((a) => favoritos.has(a.id)).map(aplicarFav)
  },

  async alternarFavorito(id: string): Promise<boolean> {
    await delay(80, 180)
    if (favoritos.has(id)) favoritos.delete(id)
    else favoritos.add(id)
    return favoritos.has(id)
  },

  async loja(id: string): Promise<LojaVitrine | undefined> {
    await delay(120, 260)
    return LOJAS.find((l) => l.id === id)
  },

  async veiculosDaLoja(lojaId: string): Promise<AnuncioVitrine[]> {
    await delay()
    return anuncios.filter((a) => a.loja_id === lojaId).map(aplicarFav)
  },

  async seguirLoja(lojaId: string): Promise<boolean> {
    await delay(80, 180)
    const l = LOJAS.find((x) => x.id === lojaId)
    if (l) l.seguindo = !l.seguindo
    return l?.seguindo ?? false
  },

  // ── Chat B2C ──────────────────────────────────────────────
  async conversas(): Promise<ConversaVitrine[]> {
    await delay()
    return [...conversas].sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em))
  },

  async mensagens(conversaId: string): Promise<Mensagem[]> {
    await delay(120, 260)
    return mensagens
      .filter((m) => m.conversa_id === conversaId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  // Abre (ou reaproveita) a conversa com a loja de um anúncio.
  async abrirConversa(anuncio: AnuncioVitrine): Promise<ConversaVitrine> {
    await delay(120, 260)
    let conv = conversas.find((c) => c.loja_id === anuncio.loja_id)
    if (!conv) {
      conv = {
        id: novoId('cv'),
        loja_id: anuncio.loja_id,
        loja_nome: anuncio.loja_nome,
        loja_verificada: anuncio.loja_verificada,
        veiculo_interesse: `${anuncio.marca} ${anuncio.modelo}`,
        ultima_mensagem: 'Conversa iniciada',
        ultima_mensagem_em: new Date().toISOString(),
        nao_lidas: 0,
      }
      conversas = [conv, ...conversas]
      // Mensagem de boas-vindas da loja
      mensagens.push({
        id: novoId('msg'),
        conversa_id: conv.id,
        autor: 'loja',
        texto: `Olá! Obrigado pelo interesse no ${anuncio.marca} ${anuncio.modelo}. Como posso ajudar?`,
        created_at: minAtras(1),
        lida: true,
      })
    }
    return conv
  },

  async enviar(conversaId: string, texto: string): Promise<Mensagem> {
    await delay(100, 220)
    const agora = new Date().toISOString()
    const msg: Mensagem = { id: novoId('msg'), conversa_id: conversaId, autor: 'cliente', texto, created_at: agora, lida: true }
    mensagens.push(msg)
    const conv = conversas.find((c) => c.id === conversaId)
    if (conv) {
      conv.ultima_mensagem = texto
      conv.ultima_mensagem_em = agora
    }
    return msg
  },

  async marcarLidas(conversaId: string): Promise<void> {
    const conv = conversas.find((c) => c.id === conversaId)
    if (conv) conv.nao_lidas = 0
  },
}
