import type { ImportIssue, ImportIssueReason, ImportResult, ParticipationStatus } from './types';
import type { Repository } from './repository';
import { todayIso } from './utils';

/**
 * Парсер CSV. Поддерживает кавычки, экранированные кавычки «""» и запятые внутри ячеек.
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
  competition: ['competition', 'конкурс', 'competition_id', 'competitionid'],
  status: ['status', 'статус'],
  score: ['score', 'баллы', 'балл'],
  date: ['date', 'дата', 'registeredat', 'registered_at'],
} as const;

const STATUS_MAP: Record<string, ParticipationStatus> = {
  pending: 'pending',
  ожидает: 'pending',
  approved: 'approved',
  подтверждено: 'approved',
  rejected: 'rejected',
  отклонено: 'rejected',
};

type ResolveTarget = {
  students: { id: string; name: string }[];
  competitions: { id: string; title: string }[];
};

function resolveStudent(raw: string, target: ResolveTarget): string | null {
  const value = raw.trim().toLowerCase();
  const found = target.students.find((s) => s.name.toLowerCase() === value || s.id === value);
  return found?.id ?? null;
}

function resolveCompetition(raw: string, target: ResolveTarget): string | null {
  const value = raw.trim().toLowerCase();
  const found = target.competitions.find(
    (c) => c.title.toLowerCase() === value || c.id === value,
  );
  return found?.id ?? null;
}

/** Нормализует заголовки и находит индексы ключевых полей. */
function buildHeaderMap(header: string[]): Record<keyof typeof FIELD_ALIASES, number> {
  const map = { student: -1, competition: -1, status: -1, score: -1, date: -1 };
  header.forEach((cell, index) => {
    const key = cell.toLowerCase().replace(/[\s-]/g, '');
    (Object.keys(FIELD_ALIASES) as (keyof typeof FIELD_ALIASES)[]).forEach((field) => {
      if (map[field] === -1 && FIELD_ALIASES[field].some((alias) => alias === key)) {
        map[field] = index;
      }
    });
  });
  return map;
}

interface ImportInput {
  rows: string[][];
  header: Record<keyof typeof FIELD_ALIASES, number>;
  target: ResolveTarget;
  repo: Repository;
  /** Смещение строки в оригинальном файле (для JSON, где строка — не строка CSV). */
  offset?: number;
}

/**
 * Общая логика валидации строк: используется и CSV, и JSON.
 * Не бросает исключений: каждая проблема превращается в ImportIssue.
 */
function importRows({ rows, header, target, repo, offset = 0 }: ImportInput): ImportResult {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let accepted = 0;

  rows.forEach((cells, index) => {
    const line = index + 1 + offset;
    const raw = cells.join(' | ').slice(0, 200);
    const studentRaw = header.student >= 0 ? (cells[header.student] ?? '') : '';
    const competitionRaw = header.competition >= 0 ? (cells[header.competition] ?? '') : '';
    const statusRaw = header.status >= 0 ? (cells[header.status] ?? '') : 'pending';
    const scoreRaw = header.score >= 0 ? (cells[header.score] ?? '0') : '0';
    const dateRaw = header.date >= 0 ? (cells[header.date] ?? '') : todayIso();

    const fail = (reason: ImportIssueReason) => issues.push({ line, raw, reason });

    if (!studentRaw && !competitionRaw) return fail('empty');
    if (!studentRaw || !competitionRaw) return fail('missing-fields');

    const studentId = resolveStudent(studentRaw, target);
    if (!studentId) return fail('unknown-student');
    const competitionId = resolveCompetition(competitionRaw, target);
    if (!competitionId) return fail('unknown-competition');

    const status = STATUS_MAP[statusRaw.trim().toLowerCase()];
    if (!status) return fail('bad-status');

    const score = Number(scoreRaw.replace(',', '.').trim());
    if (!Number.isFinite(score)) return fail('missing-fields');
    if (score < 0) return fail('negative-score');
    if (score > 1000) return fail('score-out-of-range');

    const competition = repo.getCompetition(competitionId);
    if (competition && score > competition.maxScore) return fail('score-out-of-range');

    const key = `${studentId}::${competitionId}`;
    if (seen.has(key)) return fail('duplicate');
    const existing = repo
      .getParticipations()
      .some((p) => p.studentId === studentId && p.competitionId === competitionId);
    if (existing) return fail('duplicate');
    seen.add(key);

    repo.createParticipation({
      competitionId,
      studentId,
      status,
      score,
      registeredAt: dateRaw || todayIso(),
      comment: '',
    });
    accepted++;
  });

  return { accepted, rejected: issues.length, issues };
}

/** Импорт CSV: заголовок обязателен. Данные с ошибками не ломают базу. */
export function importCsv(text: string, repo: Repository): ImportResult {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows = parseCsv(cleaned);
  if (rows.length === 0) {
    return { accepted: 0, rejected: 0, issues: [] };
  }
  const [headerRow, ...dataRows] = rows;
  const header = buildHeaderMap(headerRow);
  if (header.student < 0 || header.competition < 0) {
    return {
      accepted: 0,
      rejected: 0,
      issues: [
        {
          line: 1,
          raw: headerRow.join(' | ').slice(0, 200),
          reason: 'missing-fields',
        },
      ],
    };
  }
  const target = {
    students: repo.getUsers().filter((u) => u.role === 'student').map((u) => ({ id: u.id, name: u.name })),
    competitions: repo.getCompetitions().map((c) => ({ id: c.id, title: c.title })),
  };
  return importRows({ rows: dataRows, header, target, repo, offset: 1 });
}

/** Импорт JSON: [{student, competition, status, score, date}]. Терпит не-массивы. */
export function importJson(text: string, repo: Repository): ImportResult {
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
      String(entry.competition ?? entry.конкурс ?? ''),
      String(entry.status ?? entry.статус ?? 'pending'),
      String(entry.score ?? entry.баллы ?? '0'),
      String(entry.date ?? entry.дата ?? todayIso()),
    ];
  });
  const header = { student: 0, competition: 1, status: 2, score: 3, date: 4 };
  const target = {
    students: repo.getUsers().filter((u) => u.role === 'student').map((u) => ({ id: u.id, name: u.name })),
    competitions: repo.getCompetitions().map((c) => ({ id: c.id, title: c.title })),
  };
  return importRows({ rows, header, target, repo, offset: 0 });
}
