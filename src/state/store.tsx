/**
 * Единое хранилище состояния на клиенте.
 * Одна загрузка данных на всё приложение: страницы читают снимок из контекста,
 * а не тянут по три запроса каждая.
 * Синхронизация между вкладками — через BroadcastChannel: добавил достижение
 * в одной вкладке, во второй рейтинг пересчитался.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '../data/api';
import type { Achievement, Competition, Participation, User } from '../data/types';

const SYNC_CHANNEL = 'hackathon.sync';

export interface DataState {
  user: User | null;
  users: User[];
  achievements: Achievement[];
  competitions: Competition[];
  participations: Participation[];
  loading: boolean;
  error: string | null;
}

export interface DataActions {
  /** Перезагрузить всё с сервера. */
  refresh: () => Promise<void>;
  /** Вход по паролю. Бросает ApiError с текстом для формы. */
  login: (name: string, grade: string, password: string) => Promise<User>;
  /** Быстрый демо-вход по id аккаунта. */
  demoLogin: (userId: string) => Promise<User>;
  register: (input: {
    name: string;
    grade: string;
    password: string;
    role: 'student' | 'teacher';
    subject?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  /** Уведомить другие вкладки, что данные изменились. */
  notify: () => void;
}

export type Store = DataState & DataActions;

const StoreContext = createContext<Store | null>(null);

const EMPTY: DataState = {
  user: null,
  users: [],
  achievements: [],
  competitions: [],
  participations: [],
  loading: true,
  error: null,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(EMPTY);
  const channelRef = useRef<BroadcastChannel | null>(null);

  /** Грузит всё разом: справочники нужны всем страницам. */
  const load = useCallback(async (currentUser?: User | null) => {
    const me = currentUser === undefined ? (await api.me()).user : currentUser;
    if (!me) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    const [users, achievements, competitions, participations] = await Promise.all([
      api.users(),
      api.achievements(),
      api.competitions(),
      api.participations(),
    ]);
    setState({
      user: me,
      users: users.users,
      achievements: achievements.achievements,
      competitions: competitions.competitions,
      participations: participations.participations,
      loading: false,
      error: null,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ ...EMPTY, loading: false });
        return;
      }
      // Сеть могла отвалиться — снимаем «загрузку», иначе экран залипнет навсегда.
      setState((prev) => ({ ...prev, loading: false, error: 'Не удалось загрузить данные' }));
    }
  }, [load]);

  /** Сообщает другим вкладкам о правке и обновляет себя. */
  const notify = useCallback(() => {
    channelRef.current?.postMessage('changed');
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();

    // BroadcastChannel есть не везде (старые браузеры, тестовые окружения):
    // без него просто живём без синхронизации между вкладками.
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = () => {
      void refresh();
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [refresh]);

  const login = useCallback(
    async (name: string, grade: string, password: string) => {
      const { user } = await api.login({ name, grade, password });
      await load(user);
      return user;
    },
    [load],
  );

  const demoLogin = useCallback(
    async (userId: string) => {
      const { user } = await api.demoLogin(userId);
      await load(user);
      return user;
    },
    [load],
  );

  const register = useCallback(
    async (input: { name: string; grade: string; password: string; role: 'student' | 'teacher'; subject?: string }) => {
      const { user } = await api.register(input);
      await load(user);
      return user;
    },
    [load],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // Даже если сервер не ответил, локальную сессию пользователь закрыл осознанно.
      channelRef.current?.postMessage('changed');
      setState({ ...EMPTY, loading: false });
    }
  }, []);

  const value = useMemo<Store>(
    () => ({ ...state, refresh, login, demoLogin, register, logout, notify }),
    [state, refresh, login, demoLogin, register, logout, notify],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Доступ к хранилищу. Бросает, если провайдера нет — ошибка в коде, а не в данных. */
export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore нужно вызывать внутри StoreProvider');
  return store;
}
