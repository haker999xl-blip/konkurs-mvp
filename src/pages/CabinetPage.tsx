import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../state/session';
import { useData } from '../state/useData';
import {
  PARTICIPATION_LABEL,
  formatDate,
  getCompetitionStatus,
} from '../data/utils';
import { approvedCount, progressPercent, studentPosition, totalScore } from '../lib/rating';
import {
  DIPLOMA_TEMPLATES,
  diplomaPreviewUrl,
  downloadDiploma,
  type DiplomaVariant,
} from '../data/diplomas';
import { usePriceBump } from '../lib/usePriceBump';

/**
 * Личный кабинет ученика.
 * Вау-фича: при обновлении баллов/позиции числа анимированно «прыгают»,
 * а прогресс догоняет новое значение. Отслеживается и внутри, и между вкладками.
 */
export function CabinetPage() {
  const { user } = useSession();
  const { competitions, participations, rating } = useData();
  const [selectedParticipation, setSelectedParticipation] = useState<string | null>(null);
  const [variant, setVariant] = useState<DiplomaVariant>('classic');

  const myEntries = useMemo(
    () => participations.filter((p) => p.studentId === user?.id),
    [participations, user],
  );

  const approved = approvedCount(myEntries);
  const score = totalScore(myEntries);
  const position = user ? studentPosition(rating, user.id) : 0;
  const competitionById = useMemo(
    () => new Map(competitions.map((c) => [c.id, c])),
    [competitions],
  );

  const finishedEntries = myEntries.filter((entry) => {
    const competition = competitionById.get(entry.competitionId);
    return entry.status === 'approved' && competition && getCompetitionStatus(competition) === 'finished';
  });

  /** Диплом можно получить только за завершённый подтверждённый конкурс. */
  const diplomaCandidates = finishedEntries.length > 0 ? finishedEntries : [];
  const activeParticipation =
    diplomaCandidates.find((entry) => entry.id === selectedParticipation) ??
    diplomaCandidates[0] ??
    null;
  const activeCompetition = activeParticipation
    ? competitionById.get(activeParticipation.competitionId) ?? null
    : null;

  const scoreAnim = usePriceBump(score);
  const positionAnim = usePriceBump(position);
  const progressTarget = progressPercent(
    score,
    Math.max(1, myEntries.reduce((sum, e) => sum + (competitionById.get(e.competitionId)?.maxScore ?? 0), 0)),
  );
  const [progressShown, setProgressShown] = useState(progressTarget);

  /** Плавный догон прогресс-бара при изменении цели. */
  useEffect(() => {
    const id = window.setTimeout(() => setProgressShown(progressTarget), 60);
    return () => window.clearTimeout(id);
  }, [progressTarget]);

  if (!user) return null;

  if (user.role === 'teacher') {
    return (
      <div className="container">
        <div className="empty">
          <h1 className="empty__title">Кабинет ученика недоступен</h1>
          <p className="empty__text">
            Вы вошли как организатор. Заявки и баллы ведутся в админ-панели.
          </p>
          <Link className="btn btn--primary" to="/admin">
            Перейти в админ-панель
          </Link>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    if (!activeParticipation || !activeCompetition) return;
    downloadDiploma(
      {
        studentName: user.name,
        grade: user.grade,
        competitionTitle: activeCompetition.title,
        score: activeParticipation.score,
        maxScore: activeCompetition.maxScore,
        date: formatDate(activeParticipation.reviewedAt?.slice(0, 10) ?? activeParticipation.registeredAt),
      },
      variant,
    );
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="page-head__eyebrow">Личный кабинет · {user.grade} класс</p>
          <h1>{user.name}</h1>
          <p className="page-head__lead">
            Ваши заявки, баллы и дипломы. Баллы начисляет организатор после подтверждения участия.
          </p>
        </div>
      </div>

      <section className="stats" aria-label="Сводка">
        <div className={`stat${scoreAnim ? ' stat--bump' : ''}`}>
          <span className="stat__label">Баллы</span>
          <span className="stat__value" data-testid="total-score">{score}</span>
          <span className="stat__hint">за подтверждённые участия</span>
        </div>
        <div className={`stat${positionAnim ? ' stat--bump' : ''}`}>
          <span className="stat__label">Место в рейтинге</span>
          <span className="stat__value">
            #{position}
            <span className="stat__of"> из {rating.length}</span>
          </span>
          <span className="stat__hint">по сумме баллов школы</span>
        </div>
        <div className="stat">
          <span className="stat__label">Подтверждено</span>
          <span className="stat__value">{approved}</span>
          <span className="stat__hint">участий из {myEntries.length} заявок</span>
        </div>
        <div className="stat stat--wide">
          <span className="stat__label">Прогресс до максимума</span>
          <div className="progress" role="progressbar" aria-valuenow={progressShown} aria-valuemin={0} aria-valuemax={100}>
            <span className="progress__fill" style={{ width: `${progressShown}%` }} />
          </div>
          <span className="stat__hint">{progressShown}% от суммы максимальных баллов ваших конкурсов</span>
        </div>
      </section>

      <div className="cabinet">
        <section className="panel" aria-labelledby="my-entries-title">
          <div className="panel__head">
            <h2 id="my-entries-title">Мои участия</h2>
            <Link className="btn btn--quiet btn--sm btn--inline-mobile" to="/">
              Найти конкурс
            </Link>
          </div>

          {myEntries.length === 0 ? (
            <div className="empty empty--inline">
              <h3 className="empty__title">Пока ни одного участия</h3>
              <p className="empty__text">Найдите конкурс по интересам и подайте заявку.</p>
              <Link className="btn btn--primary" to="/">
                Открыть афишу
              </Link>
            </div>
          ) : (
            <ul className="entries">
              {myEntries.map((entry) => {
                const competition = competitionById.get(entry.competitionId);
                const percent = competition
                  ? progressPercent(entry.score, competition.maxScore)
                  : 0;
                return (
                  <li key={entry.id} className="entries__row">
                    <div className="entries__main">
                      <Link
                        className="entries__title"
                        to={`/competition/${entry.competitionId}`}
                      >
                        {competition?.title ?? 'Конкурс удалён'}
                      </Link>
                      <span className="entries__meta">
                        Заявка от {formatDate(entry.registeredAt)}
                        {competition ? ` · до ${competition.maxScore} баллов` : ''}
                      </span>
                      {entry.comment && <span className="entries__comment">{entry.comment}</span>}
                    </div>
                    <div className="entries__score-block">
                      <span className={`status status--${entry.status === 'approved' ? 'active' : entry.status === 'rejected' ? 'finished' : 'upcoming'}`}>
                        {PARTICIPATION_LABEL[entry.status]}
                      </span>
                      {entry.status === 'approved' && (
                        <div className="entries__score">
                          <span className="entries__points">{entry.score}</span>
                          <span className="entries__bar" aria-hidden="true">
                            <span style={{ width: `${percent}%` }} />
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="diploma-title">
          <div className="panel__head">
            <h2 id="diploma-title">Дипломы</h2>
            <span className="muted">{DIPLOMA_TEMPLATES.length} шаблона</span>
          </div>

          {diplomaCandidates.length === 0 ? (
            <div className="empty empty--inline">
              <h3 className="empty__title">Дипломов пока нет</h3>
              <p className="empty__text">
                Диплом открывается за завершённый конкурс с подтверждённым участием.
              </p>
            </div>
          ) : (
            <>
              <label className="field">
                <span className="field__label">Конкурс</span>
                <select
                  className="input"
                  value={activeParticipation?.id ?? ''}
                  onChange={(event) => setSelectedParticipation(event.target.value)}
                >
                  {diplomaCandidates.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {competitionById.get(entry.competitionId)?.title ?? 'Конкурс'}
                    </option>
                  ))}
                </select>
              </label>

              <div className="diploma-preview">
                {activeParticipation && activeCompetition && (
                  <img
                    src={diplomaPreviewUrl(
                      {
                        studentName: user.name,
                        grade: user.grade,
                        competitionTitle: activeCompetition.title,
                        score: activeParticipation.score,
                        maxScore: activeCompetition.maxScore,
                        date: formatDate(
                          activeParticipation.reviewedAt?.slice(0, 10) ??
                            activeParticipation.registeredAt,
                        ),
                      },
                      variant,
                    )}
                    alt={`Предпросмотр диплома: ${user.name}, ${activeCompetition.title}`}
                    width={1000}
                    height={720}
                  />
                )}
              </div>

              <fieldset className="templates">
                <legend>Шаблон</legend>
                {DIPLOMA_TEMPLATES.map((template) => (
                  <label
                    key={template.id}
                    className={`template${variant === template.id ? ' template--on' : ''}`}
                  >
                    <input
                      type="radio"
                      name="diploma-variant"
                      value={template.id}
                      checked={variant === template.id}
                      onChange={() => setVariant(template.id)}
                    />
                    <span className="template__name">{template.name}</span>
                    <span className="template__note">{template.note}</span>
                  </label>
                ))}
              </fieldset>

              <button className="btn btn--primary" type="button" onClick={handleDownload}>
                Скачать диплом
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
