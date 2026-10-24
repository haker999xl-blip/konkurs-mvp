import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { ACHIEVEMENT_CATEGORIES, achievementStatusLabel, categoryLabel } from '../data/categories';
import type { Achievement, AchievementCategory, Competition, Track } from '../data/types';
import {
  STATUS_LABEL,
  formatDate,
  formatRange,
  getCompetitionStatus,
  todayIso,
  trackLabel,
} from '../data/utils';
import { pendingCount } from '../lib/rating';
import { useStore } from '../state/store';

const EMPTY_COMPETITION = {
  title: '',
  summary: '',
  description: '',
  track: 'science' as Track,
  startsAt: todayIso(),
  deadline: todayIso(),
  maxScore: 100,
};

type CompetitionForm = typeof EMPTY_COMPETITION;

interface FormErrors {
  title?: string;
  summary?: string;
  deadline?: string;
  maxScore?: string;
}

/** Валидация формы конкурса: простые правила, понятный текст ошибки. */
function validateCompetition(form: CompetitionForm): FormErrors {
  const errors: FormErrors = {};
  if (form.title.trim().length < 3) errors.title = 'Название — минимум 3 символа';
  if (form.summary.trim().length < 10) errors.summary = 'Короткое описание — минимум 10 символов';
  if (form.deadline < form.startsAt) errors.deadline = 'Дедлайн не может быть раньше старта';
  if (!Number.isFinite(form.maxScore) || form.maxScore < 1 || form.maxScore > 1000) {
    errors.maxScore = 'Максимум баллов — от 1 до 1000';
  }
  return errors;
}

/** Форма достижения, которое организатор выдаёт сам. */
const EMPTY_MANUAL = {
  studentId: '',
  category: 'academic' as AchievementCategory,
  title: '',
  awardedOn: todayIso(),
  points: '',
};

/**
 * Админ-панель организатора.
 * Главное — очередь достижений: ученик заявил, организатор проверил, баллы пошли в рейтинг.
 * Плюс: организатор может добавить достижение любому ученику от себя.
 */
