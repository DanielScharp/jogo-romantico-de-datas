// ============================================================
// Admin Config — tipos e helpers de armazenamento compartilhado
// ============================================================
//
// O admin salva um único objeto `AdminConfig` via API no servidor,
// em um arquivo JSON do projeto. O app (GameClient) lê esse
// objeto via `loadAdminConfig()` e usa como fonte de verdade.
//
// Distribuição de letras:
//   A frase final (sem espaços, sem acento nas comparações) é
//   dividida pelos 15 dias. O algoritmo embaralha deterministicamente
//   as posições e entrega uma por dia. As posições restantes (se a
//   frase tiver mais de 15 letras) são reveladas como bônus no dia 15.
// ============================================================

// ── Tipos ────────────────────────────────────────────────────

export interface AdminDayConfig {
  day: number
  title: string
  emoji: string
  challenge: string
  answer: string
  successMessage: string
  audioUrl: string
  allowAttachment: boolean
  attachmentUrl: string
}

export interface AdminConfig {
  /** ISO date string: "2026-07-12" */
  startDate: string
  /** ISO date string: "2026-07-26" */
  endDate: string
  /** Frase final SEM espaços (ex: "AMOVOCÊMAISQUETUDO") */
  finalPhrase: string
  /** Frase final COM espaços — para exibição (ex: "AMO VOCÊ MAIS QUE TUDO") */
  finalPhraseDisplay: string
  /** Número de dias (calculado a partir de start/end, máx 15) */
  totalDays: number
  /** Array com config de cada dia, indexado por dia (1-based, índice 0 = dia 1) */
  days: AdminDayConfig[]
}

// ── Defaults ────────────────────────────────────────────────

export const DEFAULT_EMOJIS = ['✈️','🌈','🍽️','🌅','🔍','💧','🛤️','🪞','🌇','🤝','🍃','🎨','🌸','📸','💌']

export function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function cleanPhrase(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '')
}

export function buildInitialAdminConfig(): AdminConfig {
  const start = todayISO()
  const end = shiftDate(start, 14)
  const totalDays = daysBetween(start, end)
  const display = 'TE AMO PARA SEMPRE'
  return {
    startDate: start,
    endDate: end,
    finalPhrase: cleanPhrase(display),
    finalPhraseDisplay: display,
    totalDays,
    days: buildDefaultDays(totalDays),
  }
}

export function buildDefaultDays(total: number): AdminDayConfig[] {
  return Array.from({ length: total }, (_, i) => ({
    day: i + 1,
    title: `Dia ${i + 1}`,
    emoji: DEFAULT_EMOJIS[i] ?? '💛',
    challenge: '',
    answer: '',
    successMessage: '',
    audioUrl: '',
    allowAttachment: false,
    attachmentUrl: '',
  }))
}

// ── Distribuição de letras ───────────────────────────────────

export interface LetterDistribution {
  /** Mapa posição (1-indexed) → letra, para todas as letras da frase */
  phraseMap: Record<number, string>
  /** Por dia: qual posição da frase é entregue (day 1-indexed → position) */
  dayToPosition: Record<number, number>
  /** Posições extras reveladas no último dia */
  bonusPositions: number[]
}

/**
 * Dado a frase final (sem espaços) e o total de dias,
 * calcula quais posições são entregues por dia.
 *
 * Algoritmo:
 *  1. Gera um array de todas as posições [1..n]
 *  2. Embaralha deterministicamente usando a própria frase como seed
 *  3. Os primeiros `totalDays` elementos são entregues um por dia
 *  4. O restante é reservado como bônus no último dia
 */
export function computeLetterDistribution(phrase: string, totalDays: number): LetterDistribution {
  const upper = phrase.toUpperCase()
  const n = upper.length

  // phraseMap: posição 1-indexed → letra
  const phraseMap: Record<number, string> = {}
  for (let i = 0; i < n; i++) {
    phraseMap[i + 1] = upper[i]
  }

  // Posições para embaralhar
  const positions = Array.from({ length: n }, (_, i) => i + 1)

  // Embaralha deterministicamente (Fisher-Yates com seed da frase)
  function seededRand(seed: number) {
    // LCG simples
    return ((seed * 1664525 + 1013904223) & 0xffffffff) >>> 0
  }
  let seed = upper.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  for (let i = positions.length - 1; i > 0; i--) {
    seed = seededRand(seed)
    const j = seed % (i + 1)
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }

  const days = Math.min(totalDays, n)
  const dayToPosition: Record<number, number> = {}
  for (let d = 1; d <= days; d++) {
    dayToPosition[d] = positions[d - 1]
  }

  const bonusPositions = positions.slice(days)

  return { phraseMap, dayToPosition, bonusPositions }
}

// ── Store helpers via API ───────────────────────────────────

export async function loadAdminConfig(): Promise<AdminConfig | null> {
  if (typeof window === 'undefined') return null
  try {
    const response = await fetch('/api/game-store')
    if (!response.ok) return null
    const data = (await response.json()) as { config?: AdminConfig | null }
    return data.config ?? null
  } catch {
    return null
  }
}

export async function saveAdminConfig(config: AdminConfig): Promise<void> {
  const response = await fetch('/api/game-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-config', config }),
  })

  if (!response.ok) {
    throw new Error('Falha ao salvar configuração')
  }
}

export async function clearAdminConfig(): Promise<void> {
  const response = await fetch('/api/game-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset' }),
  })

  if (!response.ok) {
    throw new Error('Falha ao resetar configuração')
  }
}

// ── Helpers de data ──────────────────────────────────────────

/** Retorna diferença em dias entre duas ISO date strings (end - start), mínimo 1 */
export function daysBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, diff)
}

/** Formata "2026-07-12" → "12/07/2026" */
export function formatDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Data ISO de hoje: "2026-07-07" */
export function todayISO(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}
