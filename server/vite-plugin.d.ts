/** Типы dev-плагина API: JS-модуль, который монтирует бэкенд в Vite. */
export interface ApiPlugin {
  name: string;
  configureServer(server: { middlewares: { use(fn: unknown): void } }): void;
  configurePreviewServer(server: { middlewares: { use(fn: unknown): void } }): void;
}

export function apiPlugin(): ApiPlugin;

export default apiPlugin;