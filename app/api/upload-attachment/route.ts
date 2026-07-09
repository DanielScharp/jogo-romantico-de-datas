import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('attachment')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const fileNameLower = file.name.toLowerCase()
    const hasAllowedExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileNameLower)
    const hasAllowedMime = allowedTypes.includes(file.type)

    if (!hasAllowedMime && !hasAllowedExtension) {
      return NextResponse.json({ error: 'Tipo de arquivo não suportado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const uploadDir = path.join(process.cwd(), 'public', 'attachments')
    await fs.mkdir(uploadDir, { recursive: true })

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${Date.now()}-${safeName}`
    const filePath = path.join(uploadDir, fileName)

    await fs.writeFile(filePath, Buffer.from(bytes))

    return NextResponse.json({ url: `/attachments/${fileName}` })
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar anexo' }, { status: 500 })
  }
}
