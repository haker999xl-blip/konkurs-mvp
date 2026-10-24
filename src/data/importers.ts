import type {
  Achievement,
  AchievementCategory,
  ImportIssue,
  ImportIssueReason,
  ImportResult,
  User,
} from './types';
import { ACHIEVEMENT_CATEGORIES } from './categories';

/**
 * Парсер CSV. Поддерживает кавычки, экранированные кавычки «""» и разделители внутри ячеек.
 * Возвращает массив строк (каждая — массив ячеек). Пустые строки отбрасываются.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const pushRow = () => {
    if (row.some((v) => v.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      pushCell();
    } else if (ch === '\n') {
      pushCell();
      pushRow();
    } else if (ch === '\r') {
      // пропускаем CR, перенос обрабатывается на \n
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }
  return rows;
}

/** Ожидаемые заголовки в CSV/JSON. Латиница, чтобы файл был стабилен в Excel. */
const FIELD_ALIASES = {
  student: ['student', 'ученик', 'фио', 'name'],
  grade: ['grade', 'класс'],
  category: ['category', 'категория'],
  title: ['title', 'achievement', 'название', 'достижение'],
  points: ['points', 'score', 'баллы', 'балл'],
  date: ['date', 'awardedon', 'awarded_on', 'дата'],
  status: ['status', 'статус'],
} as const;

type FieldKey = keyof typeof FIELD_ALIASES;

const CATEGORY_MAP: Record<string, AchievementCategory> = {
  academic: 'academic',
  учёба: 'academic',
  учеба: 'academic',
  'академические успехи': 'academic',
  olympiad: 'olympiad',
  олимпиада: 'olympiad',
  project: 'project',
  проект: 'project',
  volunteer: 'volunteer',
  волонтёрство: 'volunteer',
  волонтерство: 'volunteer',
};

/** Поля достижения, которые примет сервер (без служебных id/статусов). */
export interface AchievementInput {
  studentId: string;
  category: AchievementCategory;
  title: string;
  awardedOn: string;
  points: number;
}

/**
 * Создание достижения: на предпросмотре — заглушка, при импорте — реальный вызов API.
 * Возвращает признак «уже есть такое достижение» для проверки дубликатов.
 */
export interface ImportContext {
  users: User[];
  achievements: Achievement[];
  /** `dryRun` — только проверка без записи: предпросмотр не должен создавать данные. */
  dryRun?: boolean;
  create: (input: AchievementInput) => Promise<unknown>;
}

type ResolveTarget = { students: User[] };

function resolveStudent(raw: string, gradeRaw: string, target: ResolveTarget): User | null {
  const value = raw.trim().toLowerCase();
  const grade = gradeRaw.trim().toLowerCase();
  const candidates = target.students.filter((s) => s.id === value || s.name.toLowerCase() === value);
  if (candidates.length === 0) return null;
  if (grade) {
    const byGrade = candidates.find((s) => s.grade.toLowerCase() === grade);
    if (byGrade) return byGrade;
  }
  return candidates[0];
}

/** Нормализует заголовки и находит индексы ключевых полей. */
function buildHeaderMap(header: string[]): Record<FieldKey, number> {
  const map: Record<FieldKey, number> = {
    student: -1,
    grade: -1,
    category: -1,
    title: -1,
    points: -1,
    date: -1,
    status: -1,
  };
  header.forEach((cell, index) => {
    const key = cell.toLowerCase().replace(/[\s-]/g, '');
    (Object.keys(FIELD_ALIASES) as FieldKey[]).forEach((field) => {
      if (map[field] === -1 && FIELD_ALIASES[field].some((alias) => alias === key)) {
        map[field] = index;
      }
    });
  });
  return map;
}

interface ImportInput {
  rows: string[][];
  header: Record<FieldKey, number>;
  context: ImportContext;
  /** Промисы создания: вызывающий код дожидается их и узнаёт о реальных ошибках. */
  pending: Promise<unknown>[];
  /** Смещение строки в оригинальном файле (для JSON, где строка — не строка CSV). */
  offset?: number;
}

/**
 * Общая логика валидации строк: используется и CSV, и JSON.
 * Не бросает исключений: каждая проблема превращается в ImportIssue.
 * Предпросмотр (`dryRun`) ничего не пишет; при импорте созданные записи
 * складываются в `pending` — их ждёт вызывающий код, чтобы поймать ошибки сервера.
 */
