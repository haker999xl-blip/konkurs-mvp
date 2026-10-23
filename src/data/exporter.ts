import type { Repository } from './repository';
import { PARTICIPATION_LABEL } from './utils';
import { downloadBlob } from './utils';

/** BOM для Excel: без него кириллица ломается в «кракозябры». */
const BOM = '\uFEFF';

function csvCell(value: string | number): string {
  const text = String(value);
  if (/["\n;,]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * CSV-отчёт по активности.
 * Колонки: ученик, класс, конкурс, статус, баллы, дата регистрации.
 * Разделитель — точка с запятой: Excel в русской локали открывает так корректно.
 */
export function buildReportCsv(repo: Repository): string {
  const users = new Map(repo.getUsers().map((u) => [u.id, u]));
  const competitions = new Map(repo.getCompetitions().map((c) => [c.id, c]));
  const header = ['Ученик', 'Класс', 'Конкурс', 'Статус', 'Баллы', 'Дата регистрации'];
  const lines = [header.map(csvCell).join(';')];

  const rows = [...repo.getParticipations()].sort((a, b) =>
    a.registeredAt < b.registeredAt ? 1 : -1,
  );
  rows.forEach((p) => {
    const student = users.get(p.studentId);
    const competition = competitions.get(p.competitionId);
    lines.push(
      [
        student?.name ?? 'Неизвестный ученик',
        student?.grade ?? '',
        competition?.title ?? 'Неизвестный конкурс',
        PARTICIPATION_LABEL[p.status],
        p.score,
        p.registeredAt,
      ]
        .map(csvCell)
        .join(';'),
    );
  });

  return BOM + lines.join('\r\n');
}

/** Скачивание отчёта; имя файла с датой. */
export function downloadReport(repo: Repository): void {
  const csv = buildReportCsv(repo);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `otchet-${stamp}.csv`);
}
