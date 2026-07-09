import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('audio')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 })
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/x-mpeg', 'audio/mp4']
    const fileNameLower = file.name.toLowerCase()
    const hasAllowedExtension = /\.(mp3|wav|ogg|m4a|aac|webm|mp4|mpeg|mpga)$/i.test(fileNameLower)
    const hasAllowedMime = allowedTypes.includes(file.type)

    if (!hasAllowedMime && !hasAllowedExtension) {
      return NextResponse.json({ error: 'Tipo de arquivo não suportado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const uploadDir = path.join(process.cwd(), 'public', 'audio')
    await fs.mkdir(uploadDir, { recursive: true })

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${Date.now()}-${safeName}`
    const filePath = path.join(uploadDir, fileName)

    await fs.writeFile(filePath, Buffer.from(bytes))

    return NextResponse.json({ url: `/audio/${fileName}` })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar áudio' }, { status: 500 })
  }
}
