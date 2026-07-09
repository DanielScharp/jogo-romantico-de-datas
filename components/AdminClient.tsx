'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadAdminConfig,
  saveAdminConfig,
  clearAdminConfig,
  computeLetterDistribution,
  buildDefaultDays,
  buildInitialAdminConfig,
  daysBetween,
  formatDateBR,
  shiftDate,
  cleanPhrase,
  DEFAULT_EMOJIS,
  type AdminConfig,
  type AdminDayConfig,
} from '@/lib/adminConfig'

// ── Tipos locais ──────────────────────────────────────────────

type SaveStatus = 'idle' | 'saved' | 'error'

// ── Helpers ───────────────────────────────────────────────────

/** Adiciona `days - 1` dias a uma data ISO e retorna a data resultante formatada pt-BR */
function unlockDateFor(startIso: string, dayNumber: number): string {
  return formatDateBR(shiftDate(startIso, dayNumber - 1))
}

// ── Componente principal ──────────────────────────────────────

export default function AdminClient() {
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [openDay, setOpenDay] = useState<number | null>(1)
  const [hydrated, setHydrated] = useState(false)
  const [testingAudio, setTestingAudio] = useState<number | null>(null)
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on mount
  useEffect(() => {
    let cancelled = false

    void loadAdminConfig().then((saved) => {
      if (!cancelled) {
        setConfig(saved ?? buildInitialAdminConfig())
        setHydrated(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // ── Updaters ────────────────────────────────────────────────

  const updateDates = useCallback((key: 'startDate' | 'endDate', value: string) => {
    setConfig((prev) => {
      if (!prev) return prev
      const s = key === 'startDate' ? value : prev.startDate
      const e = key === 'endDate' ? value : prev.endDate

      // Garante que endDate não fique antes de startDate
      const safeEnd = e < s ? s : e
      const total = daysBetween(s, safeEnd)

      // Redimensiona o array de dias preservando os dados já preenchidos
      let newDays: AdminDayConfig[]
      if (total > prev.days.length) {
        const extra = buildDefaultDays(total).slice(prev.days.length)
        newDays = [...prev.days, ...extra]
      } else {
        newDays = prev.days.slice(0, total)
      }

      return {
        ...prev,
        startDate: s,
        endDate: safeEnd,
        totalDays: total,
        days: newDays,
      }
    })
    setSaveStatus('idle')
  }, [])

  const updatePhraseFields = useCallback((raw: string) => {
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        finalPhrase: cleanPhrase(raw),
        finalPhraseDisplay: raw,
      }
    })
    setSaveStatus('idle')
  }, [])

  const updateDay = useCallback((day: number, patch: Partial<AdminDayConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        days: prev.days.map((d) => (d.day === day ? { ...d, ...patch } : d)),
      }
    })
    setSaveStatus('idle')
  }, [])

  // ── Save ─────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!config) return
    try {
      await saveAdminConfig(config)
      setSaveStatus('saved')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }, [config])

  const handleAudioUpload = useCallback(async (day: number, file: File) => {
    const formData = new FormData()
    formData.append('audio', file)

    try {
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar áudio')
      }

      const data = (await response.json()) as { url?: string }
      if (data.url) {
        updateDay(day, { audioUrl: data.url })
      }
    } catch {
      setSaveStatus('error')
    }
  }, [updateDay])

  const handleAttachmentUpload = useCallback(async (day: number, file: File) => {
    const formData = new FormData()
    formData.append('attachment', file)

    try {
      const response = await fetch('/api/upload-attachment', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar anexo')
      }

      const data = (await response.json()) as { url?: string }
      if (data.url) {
        updateDay(day, { attachmentUrl: data.url })
      }
    } catch {
      setSaveStatus('error')
    }
  }, [updateDay])

  const handleReset = useCallback(async () => {
    if (!confirm('Tem certeza? Isso apaga todas as configurações salvas e volta ao padrão.')) return
    try {
      await clearAdminConfig()
      setConfig(buildInitialAdminConfig())
      setSaveStatus('idle')
    } catch {
      setSaveStatus('error')
    }
  }, [])

  // ── Audio test ───────────────────────────────────────────────

  const handleTestAudio = useCallback((day: number, url: string) => {
    Object.entries(audioRefs.current).forEach(([d, el]) => {
      if (el && Number(d) !== day) { el.pause(); el.currentTime = 0 }
    })
    const el = audioRefs.current[day]
    if (!el) return
    if (testingAudio === day) {
      el.pause()
      el.currentTime = 0
      setTestingAudio(null)
    } else {
      el.src = url
      el.play().then(() => setTestingAudio(day)).catch(() => setTestingAudio(null))
      el.onended = () => setTestingAudio(null)
    }
  }, [testingAudio])

  // ── Distribution ─────────────────────────────────────────────

  const distribution = config
    ? computeLetterDistribution(config.finalPhrase, config.totalDays)
    : null

  // ── Loading ──────────────────────────────────────────────────

  if (!hydrated || !config) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  const phraseLetterCount = config.finalPhrase.length
  // Frase OK quando tem pelo menos tantas letras quanto dias
  const phraseOk = phraseLetterCount >= config.totalDays
  // Frase exatamente certa quando igual ao total de dias
  const phraseExact = phraseLetterCount === config.totalDays

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--color-background)]/95 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              aria-label="Voltar ao app"
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
            </a>
            <div className="min-w-0">
              <h1 className="font-display text-base font-bold text-[var(--color-primary-dark)] leading-tight truncate">
                Painel Admin
              </h1>
              <p className="text-xs text-[var(--color-muted-foreground)] truncate">
                Configure o jogo antes de enviar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleReset}
              className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-3 py-1.5 rounded-xl border border-[var(--color-border)] transition-colors"
            >
              Resetar
            </button>
            <button
              onClick={handleSave}
              className={`
                text-sm font-semibold px-4 py-1.5 rounded-xl transition-all duration-200
                ${saveStatus === 'saved'
                  ? 'bg-[var(--color-success)] text-white'
                  : saveStatus === 'error'
                    ? 'bg-[var(--color-destructive)] text-white'
                    : 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 active:scale-95'}
              `}
            >
              {saveStatus === 'saved' ? 'Salvo!' : saveStatus === 'error' ? 'Erro' : 'Salvar'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">

        {/* ── Seção 1: Configuração geral ── */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
            <h2 className="font-display font-bold text-[var(--color-foreground)]">
              Configuracao Geral
            </h2>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              Datas da viagem e a frase secreta final
            </p>
          </div>

          <div className="px-5 py-5 space-y-5">

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="startDate" className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
                  Inicio
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={config.startDate}
                  onChange={(e) => updateDates('startDate', e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
                <p className="text-[11px] text-[var(--color-muted-foreground)]">Dia 1 desbloqueado</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="endDate" className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
                  Termino
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={config.endDate}
                  min={config.startDate}
                  onChange={(e) => updateDates('endDate', e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  Dia {config.totalDays} desbloqueado
                </p>
              </div>
            </div>

            {/* Resumo de periodo */}
            <div className="rounded-xl bg-[var(--color-secondary)] border border-[var(--color-primary)]/20 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-foreground)]">
                <strong>{formatDateBR(config.startDate)}</strong> ate{' '}
                <strong>{formatDateBR(config.endDate)}</strong>
              </span>
              <span className="text-sm font-bold text-[var(--color-primary-dark)]">
                {config.totalDays} dia{config.totalDays !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Frase final */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="phraseDisplay" className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
                  Frase Final Secreta
                </label>
                {/* Contador de caracteres — a meta é exatamente totalDays */}
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full transition-colors
                    ${phraseExact
                      ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                      : phraseOk
                        ? 'bg-[var(--color-secondary)] text-[var(--color-primary-dark)]'
                        : 'bg-red-50 text-[var(--color-destructive)]'}
                  `}
                >
                  {phraseLetterCount} / {config.totalDays}
                </span>
              </div>

              <p className="text-xs text-[var(--color-muted-foreground)]">
                Digite a frase com espacos para exibicao. A frase precisa ter{' '}
                <strong>{config.totalDays} letras</strong> (sem espacos) — uma por dia.
                {phraseLetterCount > config.totalDays && (
                  <span className="text-[var(--color-accent)]">
                    {' '}As {phraseLetterCount - config.totalDays} letras extras serao reveladas automaticamente no ultimo dia.
                  </span>
                )}
              </p>

              <input
                id="phraseDisplay"
                type="text"
                value={config.finalPhraseDisplay}
                placeholder={`Frase com ${config.totalDays} letras (sem espacos)`}
                onChange={(e) => updatePhraseFields(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[var(--color-foreground)] font-display tracking-wider focus:outline-none transition-colors uppercase bg-[var(--color-input)]
                  ${phraseOk
                    ? 'border-[var(--color-input)] focus:border-[var(--color-primary)]'
                    : 'border-[var(--color-destructive)]/50 focus:border-[var(--color-destructive)]'}
                `}
              />

              {/* Frase sem espacos */}
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                Sem espacos:{' '}
                <strong className="font-mono tracking-widest text-[var(--color-foreground)]">
                  {config.finalPhrase || '—'}
                </strong>
              </p>

              {/* Aviso quando frase for insuficiente */}
              {!phraseOk && (
                <div className="rounded-xl bg-red-50 border border-[var(--color-destructive)]/20 px-3 py-2.5">
                  <p className="text-xs text-[var(--color-destructive)] font-medium">
                    A frase tem {phraseLetterCount} letra{phraseLetterCount !== 1 ? 's' : ''}, mas a viagem tem{' '}
                    {config.totalDays} dia{config.totalDays !== 1 ? 's' : ''}. Adicione mais{' '}
                    {config.totalDays - phraseLetterCount} letra{config.totalDays - phraseLetterCount !== 1 ? 's' : ''} ou
                    encurte o periodo.
                  </p>
                </div>
              )}
            </div>

            {/* Preview do tabuleiro */}
            {distribution && phraseOk && (
              <LetterDistributionPreview
                config={config}
                distribution={distribution}
              />
            )}
          </div>
        </section>

        {/* ── Seção 2: Dias em acordeão ── */}
        <section className="space-y-2">
          <div className="px-1">
            <h2 className="font-display font-bold text-[var(--color-foreground)]">
              Configuracao dos {config.totalDays} Dias
            </h2>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              Cada dia e desbloqueado automaticamente na data correspondente. Clique para expandir e editar.
            </p>
          </div>

          {config.days.map((day) => (
            <DayAccordion
              key={day.day}
              day={day}
              startDate={config.startDate}
              isOpen={openDay === day.day}
              distribution={distribution}
              testingAudio={testingAudio}
              audioRef={(el) => { audioRefs.current[day.day] = el }}
              onToggle={() => setOpenDay((prev) => (prev === day.day ? null : day.day))}
              onUpdate={(patch) => updateDay(day.day, patch)}
              onTestAudio={(url) => handleTestAudio(day.day, url)}
              onAudioUpload={(file) => handleAudioUpload(day.day, file)}
              onAttachmentUpload={(file) => handleAttachmentUpload(day.day, file)}
            />
          ))}
        </section>

        {/* ── Botão salvar fixo no mobile ── */}
        <div className="fixed bottom-0 inset-x-0 z-20 bg-[var(--color-background)]/95 backdrop-blur-sm border-t border-[var(--color-border)] px-4 py-3 md:hidden">
          <button
            onClick={handleSave}
            className={`
              w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-200
              ${saveStatus === 'saved'
                ? 'bg-[var(--color-success)] text-white'
                : saveStatus === 'error'
                  ? 'bg-[var(--color-destructive)] text-white'
                  : 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'}
            `}
          >
            {saveStatus === 'saved'
              ? 'Configuracoes salvas!'
              : saveStatus === 'error'
                ? 'Erro ao salvar'
                : 'Salvar Configuracoes'}
          </button>
        </div>

      </main>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────

function LetterDistributionPreview({
  config,
  distribution,
}: {
  config: AdminConfig
  distribution: ReturnType<typeof computeLetterDistribution>
}) {
  // Usar a frase sem espaços para construir os grupos de palavras
  // a partir da frase COM espaços para exibição
  const displayWords = config.finalPhraseDisplay.toUpperCase().split(' ').filter(Boolean)
  const wordGroups: Array<number[]> = []
  let cursor = 1
  for (const word of displayWords) {
    const len = word.replace(/\s/g, '').length
    wordGroups.push(Array.from({ length: len }, (_, i) => cursor + i))
    cursor += len
  }
  // Se não houver espaços, exibir como bloco único
  if (wordGroups.length === 0 && config.finalPhrase.length > 0) {
    wordGroups.push(Array.from({ length: config.finalPhrase.length }, (_, i) => i + 1))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
        Preview do tabuleiro
      </p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">
        Cada posicao mostra qual dia entrega aquela letra.
        {distribution.bonusPositions.length > 0 && ' Posicoes "bns" sao reveladas automaticamente no ultimo dia.'}
      </p>
      <div className="rounded-xl bg-[var(--color-muted)] p-3 flex flex-wrap justify-center gap-x-2 gap-y-2">
        {wordGroups.map((positions, wi) => (
          <div key={wi} className="flex gap-1">
            {positions.map((pos) => {
              const letter = distribution.phraseMap[pos]
              const deliveredBy = Object.entries(distribution.dayToPosition).find(
                ([, p]) => p === pos
              )
              const isBonus = distribution.bonusPositions.includes(pos)
              return (
                <div key={pos} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-8 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-display border
                      ${deliveredBy
                        ? 'bg-[var(--color-secondary)] border-[var(--color-primary)]/40 text-[var(--color-primary-dark)]'
                        : isBonus
                          ? 'bg-[var(--color-locked-bg)] border-[var(--color-locked)]/30 text-[var(--color-locked)]'
                          : 'bg-[var(--color-muted)] border-[var(--color-border)] text-[var(--color-muted-foreground)]'}
                    `}
                    title={deliveredBy ? `Dia ${deliveredBy[0]}` : isBonus ? 'Bonus ultimo dia' : ''}
                  >
                    {letter ?? '?'}
                  </div>
                  <span className="text-[9px] font-mono text-[var(--color-muted-foreground)]">
                    {deliveredBy ? `d${deliveredBy[0]}` : isBonus ? 'bns' : '?'}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayAccordion({
  day,
  startDate,
  isOpen,
  distribution,
  testingAudio,
  audioRef,
  onToggle,
  onUpdate,
  onTestAudio,
  onAudioUpload,
  onAttachmentUpload,
}: {
  day: AdminDayConfig
  startDate: string
  isOpen: boolean
  distribution: ReturnType<typeof computeLetterDistribution> | null
  testingAudio: number | null
  audioRef: (el: HTMLAudioElement | null) => void
  onToggle: () => void
  onUpdate: (patch: Partial<AdminDayConfig>) => void
  onTestAudio: (url: string) => void
  onAudioUpload: (file: File) => void
  onAttachmentUpload: (file: File) => void
}) {
  const position = distribution?.dayToPosition[day.day]
  const letter = position ? distribution?.phraseMap[position] : undefined
  const unlockDate = unlockDateFor(startDate, day.day)

  const isComplete =
    Boolean(day.title) &&
    Boolean(day.challenge) &&
    Boolean(day.answer) &&
    Boolean(day.successMessage)

  return (
    <div className={`rounded-2xl border transition-colors duration-200 ${isOpen ? 'border-[var(--color-primary)]/50 bg-[var(--color-card)]' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 rounded-2xl"
      >
        {/* Badge do dia */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold
          ${isComplete ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}
        `}>
          {isComplete ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          ) : day.day}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-foreground)] truncate">
              {day.emoji} {day.title || `Dia ${day.day}`}
            </span>
          </div>
          {/* Data de desbloqueio + letra */}
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 flex items-center gap-2">
            <span>Desbloqueia em <strong className="text-[var(--color-foreground)]">{unlockDate}</strong></span>
            {letter && position && (
              <>
                <span className="text-[var(--color-border)]">·</span>
                <span>
                  Letra{' '}
                  <strong className="text-[var(--color-primary)] font-display">{letter}</strong>
                  {' '}(pos.{position})
                </span>
              </>
            )}
          </p>
        </div>

        {/* Status + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isComplete && (
            <span className="text-[10px] text-[var(--color-muted-foreground)] bg-[var(--color-muted)] px-2 py-0.5 rounded-full">
              incompleto
            </span>
          )}
          {day.audioUrl && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--color-primary)]" aria-hidden>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
            className={`text-[var(--color-muted-foreground)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {isOpen && (
        <div className="px-4 pb-5 space-y-4 border-t border-[var(--color-border)]/50 pt-4 animate-slide-up">

          {/* Emoji + Titulo */}
          <div className="grid grid-cols-[64px_1fr] gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">Emoji</label>
              <input
                type="text"
                value={day.emoji}
                maxLength={4}
                onChange={(e) => onUpdate({ emoji: e.target.value })}
                className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-2 py-2.5 text-center text-lg focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">Titulo do dia</label>
              <input
                type="text"
                value={day.title}
                placeholder="Ex: O Primeiro Passo"
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
          </div>

          {/* Desafio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
              Desafio do dia
            </label>
            <textarea
              value={day.challenge}
              rows={3}
              placeholder="Descreva o desafio fotografico ou missao do dia..."
              onChange={(e) => onUpdate({ challenge: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] resize-none focus:outline-none focus:border-[var(--color-primary)] transition-colors leading-relaxed"
            />
          </div>

          {/* Resposta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
              Resposta correta
            </label>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Ela precisa digitar essa palavra (sem acento e maiusculas/minusculas sao ignorados).
            </p>
            <input
              type="text"
              value={day.answer}
              placeholder="Ex: amor"
              onChange={(e) => onUpdate({ answer: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          {/* Mensagem de sucesso */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
              Mensagem ao acertar
            </label>
            <textarea
              value={day.successMessage}
              rows={2}
              placeholder="Ex: Arrasou, meu amor! Guarda essa memoria com carinho."
              onChange={(e) => onUpdate({ successMessage: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] resize-none focus:outline-none focus:border-[var(--color-primary)] transition-colors leading-relaxed"
            />
          </div>

          {/* Audio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-widest">
              Áudio do desafio (opcional)
            </label>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Faça upload de um arquivo .mp3, .ogg, .wav ou .m4a. O áudio será salvo no projeto e ficará disponível em qualquer aparelho.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    onAudioUpload(file)
                  }
                }}
                className="block w-full text-sm text-[var(--color-muted-foreground)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
              />
              <div className="flex gap-2">
                <input
                  type="url"
                  value={day.audioUrl}
                  placeholder="https://..."
                  onChange={(e) => onUpdate({ audioUrl: e.target.value })}
                  className="flex-1 rounded-xl border border-[var(--color-input)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
                {day.audioUrl && (
                  <button
                    onClick={() => onTestAudio(day.audioUrl)}
                    aria-label={testingAudio === day.day ? 'Parar audio' : 'Testar audio'}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all
                      ${testingAudio === day.day
                        ? 'bg-[var(--color-primary)] text-white animate-glow'
                        : 'bg-[var(--color-secondary)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)] hover:text-white'}
                    `}
                  >
                    {testingAudio === day.day ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <rect x="5" y="4" width="4" height="16" rx="1" />
                        <rect x="15" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              {day.audioUrl && (
                <p className="text-[11px] text-[var(--color-primary)]">Áudio salvo em: {day.audioUrl}</p>
              )}
            </div>
            <audio ref={audioRef} preload="none" className="hidden" />
          </div>

          {/* Chips de emojis sugeridos */}
          <div className="space-y-1.5">
            <p className="text-[11px] text-[var(--color-muted-foreground)] uppercase tracking-widest font-semibold">
              Emojis sugeridos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => onUpdate({ emoji: em })}
                  className={`text-lg w-9 h-9 rounded-xl transition-all border
                    ${day.emoji === em
                      ? 'bg-[var(--color-secondary)] border-[var(--color-primary)]/50'
                      : 'bg-[var(--color-muted)] border-transparent hover:border-[var(--color-border)]'}
                  `}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
