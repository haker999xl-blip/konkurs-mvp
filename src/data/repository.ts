import type {
  Competition,
  DemoMeta,
  Participation,
  User,
} from './types';

/**
 * Контракт слоя хранения.
 * UI обращается ТОЛЬКО сюда — localStorage/JSON спрятаны за репозиторием.
 * Чтобы переехать на бэкенд, достаточно реализовать этот интерфейс на fetch.
 */
export interface Repository {
  /** Сессия: кто сейчас «вошёл». */
  getSession(): string | null;
  setSession(userId: string | null): void;

  getUsers(): User[];
  getUser(id: string): User | null;

  getCompetitions(): Competition[];
  getCompetition(id: string): Competition | null;
  createCompetition(input: Omit<Competition, 'id' | 'createdAt'>): Competition;
  updateCompetition(id: string, patch: Partial<Competition>): Competition;
  deleteCompetition(id: string): void;

  getParticipations(): Participation[];
  getParticipationsByStudent(studentId: string): Participation[];
  getParticipationsByCompetition(competitionId: string): Participation[];
  createParticipation(input: Omit<Participation, 'id' | 'reviewedAt'>): Participation;
  reviewParticipation(
    id: string,
    status: 'approved' | 'rejected',
    payload: { score: number; comment: string },
  ): Participation;

  /** Демо: пересоздать seed. Нужно для кнопки «Сбросить демо». */
  resetDemo(): void;

  /** Мета-информация (версия seed) для отображения состояния демо. */
  getDemoMeta(): DemoMeta;

  /** Подписка на изменения (другие вкладки) — возвращает функцию отписки. */
  subscribe(listener: () => void): () => void;
}
