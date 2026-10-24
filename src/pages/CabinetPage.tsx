import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { ACHIEVEMENT_CATEGORIES, achievementStatusLabel, categoryLabel } from '../data/categories';
import type { AchievementCategory } from '../data/types';
import { todayIso } from '../data/utils';
import { buildClassRating, buildRating, progressPercent, studentPosition } from '../lib/rating';
import { useCountUp } from '../lib/useCountUp';
import { usePriceBump } from '../lib/usePriceBump';
import { useStore } from '../state/store';

/** Потолок для прогресса: сумма лучших достижений, которых реально можно достичь. */
const SCORE_CEILING = 300;

interface FormState {
  category: AchievementCategory;
  title: string;
  awardedOn: string;
  points: string;
}

const EMPTY_FORM: FormState = {
  category: 'academic',
  title: '',
  awardedOn: todayIso(),
  points: '',
};

/**
 * Кабинет ученика: сюда он сам заявляет достижения и видит, что с ними стало.
 * Главный цикл платформы: добавил → организатор подтвердил → баллы выросли.
 */
export function CabinetPage() {
  const { user, users, achievements, participations, competitions, loading, notify } = useStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Таймер тоста: без очистки он дёргает setState после размонтирования страницы.
  const toastTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const rating = useMemo(() => buildRating(users, achievements), [users, achievements]);
  const classRating = useMemo(() => buildClassRating(users, achievements), [users, achievements]);

  const mine = useMemo(
    () => achievements.filter((a) => a.studentId === user?.id),
    [achievements, user?.id],
  );

  const approved = mine.filter((a) => a.status === 'approved');
  const pending = mine.filter((a) => a.status === 'pending');
  const rejected = mine.filter((a) => a.status === 'rejected');
  const score = approved.reduce((sum, a) => sum + a.points, 0);
  const position = user ? studentPosition(rating, user.id) : 0;
  const myClass = classRating.find((entry) => entry.grade === user?.grade);

  const scoreShown = useCountUp(score);
  const scoreBump = usePriceBump(score);
  const positionBump = usePriceBump(position);
  const progress = progressPercent(score, SCORE_CEILING);

  const flash = (message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast('');
      toastTimer.current = null;
    }, 2600);
  };

  /** Отправка достижения: уходит на проверку организатору. */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    const points = Number(form.points);
    if (form.title.trim().length < 3) {
      setFormError('Название достижения — минимум 3 символа.');
      return;
    }
    if (!Number.isInteger(points) || points < 0) {
      setFormError('Баллы — целое неотрицательное число.');
      return;
    }
    if (points > 500) {
      setFormError('Баллы — не больше 500.');
      return;
    }
    if (form.awardedOn > todayIso()) {
      setFormError('Дата не может быть в будущем.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createAchievement({
        category: form.category,
        title: form.title.trim(),
        awardedOn: form.awardedOn,
        points,
      });
      setForm({ ...EMPTY_FORM, category: form.category });
      flash('Достижение отправлено на проверку');
      notify();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Не удалось отправить достижение');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    // Удаление необратимо — спрашиваем подтверждение у самого пользователя.
    if (!window.confirm('Удалить это достижение? Действие необратимо.')) return;
    setDeletingId(id);
    try {
      await api.deleteAchievement(id);
      flash('Достижение удалено');
      notify();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Не удалось удалить');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="empty">Загружаем кабинет…</div>;
  }

  if (!user) return null;

  if (user.role === 'teacher') {
    return (
      <div className="empty">
        <h2 className="empty__title">Кабинет ученика недоступен</h2>
        <p className="empty__text">Вы вошли как организатор. Проверяйте достижения в админ-панели.</p>
        <Link className="btn btn--primary" to="/admin">
          Открыть админ-панель
        </Link>
      </div>
    );
  }

  const myApplications = participations.filter((p) => p.studentId === user.id);

  return (
    <>
      <header className="page-head">
        <p className="page-head__eyebrow">Личный кабинет · {user.grade} класс</p>
        <h1>{user.name}</h1>
        <p className="page-head__lead">
          Добавляйте достижения — организатор проверит, и баллы сразу пойдут в рейтинг лицея и класса.
        </p>
      </header>

      {toast && <div className="notice notice--success notice--floating">{toast}</div>}

      <section className="stats" aria-label="Ваши показатели">
        <div className={`stat${scoreBump ? ' stat--bump' : ''}`}>
          <span className="stat__label">Баллы</span>
          <span className="stat__value" data-testid="total-score">
            {scoreShown}
          </span>
          <span className="stat__hint">за подтверждённые достижения</span>
        </div>

        <div className={`stat${positionBump ? ' stat--bump' : ''}`}>
          <span className="stat__label">Место в лицее</span>
          <span className="stat__value">
            {position > 0 ? `#${position}` : '—'}
            <span className="stat__of"> из {rating.length}</span>
          </span>
          <span className="stat__hint">по сумме баллов</span>
        </div>

        <div className="stat">
          <span className="stat__label">В классе</span>
          <span className="stat__value">
            {myClass ? `#${myClass.position}` : '—'}
            <span className="stat__of"> из {classRating.length}</span>
          </span>
          <span className="stat__hint">класс {user.grade}</span>
        </div>

        <div className="stat stat--wide">
          <span className="stat__label">Проверено</span>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Прогресс по баллам"
          >
            <span className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="stat__hint">
            {approved.length} подтверждено · {pending.length} на проверке · {rejected.length} отклонено
          </span>
        </div>
      </section>

      <div className="cabinet">
        <section className="panel">
          <div className="panel__head">
            <h2>Мои достижения</h2>
            <span className="muted">{mine.length} шт.</span>
          </div>

          {mine.length === 0 ? (
            <div className="empty-inline">Пока пусто. Добавьте первое достижение — форма рядом.</div>
          ) : (
            <ul className="entries">
              {mine.map((achievement) => (
                <li key={achievement.id} className="entries__row">
                  <div className="entries__main">
                    <span className="entries__title">{achievement.title}</span>
                    <span className="entries__meta">
                      {categoryLabel(achievement.category)} · {achievement.awardedOn}
                    </span>
                    {achievement.comment && <span className="entries__comment">{achievement.comment}</span>}
                  </div>
                  <div className="entries__score-block">
                    <span className={`status status--${achievement.status}`}>
                      {achievementStatusLabel(achievement.status)}
                    </span>
                    <span className="entries__points">
                      {achievement.status === 'approved' ? `+${achievement.points}` : `${achievement.points} б.`}
                    </span>
                    {achievement.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => remove(achievement.id)}
                        disabled={deletingId === achievement.id}
                      >
                        Отозвать
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Новое достижение</h2>
          </div>

          <form className="form" onSubmit={submit} noValidate>
            <label className="field">
              <span>Категория</span>
              <select
                className="input"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as AchievementCategory })}
              >
                {ACHIEVEMENT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <span className="field__hint">
                {ACHIEVEMENT_CATEGORIES.find((c) => c.id === form.category)?.hint}
              </span>
            </label>

            <label className="field">
              <span>Название</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Призёр олимпиады по физике"
                maxLength={120}
              />
            </label>

            <div className="form__row">
              <label className="field">
                <span>Дата</span>
                <input
                  className="input"
                  type="date"
                  value={form.awardedOn}
                  max={todayIso()}
                  onChange={(event) => setForm({ ...form, awardedOn: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Баллы</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={500}
                  value={form.points}
                  onChange={(event) => setForm({ ...form, points: event.target.value })}
                  placeholder="40"
                />
              </label>
            </div>

            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}

            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? 'Отправляем…' : 'Отправить на проверку'}
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2>Заявки на конкурсы</h2>
          <Link className="btn btn--ghost btn--sm" to="/">
            Найти конкурс
          </Link>
        </div>

        {myApplications.length === 0 ? (
          <div className="empty-inline">Вы ещё не записывались на конкурсы.</div>
        ) : (
          <ul className="entries">
            {myApplications.map((application) => {
              const competition = competitions.find((c) => c.id === application.competitionId);
              return (
                <li key={application.id} className="entries__row">
                  <div className="entries__main">
                    <Link className="entries__title" to={`/competition/${application.competitionId}`}>
                      {competition?.title ?? 'Конкурс удалён'}
                    </Link>
                    <span className="entries__meta">заявка от {application.registeredAt}</span>
                    {application.comment && <span className="entries__comment">{application.comment}</span>}
                  </div>
                  <div className="entries__score-block">
                    <span className={`status status--${application.status}`}>
                      {application.status === 'approved'
                        ? 'Подтверждено'
                        : application.status === 'pending'
                          ? 'Ожидает решения'
                          : 'Отклонено'}
                    </span>
                    {application.status === 'approved' && (
                      <span className="entries__points">+{application.score}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}