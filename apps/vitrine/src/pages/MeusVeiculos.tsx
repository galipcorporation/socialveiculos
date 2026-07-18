import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { BottomNav } from '../components/BottomNav'

interface VeiculoDocumento {
  id: string
  tipo: string
  nome: string
  url: string
  visivel_comprador: boolean
  created_at: string
}

interface MeuVeiculo {
  veiculo_id: string
  marca: string
  modelo: string
  ano_fabricacao: number
  ano_modelo: number
  placa: string | null
  cor: string | null
  km: number | null
  foto_url: string | null
  loja_nome: string
  documentos: VeiculoDocumento[]
  valor_fipe_atual: number | null
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const TIPO_LABEL: Record<string, string> = {
  contrato: 'Contrato',
  nota_fiscal: 'Nota Fiscal',
  garantia: 'Garantia',
  laudo: 'Laudo',
  outro: 'Documento',
}

export function MeusVeiculos() {
  const { isAuthenticated, openLoginModal } = useAuthStore()
  const [veiculos, setVeiculos] = useState<MeuVeiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    api.get<MeuVeiculo[]>('/vitrine/meus-veiculos')
      .then(setVeiculos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <div className="vt-empty-state">
        <p>Faça login para ver seus veículos.</p>
        <button className="vt-btn-primary" onClick={() => openLoginModal('login')}>Entrar</button>
        <BottomNav />
      </div>
    )
  }

  if (loading) {
    return <div className="vt-loading"><span className="vt-spinner" /></div>
  }

  if (!veiculos.length) {
    return (
      <div className="vt-empty-state">
        <h3>Nenhum veículo encontrado</h3>
        <p>Quando você comprar um veículo por uma loja da plataforma, ele aparecerá aqui com os documentos da venda.</p>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="vt-page">
      <div className="vt-page-header">
        <h2>Meus Veículos</h2>
        <p style={{ color: 'var(--vt-text-secondary)', fontSize: 14 }}>
          Veículos adquiridos em lojas da plataforma
        </p>
      </div>

      <div className="vt-meus-veiculos-list">
        {veiculos.map(v => (
          <div key={v.veiculo_id} className="vt-meu-veiculo-card">
            {v.foto_url && (
              <img
                src={v.foto_url}
                alt={`${v.marca} ${v.modelo}`}
                className="vt-meu-veiculo-foto"
              />
            )}
            <div className="vt-meu-veiculo-info">
              <div className="vt-meu-veiculo-titulo">
                <strong>{v.marca} {v.modelo}</strong>
                <span className="vt-meu-veiculo-ano">{v.ano_modelo}</span>
              </div>
              <div className="vt-meu-veiculo-meta">
                {v.cor && <span>{v.cor}</span>}
                {v.km !== null && <span>{v.km.toLocaleString('pt-BR')} km</span>}
                {v.placa && <span>{v.placa}</span>}
              </div>
              <div className="vt-meu-veiculo-loja">Comprado em: {v.loja_nome}</div>
              {v.valor_fipe_atual != null && (
                <div className="vt-meu-veiculo-fipe">
                  Valor FIPE atual: <strong>{formatBRL(v.valor_fipe_atual)}</strong>
                </div>
              )}

              {v.documentos.length > 0 && (
                <button
                  className="vt-btn-ghost"
                  style={{ marginTop: 8, fontSize: 13 }}
                  onClick={() => setExpandido(expandido === v.veiculo_id ? null : v.veiculo_id)}
                >
                  {expandido === v.veiculo_id ? '▲ Ocultar' : `▼ ${v.documentos.length} documento${v.documentos.length > 1 ? 's' : ''}`}
                </button>
              )}

              {expandido === v.veiculo_id && (
                <div className="vt-meu-veiculo-docs">
                  {v.documentos.map(d => (
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vt-doc-item"
                    >
                      <span className="vt-doc-tipo">{TIPO_LABEL[d.tipo] ?? d.tipo}</span>
                      <span className="vt-doc-nome">{d.nome}</span>
                      <span className="vt-doc-baixar">↗</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  )
}
