import React, { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { fonts, radius, spacing } from '../../theme/tokens'
import {
  AppHeader, Badge, Button, Card, Input, Paywall, Screen, SelectField, SkeletonCard, Txt, useToast,
} from '../../components/ui'
import { OptionSheet } from '../../components/ui'
import { modulosService, siteService } from '../../services'
import type { SiteLoja, TemplateSite } from '../../services/types'
import { TEMPLATES_SITE } from '../../services/types'

export default function MeuSiteScreen() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const gateQ = useQuery({ queryKey: ['modulo', 'site'], queryFn: () => modulosService.liberado('site') })
  const siteQ = useQuery({ queryKey: ['meu-site'], queryFn: () => siteService.obter(), enabled: gateQ.data === true })

  const [form, setForm] = useState<SiteLoja | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [templateSheet, setTemplateSheet] = useState(false)

  useEffect(() => { if (siteQ.data) setForm(siteQ.data) }, [siteQ.data])

  const set = <K extends keyof SiteLoja>(k: K) => (v: SiteLoja[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  const salvar = async () => {
    if (!form) return
    setSalvando(true)
    try {
      await siteService.salvar(form)
      await queryClient.invalidateQueries({ queryKey: ['meu-site'] })
      toast.show('success', 'Alterações salvas.')
    } finally {
      setSalvando(false)
    }
  }

  const togglePublicar = async () => {
    if (!form) return
    if (!form.publicado && !form.hero_titulo.trim()) {
      toast.show('error', 'Informe ao menos o título do hero antes de publicar.')
      return
    }
    setPublicando(true)
    try {
      const s = await siteService.publicar(!form.publicado)
      setForm(s)
      await queryClient.invalidateQueries({ queryKey: ['meu-site'] })
      toast.show('success', s.publicado ? 'Site publicado.' : 'Site despublicado.')
    } finally {
      setPublicando(false)
    }
  }

  if (gateQ.isLoading) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Meu Site" large={false} back />
        <View style={{ padding: spacing.md }}><SkeletonCard withImage={false} /></View>
      </Screen>
    )
  }

  if (gateQ.data === false) {
    return (
      <Screen scroll={false} padded={false}>
        <AppHeader title="Meu Site" large={false} back />
        <Screen padded>
          <Paywall titulo="Construtor de Sites" descricao="Tenha um site próprio com a marca da sua loja, domínio e só o seu estoque. Módulo não incluído no plano atual." />
        </Screen>
      </Screen>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      <AppHeader title="Meu Site" large={false} back />
      <Screen padded style={{ gap: spacing.md }}>
        {!form ? (
          <SkeletonCard withImage={false} />
        ) : (
          <>
            {/* Status + link */}
            <Card style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Badge label={form.publicado ? 'Publicado' : 'Rascunho'} tone={form.publicado ? 'success' : 'neutral'} size="sm" />
                <Txt variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>{form.subdominio}</Txt>
              </View>
              <Button
                title={form.publicado ? 'Despublicar site' : 'Publicar site'}
                variant={form.publicado ? 'outline' : 'primary'}
                icon={form.publicado ? 'eye-off-outline' : 'rocket-outline'}
                loading={publicando}
                onPress={togglePublicar}
                full
              />
            </Card>

            {/* Preview */}
            <Preview form={form} />

            {/* Aparência */}
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Aparência</Txt>
              <SelectField label="Template" value={TEMPLATES_SITE.find((t) => t.value === form.template)?.label} onPress={() => setTemplateSheet(true)} />
              <Swatches label="Cor primária" atual={form.cor_primaria} onSelect={set('cor_primaria')} />
              <Swatches label="Cor secundária" atual={form.cor_secundaria} onSelect={set('cor_secundaria')} />
              <ImagemPicker label="Logo" uri={form.logo_url} onPick={(u) => set('logo_url')(u)} />
              <ImagemPicker label="Banner (hero)" uri={form.banner_url} onPick={(u) => set('banner_url')(u)} />
            </Card>

            {/* Conteúdo */}
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Conteúdo</Txt>
              <Input label="Título do hero" value={form.hero_titulo} onChangeText={set('hero_titulo')} />
              <Input label="Subtítulo" value={form.hero_subtitulo} onChangeText={set('hero_subtitulo')} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
              <Input label="Texto do botão (CTA)" value={form.hero_cta} onChangeText={set('hero_cta')} />
              <Input label="Sobre a loja" value={form.sobre_texto} onChangeText={set('sobre_texto')} multiline style={{ minHeight: 72, textAlignVertical: 'top' }} />
            </Card>

            {/* SEO */}
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>SEO — como aparece no Google</Txt>
              <Input label="Título (SEO)" value={form.seo_title ?? ''} onChangeText={set('seo_title')} placeholder="Ex.: Auto Premium — Seminovos em Porto Alegre" />
              <Input label="Descrição (SEO)" value={form.seo_description ?? ''} onChangeText={set('seo_description')} multiline style={{ minHeight: 56, textAlignVertical: 'top' }} placeholder="Resumo que aparece nos resultados de busca" />
            </Card>

            {/* Analytics */}
            <Card style={{ gap: spacing.sm }}>
              <Txt variant="label" color="textMuted" style={{ textTransform: 'uppercase' }}>Analytics (opcional)</Txt>
              <Input label="ID do Google Analytics (GA4)" value={form.ga4_id ?? ''} onChangeText={set('ga4_id')} autoCapitalize="none" placeholder="G-XXXXXXXXXX" />
              <Input label="ID do Meta Pixel" value={form.meta_pixel_id ?? ''} onChangeText={set('meta_pixel_id')} autoCapitalize="none" placeholder="000000000000000" />
            </Card>

            <Button title="Salvar alterações" icon="checkmark" loading={salvando} onPress={salvar} full />
          </>
        )}
      </Screen>

      <OptionSheet
        visible={templateSheet}
        onClose={() => setTemplateSheet(false)}
        title="Template do site"
        options={TEMPLATES_SITE.map((t) => ({ value: t.value, label: t.label, sublabel: t.descricao }))}
        selected={form?.template}
        onSelect={(v) => set('template')(v as TemplateSite)}
      />
    </Screen>
  )
}

/** Mock de browser com o hero renderizado em tempo real (aproximação leve). */
function Preview({ form }: { form: SiteLoja }) {
  const { colors } = useTheme()
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.xs, backgroundColor: colors.overlaySoft }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f87171' }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fbbf24' }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' }} />
        <Txt variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1, marginLeft: 6 }}>{form.subdominio}</Txt>
      </View>
      <View
        style={{
          backgroundColor: form.cor_primaria,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.md,
          alignItems: form.template === 'compacto' ? 'flex-start' : 'center',
        }}
      >
        <Txt style={{ fontFamily: fonts.displayBold, fontSize: 20, color: '#fff' }} numberOfLines={2}>
          {form.hero_titulo || 'Título do site'}
        </Txt>
        <Txt style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, textAlign: form.template === 'compacto' ? 'left' : 'center' }} numberOfLines={2}>
          {form.hero_subtitulo || 'Subtítulo do hero'}
        </Txt>
        <View style={{ marginTop: spacing.sm, backgroundColor: '#fff', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 14 }}>
          <Txt style={{ color: form.cor_secundaria || form.cor_primaria, fontFamily: fonts.semibold, fontSize: 12 }}>{form.hero_cta || 'Ver estoque'}</Txt>
        </View>
      </View>
    </Card>
  )
}

const CORES: string[] = ['#2563eb', '#0ea5e9', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0f172a', '#f59e0b']

function Swatches({ label, atual, onSelect }: { label: string; atual: string; onSelect: (c: string) => void }) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="captionMedium" color="textDim">{label}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {CORES.map((c) => (
          <Pressable
            key={c}
            onPress={() => onSelect(c)}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: atual === c ? 3 : 1, borderColor: atual === c ? colors.text : colors.border }}
          />
        ))}
      </View>
    </View>
  )
}

function ImagemPicker({ label, uri, onPick }: { label: string; uri?: string; onPick: (uri: string) => void }) {
  const { colors } = useTheme()
  const escolher = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!res.canceled && res.assets[0]) onPick(res.assets[0].uri)
  }
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="captionMedium" color="textDim">{label}</Txt>
      <Pressable onPress={escolher} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.inputBg }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: 44, height: 44, borderRadius: radius.sm }} contentFit="cover" />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.overlaySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={20} color={colors.textMuted} />
          </View>
        )}
        <Txt variant="caption" color={uri ? 'text' : 'textMuted'} style={{ flex: 1 }}>{uri ? 'Trocar imagem' : 'Escolher da galeria'}</Txt>
        <Ionicons name="cloud-upload-outline" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}
