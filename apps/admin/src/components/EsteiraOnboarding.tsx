import React, { useState } from 'react'
import { Building2, Package, FileText, CreditCard, Users, Sparkles, ChevronRight } from 'lucide-react'

export interface EsteiraOnboardingProps {
  onNavegarAba: (aba: string) => void
  onAbrirModalNovaLoja: () => void
}

export function EsteiraOnboardingGuide({ onNavegarAba, onAbrirModalNovaLoja }: EsteiraOnboardingProps) {
  const [expandido, setExpandido] = useState(true)

  const passos = [
    {
      numero: 1,
      titulo: '1. Criar/Verificar Planos',
      subtitulo: 'Defina os módulos liberados e preços',
      aba: 'planos',
      icon: Package,
    },
    {
      numero: 2,
      titulo: '2. Definir Contrato Vigente',
      subtitulo: 'Ajuste os termos de adesão aceitos',
      aba: 'contrato',
      icon: FileText,
    },
    {
      numero: 3,
      titulo: '3. Cadastrar Loja & Gestor',
      subtitulo: 'Crie a conta da loja e dados do gestor',
      aba: 'lojas',
      icon: Building2,
      acaoEspecial: onAbrirModalNovaLoja,
    },
    {
      numero: 4,
      titulo: '4. Vincular Usuários',
      subtitulo: 'Adicione vendedores e equipe à loja',
      aba: 'usuarios',
      icon: Users,
    },
    {
      numero: 5,
      titulo: '5. Financeiro da Plataforma',
      subtitulo: 'Acompanhe faturamento global, MRR, cobranças e caixa',
      aba: 'financeiro',
      icon: CreditCard,
    },
  ]

  return (
    <div className="glass-card" style={{ marginBottom: 24, padding: 20, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--sv-radius-md)',
            background: 'var(--sv-primary-glow)',
            color: 'var(--sv-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--sv-text)' }}>
              Esteira Operacional de Cadastro de Clientes
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--sv-text-dim)' }}>
              Ordem recomendada para cadastrar, vincular e ativar uma nova loja na plataforma
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={onAbrirModalNovaLoja}
            style={{ fontSize: 13, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Building2 size={15} />
            + Nova Loja
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setExpandido(!expandido)}
            style={{ fontSize: 12, padding: '7px 12px' }}
          >
            {expandido ? 'Ocultar Esteira' : 'Ver Passos'}
          </button>
        </div>
      </div>

      {expandido && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid var(--sv-border)',
        }}>
          {passos.map((p) => {
            const Icone = p.icon
            return (
              <div
                key={p.numero}
                onClick={() => {
                  if (p.acaoEspecial) p.acaoEspecial()
                  else onNavegarAba(p.aba)
                }}
                style={{
                  background: 'var(--sv-surface-elevated)',
                  border: '1px solid var(--sv-border)',
                  borderRadius: 'var(--sv-radius-md)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
                className="sv-esteira-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sv-primary-text)', textTransform: 'uppercase' }}>
                    Passo {p.numero}
                  </span>
                  <Icone size={16} style={{ color: 'var(--sv-text-dim)' }} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sv-text)' }}>
                  {p.titulo.replace(/^\d+\.\s*/, '')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', lineHeight: 1.3 }}>
                  {p.subtitulo}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--sv-primary)' }}>
                  Ir para a aba <ChevronRight size={13} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
