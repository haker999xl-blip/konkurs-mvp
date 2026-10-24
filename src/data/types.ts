/**
 * Схемы данных платформы школьных конкурсов.
 * Только фактические поля — никаких серверных сущностей.
 * Все даты хранятся в ISO-строках (YYYY-MM-DD), чтобы не теряться при JSON-сериализации.
 */

/** Роль пользователя. Ученик и организатор (учитель). */
export type Role = 'student' | 'teacher';

/** Пользователь платформы. Пароль хранится только хешем на сервере и в клиент не приходит. */
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

/**
 * Категория достижения — ядро модели: ученик сам заявляет, что добился.
 * Многоточие и «волонтёрство» из ТЗ, плюс «проект» для инженерных работ.
 */
export type AchievementCategory = 'academic' | 'olympiad' | 'project' | 'volunteer';

/** Статус достижения: заявлено учеником → проверено организатором. */
export type AchievementStatus = 'pending' | 'approved' | 'rejected';

/** Откуда пришло достижение: сам ученик, организатор или подтверждённый конкурс. */
export type AchievementSource = 'student' | 'admin' | 'contest';

/** Достижение ученика — центральная сущность платформы. */
export interface Achievement {
  id: string;
  studentId: string;
  category: AchievementCategory;
  /** Что за достижение: «Призёр муниципального этапа по физике». */
  title: string;
  /** Дата получения, YYYY-MM-DD. Не может быть в будущем. */
  awardedOn: string;
  /** Баллы, которые идут в рейтинг после подтверждения. */
  points: number;
  status: AchievementStatus;
  source: AchievementSource;
  /** Комментарий организатора: почему подтвердили или отклонили. */
  comment: string;
  /** ISO-таймстемп создания. */
  createdAt: string;
  /** ISO-таймстемп проверки. Пусто, пока pending. */
  reviewedAt: string | null;
}

/** Жизненный цикл конкурса. Производное состояние считается от дат. */
export type CompetitionStatus = 'upcoming' | 'active' | 'finished';

/** Направление конкурса (используется для поиска, фильтра и цвета карточки). */
export type Track = 'science' | 'math' | 'sport' | 'language' | 'tech';

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
  | 'bad-status'
  | 'bad-category';

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
