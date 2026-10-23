import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/useData';
import { useSession } from '../state/session';
import { getRepository } from '../data/localRepository';
import type { Competition, Track } from '../data/types';
import {
  PARTICIPATION_LABEL,
  STATUS_LABEL,
  formatDate,
  formatRange,
  getCompetitionStatus,
  todayIso,
  trackLabel,
} from '../data/utils';
import { ImportPanel, ReportPanel } from '../components/ImportPanel';

const EMPTY_FORM = {
  title: '',
  summary: '',
  description: '',
  track: 'science' as Track,
  startsAt: todayIso(),
  deadline: todayIso(),
  maxScore: 100,
};

type FormState = typeof EMPTY_FORM;

interface FormErrors {
  title?: string;
  summary?: string;
  deadline?: string;
  maxScore?: string;
}

/** Валидация формы конкурса: понятные правила, без магии. */
function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.title.trim().length < 3) errors.title = 'Название — минимум 3 символа';
  if (form.summary.trim().length < 10) errors.summary = 'Короткое описание — минимум 10 символов';
  if (form.deadline < form.startsAt) errors.deadline = 'Дедлайн не может быть раньше старта';
  if (!Number.isFinite(form.maxScore) || form.maxScore < 1 || form.maxScore > 1000) {
    errors.maxScore = 'Максимум баллов — от 1 до 1000';
  }
  return errors;
}

