import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#07090f" rx="112"/>
<rect x="88" y="88" width="336" height="336" rx="72" fill="#00e5ff"/>
<circle cx="256" cy="228" r="64" fill="#07090f"/>
</svg>`

mkdirSync(publicDir, { recursive: true })

const buf = Buffer.from(svg512)

await sharp(buf).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png'))
await sharp(buf).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png'))
await sharp(buf).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'))

console.log('Wrote public/icon-192.png, icon-512.png, apple-touch-icon.png')
