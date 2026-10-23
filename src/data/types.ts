/**
 * Схемы данных платформы школьных конкурсов.
 * Только фактические поля — никаких серверных сущностей.
 * Все даты хранятся в ISO-строках (YYYY-MM-DD), чтобы не теряться при JSON-сериализации.
 */

/** Роль пользователя. Ученик и организатор (учитель). */
export type Role = 'student' | 'teacher';

/** Пользователь платформы (симуляция аккаунта, без пароля). */
export interface User {
  id: string;
  /** Отображаемое имя: «Мария Соколова». */
  name: string;
  /** Класс для ученика: «7А». Для учителя — пусто. */
  grade: string;
  role: Role;
  /** Название кабинета/предмета учителя, для ученика пусто. */
  subject: string;
}

/** Жизненный цикл конкурса. Производное состояние считается от дат. */
export type CompetitionStatus = 'upcoming' | 'active' | 'finished';

/** Направление (используется для поиска, фильтра и цвета карточки). */
export type Track = 'science' | 'art' | 'sport' | 'language' | 'tech';

/** Конкурс, созданный организатором. */
export interface Competition {
  id: string;
  title: string;
  /** Короткий тизер для карточки афиши (<=140 символов). */
  summary: string;
  /** Полное описание для страницы конкурса. */
  description: string;
  track: Track;
  /** Дата начала приёма заявок, YYYY-MM-DD. */
  startsAt: string;
  /** Дедлайн участия, YYYY-MM-DD (включительно). */
  deadline: string;
  /** Максимальный балл, который можно получить за конкурс. */
  maxScore: number;
  /** Путь к картинке-превью в public/ (необязательно: без неё карточка рисует тему). */
  image?: string;
  /** Пользователь-организатор. */
  createdBy: string;
  /** ISO-таймстемп создания — для сортировки и отчёта. */
  createdAt: string;
}

/** Статус заявки ученика на конкурс. */
export type ParticipationStatus = 'pending' | 'approved' | 'rejected';

/** Участие ученика в конкурсе. */
export interface Participation {
  id: string;
  competitionId: string;
  studentId: string;
  status: ParticipationStatus;
  /** Баллы начисляются только после подтверждения организатором (0..maxScore). */
  score: number;
  /** Дата регистрации заявки, YYYY-MM-DD. */
  registeredAt: string;
  /** ISO-таймстемп подтверждения/отклонения. Пусто, пока pending. */
  reviewedAt: string | null;
  /** Краткий комментарий организатора. */
  comment: string;
}

/** Шаблон диплома. Два варианта доступны в MVP. */
export interface DiplomaTemplate {
  id: string;
  name: string;
  /** SVG-шаблон идёт строкой: подставляем данные и отдаём файлом. */
  variant: 'classic' | 'modern';
}

/** Результат импорта «грязного» CSV/JSON: что приняли, что отбросили и почему. */
export interface ImportIssue {
  /** Номер строки в файле (1-based, с учётом заголовка). */
  line: number;
  /** Исходные значения строки для отображения в отчёте. */
  raw: string;
  /** Человеческое объяснение, почему строка отброшена. */
  reason: ImportIssueReason;
}

export type ImportIssueReason =
  | 'empty'
  | 'missing-fields'
  | 'negative-score'
  | 'score-out-of-range'
  | 'unknown-student'
  | 'unknown-competition'
  | 'duplicate'
  | 'bad-status';

/** Полный результат импорта. */
export interface ImportResult {
  accepted: number;
  rejected: number;
  issues: ImportIssue[];
}

/** Состояние демо-режима: переключатель ролей и отметка о сеянии данных. */
export interface DemoMeta {
  seedVersion: number;
  lastSeededAt: string;
}
