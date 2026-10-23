import type { Competition, CompetitionStatus, Participation, Track } from './types';

/** Уникальный id без внешних зависимостей. */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Сегодняшняя дата в YYYY-MM-DD (локальная, без сдвигов таймзоны). */
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Статус конкурса выводится из дат, а не хранится полем:
 * это исключает рассинхронизацию данных в админке.
 */
export function getCompetitionStatus(c: Competition, today = todayIso()): CompetitionStatus {
  if (today < c.startsAt) return 'upcoming';
  if (today > c.deadline) return 'finished';
  return 'active';
}

export const STATUS_LABEL: Record<CompetitionStatus, string> = {
  upcoming: 'Скоро старт',
  active: 'Идёт приём',
  finished: 'Завершён',
};

export const PARTICIPATION_LABEL: Record<Participation['status'], string> = {
  pending: 'Ожидает решения',
  approved: 'Подтверждено',
  rejected: 'Отклонено',
};

/** Диапазон дат человеческим языком: «12–20 мая». */
export function formatRange(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return `${fmt.format(start)} — ${fmt.format(end)}`;
}

/** Дата коротко: «12 мая». */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(iso.length === 10 ? `${iso}T00:00:00` : iso),
  );
}

/** Осталось дней до дедлайна (может быть отрицательным). */
export function daysUntil(iso: string, today = todayIso()): number {
  const a = new Date(`${iso}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Человеческий дедлайн: «осталось 3 дня», «сегодня последний день», «завершён 4 дня назад». */
export function deadlineLabel(c: Competition, today = todayIso()): string {
  const diff = daysUntil(c.deadline, today);
  if (diff < 0) return `Завершён ${formatDate(c.deadline)}`;
  if (diff === 0) return 'Сегодня последний день';
  const word = diff === 1 ? 'день' : diff < 5 ? 'дня' : 'дней';
  return `Осталось ${diff} ${word}`;
}

export function trackLabel(track: Track): string {
  const map: Record<Track, string> = {
    science: 'Наука',
    art: 'Творчество',
    sport: 'Спорт',
    language: 'Языки',
    tech: 'Технологии',
  };
  return map[track];
}

/** Экранирование пользовательских строк: защита от XSS через имена/импорт. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Скачивание файла из Blob: используется для дипломов и CSV. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
