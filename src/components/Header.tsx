import { NavLink, Link } from 'react-router-dom';
import { useStore } from '../state/store';

/** Иконки: инлайновые SVG, без emoji и без иконочных библиотек. */
function Icon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function Header() {
  const { user, logout } = useStore();

  if (!user) return null;

  const navItems =
    user.role === 'teacher'
      ? [
          { to: '/', label: 'Афиша' },
          { to: '/admin', label: 'Админ-панель' },
          { to: '/rating', label: 'Рейтинг' },
        ]
      : [
          { to: '/', label: 'Афиша' },
          { to: '/cabinet', label: 'Мой кабинет' },
          { to: '/rating', label: 'Рейтинг' },
        ];

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="brand" aria-label="На главную">
          <span className="brand__mark" aria-hidden="true">Д</span>
          <span className="brand__text">
            <span className="brand__name">Достижения</span>
            <span className="brand__sub">платформа лицея</span>
          </span>
        </Link>

        <nav className="header__nav" aria-label="Основная навигация">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header__user">
          <div className="user-chip">
            <span className="user-chip__avatar" aria-hidden="true">{initials(user.name)}</span>
            <div className="user-chip__body">
              <div className="user-chip__name">{user.name}</div>
              <div className="user-chip__role">
                {user.role === 'teacher' ? 'Организатор' : `${user.grade} класс`}
              </div>
            </div>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={() => {
              // Ошибку выхода не показываем: локальная сессия сбрасывается в любом случае.
              void logout().catch(() => undefined);
            }}
            aria-label="Выйти из аккаунта"
            title="Выйти"
          >
            <Icon />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>Достижения — платформа достижений учеников лицея</span>
        <span>Данные хранятся в базе SQLite на сервере.</span>
      </div>
    </footer>
  );
}
