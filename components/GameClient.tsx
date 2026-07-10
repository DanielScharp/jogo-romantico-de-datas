'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCurrentGameDay, getEffectiveConfig, isDayUnlocked } from '@/lib/gameData'
import type { EffectiveConfig } from '@/lib/gameData'
import { defaultProgress, loadProgress, saveProgress, type GameProgress } from '@/lib/gameStore'
import DayCard from './DayCard'
import LetterBoard from './LetterBoard'

export default function GameClient() {
  const [progress, setProgress] = useState<GameProgress>(defaultProgress)
  const [config, setConfig] = useState<EffectiveConfig | null>(null)
  const [currentDay, setCurrentDay] = useState(0)
  const [activeTab, setActiveTab] = useState<'dias' | 'tabuleiro'>('dias')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false

    void Promise.all([getEffectiveConfig(), loadProgress()]).then(([cfg, storedProgress]) => {
      if (cancelled) return

      setConfig(cfg)
      setProgress(storedProgress)
      setCurrentDay(getCurrentGameDay(cfg.startDate, cfg.totalDays))
      setHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleDayComplete = useCallback(
    (dayNumber: number, letter: string, position: number, submittedAnswer: string) => {
      setProgress((prev) => {
        if (prev.completedDays.includes(dayNumber)) {
          const next: GameProgress = {
            ...prev,
            submittedAnswers: { ...prev.submittedAnswers, [dayNumber]: submittedAnswer },
          }
          void saveProgress(next).catch(() => undefined)
          return next
        }

        const next: GameProgress = {
          completedDays: [...prev.completedDays, dayNumber],
          unlockedLetters: { ...prev.unlockedLetters, [position]: letter },
          submittedAnswers: { ...prev.submittedAnswers, [dayNumber]: submittedAnswer },
          attachedImages: prev.attachedImages,
        }
        void saveProgress(next).catch(() => undefined)
        return next
      })
    },
    []
  )

  const handleAttachmentUploaded = useCallback((dayNumber: number, attachmentUrl: string) => {
    setProgress((prev) => {
      const next: GameProgress = {
        ...prev,
        attachedImages: { ...prev.attachedImages, [dayNumber]: attachmentUrl },
      }
      void saveProgress(next).catch(() => undefined)
      return next
    })
  }, [])

  const handleFinalPhraseSolved = useCallback(() => {
    setProgress((prev) => {
      if (prev.finalPhraseCompleted) {
        return prev
      }

      const next: GameProgress = {
        ...prev,
        finalPhraseCompleted: true,
      }
      void saveProgress(next).catch(() => undefined)
      return next
    })
  }, [])

  if (!hydrated || !config) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  const lastDayCompleted = progress.completedDays.includes(config.totalDays)
  const completedCount = progress.completedDays.length

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--color-background)]/95 backdrop-blur-sm border-b border-[var(--color-border)] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-[var(--color-primary-dark)] leading-tight">
              Nossa Viagem
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {currentDay === 0
                ? 'A aventura começa em breve...'
                : `Dia ${currentDay} de ${config.totalDays} desbloqueado`}
            </p>
          </div>

          {/* Heart + progress */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg
                width="36" height="36" viewBox="0 0 24 24"
                className="animate-heartbeat text-[var(--color-primary)]"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {completedCount}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex rounded-2xl bg-[var(--color-muted)] p-1 gap-1" role="tablist">
          {(['dias', 'tabuleiro'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex-1 rounded-xl py-2 text-sm font-medium transition-all duration-200
                ${activeTab === tab
                  ? 'bg-[var(--color-card)] text-[var(--color-primary-dark)] shadow-sm'
                  : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}
              `}
            >
              {tab === 'dias' ? 'Dias da Viagem' : 'Mensagem Secreta'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-12">
        {activeTab === 'dias' ? (
          <div className="space-y-3" role="tabpanel" aria-label="Dias da Viagem">
            {/* Before trip banner */}
            {currentDay === 0 && (
              <div className="rounded-2xl bg-[var(--color-secondary)] border border-[var(--color-border)] px-5 py-5 text-center space-y-2 animate-slide-up">
                <div className="text-4xl animate-float">💌</div>
                <p className="font-display text-lg font-semibold text-[var(--color-primary-dark)]">
                  Sua aventura começa em breve!
                </p>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                  O primeiro dia se abrirá no dia combinado. Até lá, guarda o app e prepara o coração.
                </p>
              </div>
            )}

            {config.days.map((day) => (
              <DayCard
                key={day.day}
                dayData={day}
                isUnlocked={isDayUnlocked(day.day, currentDay)}
                isCompleted={progress.completedDays.includes(day.day)}
                submittedAnswer={progress.submittedAnswers[day.day]}
                attachmentUrl={progress.attachedImages[day.day]}
                onAttachmentUploaded={handleAttachmentUploaded}
                onComplete={handleDayComplete}
              />
            ))}
          </div>
        ) : (
          <div role="tabpanel" aria-label="Mensagem Secreta">
            <LetterBoard
              unlockedLetters={progress.unlockedLetters}
              lastDayCompleted={lastDayCompleted}
              finalPhraseCompleted={progress.finalPhraseCompleted}
              phraseMap={config.phraseMap}
              bonusPositions={config.bonusPositions}
              finalPhraseDisplay={config.finalPhraseDisplay}
              totalLetters={Object.keys(config.phraseMap).length}
              onFinalPhraseSolved={handleFinalPhraseSolved}
            />
          </div>
        )}
      </main>
    </div>
  )
}