export function AdminPage() {
  const { user, users, achievements, competitions, participations, loading, refresh, notify } = useStore();

  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewPoints, setReviewPoints] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [manualError, setManualError] = useState('');

  const [competitionForm, setCompetitionForm] = useState<CompetitionForm>(EMPTY_COMPETITION);
  const [competitionErrors, setCompetitionErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const pending = useMemo(() => achievements.filter((a) => a.status === 'pending'), [achievements]);
  const decided = useMemo(
    () =>
      achievements
        .filter((a) => a.status !== 'pending')
        // Копия перед сортировкой: исходный массив приходит из стора и мутировать его нельзя.
        .toSorted((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
        .slice(0, 8),
    [achievements],
  );

  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);
  const studentById = (id: string) => users.find((u) => u.id === id);
  const studentName = (id: string) => studentById(id)?.name ?? 'Ученик удалён';

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  /**
   * Верификация: подтверждение начисляет баллы, отклонение — нет.
   * Пустое поле баллов — не «ноль по умолчанию», а незаполненный ввод: просим вписать число.
   */
  const review = async (achievement: Achievement, status: 'approved' | 'rejected') => {
    setError('');
    const rawPoints = reviewPoints.trim();
    const points = status === 'approved' ? Number(rawPoints.replace(',', '.')) : 0;
    if (status === 'approved' && rawPoints === '') {
      setError('Укажите баллы: пустое поле не начисляет ноль, а требует число.');
      return;
    }
    if (status === 'approved' && (!Number.isInteger(points) || points < 0 || points > 500)) {
      setError('Баллы при подтверждении — целое число от 0 до 500.');
      return;
    }
    try {
      await api.reviewAchievement(achievement.id, status, {
        // Отклонение без комментария не должно стирать прежнее объяснение.
        comment: reviewComment.trim() || (status === 'rejected' ? achievement.comment : ''),
        points,
      });
      setReviewingId(null);
      setReviewPoints('');
      setReviewComment('');
      // Ошибка относилась к уже закрытой форме — не оставляем её висеть на странице.
      setError('');
      flash(status === 'approved' ? 'Достижение подтверждено — баллы начислены' : 'Достижение отклонено');
      notify();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить решение');
    }
  };

  /** Организатор добавляет достижение от себя — сразу подтверждённое. */
  const addManual = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualError('');
    const points = Number(manual.points);
    if (!manual.studentId) {
      setManualError('Выберите ученика.');
      return;
    }
    if (manual.title.trim().length < 3) {
      setManualError('Название — минимум 3 символа.');
      return;
    }
    if (!Number.isInteger(points) || points < 0 || points > 500) {
      setManualError('Баллы — целое число от 0 до 500.');
      return;
    }
    try {
      await api.createAchievement({
        studentId: manual.studentId,
        category: manual.category,
        title: manual.title.trim(),
        awardedOn: manual.awardedOn,
        points,
        status: 'approved',
      });
      setManual({ ...EMPTY_MANUAL, studentId: manual.studentId, category: manual.category });
      flash('Достижение добавлено ученику');
      notify();
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : 'Не удалось добавить достижение');
    }
  };

  const submitCompetition = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateCompetition(competitionForm);
    setCompetitionErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      title: competitionForm.title.trim(),
      summary: competitionForm.summary.trim(),
      description: competitionForm.description.trim() || competitionForm.summary.trim(),
      track: competitionForm.track,
      startsAt: competitionForm.startsAt,
      deadline: competitionForm.deadline,
      maxScore: Number(competitionForm.maxScore),
    };
    try {
      // Фиксируем режим и id до сброса: после setEditingId(null) в локальной переменной
      // остаётся актуальное действие, а в состоянии — уже пусто.
      const editId = editingId;
      if (editId) await api.updateCompetition(editId, payload);
      else await api.createCompetition(payload);
      setCompetitionForm(EMPTY_COMPETITION);
      setEditingId(null);
      flash(editId ? 'Конкурс обновлён' : 'Конкурс добавлен на афишу');
      notify();
    } catch (err) {
      setCompetitionErrors({ title: err instanceof ApiError ? err.message : 'Не удалось сохранить' });
    }
  };

  const startEdit = (competition: Competition) => {
    setEditingId(competition.id);
    setCompetitionForm({
      title: competition.title,
      summary: competition.summary,
      description: competition.description,
      track: competition.track,
      startsAt: competition.startsAt,
      deadline: competition.deadline,
      maxScore: competition.maxScore,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetDemoData = async () => {
    try {
      await api.resetDemo();
      setConfirmReset(false);
      flash('Демо-данные восстановлены');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сбросить демо');
    }
  };

  if (loading) return <div className="empty">Загружаем админ-панель…</div>;

  if (!user || user.role !== 'teacher') {
    return (
      <div>
        <div className="empty">
          <h1 className="empty__title">Раздел только для организатора</h1>
          <p className="empty__text">Ученический аккаунт не открывает эту страницу.</p>
          <Link className="btn btn--primary" to="/">
            На афишу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-head__eyebrow">Организатор · {user.name}</p>
          <h1>Админ-панель</h1>
          <p className="page-head__lead">
            Проверяйте заявленные достижения и добавляйте свои — баллы сразу попадают в рейтинг.
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setConfirmReset(true)}>
          Сбросить демо
        </button>
      </div>

      {toast && (
        <div className="notice notice--success notice--floating" role="status">
          {toast}
        </div>
      )}

      {error && (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-grid">
        <section className="panel" aria-labelledby="queue-title">
          <div className="panel__head">
            <h2 id="queue-title">Достижения на проверке</h2>
            <span className="badge-count">{pendingCount(achievements)}</span>
          </div>

          {pending.length === 0 ? (
            <p className="empty-inline">Очередь пуста — все достижения проверены.</p>
          ) : (
            <ul className="queue">
              {pending.map((achievement) => {
                const student = studentById(achievement.studentId);
                const isOpen = reviewingId === achievement.id;
                return (
                  <li key={achievement.id} className="queue__row">
                    <div className="queue__info">
                      <span className="queue__name">
                        {studentName(achievement.studentId)}
                        {student?.grade ? ` · ${student.grade}` : ''}
                      </span>
                      <span className="queue__comp">{achievement.title}</span>
                      <span className="queue__date">
                        {categoryLabel(achievement.category)} · {formatDate(achievement.awardedOn)} · заявлено{' '}
                        {achievement.points} б.
                      </span>
                    </div>

                    {!isOpen ? (
                      <button
                        className="btn btn--ghost btn--sm btn--inline-mobile"
                        type="button"
                        onClick={() => {
                          setReviewingId(achievement.id);
                          setReviewPoints(String(achievement.points));
                          setReviewComment('');
                          setError('');
                        }}
                      >
                        Проверить
                      </button>
                    ) : (
                      <div className="review">
                        <label className="field field--inline">
                          <span className="field__label">Баллы к начислению</span>
                          <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={500}
                            value={reviewPoints}
                            onChange={(e) => setReviewPoints(e.target.value)}
                            autoFocus
                          />
                        </label>
                        <label className="field">
                          <span className="field__label">Комментарий ученику</span>
                          <input
                            className="input"
                            type="text"
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Например: диплом сверен с реестром"
                          />
                        </label>
                        <div className="review__actions">
                          <button className="btn btn--primary btn--sm" type="button" onClick={() => review(achievement, 'approved')}>
                            Подтвердить
                          </button>
                          <button className="btn btn--ghost btn--sm" type="button" onClick={() => review(achievement, 'rejected')}>
                            Отклонить
                          </button>
                          <button className="btn btn--quiet btn--sm" type="button" onClick={() => setReviewingId(null)}>
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="manual-title">
          <div className="panel__head">
            <h2 id="manual-title">Добавить достижение ученику</h2>
          </div>

          <form className="form" onSubmit={addManual} noValidate>
            <label className="field">
              <span className="field__label">Ученик</span>
              <select
                className="input"
                value={manual.studentId}
                onChange={(e) => setManual({ ...manual, studentId: e.target.value })}
              >
                <option value="">— выберите ученика —</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.grade}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Категория</span>
              <select
                className="input"
                value={manual.category}
                onChange={(e) => setManual({ ...manual, category: e.target.value as AchievementCategory })}
              >
                {ACHIEVEMENT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Название</span>
              <input
                className="input"
                type="text"
                value={manual.title}
                onChange={(e) => setManual({ ...manual, title: e.target.value })}
                placeholder="Победитель школьного этапа по информатике"
              />
            </label>

            <div className="form__row">
              <label className="field">
                <span className="field__label">Дата</span>
                <input
                  className="input"
                  type="date"
                  value={manual.awardedOn}
                  max={todayIso()}
                  onChange={(e) => setManual({ ...manual, awardedOn: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Баллы</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={500}
                  value={manual.points}
                  onChange={(e) => setManual({ ...manual, points: e.target.value })}
                  placeholder="50"
                />
              </label>
            </div>

            {manualError && (
              <p className="field-error" role="alert">
                {manualError}
              </p>
            )}

            <button className="btn btn--primary" type="submit">
              Добавить и подтвердить
            </button>
          </form>
        </section>

        <section className="panel" aria-labelledby="solution-title">
          <div className="panel__head">
            <h2 id="solution-title">Последние решения</h2>
          </div>
          {decided.length === 0 ? (
            <p className="empty-inline">Решений пока нет.</p>
          ) : (
            <ul className="history">
              {decided.map((achievement) => (
                <li key={achievement.id} className="history__row">
                  <span className="history__name">{studentName(achievement.studentId)}</span>
                  <span className="history__comp">{achievement.title}</span>
                  <span className={`status status--${achievement.status}`}>
                    {achievementStatusLabel(achievement.status)}
                  </span>
                  <span className="history__score">
                    {achievement.status === 'approved' ? `${achievement.points} б.` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="form-title">
          <div className="panel__head">
            <h2 id="form-title">{editingId ? 'Редактировать конкурс' : 'Новый конкурс'}</h2>
            {editingId && (
              <button
                className="btn btn--quiet btn--sm"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setCompetitionForm(EMPTY_COMPETITION);
                  setCompetitionErrors({});
                }}
              >
                Отменить
              </button>
            )}
          </div>

          <form className="form" onSubmit={submitCompetition} noValidate>
            <label className="field">
              <span className="field__label">Название</span>
              <input
                className="input"
                type="text"
                value={competitionForm.title}
                onChange={(e) => setCompetitionForm({ ...competitionForm, title: e.target.value })}
                aria-invalid={Boolean(competitionErrors.title)}
                placeholder="Например: Олимпиада по физике, школьный этап"
              />
              {competitionErrors.title && <span className="field-error">{competitionErrors.title}</span>}
            </label>

            <label className="field">
              <span className="field__label">Короткое описание для афиши</span>
              <input
                className="input"
                type="text"
                value={competitionForm.summary}
                onChange={(e) => setCompetitionForm({ ...competitionForm, summary: e.target.value })}
                aria-invalid={Boolean(competitionErrors.summary)}
                placeholder="Одна-две фразы: что делать участнику"
              />
              {competitionErrors.summary && <span className="field-error">{competitionErrors.summary}</span>}
            </label>

            <label className="field">
              <span className="field__label">Полное описание</span>
              <textarea
                className="input input--area"
                rows={3}
                value={competitionForm.description}
                onChange={(e) => setCompetitionForm({ ...competitionForm, description: e.target.value })}
                placeholder="Формат, критерии, что взять с собой"
              />
            </label>

            <div className="form__row">
              <label className="field">
                <span className="field__label">Направление</span>
                <select
                  className="input"
                  value={competitionForm.track}
                  onChange={(e) => setCompetitionForm({ ...competitionForm, track: e.target.value as Track })}
                >
                  {(['science', 'math', 'sport', 'language', 'tech'] as const).map((track) => (
                    <option key={track} value={track}>
                      {trackLabel(track)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Максимум баллов</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={1000}
                  value={competitionForm.maxScore}
                  onChange={(e) => setCompetitionForm({ ...competitionForm, maxScore: Number(e.target.value) })}
                  aria-invalid={Boolean(competitionErrors.maxScore)}
                />
                {competitionErrors.maxScore && <span className="field-error">{competitionErrors.maxScore}</span>}
              </label>
            </div>

            <div className="form__row">
              <label className="field">
                <span className="field__label">Начало приёма</span>
                <input
                  className="input"
                  type="date"
                  value={competitionForm.startsAt}
                  onChange={(e) => setCompetitionForm({ ...competitionForm, startsAt: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field__label">Дедлайн</span>
                <input
                  className="input"
                  type="date"
                  value={competitionForm.deadline}
                  onChange={(e) => setCompetitionForm({ ...competitionForm, deadline: e.target.value })}
                  aria-invalid={Boolean(competitionErrors.deadline)}
                />
                {competitionErrors.deadline && <span className="field-error">{competitionErrors.deadline}</span>}
              </label>
            </div>

            <button className="btn btn--primary" type="submit">
              {editingId ? 'Сохранить изменения' : 'Добавить конкурс'}
            </button>
          </form>
        </section>
      </div>

      <section className="panel" aria-labelledby="all-competitions">
        <div className="panel__head">
          <h2 id="all-competitions">Олимпиады и конкурсы</h2>
          <span className="muted">{competitions.length} шт.</span>
        </div>
        {competitions.length === 0 ? (
          <p className="empty-inline">Пока нет ни одного конкурса. Добавьте первый через форму выше.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Все конкурсы лицея</caption>
              <thead>
                <tr>
                  <th scope="col">Конкурс</th>
                  <th scope="col">Направление</th>
                  <th scope="col">Статус</th>
                  <th scope="col">Сроки</th>
                  <th scope="col" className="table__num">Заявок</th>
                  <th scope="col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map((competition) => {
                  const status = getCompetitionStatus(competition);
                  const count = participations.filter((p) => p.competitionId === competition.id).length;
                  return (
                    <tr key={competition.id}>
                      <td>
                        <Link to={`/competition/${competition.id}`}>{competition.title}</Link>
                      </td>
                      <td>{trackLabel(competition.track)}</td>
                      <td>
                        <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td>{formatRange(competition.startsAt, competition.deadline)}</td>
                      <td className="table__num">{count}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn--quiet btn--sm" type="button" onClick={() => startEdit(competition)}>
                            Изменить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmReset && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmReset(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reset-title" className="modal__title">
              Сбросить демо?
            </h2>
            <p className="modal__text">
              Все изменения вернутся к исходным: 7 аккаунтов, 12 достижений и 4 конкурса. Зарегистрированные
              аккаунты и их достижения будут удалены.
            </p>
            <div className="modal__actions">
              <button className="btn btn--ghost" type="button" onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
              <button className="btn btn--danger" type="button" onClick={resetDemoData}>
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}