import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildClassRating, buildRating } from '../lib/rating';
import { useStore } from '../state/store';

type Scope = 'school' | 'classes';

/**
 * Рейтинг лицея: два среза по требованию ТЗ — общий по лицею и по классам.
 * Переключатель сверху, без перезагрузки: данные уже в сторе.
 */
export function RatingPage() {
  const { user, users, achievements, loading } = useStore();
  const [scope, setScope] = useState<Scope>('school');

  const rating = useMemo(() => buildRating(users, achievements), [users, achievements]);
  const classRating = useMemo(() => buildClassRating(users, achievements), [users, achievements]);

  if (loading) return <div className="empty">Считаем рейтинг…</div>;

  const hasPoints = achievements.some((a) => a.status === 'approved' && a.points > 0);

  return (
    <>
      <header className="page-head">
        <p className="page-head__eyebrow">Рейтинг лицея</p>
        <h1>Кто набирает больше всех баллов</h1>
        <p className="page-head__lead">
          В зачёт идут только подтверждённые достижения. Переключитесь на классы, чтобы увидеть
          соперничество между параллелями.
        </p>
      </header>

      <div className="rating-switch" role="tablist" aria-label="Срез рейтинга">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'school'}
          className={`rating-switch__btn${scope === 'school' ? ' rating-switch__btn--on' : ''}`}
          onClick={() => setScope('school')}
        >
          По лицею
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'classes'}
          className={`rating-switch__btn${scope === 'classes' ? ' rating-switch__btn--on' : ''}`}
          onClick={() => setScope('classes')}
        >
          По классам
        </button>
      </div>

      {!hasPoints ? (
        <div className="empty">
          <h2 className="empty__title">Рейтинг пока пуст</h2>
          <p className="empty__text">Как только организатор подтвердит первое достижение — здесь появятся баллы.</p>
          <Link className="btn btn--primary" to="/">
            Добавить достижение
          </Link>
        </div>
      ) : scope === 'school' ? (
        <>
          <section className="podium" aria-label="Топ-3 ученика лицея">
            {rating.slice(0, 3).map((entry) => (
              <article
                key={entry.student.id}
                className={`podium__item podium__item--${entry.position}${
                  entry.student.id === user?.id ? ' podium__item--me' : ''
                }`}
              >
                <span className="podium__place">{entry.position}</span>
                <span className="podium__name">{entry.student.name}</span>
                <span className="podium__grade">{entry.student.grade} класс</span>
                <span className="podium__points">{entry.points}</span>
                <span className="podium__hint">
                  баллов · {entry.approved} {entry.approved === 1 ? 'достижение' : 'достижений'}
                </span>
              </article>
            ))}
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Все ученики</h2>
              <span className="muted">{rating.length} учеников</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Рейтинг учеников лицея по подтверждённым достижениям</caption>
                <thead>
                  <tr>
                    <th scope="col">Место</th>
                    <th scope="col">Ученик</th>
                    <th scope="col">Класс</th>
                    <th scope="col" className="table__num">Баллы</th>
                    <th scope="col" className="table__num">Достижений</th>
                  </tr>
                </thead>
                <tbody>
                  {rating.slice(3).map((entry) => (
                    <tr key={entry.student.id} className={entry.student.id === user?.id ? 'table__me' : undefined}>
                      <td className="table__num">{entry.position}</td>
                      <td>{entry.student.name}</td>
                      <td>{entry.student.grade}</td>
                      <td className="table__num">{entry.points}</td>
                      <td className="table__num">{entry.approved}</td>
                    </tr>
                  ))}
                  {rating.length <= 3 && (
                    <tr>
                      <td colSpan={5} className="table__center">
                        Все участники в топ-3.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="podium" aria-label="Топ-3 класса лицея">
            {classRating.slice(0, 3).map((entry) => (
              <article
                key={entry.grade}
                className={`podium__item podium__item--${entry.position}${
                  entry.grade === user?.grade ? ' podium__item--me' : ''
                }`}
              >
                <span className="podium__place">{entry.position}</span>
                <span className="podium__name">{entry.grade}</span>
                <span className="podium__grade">класс</span>
                <span className="podium__points">{entry.points}</span>
                <span className="podium__hint">
                  баллов · {entry.contributors} из {entry.students} учеников
                </span>
              </article>
            ))}
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Все классы</h2>
              <span className="muted">{classRating.length} классов</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Рейтинг классов по сумме подтверждённых баллов</caption>
                <thead>
                  <tr>
                    <th scope="col">Место</th>
                    <th scope="col">Класс</th>
                    <th scope="col" className="table__num">Баллы</th>
                    <th scope="col" className="table__num">Достижений</th>
                    <th scope="col" className="table__num">Учеников с баллами</th>
                  </tr>
                </thead>
                <tbody>
                  {classRating.slice(3).map((entry) => (
                    <tr key={entry.grade} className={entry.grade === user?.grade ? 'table__me' : undefined}>
                      <td className="table__num">{entry.position}</td>
                      <td>{entry.grade}</td>
                      <td className="table__num">{entry.points}</td>
                      <td className="table__num">{entry.approved}</td>
                      <td className="table__num">
                        {entry.contributors} / {entry.students}
                      </td>
                    </tr>
                  ))}
                  {classRating.length <= 3 && (
                    <tr>
                      <td colSpan={5} className="table__center">
                        Все классы в топ-3.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}