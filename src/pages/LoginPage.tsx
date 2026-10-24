import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import type { User } from '../data/types';
import { useStore } from '../state/store';

type Mode = 'quick' | 'login' | 'register';

const DEMO_PASSWORD_HINT = 'Демо-пароль всех аккаунтов: demo1234';

/**
 * Вход с двумя режимами — специально для показа:
 *  • «Быстрый вход» — выбор аккаунта из списка, один клик, без пароля;
 *  • «Вход и регистрация» — настоящая форма с паролем и проверкой.
 * Переключатель сверху карточки, режим запоминается в sessionStorage,
 * чтобы на защите не искать его заново после перезагрузки.
 */
export function LoginPage() {
  const { user, login, demoLogin, register } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>(() => {
    const saved = sessionStorage.getItem('hackathon.login-mode');
    return saved === 'login' || saved === 'register' ? saved : 'quick';
  });
  const [accounts, setAccounts] = useState<User[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [subject, setSubject] = useState('');

  /**
   * После входа ученик идёт в кабинет, организатор — в админ-панель.
   * Переход делает только этот эффект: дублировать его вручную после запроса нельзя,
   * иначе история получит два одинаковых перехода подряд.
   */
  useEffect(() => {
    if (user) navigate(user.role === 'teacher' ? '/admin' : '/cabinet', { replace: true });
  }, [user, navigate]);

  /** Список аккаунтов для быстрого режима; сам режим работает без него. */
  useEffect(() => {
    if (mode !== 'quick' || accounts.length) return;
    api
      .demoAccounts()
      .then(({ accounts: list }) => {
        setAccounts(list);
        if (list.length) setSelected((prev) => prev || list[0].id);
      })
      .catch(() => setAccountsError('Быстрый вход недоступен — войдите по паролю.'));
  }, [mode, accounts.length]);

  const switchMode = (next: Mode) => {
    sessionStorage.setItem('hackathon.login-mode', next);
    setMode(next);
    setError('');
  };

  const goAfterLogin = (next: User) => {
    // Тот же путь, что и в эффекте выше, и с replace: двойной navigate не плодит историю.
    navigate(next.role === 'teacher' ? '/admin' : '/cabinet', { replace: true });
  };

  const handleQuick = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) {
      setError('Выберите, под кем войти.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const next = await demoLogin(selected);
      goAfterLogin(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next =
        mode === 'login'
          ? await login(name, grade, password)
          : await register({ name, grade, password, role, subject });
      goAfterLogin(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  const students = accounts.filter((u) => u.role === 'student');
  const teachers = accounts.filter((u) => u.role === 'teacher');

  return (
    <main className="auth">
      <section className="auth__intro" aria-labelledby="auth-title">
        <p className="auth__eyebrow">Достижения лицея</p>
        <h1 id="auth-title" className="auth__title">
          Достижения учеников — в одном месте
        </h1>
        <p className="auth__lead">
          Ученик заявляет достижение сам, организатор проверяет — баллы сразу идут
          в рейтинг лицея и класса.
        </p>
        <ul className="auth__facts">
          <li>Категории, баллы и подтверждение</li>
          <li>Рейтинг по лицею и по классам</li>
          <li>Олимпиады по физике, математике и информатике</li>
        </ul>
      </section>

      <div className="auth__card">
        <div className="auth__switch" role="tablist" aria-label="Способ входа">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'quick'}
            className={`auth__switch-btn${mode === 'quick' ? ' auth__switch-btn--on' : ''}`}
            onClick={() => switchMode('quick')}
          >
            Быстрый вход
            <span className="auth__switch-note">для показа</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode !== 'quick'}
            className={`auth__switch-btn${mode !== 'quick' ? ' auth__switch-btn--on' : ''}`}
            onClick={() => switchMode('login')}
          >
            Вход по паролю
            <span className="auth__switch-note">как настоящий</span>
          </button>
        </div>

        {mode === 'quick' ? (
          <form onSubmit={handleQuick} noValidate>
            <p className="auth__hint">
              Выберите аккаунт — один клик и вы в нужной роли. {DEMO_PASSWORD_HINT}
            </p>

            {accountsError && (
              <p className="field-error" role="alert">
                {accountsError}
              </p>
            )}

            {students.length > 0 && (
              <fieldset className="auth__group">
                <legend>Ученик</legend>
                {students.map((account) => (
                  <label
                    key={account.id}
                    className={`account${selected === account.id ? ' account--on' : ''}`}
                  >
                    <input
                      type="radio"
                      name="account"
                      value={account.id}
                      checked={selected === account.id}
                      onChange={() => {
                        setSelected(account.id);
                        setError('');
                      }}
                    />
                    <span className="account__avatar" aria-hidden="true">
                      {account.name.slice(0, 1)}
                    </span>
                    <span className="account__body">
                      <span className="account__name">{account.name}</span>
                      <span className="account__meta">
                        {account.grade} класс
                        {account.id === 'u-student-masha' ? ' · основной демо-аккаунт' : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {teachers.length > 0 && (
              <fieldset className="auth__group">
                <legend>Организатор</legend>
                {teachers.map((account) => (
                  <label
                    key={account.id}
                    className={`account${selected === account.id ? ' account--on' : ''}`}
                  >
                    <input
                      type="radio"
                      name="account"
                      value={account.id}
                      checked={selected === account.id}
                      onChange={() => {
                        setSelected(account.id);
                        setError('');
                      }}
                    />
                    <span className="account__avatar account__avatar--teacher" aria-hidden="true">
                      {account.name.slice(0, 1)}
                    </span>
                    <span className="account__body">
                      <span className="account__name">{account.name}</span>
                      <span className="account__meta">{account.subject}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}

            <button className="btn btn--primary auth__submit" type="submit" disabled={busy}>
              {busy ? 'Входим…' : 'Войти'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} noValidate>
            <div className="auth__tabs" role="group" aria-label="Вход или регистрация">
              <button
                type="button"
                className={`auth__tab${mode === 'login' ? ' auth__tab--on' : ''}`}
                onClick={() => switchMode('login')}
              >
                Вход
              </button>
              <button
                type="button"
                className={`auth__tab${mode === 'register' ? ' auth__tab--on' : ''}`}
                onClick={() => switchMode('register')}
              >
                Регистрация
              </button>
            </div>

            {mode === 'register' && (
              <fieldset className="auth__group auth__group--roles">
                <legend>Кто вы</legend>
                <label className={`account${role === 'student' ? ' account--on' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={role === 'student'}
                    onChange={() => setRole('student')}
                  />
                  <span className="account__body">
                    <span className="account__name">Ученик</span>
                    <span className="account__meta">Добавляю свои достижения</span>
                  </span>
                </label>
                <label className={`account${role === 'teacher' ? ' account--on' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="teacher"
                    checked={role === 'teacher'}
                    onChange={() => setRole('teacher')}
                  />
                  <span className="account__body">
                    <span className="account__name">Организатор</span>
                    <span className="account__meta">Проверяю достижения учеников</span>
                  </span>
                </label>
              </fieldset>
            )}

            <div className="auth__fields">
              <label className="field">
                <span>Имя и фамилия</span>
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Мария Соколова"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="field">
                <span>
                  {role === 'teacher'
                    ? mode === 'register'
                      ? 'Кабинет или предмет'
                      : 'Класс или кабинет (необязательно)'
                    : 'Класс'}
                </span>
                <input
                  className="input"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  placeholder={role === 'teacher' ? 'Кабинет физики' : '8А'}
                  autoComplete="off"
                  required={!(role === 'teacher' && mode === 'login')}
                />
              </label>

              {mode === 'register' && role === 'teacher' && (
                <label className="field">
                  <span>Предмет</span>
                  <input
                    className="input"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Физика, классное руководство 8А"
                  />
                </label>
              )}

              <label className="field">
                <span>Пароль</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'register' ? 'Минимум 6 символов, буквы и цифры' : 'demo1234'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </label>
            </div>

            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}

            <button className="btn btn--primary auth__submit" type="submit" disabled={busy}>
              {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>

            {mode === 'login' && <p className="auth__hint">{DEMO_PASSWORD_HINT}</p>}
          </form>
        )}
      </div>
    </main>
  );
}