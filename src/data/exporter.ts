import type { Achievement, User } from './types';
import { ACHIEVEMENT_CSV_HEADER, achievementToRow } from './report';
import { downloadBlob } from './utils';

/** BOM для Excel: без него кириллица ломается в «кракозябры». */
const BOM = '\uFEFF';

function csvCell(value: string | number): string {
  const text = String(value);
  if (/["\n;,]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * CSV-отчёт по достижениям.
 * Разделитель — точка с запятой: Excel в русской локали открывает так корректно.
 */
export function buildReportCsv(users: User[], achievements: Achievement[]): string {
  const lines = [ACHIEVEMENT_CSV_HEADER.map(csvCell).join(';')];
  achievementToRow(users, achievements).forEach((row) => {
    lines.push(row.map(csvCell).join(';'));
  });
  return BOM + lines.join('\r\n');
}

/** Скачивание отчёта; имя файла с датой. */
export function downloadReport(users: User[], achievements: Achievement[]): void {
  const csv = buildReportCsv(users, achievements);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `dostizheniya-${stamp}.csv`);
}