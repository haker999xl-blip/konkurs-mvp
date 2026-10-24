/**
 * Прод-сервер: раздаёт собранный dist/ и обрабатывает /api в одном процессе.
 * Запуск: npm run build && npm start (порт 4173, переопределяется PORT).
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleApi } from './api.js';

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '0.0.0.0';
const ROOT = resolve(process.cwd(), 'dist');

/** Типы файлов, которые реально отдаёт SPA. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Не выпускаем запрос за пределы dist. Битый процент в URL — тоже мимо. */
function safePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const target = normalize(join(ROOT, decoded));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

/** Отдаёт файл, если он существует; иначе false. */
async function sendFile(res, filePath) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': filePath.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';

  if (url.startsWith('/api/')) {
    try {
      await handleApi(req, res);
    } catch (error) {
      console.error('[api]', error);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }));
    }
    return;
  }

  const filePath = safePath(url);
  if (filePath && (await sendFile(res, filePath))) return;

  // SPA-фолбэк: любой неизвестный путь отдаёт index.html, маршрутизацией займётся React Router.
  if (!(await sendFile(res, join(ROOT, 'index.html')))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Сначала соберите фронтенд: npm run build');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Достижения лицея: http://localhost:${PORT}`);
});