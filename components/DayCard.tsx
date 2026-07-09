'use client'

import { useState } from 'react'
import type { DayData } from '@/lib/gameData'
import AudioPlayer from './AudioPlayer'
import ChallengeForm from './ChallengeForm'

interface DayCardProps {
  dayData: DayData
  isUnlocked: boolean
  isCompleted: boolean
  submittedAnswer?: string
  attachmentUrl?: string
  onAttachmentUploaded?: (dayNumber: number, attachmentUrl: string) => void
  onComplete: (dayNumber: number, letter: string, position: number, submittedAnswer: string) => void
}

export default function DayCard({ dayData, isUnlocked, isCompleted, submittedAnswer, attachmentUrl, onAttachmentUploaded, onComplete }: DayCardProps) {
  const [expanded, setExpanded] = useState(false)

  const handleToggle = () => {
    if (isUnlocked) setExpanded((v) => !v)
  }

  return (
    <article
      className={`
        rounded-2xl border transition-all duration-300
        ${isUnlocked
          ? 'bg-[var(--color-card)] border-[var(--color-border)] shadow-sm'
          : 'bg-[var(--color-locked-bg)] border-[var(--color-locked)]/40'}
        ${isCompleted && !expanded ? 'border-[var(--color-success)]/50' : ''}
      `}
    >
      {/* Header — clicável */}
      <button
        onClick={handleToggle}
        disabled={!isUnlocked}
        aria-expanded={expanded}
        aria-label={`Dia ${dayData.day}: ${dayData.title}`}
        className="w-full text-left px-4 py-4 flex items-center gap-3 rounded-2xl"
      >
        {/* Day number badge */}
        <div
          className={`
            flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
            ${isCompleted
              ? 'bg-[var(--color-success)] text-white'
              : isUnlocked
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'bg-[var(--color-locked)]/30 text-[var(--color-locked)]'}
          `}
        >
          {isCompleted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          ) : (
            dayData.day
          )}
        </div>

        {/* Title area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{dayData.emoji}</span>
            <span
              className={`
                text-sm font-semibold truncate
                ${isUnlocked ? 'text-[var(--color-foreground)]' : 'text-[var(--color-locked)]'}
              `}
            >
              {isUnlocked ? dayData.title : `Dia ${dayData.day} — Trancado`}
            </span>
          </div>
          {!isUnlocked && (
            <p className="text-xs text-[var(--color-locked)] mt-0.5">
              Disponível em breve
            </p>
          )}
          {isCompleted && isUnlocked && !expanded && (
            <p className="text-xs text-[var(--color-success)] mt-0.5 font-medium">
              Concluído — letra desbloqueada!
            </p>
          )}
        </div>

        {/* Lock icon or chevron */}
        {!isUnlocked ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-[var(--color-locked)]" aria-hidden>
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
        ) : (
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
            className={`flex-shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
        )}
      </button>

      {/* Expanded content */}
      {isUnlocked && expanded && (
        <div className="px-4 pb-5 space-y-4 animate-slide-up border-t border-[var(--color-border)]/50 pt-4">
          {/* Audio */}
          <AudioPlayer src={dayData.audioUrl} dayNumber={dayData.day} />

          {/* Photo challenge */}
          <div className="rounded-2xl bg-[var(--color-secondary)] border border-[var(--color-border)]/60 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary-dark)] flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              Desafio Fotográfico
            </p>
            <p className="text-sm text-[var(--color-foreground)] leading-relaxed">
              {dayData.challenge}
            </p>
          </div>

          {/* Challenge form */}
          <ChallengeForm
            dayData={dayData}
            alreadyCompleted={isCompleted}
            submittedAnswer={submittedAnswer}
            attachmentUrl={attachmentUrl}
            onAttachmentUploaded={onAttachmentUploaded}
            onComplete={onComplete}
          />
        </div>
      )}
    </article>
  )
}
