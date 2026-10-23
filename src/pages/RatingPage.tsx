import { Link } from 'react-router-dom';
import { useData } from '../state/useData';
import { useSession } from '../state/session';

/** общий рейтинг школы: сумма баллов подтверждённых участий. */
export function RatingPage() {
  const { rating } = useData();
  const { user } = useSession();
  const top = rating.slice(0, 3);
  const rest = rating.slice(3);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="page-head__eyebrow">Рейтинг школы</p>
          <h1>Кто набирает больше всех баллов</h1>
          <p className="page-head__lead">
            Считаем только подтверждённые участия. Баллы начисляет организатор после конкурса.
          </p>
        </div>
      </div>

      {rating.every((entry) => entry.points === 0) ? (
        <div className="empty">
          <h2 className="empty__title">Рейтинг пока пуст</h2>
          <p className="empty__text">Подтверждённых участий ещё нет — баллы появятся после первого конкурса.</p>
          <Link className="btn btn--primary" to="/">
            Открыть афишу
          </Link>
        </div>
      ) : (
        <>
          <section className="podium" aria-label="Топ-3 ученика">
            {top.map((entry) => (
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
                <span className="podium__hint">баллов · {entry.approved} конкурса</span>
              </article>
            ))}
          </section>

          <section className="panel" aria-labelledby="rating-all">
            <div className="panel__head">
              <h2 id="rating-all">Все участники</h2>
              <span className="muted">{rating.length} учеников</span>
            </div>
            <table className="table">
              <caption className="sr-only">Рейтинг учеников школы по сумме баллов</caption>
              <thead>
                <tr>
                  <th scope="col">Место</th>
                  <th scope="col">Ученик</th>
                  <th scope="col">Класс</th>
                  <th scope="col" className="table__num">Баллы</th>
                  <th scope="col" className="table__num">Участий</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((entry) => (
                  <tr key={entry.student.id} className={entry.student.id === user?.id ? 'table__me' : undefined}>
                    <td>{entry.position}</td>
                    <td>{entry.student.name}</td>
                    <td>{entry.student.grade}</td>
                    <td className="table__num">{entry.points}</td>
                    <td className="table__num">{entry.approved}</td>
                  </tr>
                ))}
                {rest.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table__center">
                      Все участники в топ-3.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
