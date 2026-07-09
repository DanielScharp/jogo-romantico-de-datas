// ============================================================
// gameData.ts — fonte de verdade do jogo
// ============================================================
//
// Os dados abaixo são os DEFAULTS hardcoded.
// Se houver uma config salva pelo admin no store compartilhado,
// ela é usada em vez dos defaults — veja getEffectiveConfig().
// ============================================================

import {
  loadAdminConfig,
  computeLetterDistribution,
  daysBetween,
  type AdminConfig,
} from './adminConfig'

// ── Tipos ─────────────────────────────────────────────────────

export interface DayData {
  day: number
  title: string
  challenge: string
  answer: string
  successMessage: string
  letter: string
  position: number
  audioUrl: string
  emoji: string
  allowAttachment: boolean
  attachmentUrl: string
}

export interface EffectiveConfig {
  days: DayData[]
  totalDays: number
  phraseMap: Record<number, string>
  bonusPositions: number[]
  finalPhraseDisplay: string
  startDate: string
  endDate: string
}

// ── Defaults hardcoded (fallback quando não há config admin) ──

// "TE AMO PARA SEMPRE" sem espaços = TEAMOPARASEMPRE (15 letras)
const DEFAULT_PHRASE = 'TEAMOPARASEMPRE'
const DEFAULT_PHRASE_DISPLAY = 'TE AMO PARA SEMPRE'
const DEFAULT_START = '2026-07-12'
const DEFAULT_END = '2026-07-26'
const DEFAULT_TOTAL = daysBetween(DEFAULT_START, DEFAULT_END)

// Distribuição padrão calculada uma vez
const _defaultDist = computeLetterDistribution(DEFAULT_PHRASE, DEFAULT_TOTAL)

const DEFAULT_DAYS_RAW = [
  { title: 'O Primeiro Passo',     emoji: '✈️', challenge: 'Tire uma foto do lugar onde você chegou hoje. Qual é o nome da cidade ou local?', answer: 'chegada',  successMessage: 'Arrasou, meu amor! Guarda essa memória com carinho.' },
  { title: 'Cores ao Redor',        emoji: '🌈', challenge: 'Encontre algo colorido e bonito. Que cor predomina na paisagem de hoje?',          answer: 'colorida', successMessage: 'Que linda foto você deve ter tirado! Saudades já.' },
  { title: 'Um Novo Sabor',         emoji: '🍽️', challenge: 'Experimente uma comida local. Como você descreveria o sabor em uma palavra?',       answer: 'delicia',  successMessage: 'Tenho certeza que estava gostoso! Quero provar também.' },
  { title: 'O Horizonte',           emoji: '🌅', challenge: 'Encontre uma vista bonita. O que você vê no horizonte?',                            answer: 'horizonte',successMessage: 'Seus olhos são o lugar mais bonito que conheço.' },
  { title: 'Detalhe Escondido',     emoji: '🔍', challenge: 'Procure um detalhe pequeno e bonito que a maioria passa sem ver. O que você encontrou?', answer: 'detalhe', successMessage: 'Você sempre enxerga beleza onde outros não veem.' },
  { title: 'Encontro com a Água',   emoji: '💧', challenge: 'Água de alguma forma — mar, rio, fonte ou chuva. O que a água te lembrou hoje?',    answer: 'agua',     successMessage: 'Assim como a água, meu amor por você não tem fim.' },
  { title: 'A Rua que Conta Histórias', emoji: '🛤️', challenge: 'Caminhe por uma rua nova. Qual é o nome da rua mais bonita que você passou?',  answer: 'rua',      successMessage: 'Cada rua nova é um capítulo da nossa história.' },
  { title: 'Reflexo',               emoji: '🪞', challenge: 'Encontre um reflexo — em vitrine, espelho ou água. O que o reflexo te mostrou?',    answer: 'reflexo',  successMessage: 'No meu reflexo, só vejo alguém que te ama muito.' },
  { title: 'A Hora Dourada',        emoji: '🌇', challenge: 'Observe o céu em algum momento do dia. Que horas você tirou a foto?',               answer: 'ceu',      successMessage: 'Cada pôr do sol que você vê, eu vejo daqui pensando em você.' },
  { title: 'Conexão Local',         emoji: '🤝', challenge: 'Converse com alguém local. O que você aprendeu de novo?',                           answer: 'conexao',  successMessage: 'Você conecta com qualquer pessoa. Isso é um dom seu.' },
  { title: 'O Silêncio Bonito',     emoji: '🍃', challenge: 'Encontre um momento de silêncio e tire uma foto. Onde foi?',                        answer: 'silencio', successMessage: 'Nesse silêncio, meu coração estava gritando saudade.' },
  { title: 'Arte em Todo Lugar',    emoji: '🎨', challenge: 'Encontre arte urbana, grafite ou escultura. O que a obra te transmitiu?',            answer: 'arte',     successMessage: 'Você é a obra de arte mais linda que já vi.' },
  { title: 'O Cheiro do Lugar',     emoji: '🌸', challenge: 'Feche os olhos e respire fundo. Qual é o cheiro característico desse lugar?',       answer: 'aroma',    successMessage: 'Quando você voltar, vou te abraçar e guardar o seu cheiro.' },
  { title: 'O Último Completo',     emoji: '📸', challenge: 'Qual foi o momento mais marcante da viagem até agora?',                             answer: 'memoria',  successMessage: 'Falta só um dia. Estou tão ansioso para te ver!' },
  { title: 'O Grande Final',        emoji: '💌', challenge: 'Chegou o último desafio! Tire uma selfie sorrindo. Qual a primeira palavra que vem à cabeça quando pensa em casa?', answer: 'amor', successMessage: 'Parabéns! Você completou todos os dias!' },
]

