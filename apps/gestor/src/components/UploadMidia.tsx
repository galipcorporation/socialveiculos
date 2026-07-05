import React, { useState, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'

export interface Midia {
  id: string
  tipo: 'foto' | 'video'
  url: string
  ordem: number
}

interface UploadMidiaProps {
  veiculoId: string
  midias: Midia[]
  onChange: (midias: Midia[]) => void
  sidebar?: boolean
  onRequestUpload?: () => Promise<string | null>
  salvandoRascunho?: boolean
}

export function UploadMidia({ veiculoId, midias, onChange, sidebar, onRequestUpload, salvandoRascunho }: UploadMidiaProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = async (files: FileList) => {
    if (!files || files.length === 0) return

    let efectiveId = veiculoId
    if (!efectiveId && onRequestUpload) {
      const resolved = await onRequestUpload()
      if (!resolved) {
        useUIStore.getState().showToast('Não foi possível criar o rascunho.', 'error')
        return
      }
      efectiveId = resolved
    }

    setUploading(true)
    setProgress(10)

    try {
      const token = useAuthStore.getState().token

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)

        setProgress(30 + Math.round((i / files.length) * 40))

        // 1. Upload unificado
        const response = await fetch('/v1/midias/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || 'Falha ao fazer upload da mídia.')
        }

        const uploadResult = await response.json()

        // 2. Associar ao veículo
        const assocResponse = await fetch(`/v1/veiculos/${efectiveId}/midias`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            url: uploadResult.url,
            tipo: uploadResult.tipo
          })
        })

        if (!assocResponse.ok) {
          throw new Error('Falha ao associar mídia ao veículo.')
        }

        const updatedMidias = await assocResponse.json()
        onChange(updatedMidias)
      }

      setProgress(100)
      useUIStore.getState().showToast('Mídias carregadas com sucesso!', 'success')
    } catch (err: any) {
      useUIStore.getState().showToast(err.message || 'Erro durante o upload.', 'error')
    } finally {
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
      }, 500)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await processFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (salvandoRascunho) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!salvandoRascunho) setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDelete = async (midiaId: string) => {
    const ok = await useUIStore.getState().confirm({
      title: 'Excluir Mídia',
      message: 'Deseja realmente remover esta mídia?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    })
    if (!ok) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/v1/midias/${midiaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        onChange(midias.filter(m => m.id !== midiaId))
        useUIStore.getState().showToast('Mídia removida com sucesso.', 'success')
      } else {
        useUIStore.getState().showToast('Erro ao excluir mídia.', 'error')
      }
    } catch (err) {
      console.error(err)
      useUIStore.getState().showToast('Erro de conexão ao remover mídia.', 'error')
    }
  }

  const handleMove = async (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= midias.length) return

    const newMidias = [...midias]
    // Swap
    const temp = newMidias[index]
    newMidias[index] = newMidias[newIndex]
    newMidias[newIndex] = temp

    // Atualizar ordem localmente primeiro
    onChange(newMidias)

    // Chamar API para persistir nova ordem
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/v1/veiculos/${veiculoId}/midias/ordem`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMidias.map(m => m.id))
      })

      if (!response.ok) {
        throw new Error('Erro ao salvar reordenação no servidor.')
      }
    } catch (err) {
      console.error(err)
      // Recarregar em caso de falha
      useUIStore.getState().showToast('Erro ao salvar ordenação no servidor.', 'error')
    }
  }

  const uploadZone = (
    <div
      onClick={() => !salvandoRascunho && fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${dragOver ? '#3b82f6' : 'var(--sv-border)'}`, borderRadius: 8,
        padding: sidebar ? '16px 12px' : '24px 16px',
        textAlign: 'center', cursor: salvandoRascunho ? 'wait' : 'pointer',
        background: dragOver ? 'rgba(59,130,246,0.08)' : 'var(--sv-bg)',
        transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: salvandoRascunho ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!salvandoRascunho && !dragOver) e.currentTarget.style.borderColor = '#3b82f6' }}
      onMouseLeave={(e) => { if (!dragOver) e.currentTarget.style.borderColor = 'var(--sv-border)' }}
    >
      {salvandoRascunho ? (
        <span className="spinner" style={{ width: sidebar ? 20 : 28, height: sidebar ? 20 : 28, marginBottom: 6 }} />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: sidebar ? 24 : 32, height: sidebar ? 24 : 32, color: 'var(--sv-text-muted)', marginBottom: 6 }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )}
      <span style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>
        {salvandoRascunho ? 'Preparando...' : sidebar ? 'Adicionar fotos/vídeos' : 'Clique para selecionar ou arraste fotos/vídeos'}
      </span>
      {!sidebar && !salvandoRascunho && <span style={{ fontSize: 11, color: 'var(--sv-text-muted)', marginTop: 4 }}>Limite: Imagem 15MB, Vídeo 100MB</span>}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
      />
    </div>
  )

  const progressBar = uploading && (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sv-text-dim)', marginBottom: 3 }}>
        <span>Carregando...</span>
        <span>{progress}%</span>
      </div>
      <div style={{ width: '100%', height: 3, background: 'var(--sv-border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.2s' }} />
      </div>
    </div>
  )

  const thumbHeight = sidebar ? 120 : 90
  const cols = sidebar ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(120px, 1fr))'

  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, marginTop: 12 }}>
      {midias.map((m, index) => (
        <div
          key={m.id}
          style={{
            position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#07111c',
            border: index === 0 ? '2px solid #3b82f6' : '1px solid var(--sv-border)',
            display: 'flex', flexDirection: 'column'
          }}
        >
          {index === 0 && (
            <span style={{ position: 'absolute', top: 5, left: 5, background: '#3b82f6', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3, zIndex: 3, letterSpacing: '0.05em' }}>
              CAPA
            </span>
          )}
          <div style={{ height: thumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            {m.tipo === 'video' ? (
              <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={m.url} alt="Mídia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 4px', background: 'rgba(0,0,0,0.6)', alignItems: 'center', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <div style={{ display: 'flex', gap: 1 }}>
              <button type="button" disabled={index === 0} onClick={() => handleMove(index, 'left')}
                style={{ background: 'none', border: 'none', color: '#fff', opacity: index === 0 ? 0.3 : 0.9, cursor: index === 0 ? 'default' : 'pointer', fontSize: 11, padding: '1px 4px' }}>
                ◀
              </button>
              <button type="button" disabled={index === midias.length - 1} onClick={() => handleMove(index, 'right')}
                style={{ background: 'none', border: 'none', color: '#fff', opacity: index === midias.length - 1 ? 0.3 : 0.9, cursor: index === midias.length - 1 ? 'default' : 'pointer', fontSize: 11, padding: '1px 4px' }}>
                ▶
              </button>
            </div>
            <button type="button" onClick={() => handleDelete(m.id)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 10, padding: '1px 4px' }}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  if (sidebar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {uploadZone}
        {progressBar}
        {midias.length > 0 && grid}
        {midias.length === 0 && !uploading && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--sv-text-muted)', marginTop: 16, lineHeight: 1.5 }}>
            Nenhuma mídia.<br />Limite: Imagem 15MB · Vídeo 100MB
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--sv-surface-dim)', border: '1px solid var(--sv-border)', borderRadius: 12, padding: 16, marginTop: 12 }}>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--sv-text)', marginBottom: 8 }}>
        Fotos e Vídeos (Mídia Unificada)
      </label>
      {uploadZone}
      {progressBar}
      {grid}
    </div>
  )
}
export default UploadMidia
