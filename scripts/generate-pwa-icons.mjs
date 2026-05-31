import sharp from 'sharp'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const sourcePath = join(publicDir, 'icon-source.png')

if (!existsSync(sourcePath)) {
  console.error('Falta public/icon-source.png — coloca aí a imagem original do ícone.')
  process.exit(1)
}

mkdirSync(publicDir, { recursive: true })

const source = sharp(sourcePath)

async function writePng(size, name) {
  await source
    .clone()
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(join(publicDir, name))
}

await writePng(192, 'icon-192.png')
await writePng(512, 'icon-512.png')
await writePng(180, 'apple-touch-icon.png')
await writePng(32, 'favicon.png')

console.log(
  'Ícones gerados: icon-192.png, icon-512.png, apple-touch-icon.png, favicon.png (a partir de icon-source.png)',
)