function buildDaysFromRaw(
  raw: typeof DEFAULT_DAYS_RAW,
  dist: ReturnType<typeof computeLetterDistribution>
): DayData[] {
  return raw.map((r, i) => {
    const day = i + 1
    const position = dist.dayToPosition[day] ?? 1
    const letter = dist.phraseMap[position] ?? '?'
    return {
      day,
      title: r.title,
      emoji: r.emoji,
      challenge: r.challenge,
      answer: r.answer,
      successMessage: r.successMessage,
      letter,
      position,
      audioUrl: '',
      allowAttachment: false,
      attachmentUrl: '',
    }
  })
}

// ── Config efetiva ────────────────────────────────────────────

/**
 * Retorna a config efetiva do jogo.
 * - No servidor (SSR) retorna sempre os defaults.
 * - No cliente lê o store compartilhado e, se houver config admin, a usa.
 * - Sempre calcula a distribuição de letras a partir da frase atual.
 */
export async function getEffectiveConfig(): Promise<EffectiveConfig> {
  // Tentar ler config admin (só no cliente)
  const admin: AdminConfig | null = await loadAdminConfig()

  if (admin) {
    const dist = computeLetterDistribution(admin.finalPhrase, admin.totalDays)
    const days: DayData[] = admin.days.map((d) => {
      const position = dist.dayToPosition[d.day] ?? 1
      const letter = dist.phraseMap[position] ?? '?'
      return {
        day: d.day,
        title: d.title || `Dia ${d.day}`,
        emoji: d.emoji || '💛',
        challenge: d.challenge,
        answer: d.answer,
        successMessage: d.successMessage,
        letter,
        position,
        audioUrl: d.audioUrl || '',
        allowAttachment: d.allowAttachment || false,
        attachmentUrl: d.attachmentUrl || '',
      }
    })
    return {
      days,
      totalDays: admin.totalDays,
      phraseMap: dist.phraseMap,
      bonusPositions: dist.bonusPositions,
      finalPhraseDisplay: admin.finalPhraseDisplay || admin.finalPhrase,
      startDate: admin.startDate,
      endDate: admin.endDate,
    }
  }

  // Fallback: defaults hardcoded
  return {
    days: buildDaysFromRaw(DEFAULT_DAYS_RAW.slice(0, DEFAULT_TOTAL), _defaultDist),
    totalDays: DEFAULT_TOTAL,
    phraseMap: _defaultDist.phraseMap,
    bonusPositions: _defaultDist.bonusPositions,
    finalPhraseDisplay: DEFAULT_PHRASE_DISPLAY,
    startDate: DEFAULT_START,
    endDate: DEFAULT_END,
  }
}

// ── Funções de progresso temporal ────────────────────────────
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day) // mês é 0-indexado
}

/**
 * Quantos dias do jogo já foram desbloqueados com base na data atual
 * e na data de início configurada.
 */
export function getCurrentGameDay(startDate: string, totalDays: number): number {
  if (typeof window === 'undefined') return 0
  const now = new Date()
  const start = parseDateLocal(startDate)
  // Zerar horas para comparar só datas
  now.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diff < 1) return 0
  return Math.min(diff, totalDays)
}

export function isDayUnlocked(dayNumber: number, currentGameDay: number): boolean {
  return currentGameDay >= dayNumber
}

// ── Legados para compatibilidade (LetterBoard) ────────────────
// Esses exports são recalculados dinamicamente pelo GameClient
// e passados via props; não são mais usados diretamente.
export const DAYS_DATA = buildDaysFromRaw(DEFAULT_DAYS_RAW.slice(0, DEFAULT_TOTAL), _defaultDist)
export const FINAL_PHRASE = DEFAULT_PHRASE
export const FINAL_PHRASE_DISPLAY = DEFAULT_PHRASE_DISPLAY
export const PHRASE_MAP = _defaultDist.phraseMap
export const BONUS_POSITIONS_DAY_15 = _defaultDist.bonusPositions