function importRows({ rows, header, context, offset = 0, pending }: ImportInput): ImportResult {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const studentOnly = context.users.filter((u) => u.role === 'student');
  const today = new Date().toISOString().slice(0, 10);
  let accepted = 0;

  rows.forEach((cells, index) => {
    const line = index + 1 + offset;
    const raw = cells.join(' | ').slice(0, 200);
    const pick = (field: FieldKey) => (header[field] >= 0 ? (cells[header[field]] ?? '') : '');

    const studentRaw = pick('student');
    const categoryRaw = pick('category');
    const titleRaw = pick('title');
    const pointsRaw = pick('points');
    const dateRaw = pick('date');

    const fail = (reason: ImportIssueReason) => issues.push({ line, raw, reason });

    if (!studentRaw && !titleRaw) return fail('empty');
    if (!studentRaw || !categoryRaw || !titleRaw) return fail('missing-fields');

    const student = resolveStudent(studentRaw, pick('grade'), { students: studentOnly });
    if (!student) return fail('unknown-student');

    const category = CATEGORY_MAP[categoryRaw.trim().toLowerCase()];
    if (!category) return fail('bad-category');

    if (titleRaw.trim().length < 3) return fail('missing-fields');

    const points = Number(pointsRaw.replace(',', '.').trim() || '0');
    if (!Number.isFinite(points)) return fail('missing-fields');
    if (points < 0) return fail('negative-score');
    if (points > 500 || !Number.isInteger(points)) return fail('score-out-of-range');

    const date = dateRaw.trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('missing-fields');
    // Дата не должна переезжать (2026-02-31) и не может быть в будущем — как и на сервере.
    if (date) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        return fail('missing-fields');
      }
      if (date > today) return fail('missing-fields');
    }

    const key = `${student.id}::${category}::${titleRaw.trim().toLowerCase()}`;
    if (seen.has(key)) return fail('duplicate');
    const exists = context.achievements.some(
      (a) =>
        a.studentId === student.id &&
        a.category === category &&
        a.title.trim().toLowerCase() === titleRaw.trim().toLowerCase(),
    );
    if (exists) return fail('duplicate');
    seen.add(key);

    if (!context.dryRun) {
      pending.push(
        context.create({
          studentId: student.id,
          category,
          title: titleRaw.trim(),
          awardedOn: date || today,
          points,
        }),
      );
    }
    accepted++;
  });

  return { accepted, rejected: issues.length, issues };
}

/**
 * Импорт CSV: заголовок обязателен. Данные с ошибками не ломают базу.
 * `pending` получает промисы создания — без ожидания нельзя утверждать, что строки сохранены.
 */
export function importCsv(text: string, context: ImportContext, pending: Promise<unknown>[] = []): ImportResult {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows = parseCsv(cleaned);
  if (rows.length === 0) {
    return { accepted: 0, rejected: 0, issues: [] };
  }
  const [headerRow, ...dataRows] = rows;
  const header = buildHeaderMap(headerRow);
  if (header.student < 0 || header.title < 0 || header.category < 0) {
    return {
      accepted: 0,
      rejected: 0,
      issues: [
        { line: 1, raw: headerRow.join(' | ').slice(0, 200), reason: 'missing-fields' },
      ],
    };
  }
  return importRows({ rows: dataRows, header, context, pending, offset: 1 });
}

/** Импорт JSON: [{student, category, title, points, date}]. Терпит не-массивы. */
export function importJson(text: string, context: ImportContext, pending: Promise<unknown>[] = []): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      accepted: 0,
      rejected: 1,
      issues: [{ line: 0, raw: text.slice(0, 200), reason: 'empty' }],
    };
  }
  const list = Array.isArray(parsed) ? parsed : [];
  const rows = list.map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return [
      String(entry.student ?? entry.ученик ?? entry.name ?? ''),
      String(entry.grade ?? entry.класс ?? ''),
      String(entry.category ?? entry.категория ?? ''),
      String(entry.title ?? entry.achievement ?? entry.название ?? ''),
      String(entry.points ?? entry.score ?? entry.баллы ?? '0'),
      String(entry.date ?? entry.дата ?? ''),
      String(entry.status ?? entry.статус ?? 'pending'),
    ];
  });
  const header: Record<FieldKey, number> = {
    student: 0,
    grade: 1,
    category: 2,
    title: 3,
    points: 4,
    date: 5,
    status: 6,
  };
  return importRows({ rows, header, context, pending, offset: 0 });
}

/** Подписи категорий — для примеров и подсказок в интерфейсе. */
export const CATEGORY_HINT = ACHIEVEMENT_CATEGORIES.map((c) => c.id).join(' | ');