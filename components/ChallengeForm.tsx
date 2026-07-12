'use client'

import { useEffect, useRef, useState } from 'react'
import type { DayData } from '@/lib/gameData'

interface ChallengeFormProps {
  dayData: DayData
  alreadyCompleted: boolean
  submittedAnswer?: string
  attachmentUrl?: string
  onAttachmentUploaded?: (dayNumber: number, attachmentUrl: string) => void
  onSubmitAnswer: (dayNumber: number, letter: string, position: number, submittedAnswer: string, isCorrect: boolean) => void
}

// Normaliza string: remove acentos e converte para minúsculas
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function ChallengeForm({ dayData, alreadyCompleted, submittedAnswer = '', attachmentUrl = '', onAttachmentUploaded, onSubmitAnswer }: ChallengeFormProps) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>(
    alreadyCompleted ? 'success' : 'idle'
  )
  const [shake, setShake] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [submittedAnswerState, setSubmittedAnswerState] = useState(submittedAnswer)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [selectedAttachmentName, setSelectedAttachmentName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (alreadyCompleted) {
      setStatus('success')
      setSubmittedAnswerState(submittedAnswer)
    }
  }, [alreadyCompleted, submittedAnswer])

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  const handleAttachmentSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onAttachmentUploaded) return

    const formData = new FormData()
    formData.append('attachment', file)

    setSelectedAttachmentName(file.name)
    setIsUploadingAttachment(true)

    try {
      const response = await fetch('/api/upload-attachment', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Falha ao enviar anexo')

      const data = (await response.json()) as { url?: string }
      if (data.url) {
        onAttachmentUploaded(dayData.day, data.url)
      }
    } catch {
      setStatus('error')
    } finally {
      setIsUploadingAttachment(false)
      event.target.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedValue = value.trim()
    if (!trimmedValue) return

    const isCorrect = normalize(trimmedValue) === normalize(dayData.answer)
    onSubmitAnswer(dayData.day, dayData.letter, dayData.position, trimmedValue, isCorrect)

    if (isCorrect) {
      setSubmittedAnswerState(trimmedValue)
      setStatus('success')
      setConfetti(true)
      setTimeout(() => setConfetti(false), 2000)
    } else {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      setStatus('error')
      setShake(true)
      errorTimerRef.current = setTimeout(() => {
        setShake(false)
        setStatus('idle')
      }, 1800)
    }
  }

  if (status === 'success') {
    return (
      <div className="animate-slide-up rounded-2xl bg-[var(--color-success-bg)] border border-[var(--color-success)] px-4 py-4 text-center space-y-3 relative overflow-hidden">
        {/* Confetti particles */}
        {confetti && <ConfettiEffect />}

        <div className="text-3xl animate-heartbeat">💕</div>
        <p className="text-sm font-medium text-[#3a6b35] leading-relaxed">
          {dayData.successMessage}
        </p>

        {/* Letter reward */}
        <div className="inline-flex flex-col items-center gap-1 bg-white/60 rounded-xl px-5 py-3 border border-[var(--color-success)]">
          <span className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-widest">
            Letra desbloqueada
          </span>
          <span className="text-4xl font-bold text-[var(--color-primary)] font-display animate-pop-in">
            {dayData.letter}
          </span>
        </div>

        {submittedAnswerState && (
          <div className="rounded-xl border border-[var(--color-success)]/30 bg-white/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Resposta enviada
            </p>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">“{submittedAnswerState}”</p>
          </div>
        )}

        {attachmentUrl && (
          <div className="rounded-xl border border-[var(--color-success)]/30 bg-white/70 px-3 py-3">
            <p className="text-[11px] uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">
              Foto anexada
            </p>
            <img src={attachmentUrl} alt="Foto do desafio" className="w-full rounded-lg object-cover max-h-64" />
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-xl border border-[var(--color-border)] bg-white/70 p-3 space-y-2">
        <label className="block text-sm font-medium text-[var(--color-foreground)]">
          Anexe uma foto com a sua resposta (opcional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleAttachmentSelect}
          className="block w-full text-sm text-[var(--color-muted-foreground)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
        />
        {selectedAttachmentName && (
          <p className="text-xs text-[var(--color-foreground)]">Arquivo selecionado: {selectedAttachmentName}</p>
        )}
        {isUploadingAttachment && (
          <p className="text-xs text-[var(--color-muted-foreground)]">Enviando sua foto...</p>
        )}
      </div>

      <label
        htmlFor={`answer-day-${dayData.day}`}
        className="block text-sm font-medium text-[var(--color-foreground)]"
      >
        Sua resposta:
      </label>
      <div className={`flex gap-2 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <input
          ref={inputRef}
          id={`answer-day-${dayData.day}`}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Digite aqui..."
          autoComplete="off"
          className={`
            flex-1 rounded-xl border px-4 py-2.5 text-sm bg-[var(--color-card)]
            placeholder-[var(--color-locked)] outline-none transition-all
            focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20
            ${status === 'error'
              ? 'border-red-400 bg-red-50'
              : 'border-[var(--color-border)]'}
          `}
        />
        <button
          type="submit"
          className="rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-4 py-2.5 text-sm font-medium transition-all active:scale-95 hover:brightness-105 shadow-sm"
        >
          Enviar
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-500 animate-slide-up">
          Hmm, não foi bem isso... Tente novamente, meu amor!
        </p>
      )}
    </form>
  )
}

function ConfettiEffect() {
  const pieces = Array.from({ length: 18 }, (_, i) => i)
  const colors = ['#d4789a', '#c9a96e', '#a8c5a0', '#f5d0df', '#f2e8d5', '#e8a4b8']

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 5.5) % 100}%`,
            top: 0,
            width: 8,
            height: 8,
            borderRadius: i % 3 === 0 ? '50%' : '2px',
            backgroundColor: colors[i % colors.length],
            animation: `confetti-fall ${0.8 + (i % 4) * 0.25}s ease-out ${(i % 5) * 0.12}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
