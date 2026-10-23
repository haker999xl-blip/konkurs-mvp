import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../state/useData';
import { useSession } from '../state/session';
import { getRepository } from '../data/localRepository';
import {
  PARTICIPATION_LABEL,
  STATUS_LABEL,
  deadlineLabel,
  formatRange,
  getCompetitionStatus,
  todayIso,
  trackLabel,
} from '../data/utils';

/** Страница конкурса: описание, сроки, заявка ученика, список участников для админа. */
export function CompetitionPage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const { competitions, participations, users, refresh } = useData();
  const [justJoined, setJustJoined] = useState(false);

  const competition = competitions.find((c) => c.id === id);

  const myEntry = useMemo(
    () => participations.find((p) => p.competitionId === id && p.studentId === user?.id),
    [participations, id, user],
  );

  const entries = useMemo(
    () => participations.filter((p) => p.competitionId === id),
    [participations, id],
  );

  const studentName = (studentId: string) =>
    users.find((u) => u.id === studentId)?.name ?? 'Без имени';

  if (!competition) {
    return (
      <div className="container">
        <div className="empty">
          <h1 className="empty__title">Конкурс не найден</h1>
          <p className="empty__text">Возможно, его удалили. Вернитесь на афишу.</p>
          <Link className="btn btn--primary" to="/">
            На афишу
          </Link>
        </div>
      </div>
    );
  }

  const status = getCompetitionStatus(competition);
  const canJoin = user?.role === 'student' && status !== 'finished' && !myEntry;

  /** Заявка создаётся со статусом pending: баллы начислит админ (вау-фича). */
  const join = () => {
    if (!user || !canJoin) return;
    getRepository().createParticipation({
      competitionId: competition.id,
      studentId: user.id,
      status: 'pending',
      score: 0,
      registeredAt: todayIso(),
      comment: '',
    });
    setJustJoined(true);
    refresh();
  };

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Хлебные крошки">
        <Link to="/">Афиша</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{competition.title}</span>
      </nav>

      <div className="detail">
        <div className="detail__main">
          <p className="page-head__eyebrow">{trackLabel(competition.track)}</p>
          <h1 className="detail__title">{competition.title}</h1>
          <div className="detail__badges">
            <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
            <span className="pill">{formatRange(competition.startsAt, competition.deadline)}</span>
            <span className="pill">до {competition.maxScore} баллов</span>
          </div>
          <p className="detail__lead">{competition.summary}</p>
          <p className="detail__text">{competition.description}</p>

          <dl className="facts">
            <div>
              <dt>Приём заявок</dt>
              <dd>{formatRange(competition.startsAt, competition.deadline)}</dd>
            </div>
            <div>
              <dt>Дедлайн</dt>
              <dd>{deadlineLabel(competition)}</dd>
            </div>
            <div>
              <dt>Заявок подано</dt>
              <dd>{entries.length}</dd>
            </div>
          </dl>
        </div>

        <aside className="detail__aside" aria-label="Участие">
          {user?.role === 'student' && (
            <div className="join">
              {myEntry ? (
                <>
                  <p className="join__label">Ваш статус</p>
                  <p className={`join__status join__status--${myEntry.status}`}>
                    {PARTICIPATION_LABEL[myEntry.status]}
                  </p>
                  {myEntry.status === 'approved' && (
                    <p className="join__score">
                      {myEntry.score} <span>/ {competition.maxScore} баллов</span>
                    </p>
                  )}
                  {myEntry.status === 'pending' && (
                    <p className="join__note">
                      Заявка отправлена. Баллы появятся, когда организатор подтвердит участие.
                    </p>
                  )}
                  {myEntry.comment && <p className="join__note">{myEntry.comment}</p>}
                  <Link className="btn btn--ghost" to="/cabinet">
                    Перейти в кабинет
                  </Link>
                </>
              ) : status === 'finished' ? (
                <>
                  <p className="join__label">Приём закрыт</p>
                  <p className="join__note">Конкурс завершён — заявки больше не принимаются.</p>
                  <Link className="btn btn--ghost" to="/">
                    На афишу
                  </Link>
                </>
              ) : status === 'upcoming' ? (
                <>
                  <p className="join__label">Старт {formatRange(competition.startsAt, competition.startsAt)}</p>
                  <p className="join__note">Приём заявок ещё не открыт.</p>
                </>
              ) : (
                <>
                  <p className="join__label">Участие бесплатное</p>
                  <p className="join__note">
                    Заявка уйдёт организатору. Он подтвердит участие и выставит баллы.
                  </p>
                  <button className="btn btn--primary" type="button" onClick={join}>
                    Участвовать
                  </button>
                  {justJoined && (
                    <p className="join__flash" role="status">
                      Заявка отправлена
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {user?.role === 'teacher' && (
            <div className="join">
              <p className="join__label">Режим организатора</p>
              <p className="join__note">
                Заявки и подтверждение баллов — в админ-панели.
              </p>
              <Link className="btn btn--primary" to="/admin">
                Открыть админ-панель
              </Link>
            </div>
          )}
        </aside>
      </div>

      {user?.role === 'teacher' && (
        <section className="panel" aria-labelledby="part-list-title">
          <div className="panel__head">
            <h2 id="part-list-title">Заявки на конкурс</h2>
            <span className="muted">{entries.length} шт.</span>
          </div>
          {entries.length === 0 ? (
            <p className="empty-inline">Пока никто не подал заявку.</p>
          ) : (
            <ul className="people">
              {entries.map((entry) => (
                <li key={entry.id} className="people__row">
                  <span className="people__name">{studentName(entry.studentId)}</span>
                  <span className={`status status--${entry.status === 'approved' ? 'active' : entry.status === 'rejected' ? 'finished' : 'upcoming'}`}>
                    {PARTICIPATION_LABEL[entry.status]}
                  </span>
                  <span className="people__score">
                    {entry.status === 'approved' ? `${entry.score} баллов` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
