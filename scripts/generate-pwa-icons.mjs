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

/** Ícone maskable: arte no centro 80% (zona segura Android). */
async function writeMaskablePng(size, name) {
  const inner = Math.round(size * 0.8)
  const padding = Math.round((size - inner) / 2)
  const resized = await source
    .clone()
    .resize(inner, inner, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 7, g: 9, b: 15, alpha: 1 },
    },
  })
    .composite([{ input: resized, left: padding, top: padding }])
    .png()
    .toFile(join(publicDir, name))
}

await writePng(192, 'icon-192.png')
await writePng(512, 'icon-512.png')
await writeMaskablePng(512, 'icon-maskable-512.png')
await writePng(180, 'apple-touch-icon.png')
await writePng(32, 'favicon.png')

console.log(
  'Ícones gerados: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon.png',
)
