import { useState } from 'react';
import { useStore } from '../state/store';
import { api } from '../data/api';
import type { ImportResult } from '../data/types';
import type { ImportContext } from '../data/importers';
import { importCsv, importJson } from '../data/importers';
import { downloadReport } from '../data/exporter';

const REASON_LABEL: Record<string, string> = {
  empty: 'Пустая строка',
  'missing-fields': 'Не хватает полей',
  'negative-score': 'Отрицательные баллы',
  'score-out-of-range': 'Баллы вне диапазона 0–500',
  'unknown-student': 'Ученик не найден в базе',
  'unknown-competition': 'Конкурс не найден',
  duplicate: 'Такое достижение уже есть',
  'bad-status': 'Неизвестный статус',
  'bad-category': 'Неизвестная категория',
};

const SAMPLE_CSV = `student,grade,category,title,points,date
Мария Соколова,8А,olympiad,Призёр городской олимпиады по физике,60,2026-10-01
Дмитрий Ковалёв,8Б,project,Проект «Умная теплица»,45,2026-10-02
,,academic,Пустая строка без ученика,10,2026-10-02
Алина Ветрова,7А,olympiad,Олимпиада по математике,-10,2026-10-03
Алина Ветрова,7А,unknown,Неизвестная категория,20,2026-10-03
Игорь Лебедев,8А,volunteer,Экологическая акция «Чистый парк»,20,2026-10-04
Мария Соколова,8А,olympiad,Призёр городской олимпиады по физике,60,2026-10-01
`;

interface Props {
  onDone: () => void;
}

/** Предпросмотр: считаем, что запись прошла, но в базу ничего не пишем. */
function dryContext(context: ImportContext): ImportContext {
  return { ...context, dryRun: true, create: () => Promise.resolve() };
}

export function ImportPanel({ onDone }: Props) {
  const { users, achievements, refresh } = useStore();
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [isJsonFile, setIsJsonFile] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError('');
    setApplied(null);
    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith('.json');
      const result = isJson
        ? importJson(text, dryContext({ users, achievements, create: () => Promise.resolve() }))
        : importCsv(text, dryContext({ users, achievements, create: () => Promise.resolve() }));
      setFileName(file.name);
      setFileText(text);
      setIsJsonFile(isJson);
      setPreview(result);
    } catch {
      setError('Не удалось прочитать файл. Проверьте кодировку и формат.');
    }
  };

  /** Подтверждение: повторный разбор, теперь записи уходят на сервер. */
  const apply = async () => {
    if (!preview || preview.accepted === 0) return;
    setBusy(true);
    setError('');
    const created: Promise<unknown>[] = [];
    const context: ImportContext = {
      users,
      achievements,
      create: (input) => api.createAchievement(input),
    };
    try {
      const result = isJsonFile
        ? importJson(fileText, context, created)
        : importCsv(fileText, context, created);
      // Строка считается принятой только если сервер её действительно сохранил.
      const settled = await Promise.allSettled(created);
      const failed = settled.filter((item) => item.status === 'rejected').length;
      const applied: ImportResult = {
        ...result,
        accepted: result.accepted - failed,
        rejected: result.rejected + failed,
      };
      setApplied(applied);
      if (failed > 0) {
        setError(`Сервер отклонил ${failed} из ${created.length} записей. Проверьте права и данные.`);
      }
      void refresh();
      onDone();
    } catch {
      setError('Сервер отклонил импорт. Проверьте права и повторите.');
    } finally {
      setBusy(false);
    }
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
            Колонки: student, grade, category, title, points, date. Достижения попадают
            сразу подтверждёнными. Сначала показываем предпросмотр — база не меняется.
          </span>
        </label>
        <button className="btn btn--ghost" type="button" onClick={loadSample}>
          Подставить пример с ошибками
        </button>
      </div>

      <p className="muted">Учеников в базе: {users.filter((u) => u.role === 'student').length}.</p>

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
            onClick={() => void apply()}
            disabled={preview.accepted === 0 || Boolean(applied) || busy}
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

/** CSV-отчёт по достижениям: отдельная кнопка в админ-панели. */
export function ReportPanel() {
  const { users, achievements } = useStore();
  return (
    <div className="report-callout">
      <p className="report-callout__text">
        Отчёт по всем достижениям лицея: ученик, класс, категория, статус, баллы, дата.
        Открывается в Excel без кракозябр.
      </p>
      <button
        className="btn btn--ghost"
        type="button"
        onClick={() => downloadReport(users, achievements)}
      >
        Выгрузить отчёт CSV
      </button>
    </div>
  );
}