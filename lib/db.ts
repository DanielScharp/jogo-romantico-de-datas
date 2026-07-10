import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  buildInitialAdminConfig,
  type AdminConfig,
} from './adminConfig'

export interface Progress {
  completedDays: number[]
  unlockedLetters: Record<number, string>
  submittedAnswers: Record<number, string>
  attachedImages: Record<number, string>
  finalPhraseCompleted: boolean
}

export interface StoredGameData {
  config: AdminConfig
  progress: Progress
}

const DB_FILE_PATH = path.join(process.cwd(), 'db.json')

export const defaultProgress: Progress = {
  completedDays: [],
  unlockedLetters: {},
  submittedAnswers: {},
  attachedImages: {},
  finalPhraseCompleted: false,
}

function buildDefaultStore(): StoredGameData {
  return {
    config: buildInitialAdminConfig(),
    progress: defaultProgress,
  }
}

async function ensureDbFile(): Promise<void> {
  try {
    await fs.access(DB_FILE_PATH)
  } catch {
    await fs.writeFile(DB_FILE_PATH, JSON.stringify(buildDefaultStore(), null, 2), 'utf8')
  }
}

export async function readGameStore(): Promise<StoredGameData> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE_PATH, 'utf8')
  return JSON.parse(raw) as StoredGameData
}

export async function writeGameStore(store: StoredGameData): Promise<void> {
  await ensureDbFile()
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export async function saveAdminConfigToStore(config: AdminConfig): Promise<StoredGameData> {
  const store = await readGameStore()
  const nextStore: StoredGameData = {
    ...store,
    config,
  }
  await writeGameStore(nextStore)
  return nextStore
}

export async function saveProgressToStore(progress: Progress): Promise<StoredGameData> {
  const store = await readGameStore()
  const nextStore: StoredGameData = {
    ...store,
    progress,
  }
  await writeGameStore(nextStore)
  return nextStore
}

export async function resetGameStore(): Promise<StoredGameData> {
  const defaultStore = buildDefaultStore()
  await writeGameStore(defaultStore)
  return defaultStore
}
