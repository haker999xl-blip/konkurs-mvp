import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/useData';
import { useSession } from '../state/session';
import type { Competition, CompetitionStatus } from '../data/types';
import {
  STATUS_LABEL,
  deadlineLabel,
  formatRange,
  getCompetitionStatus,
  trackLabel,
} from '../data/utils';

interface CardProps {
  competition: Competition;
  status: CompetitionStatus;
  joined: boolean;
}

/** Карточка афиши: направление, сроки, статус и быстрый переход. */
function CompetitionCard({ competition, status, joined }: CardProps) {
  return (
    <article className={`card card--${competition.track}`}>
      <Link
        className="card__media"
        to={`/competition/${competition.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {competition.image ? (
          <img
            className="card__image"
            src={competition.image}
            alt=""
            width={800}
            height={520}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="card__image card__image--empty" />
        )}
      </Link>
      <div className="card__top">
        <span className="card__track">{trackLabel(competition.track)}</span>
        <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <h3 className="card__title">
        <Link to={`/competition/${competition.id}`}>{competition.title}</Link>
      </h3>
      <p className="card__summary">{competition.summary}</p>
      <div className="card__meta">
        <span>{formatRange(competition.startsAt, competition.deadline)}</span>
        <span className="card__deadline">{deadlineLabel(competition)}</span>
      </div>
      <div className="card__foot">
        <span className="card__max">до {competition.maxScore} баллов</span>
        {joined ? (
          <span className="pill pill--joined">Вы участвуете</span>
        ) : (
          <Link className="card__link" to={`/competition/${competition.id}`}>
            {status === 'finished' ? 'Посмотреть' : 'Открыть'}
          </Link>
        )}
      </div>
    </article>
  );
}

export function PosterPage() {
  const { competitions, participations } = useData();
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | CompetitionStatus>('all');
  const [track, setTrack] = useState<'all' | Competition['track']>('all');
  const [sort, setSort] = useState<'deadline' | 'start'>('deadline');

  /** Поиск без учёта регистра + комбинируемые фильтры + сортировка по датам. */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return competitions
      .filter((c) => {
        if (q && !c.title.toLowerCase().includes(q) && !c.summary.toLowerCase().includes(q)) {
          return false;
        }
        if (status !== 'all' && getCompetitionStatus(c) !== status) return false;
        if (track !== 'all' && c.track !== track) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'deadline') return a.deadline.localeCompare(b.deadline);
        return a.startsAt.localeCompare(b.startsAt);
      });
  }, [competitions, query, status, track, sort]);

  const myCompetitions = useMemo(
    () => new Set(participations.filter((p) => p.studentId === user?.id).map((p) => p.competitionId)),
    [participations, user],
  );

  const activeCount = competitions.filter((c) => getCompetitionStatus(c) === 'active').length;
  const hasFilters = query !== '' || status !== 'all' || track !== 'all';

  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setTrack('all');
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <p className="page-head__eyebrow">Афиша · 7–8 классы</p>
          <h1>Что происходит в школе</h1>
          <p className="page-head__lead">
            {activeCount > 0
              ? `Сейчас открыт приём заявок в ${activeCount} ${activeCount === 1 ? 'конкурс' : 'конкурса'}. Выбирайте направление и присоединяйтесь.`
              : 'Приём заявок пока закрыт — загляните на страницы завершённых конкурсов.'}
          </p>
        </div>
      </div>

      <div className="toolbar" role="search">
        <div className="toolbar__search">
          <label htmlFor="poster-search" className="sr-only">
            Поиск конкурсов по названию
          </label>
          <input
            id="poster-search"
            type="search"
            className="input"
            placeholder="Найти конкурс: наука, поэзия, шахматы…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="toolbar__filters">
          <label className="select">
            <span>Статус</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">Все</option>
              <option value="active">Идёт приём</option>
              <option value="upcoming">Скоро старт</option>
              <option value="finished">Завершён</option>
            </select>
          </label>

          <label className="select">
            <span>Направление</span>
            <select value={track} onChange={(e) => setTrack(e.target.value as typeof track)}>
              <option value="all">Любое</option>
              <option value="science">Наука</option>
              <option value="art">Творчество</option>
              <option value="sport">Спорт</option>
              <option value="language">Языки</option>
              <option value="tech">Технологии</option>
            </select>
          </label>

          <label className="select">
            <span>Сортировка</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="deadline">По дедлайну</option>
              <option value="start">По дате старта</option>
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title">Ничего не нашлось</h2>
          <p className="empty__text">
            {hasFilters
              ? 'Слишком узкие фильтры. Сбросьте их — и конкурсы вернутся.'
              : 'Организатор ещё не добавил конкурсы. Загляните чуть позже.'}
          </p>
          {hasFilters && (
            <button className="btn btn--ghost" type="button" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="poster-grid">
          {visible.map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              status={getCompetitionStatus(competition)}
              joined={myCompetitions.has(competition.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
