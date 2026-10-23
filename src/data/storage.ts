import type { DemoMeta, Participation } from './types';

/** Ключи localStorage. Один корень, чтобы сброс демо был атомарным. */
const ROOT = 'school-contests.v1';

const KEYS = {
  users: `${ROOT}:users`,
  competitions: `${ROOT}:competitions`,
  participations: `${ROOT}:participations`,
  session: `${ROOT}:session`,
  meta: `${ROOT}:meta`,
} as const;

/** Безопасное чтение JSON: повреждённый ключ не роняет приложение. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Запись JSON с обработкой квоты (localStorage может быть переполнен). */
export function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  localStorage.removeItem(key);
}

export { KEYS };

/** Удобные типизированные аксессоры, чтобы не повторять имена ключей. */
export const storage = {
  users: {
    read: <TDefault>(fallback: TDefault) => readJson(KEYS.users, fallback),
    write: (v: unknown) => writeJson(KEYS.users, v),
  },
  competitions: {
    read: <TDefault>(fallback: TDefault) => readJson(KEYS.competitions, fallback),
    write: (v: unknown) => writeJson(KEYS.competitions, v),
  },
  participations: {
    read: <TDefault>(fallback: TDefault) => readJson(KEYS.participations, fallback),
    write: (v: Participation[]) => writeJson(KEYS.participations, v),
  },
  /**
   * Сессия живёт в sessionStorage: у каждой вкладки своя роль.
   * Это позволяет показать вау-фичу на двух вкладках — учитель и ученик.
   */
  session: {
    read: (): string | null => {
      try {
        return sessionStorage.getItem(KEYS.session);
      } catch {
        return null;
      }
    },
    write: (v: string | null) => {
      try {
        if (v === null) sessionStorage.removeItem(KEYS.session);
        else sessionStorage.setItem(KEYS.session, v);
      } catch {
        /* приватный режим — сессия просто не сохранится */
      }
    },
  },
  meta: {
    read: (): DemoMeta | null => readJson<DemoMeta | null>(KEYS.meta, null),
    write: (v: DemoMeta) => writeJson(KEYS.meta, v),
  },
};
