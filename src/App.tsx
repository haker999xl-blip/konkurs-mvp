import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSession } from './state/session';
import { Header, Footer } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { PosterPage } from './pages/PosterPage';
import { CompetitionPage } from './pages/CompetitionPage';
import { CabinetPage } from './pages/CabinetPage';
import { AdminPage } from './pages/AdminPage';
import { RatingPage } from './pages/RatingPage';

/** Редирект на вход, если сессии нет. Возврат — после логина. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Кабинет — только для ученика: учителя ведём в админ-панель. */
function StudentOnly({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  if (user?.role === 'teacher') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useSession();
  const location = useLocation();

  // При смене маршрута возвращаем фокус на начало страницы для клавиатуры.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="app">
      <Header />
      <main className="app__main">
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to={user.role === 'teacher' ? '/admin' : '/cabinet'} replace /> : <LoginPage />}
          />
          <Route
            path="/"
            element={
              <RequireAuth>
                <PosterPage />
              </RequireAuth>
            }
          />
          <Route
            path="/competition/:id"
            element={
              <RequireAuth>
                <CompetitionPage />
              </RequireAuth>
            }
          />
          <Route
            path="/cabinet"
            element={
              <RequireAuth>
                <StudentOnly>
                  <CabinetPage />
                </StudentOnly>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path="/rating"
            element={
              <RequireAuth>
                <RatingPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
