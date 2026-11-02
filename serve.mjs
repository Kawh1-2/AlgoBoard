/**
 * 零依赖静态服务器。
 * 只做三件事：托管 dist/、SPA 回退到 index.html、启动后自动打开浏览器。
 * 不依赖 node_modules，删了依赖也能跑（只要 dist/ 还在）。
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const PORT = 1001
const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = resolve(join(ROOT, urlPath))

  // 防目录穿越
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  let info = await stat(filePath).catch(() => null)
  if (!info || info.isDirectory()) {
    filePath = join(ROOT, 'index.html')
    info = await stat(filePath).catch(() => null)
  }

  if (!info) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('dist/ 不存在，请先运行 npm run build')
    return
  }

  try {
    const data = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(data)
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal error')
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。`)
    console.error('请先关闭占用该端口的程序，而不是改用其他端口。')
    console.error('原因是画板数据绑定在 http://localhost:' + PORT + ' 这个地址上，换端口会读不到旧数据。\n')
    process.exit(1)
  }
  throw err
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`
  console.log(`\n  AlgoBoard 已启动: ${url}\n  关闭此窗口即可停止服务。\n`)
  exec(`start "" "${url}"`)
})
