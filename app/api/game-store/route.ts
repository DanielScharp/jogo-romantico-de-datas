import { NextResponse } from 'next/server'
import {
  readGameStore,
  saveAdminConfigToStore,
  saveProgressToStore,
  resetGameStore,
} from '@/lib/db'

export async function GET() {
  const store = await readGameStore()
  return NextResponse.json(store)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body?.action

    if (action === 'save-config') {
      const store = await saveAdminConfigToStore(body.config)
      return NextResponse.json(store)
    }

    if (action === 'save-progress') {
      const store = await saveProgressToStore(body.progress)
      return NextResponse.json(store)
    }

    if (action === 'reset') {
      const store = await resetGameStore()
      return NextResponse.json(store)
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 })
  }
}