export function AdminPage() {
  const { user } = useSession();
  const { competitions, participations, users, refresh } = useData();
  const repo = getRepository();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Competition | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const pendingEntries = useMemo(
    () => participations.filter((p) => p.status === 'pending'),
    [participations],
  );

  const studentName = (id: string) => users.find((u) => u.id === id)?.name ?? 'Без имени';
  const competitionTitle = (id: string) =>
    competitions.find((c) => c.id === id)?.title ?? 'Конкурс удалён';

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  /** Возврат к исходным данным: перед показом демо удобно начинать с чистого листа. */
  const resetDemoData = () => {
    repo.resetDemo();
    setConfirmReset(false);
  };

  if (!user || user.role !== 'teacher') {
    return (
      <div className="container">
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

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      description: form.description.trim() || form.summary.trim(),
      track: form.track,
      startsAt: form.startsAt,
      deadline: form.deadline,
      maxScore: Number(form.maxScore),
      createdBy: user.id,
    };

    if (editingId) {
      repo.updateCompetition(editingId, payload);
      flash('Конкурс обновлён');
    } else {
      repo.createCompetition(payload);
      flash('Конкурс добавлен на афишу');
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
    refresh();
  };

  const startEdit = (competition: Competition) => {
    setEditingId(competition.id);
    setForm({
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

  const remove = () => {
    if (!confirmDelete) return;
    repo.deleteCompetition(confirmDelete.id);
    setConfirmDelete(null);
    if (editingId === confirmDelete.id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    flash('Конкурс удалён');
    refresh();
  };

  const openReview = (participationId: string) => {
    const entry = participations.find((p) => p.id === participationId);
    if (!entry) return;
    setReviewing(entry.id);
    setReviewScore('');
    setReviewComment('');
  };

  /**
   * Подтверждение участия — точка вау-фичи.
   * После записи в localStorage BroadcastChannel сообщает другой вкладке,
   * и у ученика анимированно обновляются баллы, прогресс и место.
   */
  const confirmReview = (status: 'approved' | 'rejected') => {
    if (!reviewing) return;
    const entry = participations.find((p) => p.id === reviewing);
    const competition = competitions.find((c) => c.id === entry?.competitionId);
    const score = Number(reviewScore || 0);
    if (status === 'approved' && (!Number.isFinite(score) || score < 0 || score > (competition?.maxScore ?? 1000))) {
      flash(`Баллы: от 0 до ${competition?.maxScore ?? 1000}`);
      return;
    }
    repo.reviewParticipation(reviewing, status, {
      score: status === 'approved' ? score : 0,
      comment: reviewComment.trim(),
    });
    setReviewing(null);
    refresh();
    flash(status === 'approved' ? 'Участие подтверждено — баллы начислены' : 'Заявка отклонена');
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="page-head__eyebrow">Организатор · {user.name}</p>
          <h1>Админ-панель</h1>
          <p className="page-head__lead">
            Создавайте конкурсы, подтверждайте участия и выгружайте отчёт. Всё занимает
            секунды вместо часов в Excel.
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

      <div className="admin-grid">
        <section className="panel" aria-labelledby="queue-title">
          <div className="panel__head">
            <h2 id="queue-title">На рассмотрении</h2>
            <span className="badge-count">{pendingEntries.length}</span>
          </div>
          {pendingEntries.length === 0 ? (
            <p className="empty-inline">Новых заявок нет — очередь пуста.</p>
          ) : (
            <ul className="queue">
              {pendingEntries.map((entry) => {
                const competition = competitions.find((c) => c.id === entry.competitionId);
                const isOpen = reviewing === entry.id;
                return (
                  <li key={entry.id} className="queue__row">
                    <div className="queue__info">
                      <span className="queue__name">{studentName(entry.studentId)}</span>
                      <span className="queue__comp">{competitionTitle(entry.competitionId)}</span>
                      <span className="queue__date">заявка от {formatDate(entry.registeredAt)}</span>
                    </div>
                    {!isOpen ? (
                      <button className="btn btn--ghost btn--sm btn--inline-mobile" type="button" onClick={() => openReview(entry.id)}>
                        Рассмотреть
                      </button>
                    ) : (
                      <div className="review">
                        <label className="field field--inline">
                          <span className="field__label">Баллы (макс. {competition?.maxScore ?? 100})</span>
                          <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={competition?.maxScore ?? 100}
                            value={reviewScore}
                            onChange={(e) => setReviewScore(e.target.value)}
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
                            placeholder="Например: точная защита, хорошие вопросы"
                          />
                        </label>
                        <div className="review__actions">
                          <button className="btn btn--primary btn--sm" type="button" onClick={() => confirmReview('approved')}>
                            Подтвердить
                          </button>
                          <button className="btn btn--ghost btn--sm" type="button" onClick={() => confirmReview('rejected')}>
                            Отклонить
                          </button>
                          <button className="btn btn--quiet btn--sm" type="button" onClick={() => setReviewing(null)}>
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

        <section className="panel" aria-labelledby="form-title">
          <div className="panel__head">
            <h2 id="form-title">{editingId ? 'Редактировать конкурс' : 'Новый конкурс'}</h2>
            {editingId && (
              <button
                className="btn btn--quiet btn--sm"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                  setErrors({});
                }}
              >
                Отменить
              </button>
            )}
          </div>

          <form className="form" onSubmit={submitForm} noValidate>
            <label className="field">
              <span className="field__label">Название</span>
              <input
                className="input"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                aria-invalid={Boolean(errors.title)}
                placeholder="Например: Конкурс проектов «Школа 2030»"
              />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </label>

            <label className="field">
              <span className="field__label">Короткое описание для афиши</span>
              <input
                className="input"
                type="text"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                aria-invalid={Boolean(errors.summary)}
                placeholder="Одна-две фразы: что делать участнику"
              />
              {errors.summary && <span className="field-error">{errors.summary}</span>}
            </label>

            <label className="field">
              <span className="field__label">Полное описание</span>
              <textarea
                className="input input--area"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Формат, критерии, что взять с собой"
              />
            </label>

            <div className="form__row">
              <label className="field">
                <span className="field__label">Направление</span>
                <select
                  className="input"
                  value={form.track}
                  onChange={(e) => setForm({ ...form, track: e.target.value as Track })}
                >
                  {(['science', 'art', 'sport', 'language', 'tech'] as const).map((track) => (
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
                  value={form.maxScore}
                  onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })}
                  aria-invalid={Boolean(errors.maxScore)}
                />
                {errors.maxScore && <span className="field-error">{errors.maxScore}</span>}
              </label>
            </div>

            <div className="form__row">
              <label className="field">
                <span className="field__label">Начало приёма</span>
                <input
                  className="input"
                  type="date"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field__label">Дедлайн</span>
                <input
                  className="input"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  aria-invalid={Boolean(errors.deadline)}
                />
                {errors.deadline && <span className="field-error">{errors.deadline}</span>}
              </label>
            </div>

            <button className="btn btn--primary" type="submit">
              {editingId ? 'Сохранить изменения' : 'Добавить конкурс'}
            </button>
          </form>
        </section>

        <section className="panel" aria-labelledby="import-title">
          <div className="panel__head">
            <h2 id="import-title">Участники из файла</h2>
          </div>
          <ImportPanel onDone={refresh} />
        </section>

        <section className="panel" aria-labelledby="export-title">
          <div className="panel__head">
            <h2 id="export-title">Отчёт по активности</h2>
          </div>
          <ReportPanel />
        </section>
      </div>

      <section className="panel" aria-labelledby="all-competitions">
        <div className="panel__head">
          <h2 id="all-competitions">Конкурсы</h2>
          <span className="muted">{competitions.length} шт.</span>
        </div>
        {competitions.length === 0 ? (
          <p className="empty-inline">Пока нет ни одного конкурса. Добавьте первый через форму выше.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Все конкурсы школы</caption>
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
                          <button
                            className="btn btn--quiet btn--sm row-actions__danger"
                            type="button"
                            onClick={() => setConfirmDelete(competition)}
                          >
                            Удалить
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

      <section className="panel panel--muted">
        <div className="panel__head">
          <h2>История решений</h2>
        </div>
        <ul className="history">
          {participations
            .filter((p) => p.status !== 'pending')
            .slice(-6)
            .reverse()
            .map((entry) => (
              <li key={entry.id} className="history__row">
                <span className="history__name">{studentName(entry.studentId)}</span>
                <span className="history__comp">{competitionTitle(entry.competitionId)}</span>
                <span className={`status status--${entry.status === 'approved' ? 'active' : 'finished'}`}>
                  {PARTICIPATION_LABEL[entry.status]}
                </span>
                <span className="history__score">{entry.status === 'approved' ? `${entry.score} б.` : '—'}</span>
              </li>
            ))}
        </ul>
      </section>

      {confirmDelete && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-title" className="modal__title">Удалить конкурс?</h2>
            <p className="modal__text">
              «{confirmDelete.title}» исчезнет с афиши. Заявки на этот конкурс тоже удалятся.
              Действие необратимо.
            </p>
            <div className="modal__actions">
              <button className="btn btn--ghost" type="button" onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button className="btn btn--danger" type="button" onClick={remove}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmReset && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmReset(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reset-title" className="modal__title">Сбросить демо?</h2>
            <p className="modal__text">
              Все изменения вернутся к исходным: 4 конкурса, 12 заявок, баллы и решения.
              Вкладки закроют сессию. Удобно перед показом.
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
