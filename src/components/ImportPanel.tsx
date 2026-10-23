import { useState } from 'react';
import { useData } from '../state/useData';
import { getRepository } from '../data/localRepository';
import type { ImportResult } from '../data/types';
import type { Repository as RepoContract } from '../data/repository';
import { importCsv, importJson } from '../data/importers';
import { downloadReport } from '../data/exporter';

const REASON_LABEL: Record<string, string> = {
  empty: 'Пустая строка',
  'missing-fields': 'Не хватает полей',
  'negative-score': 'Отрицательные баллы',
  'score-out-of-range': 'Баллы больше максимума конкурса',
  'unknown-student': 'Ученик не найден в базе',
  'unknown-competition': 'Конкурс не найден',
  duplicate: 'Дубликат заявки',
  'bad-status': 'Неизвестный статус',
};

const SAMPLE_CSV = `student,competition,status,score,date
Мария Соколова,Научные чтения «Первая гипотеза»,approved,88,2026-10-01
Дмитрий Ковалёв,Фестиваль чтения «Своими словами»,approved,75,2026-10-02
,Фестиваль чтения «Своими словами»,approved,50,2026-10-02
Алина Ветрова,Кибертурнир «Быстрый ход»,pending,-10,2026-10-03
Алина Ветрова,Кибертурнир «Быстрый ход»,approved,120,2026-10-03
Игорь Лебедев,Несуществующий конкурс,approved,40,2026-10-04
Игорь Лебедев,SpeakUp: конкурс speaking,approved,86,2026-10-04
`;

/**
 * Заглушка репозитория для предпросмотра: читает живые данные,
 * но записывать участия не умеет. Так предпросмотр не портит базу.
 */
function createDryRepository(real: RepoContract): RepoContract {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'createParticipation') {
        return () => ({
          id: 'dry',
          competitionId: '',
          studentId: '',
          status: 'pending' as const,
          score: 0,
          registeredAt: '',
          reviewedAt: null,
          comment: '',
        });
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

interface Props {
  onDone: () => void;
}

export function ImportPanel({ onDone }: Props) {
  const { competitions } = useData();
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [isJsonFile, setIsJsonFile] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setApplied(null);
    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith('.json');
      const dry = createDryRepository(getRepository());
      const result = isJson ? importJson(text, dry) : importCsv(text, dry);
      setFileName(file.name);
      setFileText(text);
      setIsJsonFile(isJson);
      setPreview(result);
    } catch {
      setError('Не удалось прочитать файл. Проверьте кодировку и формат.');
    }
  };

  /** Подтверждение: повторный разбор уже на живом репозитории — данные пишутся. */
  const apply = () => {
    if (!preview || preview.accepted === 0) return;
    const repo = getRepository();
    const result = isJsonFile ? importJson(fileText, repo) : importCsv(fileText, repo);
    setApplied(result);
    onDone();
  };

  const loadSample = () => {
    const file = new File([SAMPLE_CSV], 'demo-dirty.csv', { type: 'text/csv' });
    void handleFile(file);
  };

  return (
    <div className="import">
      <div className="import__row">
        <label className="dropzone">
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleFile(file);
            }}
          />
          <span className="dropzone__title">Выберите CSV или JSON</span>
          <span className="dropzone__hint">
            Колонки: student, competition, status, score, date. Файл обрабатывается в
            браузере и никуда не отправляется.
          </span>
        </label>
        <button className="btn btn--ghost" type="button" onClick={loadSample}>
          Подставить пример с ошибками
        </button>
      </div>

      <p className="muted">Доступно конкурсов: {competitions.length}.</p>

      {error && (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      )}

      {preview && (
        <div className="panel panel--flat">
          <div className="panel__head">
            <h3>{fileName}</h3>
            <span className="muted">
              принять {preview.accepted} · отклонить {preview.rejected}
            </span>
          </div>

          {preview.issues.length === 0 ? (
            <p className="muted">Ошибок нет — все строки готовы к импорту.</p>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th scope="col">Строка</th>
                    <th scope="col">Почему</th>
                    <th scope="col">Данные</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.issues.slice(0, 12).map((issue, index) => (
                    <tr key={`${issue.line}-${index}`}>
                      <td>{issue.line || '—'}</td>
                      <td>{REASON_LABEL[issue.reason] ?? issue.reason}</td>
                      <td className="muted">{issue.raw}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.issues.length > 12 && (
            <p className="muted">… и ещё {preview.issues.length - 12} строк с ошибками.</p>
          )}

          <button
            className="btn btn--primary"
            type="button"
            onClick={apply}
            disabled={preview.accepted === 0 || Boolean(applied)}
          >
            {applied ? 'Импортировано' : `Импортировать ${preview.accepted}`}
          </button>
        </div>
      )}

      {applied && (
        <div className="notice notice--success" role="status">
          Импорт завершён: добавлено {applied.accepted}, отброшено {applied.rejected}.
        </div>
      )}
    </div>
  );
}

/** CSV-отчёт по активности: отдельная кнопка в админ-панели. */
export function ReportPanel() {
  return (
    <div className="report-callout">
      <p className="report-callout__text">
        Отчёт по активности всей школы: ученик, класс, конкурс, статус, баллы, дата.
        Открывается в Excel без кракозябр.
      </p>
      <button className="btn btn--ghost" type="button" onClick={() => downloadReport(getRepository())}>
        Выгрузить отчёт CSV
      </button>
    </div>
  );
}
