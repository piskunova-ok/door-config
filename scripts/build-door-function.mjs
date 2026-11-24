import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'

const source = resolve('functions/submit-door-request')
const outDir = resolve('artifacts/door-request-function')
await mkdir(outDir, { recursive: true })
await build({
  configFile: false, publicDir: false, envFile: false,
  ssr: { external: ['pdfkit'] },
  build: {
    ssr: resolve(source, 'handler.mjs'), target: 'node22', outDir, emptyOutDir: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'handler.mjs' } },
  },
})
await Promise.all(['package.json', 'package-lock.json', 'Manrope.ttf', 'OFL.txt'].map(file =>
  copyFile(resolve(source, file), resolve(outDir, file))))
await writeFile(resolve(outDir, 'index.js'),
  "exports.handler = async (event, context) => (await import('./handler.mjs')).handler(event, context)\n")
