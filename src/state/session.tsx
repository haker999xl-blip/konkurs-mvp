import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../data/types';
import { getRepository } from '../data/localRepository';

interface SessionContextValue {
  user: User | null;
  users: User[];
  login: (userId: string) => void;
  logout: () => void;
  /** Меняется при каждом внешнем сообщении — триггер перечитать данные. */
  revision: number;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Провайдер сессии. Хранит только id пользователя; всё остальное — из репозитория.
 * Подписывается на межвкладочные события: монитор данных обновляется автоматически.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const repo = getRepository();
  const [userId, setUserId] = useState<string | null>(() => repo.getSession());
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const unsubscribe = repo.subscribe(() => {
      setUserId(repo.getSession());
      setRevision((r) => r + 1);
    });
    return unsubscribe;
  }, [repo]);

  const login = useCallback(
    (id: string) => {
      repo.setSession(id);
      setUserId(id);
    },
    [repo],
  );

  const logout = useCallback(() => {
    repo.setSession(null);
    setUserId(null);
  }, [repo]);

  const users = useMemo(() => repo.getUsers(), [repo, revision]);
  const user = useMemo(
    () => users.find((u) => u.id === userId) ?? null,
    [users, userId],
  );

  const value = useMemo(
    () => ({ user, users, login, logout, revision }),
    [user, users, login, logout, revision],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession должен использоваться внутри SessionProvider');
  return ctx;
}
