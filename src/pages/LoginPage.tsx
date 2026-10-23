import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../state/session';

/**
 * Вход — симуляция: без пароля, выбор из seed-аккаунтов.
 * Задача экрана: за один клик дать и ученика, и организатора для демо.
 */
export function LoginPage() {
  const { users, login } = useSession();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState(false);

  const students = users.filter((u) => u.role === 'student');
  const teachers = users.filter((u) => u.role === 'teacher');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) {
      setError(true);
      return;
    }
    const user = users.find((u) => u.id === selected);
    login(selected);
    navigate(user?.role === 'teacher' ? '/admin' : '/cabinet');
  };

  return (
    <main className="auth">
      <section className="auth__intro" aria-labelledby="auth-title">
        <p className="auth__eyebrow">Платформа школьных конкурсов</p>
        <h1 id="auth-title" className="auth__title">
          Все конкурсы школы — в одном месте
        </h1>
        <p className="auth__lead">
          Ученики находят конкурсы и забирают дипломы. Учителя собирают заявки и
          выгружают отчёт без Excel-марафона.
        </p>
        <ul className="auth__facts">
          <li>Афиша, заявки, баллы и дипломы</li>
          <li>Импорт участников за один шаг</li>
          <li>Отчёт, который открывается в Excel</li>
        </ul>
      </section>

      <form className="auth__card" onSubmit={handleSubmit} noValidate>
        <h2 className="auth__card-title">Вход в демо</h2>
        <p className="auth__hint">Пароль не нужен: выберите одну из учётных записей.</p>

        <fieldset className="auth__group">
          <legend>Ученик</legend>
          {students.map((user) => (
            <label key={user.id} className={`account${selected === user.id ? ' account--on' : ''}`}>
              <input
                type="radio"
                name="account"
                value={user.id}
                checked={selected === user.id}
                onChange={() => {
                  setSelected(user.id);
                  setError(false);
                }}
              />
              <span className="account__avatar" aria-hidden="true">
                {user.name.slice(0, 1)}
              </span>
              <span className="account__body">
                <span className="account__name">{user.name}</span>
                <span className="account__meta">
                  {user.grade} класс
                  {user.id === 'u-student-masha' ? ' · основной демо-аккаунт' : ''}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="auth__group">
          <legend>Организатор</legend>
          {teachers.map((user) => (
            <label key={user.id} className={`account${selected === user.id ? ' account--on' : ''}`}>
              <input
                type="radio"
                name="account"
                value={user.id}
                checked={selected === user.id}
                onChange={() => {
                  setSelected(user.id);
                  setError(false);
                }}
              />
              <span className="account__avatar account__avatar--teacher" aria-hidden="true">
                {user.name.slice(0, 1)}
              </span>
              <span className="account__body">
                <span className="account__name">{user.name}</span>
                <span className="account__meta">{user.subject}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p className="field-error" role="alert">
            Выберите, под кем войти: ученик или организатор.
          </p>
        )}

        <button className="btn btn--primary auth__submit" type="submit">
          Войти
        </button>
      </form>
    </main>
  );
}
