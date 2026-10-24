/**
 * Dev-плагин Vite: монтирует API прямо в dev-сервер.
 * Один процесс на всё — не нужно держать отдельный бэкенд на ноутбуке.
 *
 * Серверный код грузим лениво и по абсолютному URL: Vite пытается инлайнить
 * импорты из vite.config в один mjs-файл, и общий `let db` теряется между
 * модулями. Динамический путь этого не позволяет.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

let apiModule = null;

/** Один раз импортирует обработчик API. */
async function loadApi() {
  if (!apiModule) {
    const entry = pathToFileURL(resolve(process.cwd(), 'server', 'api.js')).href;
    apiModule = await import(entry);
  }
  return apiModule;
}

/** Middleware-прослойка: отдаём запросы /api в node-обработчик. */
function createApiMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) {
      next();
      return;
    }
    try {
      const { handleApi } = await loadApi();
      await handleApi(req, res);
    } catch (error) {
      console.error('[api]', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }));
    }
  };
}

/** Плагин для vite.config.ts: `apiPlugin()`. */
export function apiPlugin() {
  return {
    name: 'hackathon-api',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
  };
}

export default apiPlugin;