'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface LetterBoardProps {
  unlockedLetters: Record<number, string>  // position(canonical) → letter
  lastDayCompleted: boolean
  finalPhraseCompleted: boolean
  phraseMap: Record<number, string>        // position → correct letter (only admin knows this)
  bonusPositions: number[]
  finalPhraseDisplay: string
  totalLetters: number
  onFinalPhraseSolved?: () => void
}

// A chip in the bank — identified by an opaque id (the canonical position)
// but we do NOT show the position to the player
interface BankChip {
  id: number    // canonical phrase position — used internally only
  letter: string
}

// What sits on a board cell
interface CellPlacement {
  chipId: number   // which chip from the bank
  letter: string
}

export default function LetterBoard({
  unlockedLetters,
  lastDayCompleted,
  finalPhraseCompleted,
  phraseMap,
  bonusPositions,
  finalPhraseDisplay,
  totalLetters,
  onFinalPhraseSolved,
}: LetterBoardProps) {
  // Merge bonus letters (last day reward) into available set
  const allUnlocked: Record<number, string> = { ...unlockedLetters }
  if (lastDayCompleted) {
    bonusPositions.forEach((pos) => { allUnlocked[pos] = phraseMap[pos] })
  }

  // board: cellIndex (1-based board position) → placed chip
  // NOTE: cellIndex is just a visual slot, NOT the canonical phrase position
  const [board, setBoard] = useState<Record<number, CellPlacement>>({})
  // which chip is currently being dragged
  const [dragging, setDragging] = useState<number | null>(null)
  // which cell is highlighted during drag-over
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  // final validation state
  const [validated, setValidated] = useState<'idle' | 'correct' | 'wrong'>('idle')
  // wrong animation: shake the whole board
  const [shaking, setShaking] = useState(false)

  const isSolved = finalPhraseCompleted || validated === 'correct'
  const totalUnlocked = Object.keys(allUnlocked).length

  // All available chips, sorted by letter for a tidy display
  const allChips: BankChip[] = Object.entries(allUnlocked)
    .map(([id, letter]) => ({ id: Number(id), letter }))
    .sort((a, b) => a.letter.localeCompare(b.letter, 'pt'))

  // Chips currently sitting on the board
  const usedChipIds = new Set(Object.values(board).map((c) => c.chipId))

  // Chips still in the bank (not placed)
  const bankChips = allChips.filter((c) => !usedChipIds.has(c.id))

  // Board slot count = total letters in phrase
  const boardSlots = totalLetters

  // Count filled cells
  const filledCount = Object.keys(board).length

  // Whether all slots are filled
  const allFilled = filledCount === boardSlots && boardSlots > 0

  // Build word groups from display phrase (for visual spacing)
  const wordGroups: number[][] = (() => {
    const words = finalPhraseDisplay.toUpperCase().split(' ')
    const groups: number[][] = []
    let slot = 1
    for (const word of words) {
      const g: number[] = []
      for (let i = 0; i < word.length; i++) g.push(slot++)
      groups.push(g)
    }
    return groups
  })()

  useEffect(() => {
    if (!finalPhraseCompleted || Object.keys(board).length > 0) return

    const restoredBoard = Object.fromEntries(
      Array.from({ length: boardSlots }, (_, index) => {
        const slot = index + 1
        const letter = phraseMap[slot]
        if (!letter) return null
        return [slot, { chipId: slot, letter }]
      }).filter(Boolean) as Array<[number, CellPlacement]>
    )

    if (Object.keys(restoredBoard).length > 0) {
      setBoard(restoredBoard)
      setValidated('correct')
    }
  }, [board, boardSlots, finalPhraseCompleted, phraseMap])

  // ── Validation ────────────────────────────────────────────────────────────────
  // The correct sequence is simply the phrase itself, positionally.
  // phraseMap[pos] gives the correct letter at phrase position `pos`.
  // Our board maps cellSlot (1..N) → chipId, and we check if
  // phraseMap[cellSlot] === placed chip's letter.
  const handleValidate = useCallback(() => {
    if (!allFilled) return
    const isCorrect = Array.from({ length: boardSlots }, (_, i) => i + 1).every((slot) => {
      const placed = board[slot]
      if (!placed) return false
      return phraseMap[slot] === placed.letter
    })
    if (isCorrect) {
      setValidated('correct')
      onFinalPhraseSolved?.()
    } else {
      setValidated('wrong')
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setValidated('idle')
      }, 700)
    }
  }, [allFilled, board, boardSlots, phraseMap])

  // ── Place / remove helpers ────────────────────────────────────────────────────
  const placeChip = useCallback((chipId: number, letter: string, cellSlot: number) => {
    if (isSolved) return

    setValidated('idle')
    setBoard((prev) => {
      const next = { ...prev }
      // If cell already occupied, return old chip to bank (just overwrite)
      next[cellSlot] = { chipId, letter }
      return next
    })
  }, [])

  const removeFromCell = useCallback((cellSlot: number) => {
    if (isSolved) return

    setValidated('idle')
    setBoard((prev) => {
      const next = { ...prev }
      delete next[cellSlot]
      return next
    })
  }, [])

  // ── Mouse drag ────────────────────────────────────────────────────────────────
  const onChipDragStart = (chipId: number) => {
    setDragging(chipId)
    setValidated('idle')
  }
  const onChipDragEnd = () => { setDragging(null); setHoveredCell(null) }

  const onCellDragOver = (e: React.DragEvent, slot: number) => {
    e.preventDefault()
    setHoveredCell(slot)
  }
  const onCellDragLeave = () => setHoveredCell(null)
  const onCellDrop = (e: React.DragEvent, slot: number) => {
    if (isSolved) return

    e.preventDefault()
    setHoveredCell(null)
    if (dragging === null) return
    const chip = allChips.find((c) => c.id === dragging)
    if (!chip) return
    placeChip(chip.id, chip.letter, slot)
    setDragging(null)
  }

  // Drag a chip FROM the board back to another cell
  const onBoardChipDragStart = (e: React.DragEvent, fromSlot: number) => {
    const placed = board[fromSlot]
    if (!placed) return
    setDragging(placed.chipId)
    // Remove from current cell immediately so it feels natural
    setTimeout(() => removeFromCell(fromSlot), 0)
  }

  // ── Touch drag (mobile) ───────────────────────────────────────────────────────
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const touchChipRef = useRef<{ chipId: number; letter: string; fromSlot?: number } | null>(null)

  const spawnGhost = (x: number, y: number, letter: string) => {
    const ghost = document.createElement('div')
    ghost.id = 'letter-ghost'
    ghost.textContent = letter
    ghost.style.cssText = `
      position:fixed;z-index:9999;pointer-events:none;
      width:44px;height:48px;border-radius:14px;
      background:var(--color-primary);color:var(--color-primary-foreground);
      display:flex;align-items:center;justify-content:center;
      font-size:20px;font-weight:700;opacity:0.93;
      box-shadow:0 8px 24px rgba(212,120,154,0.4);
      transform:scale(1.15) rotate(-3deg);
    `
    ghost.style.left = `${x - 22}px`
    ghost.style.top = `${y - 24}px`
    document.body.appendChild(ghost)
    ghostRef.current = ghost
  }

  const moveGhost = (x: number, y: number) => {
    if (!ghostRef.current) return
    ghostRef.current.style.left = `${x - 22}px`
    ghostRef.current.style.top = `${y - 24}px`
  }

  const removeGhost = () => {
    ghostRef.current?.remove()
    ghostRef.current = null
  }

  const onBankTouchStart = (e: React.TouchEvent, chipId: number, letter: string) => {
    touchChipRef.current = { chipId, letter }
    setDragging(chipId)
    const t = e.touches[0]
    spawnGhost(t.clientX, t.clientY, letter)
  }

  const onBoardTouchStart = (e: React.TouchEvent, fromSlot: number) => {
    const placed = board[fromSlot]
    if (!placed) return
    touchChipRef.current = { chipId: placed.chipId, letter: placed.letter, fromSlot }
    setDragging(placed.chipId)
    removeFromCell(fromSlot)
    const t = e.touches[0]
    spawnGhost(t.clientX, t.clientY, placed.letter)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    moveGhost(t.clientX, t.clientY)
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const cellEl = el?.closest('[data-cell-slot]')
    setHoveredCell(cellEl ? Number(cellEl.getAttribute('data-cell-slot')) : null)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    removeGhost()
    const t = e.changedTouches[0]
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const cellEl = el?.closest('[data-cell-slot]')
    const slot = cellEl ? Number(cellEl.getAttribute('data-cell-slot')) : null
    if (slot && touchChipRef.current) {
      placeChip(touchChipRef.current.chipId, touchChipRef.current.letter, slot)
    }
    touchChipRef.current = null
    setDragging(null)
    setHoveredCell(null)
  }

  // ── Derived display ───────────────────────────────────────────────────────────
  const getCellState = (slot: number) => {
    const placed = board[slot]
    const isHovered = hoveredCell === slot
    if (isSolved) return 'correct'
    if (placed) return isHovered ? 'filled-hovered' : 'filled'
    if (isHovered && dragging !== null) return 'hovered'
    return slot > totalUnlocked ? 'locked' : 'empty'
  }

  return (
    <section
      aria-label="Tabuleiro da mensagem secreta"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-foreground)] font-display">
          Mensagem Secreta
        </h2>
        <span className="text-xs text-[var(--color-muted-foreground)] bg-[var(--color-muted)] px-2.5 py-1 rounded-full">
          {totalUnlocked}/{boardSlots} letra{totalUnlocked !== 1 ? 's' : ''} ganha{totalUnlocked !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress bar — how many letters earned */}
      <div className="h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden" aria-label={`${totalUnlocked} de ${boardSlots} letras desbloqueadas`}>
        <div
          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-700"
          style={{ width: boardSlots > 0 ? `${(totalUnlocked / boardSlots) * 100}%` : '0%' }}
        />
      </div>

      {/* Board */}
      <div
        aria-label="Tabuleiro"
        style={shaking ? { animation: 'shake 0.6s ease-in-out' } : undefined}
        className="flex flex-wrap justify-center gap-x-3 gap-y-3"
      >
        {wordGroups.map((slots, wi) => (
          <div key={wi} className="flex gap-1.5">
            {slots.map((slot) => {
              const state = getCellState(slot)
              const placed = board[slot]

              return (
                <div
                  key={slot}
                  data-cell-slot={slot}
                  onDragOver={(e) => onCellDragOver(e, slot)}
                  onDragLeave={onCellDragLeave}
                  onDrop={(e) => onCellDrop(e, slot)}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div
                    aria-label={placed ? `Posição ${slot}: letra ${placed.letter}` : `Posição ${slot} vazia`}
                    draggable={!!placed && !isSolved}
                    onDragStart={placed ? (e) => onBoardChipDragStart(e, slot) : undefined}
                    onDragEnd={onChipDragEnd}
                    onTouchStart={placed && !isSolved ? (e) => onBoardTouchStart(e, slot) : undefined}
                    onTouchMove={placed ? onTouchMove : undefined}
                    onTouchEnd={placed ? onTouchEnd : undefined}
                    onClick={() => placed && !isSolved && removeFromCell(slot)}
                    className={[
                      'w-9 h-10 rounded-xl flex items-center justify-center',
                      'text-base font-bold font-display select-none transition-all duration-200',
                      'border-2',
                      state === 'correct'
                        ? 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)] shadow-sm'
                        : state === 'filled'
                        ? 'border-[var(--color-primary)]/60 bg-[var(--color-secondary)] text-[var(--color-primary-dark)] cursor-grab active:cursor-grabbing'
                        : state === 'filled-hovered'
                        ? 'border-[var(--color-primary)] bg-[var(--color-secondary)] text-[var(--color-primary-dark)] scale-105 shadow-md cursor-grab'
                        : state === 'hovered'
                        ? 'border-[var(--color-primary)] bg-[var(--color-secondary)] scale-110 shadow-md border-solid'
                        : state === 'empty'
                        ? 'border-dashed border-[var(--color-primary)]/40 bg-[var(--color-muted)] text-transparent'
                        : 'border-[var(--color-locked)]/25 bg-[var(--color-locked-bg)] text-transparent',
                    ].join(' ')}
                  >
                    {placed ? placed.letter : ''}
                  </div>
                  {/* Slot number hidden from player — just a bottom line indicator */}
                  <div className="w-6 h-px bg-[var(--color-border)]" />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Wrong message */}
      {validated === 'wrong' && (
        <p className="text-center text-sm font-medium text-red-400 animate-slide-up">
          Hmm, ainda nao e essa... tente reorganizar as letras!
        </p>
      )}

      {isSolved && (
        <p className="text-center text-sm font-medium text-[var(--color-success)] animate-slide-up">
          Mensagem revelada com sucesso! Ela já ficou salva para você.
        </p>
      )}

      {/* Validate button — only when all slots filled */}
      {allFilled && !isSolved && (
        <button
          onClick={handleValidate}
          className="w-full rounded-xl py-3 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-95 animate-slide-up animate-glow"
        >
          Revelar a mensagem!
        </button>
      )}

      {/* Divider */}
      {bankChips.length > 0 && (
        <div className="border-t border-dashed border-[var(--color-border)]" />
      )}

      {/* Bank of unlocked letters */}
      {bankChips.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-widest">
            Suas letras — arraste para o tabuleiro
          </p>

          <div className="flex flex-wrap gap-2">
            {bankChips.map((chip) => {
              const isBeingDragged = dragging === chip.id
              return (
                <div
                  key={chip.id}
                  draggable
                  onDragStart={() => onChipDragStart(chip.id)}
                  onDragEnd={onChipDragEnd}
                  onTouchStart={(e) => onBankTouchStart(e, chip.id, chip.letter)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  aria-label={`Letra ${chip.letter}, arraste para o tabuleiro`}
                  className={[
                    'w-11 h-12 rounded-xl border-2 flex items-center justify-center',
                    'text-xl font-bold font-display select-none transition-all duration-200',
                    'bg-[var(--color-secondary)] border-[var(--color-primary)]/50 text-[var(--color-primary-dark)]',
                    'cursor-grab active:cursor-grabbing',
                    isBeingDragged
                      ? 'opacity-25 scale-90'
                      : 'hover:scale-110 hover:shadow-md hover:border-[var(--color-primary)] active:scale-95',
                  ].join(' ')}
                >
                  {chip.letter}
                </div>
              )
            })}
          </div>

          {filledCount === 0 && totalUnlocked > 0 && (
            <p className="text-[11px] text-[var(--color-muted-foreground)] italic text-center pt-1">
              Arraste cada letra para uma posicao no tabuleiro acima. Quando preencher tudo, descubra a mensagem!
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {totalUnlocked === 0 && (
        <p className="text-xs text-center text-[var(--color-muted-foreground)] italic py-2">
          As letras aparecem aqui conforme voce completa os desafios de cada dia.
        </p>
      )}

      {/* Celebration */}
      {validated === 'correct' && (
        <div className="relative animate-pop-in rounded-2xl bg-[var(--color-secondary)] border border-[var(--color-primary)]/30 p-5 text-center space-y-2 overflow-hidden">
          <div className="text-5xl" role="img" aria-label="coracao">
            💌
          </div>
          <p className="font-display text-xl font-bold text-[var(--color-primary-dark)] text-balance">
            {finalPhraseDisplay}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
            Voce descobriu a mensagem secreta! Cada letra foi uma lembranca nossa.
          </p>
          <CelebrationConfetti />
        </div>
      )}
    </section>
  )
}

function CelebrationConfetti() {
  const colors = ['#d4789a', '#c9a96e', '#a8c5a0', '#f5d0df', '#e8a4b8', '#f2e8d5']
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 3.7) % 100}%`,
            top: '-10px',
            width: 9,
            height: 9,
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            backgroundColor: colors[i % colors.length],
            animation: `confetti-fall ${0.8 + (i % 5) * 0.18}s ease-out ${(i % 7) * 0.08}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
