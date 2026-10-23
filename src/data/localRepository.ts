import type { Competition, DemoMeta, Participation, User } from './types';
import type { Repository } from './repository';
import {
  SEED_USERS,
  SEED_VERSION,
  buildSeedCompetitions,
  buildSeedParticipations,
} from './seed';
import { storage } from './storage';
import { uid } from './utils';

const STORAGE_EVENT_KEY = 'school-contests.sync';

/**
 * Реализация хранилища на localStorage.
 * Все операции идут через cache в памяти, а запись — атомарная на ключ.
 * Подписка объединяет два канала:
 *  - `storage` — срабатывает в ДРУГИХ вкладках (вау-фича: админ → ученик);
 *  - BroadcastChannel — мгновенное уведомление в современных браузерах.
 */
export class LocalRepository implements Repository {
  private channel: BroadcastChannel | null = null;
  /** Подписчики этой вкладки: BroadcastChannel не доставляет сообщение себе. */
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(STORAGE_EVENT_KEY);
    }
    this.ensureSeed();
  }

  /** Гарантирует наличие seed при первом запуске, не перезаписывая живое. */
  private ensureSeed(): void {
    const meta = storage.meta.read();
    const users = storage.users.read<User[] | null>(null);
    if (!meta || meta.seedVersion !== SEED_VERSION || !users || users.length === 0) {
      this.resetDemo();
    }
  }

  resetDemo(): void {
    storage.users.write(SEED_USERS);
    storage.competitions.write(buildSeedCompetitions());
    storage.participations.write(buildSeedParticipations());
    storage.session.write(null);
    const meta: DemoMeta = {
      seedVersion: SEED_VERSION,
      lastSeededAt: new Date().toISOString(),
    };
    storage.meta.write(meta);
    this.broadcast('reset');
  }

  getDemoMeta(): DemoMeta {
    return storage.meta.read() ?? { seedVersion: SEED_VERSION, lastSeededAt: new Date().toISOString() };
  }

  getSession(): string | null {
    return storage.session.read();
  }

  setSession(userId: string | null): void {
    storage.session.write(userId);
  }

  getUsers(): User[] {
    return storage.users.read<User[]>([]);
  }

  getUser(id: string): User | null {
    return this.getUsers().find((u) => u.id === id) ?? null;
  }

  getCompetitions(): Competition[] {
    return storage.competitions.read<Competition[]>([]);
  }

  getCompetition(id: string): Competition | null {
    return this.getCompetitions().find((c) => c.id === id) ?? null;
  }

  createCompetition(input: Omit<Competition, 'id' | 'createdAt'>): Competition {
    const competition: Competition = {
      ...input,
      id: uid('c'),
      createdAt: new Date().toISOString(),
    };
    storage.competitions.write([competition, ...this.getCompetitions()]);
    this.broadcast();
    return competition;
  }

  updateCompetition(id: string, patch: Partial<Competition>): Competition {
    const list = this.getCompetitions();
    const index = list.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('Конкурс не найден');
    const next: Competition = { ...list[index], ...patch, id };
    list[index] = next;
    storage.competitions.write(list);
    this.broadcast();
    return next;
  }

  deleteCompetition(id: string): void {
    storage.competitions.write(this.getCompetitions().filter((c) => c.id !== id));
    storage.participations.write(
      this.getParticipations().filter((p) => p.competitionId !== id),
    );
    this.broadcast();
  }

  getParticipations(): Participation[] {
    return storage.participations.read<Participation[]>([]);
  }

  getParticipationsByStudent(studentId: string): Participation[] {
    return this.getParticipations().filter((p) => p.studentId === studentId);
  }

  getParticipationsByCompetition(competitionId: string): Participation[] {
    return this.getParticipations().filter((p) => p.competitionId === competitionId);
  }

  createParticipation(input: Omit<Participation, 'id' | 'reviewedAt'>): Participation {
    const entry: Participation = {
      ...input,
      id: uid('p'),
      reviewedAt: null,
    };
    storage.participations.write([...this.getParticipations(), entry]);
    this.broadcast();
    return entry;
  }

  reviewParticipation(
    id: string,
    status: 'approved' | 'rejected',
    payload: { score: number; comment: string },
  ): Participation {
    const list = this.getParticipations();
    const index = list.findIndex((p) => p.id === id);
    if (index < 0) throw new Error('Заявка не найдена');
    const next: Participation = {
      ...list[index],
      status,
      score: status === 'approved' ? payload.score : 0,
      comment: payload.comment,
      reviewedAt: new Date().toISOString(),
    };
    list[index] = next;
    storage.participations.write(list);
    this.broadcast();
    return next;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.includes('school-contests.v1')) listener();
    };
    window.addEventListener('storage', onStorage);
    const onMessage = (event: MessageEvent) => {
      // Сброс демо разлогинивает все вкладки, иначе они покажут пустые данные.
      if (event.data === 'reset') storage.session.write(null);
      listener();
    };
    this.channel?.addEventListener('message', onMessage);
    return () => {
      this.listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
      this.channel?.removeEventListener('message', onMessage);
    };
  }

  private broadcast(kind: 'sync' | 'reset' = 'sync'): void {
    this.listeners.forEach((listener) => listener());
    this.channel?.postMessage(kind);
  }
}

let singleton: LocalRepository | null = null;

/** Точка доступа к репозиторию. Один экземпляр на вкладку. */
export function getRepository(): LocalRepository {
  if (!singleton) singleton = new LocalRepository();
  return singleton;
}
