/**
 * Стартовые данные: демо-аккаунты, достижения и афиша олимпиад.
 * Сид идемпотентен — перезаписывается только при смене SEED_VERSION.
 */
import { hashPassword } from './password.js';

export const SEED_VERSION = 1;

/** Один пароль на все демо-аккаунты: удобно на защите, честно написано в README. */
export const DEMO_PASSWORD = 'demo1234';

/** Дата со сдвигом в UTC: не зависит от таймзоны машины и не уезжает на день вперёд. */
function isoShift(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

/** Классы лицея, между которыми сравниваем в рейтинге. */
const SEED_USERS = [
  { id: 'u-teacher-anna', name: 'Анна Николаевна', grade: '', role: 'teacher', subject: 'Физика, классный руководитель 8А' },
  { id: 'u-student-masha', name: 'Мария Соколова', grade: '8А', role: 'student', subject: '' },
  { id: 'u-student-dima', name: 'Дмитрий Ковалёв', grade: '8Б', role: 'student', subject: '' },
  { id: 'u-student-alina', name: 'Алина Ветрова', grade: '7А', role: 'student', subject: '' },
  { id: 'u-student-igor', name: 'Игорь Лебедев', grade: '8А', role: 'student', subject: '' },
  { id: 'u-student-vera', name: 'Вера Тимофеева', grade: '7Б', role: 'student', subject: '' },
  { id: 'u-student-kyrill', name: 'Кирилл Орлов', grade: '8Б', role: 'student', subject: '' },
];

/**
 * Достижения: 12 записей, покрывающих все категории и все статусы.
 * Мария — главный демо-аккаунт: 88 + 74 + 81 = 243 подтверждённых балла,
 * плюс одно «ожидает проверки» — на нём и показываем верификацию.
 */
const SEED_ACHIEVEMENTS = [
  { id: 'a-1', studentId: 'u-student-masha', category: 'academic', title: 'Призёр муниципального этапа по физике', awardedOn: isoShift(-19), points: 88, status: 'approved', source: 'admin', comment: 'Результат подтверждён протоколом жюри.' },
  { id: 'a-2', studentId: 'u-student-masha', category: 'olympiad', title: 'Олимпиада «Физтех» — диплом 2 степени', awardedOn: isoShift(-10), points: 74, status: 'approved', source: 'student', comment: 'Диплом загружен, сверен с реестром.' },
  { id: 'a-3', studentId: 'u-student-masha', category: 'project', title: 'Проект «Маятник с датчиком угла»', awardedOn: isoShift(-4), points: 81, status: 'approved', source: 'student', comment: 'Хорошая экспериментальная часть.' },
  { id: 'a-4', studentId: 'u-student-masha', category: 'olympiad', title: 'Олимпиада по информатике, школьный этап', awardedOn: isoShift(-1), points: 60, status: 'pending', source: 'student', comment: '' },
  { id: 'a-5', studentId: 'u-student-dima', category: 'olympiad', title: 'Победитель городской олимпиады по математике', awardedOn: isoShift(-18), points: 95, status: 'approved', source: 'admin', comment: 'Первое место в личном зачёте.' },
  { id: 'a-6', studentId: 'u-student-dima', category: 'academic', title: 'Отличник промежуточной аттестации', awardedOn: isoShift(-6), points: 45, status: 'approved', source: 'admin', comment: 'Средний балл 5,0 по профильным предметам.' },
  { id: 'a-7', studentId: 'u-student-alina', category: 'project', title: 'Инженерный проект «Умная теплица»', awardedOn: isoShift(-9), points: 92, status: 'approved', source: 'student', comment: 'Отличная защита прототипа.' },
  { id: 'a-8', studentId: 'u-student-alina', category: 'academic', title: 'Конкурс исследовательских работ по физике', awardedOn: isoShift(-17), points: 79, status: 'approved', source: 'student', comment: 'Гипотеза сформулирована хорошо.' },
  { id: 'a-9', studentId: 'u-student-igor', category: 'olympiad', title: 'Олимпиада по физике «Ломоносов» — призёр', awardedOn: isoShift(-3), points: 86, status: 'approved', source: 'student', comment: 'Подтверждено дипломом.' },
  { id: 'a-10', studentId: 'u-student-vera', category: 'volunteer', title: 'Волонтёр научного фестиваля лицея', awardedOn: isoShift(-2), points: 30, status: 'pending', source: 'student', comment: '' },
  { id: 'a-11', studentId: 'u-student-kyrill', category: 'project', title: 'Бот для расписания лицея', awardedOn: isoShift(-5), points: 55, status: 'rejected', source: 'student', comment: 'Нужен работающий репозиторий и описание стека — пришлите повторно.' },
  { id: 'a-12', studentId: 'u-student-igor', category: 'volunteer', title: 'Помощь в проведении турнира по робототехнике', awardedOn: isoShift(0), points: 20, status: 'pending', source: 'student', comment: '' },
];

/**
 * Афиша: олимпиады и конкурсы по физике, математике и информатике.
 * Обложки — из патча motion, сюжеты переписаны под лицей.
 */
const SEED_COMPETITIONS = [
  {
    id: 'c-physics',
    title: 'Олимпиада по физике «Первая гипотеза»',
    summary: 'Экспериментальный тур: гипотеза, измерения, вывод. Проверяем ход мысли, а не идеальный результат.',
    description: 'Два тура: теоретический и экспериментальный. В экспериментальном вы получаете установку и 40 минут на исследование — оценивается корректность измерений, оценка погрешности и умение объяснить результат простыми словами.',
    track: 'science',
    startsAt: isoShift(-20),
    deadline: isoShift(-7),
    maxScore: 100,
    image: '/poster-lections.svg',
  },
  {
    id: 'c-math',
    title: 'Математический турнир «Своими словами»',
    summary: 'Задачи, где важен не ответ, а доказательство. Командный и личный зачёт для 7–8 классов.',
    description: 'Пять задач на доказательство и конструкцию: комбинаторика, геометрия, оценка. Решение засчитывается, только если вы объяснили каждый шаг. Разрешены черновики, запрещены калькуляторы.',
    track: 'math',
    startsAt: isoShift(-12),
    deadline: isoShift(2),
    maxScore: 80,
    image: '/poster-poetry.svg',
  },
  {
    id: 'c-informatics',
    title: 'Турнир по информатике «Быстрый ход»',
    summary: 'Алгоритмы на скорость: 5 задач за 3 часа, автоматическая проверка и школьный рейтинг.',
    description: 'Задачи на сортировки, префиксные суммы и жадные алгоритмы. Пять задач, три часа, автоматическая система проверки на наборе тестов. Языки — Python, C++, JavaScript. Решение без прохождения тестов не засчитывается.',
    track: 'tech',
    startsAt: isoShift(4),
    deadline: isoShift(12),
    maxScore: 120,
    image: '/poster-rally.svg',
  },
  {
    id: 'c-physics-lab',
    title: 'Физический практикум: лабораторный тур',
    summary: 'Командная работа с оборудованием: собрать схему, снять данные, защитить выводы перед жюри.',
    description: 'Команды по три человека. На столе — набор датчиков и схема. Нужно собрать установку, снять не менее десяти точек, построить график и защитить вывод. Оценивается аккуратность и честность обработки данных.',
    track: 'science',
    startsAt: isoShift(-3),
    deadline: isoShift(5),
    maxScore: 90,
    image: '/poster-english.svg',
  },
];

/**
 * Заявки на конкурсы: подтверждённое участие становится достижением категории «олимпиада».
 * У Марии уже есть три подтверждённых достижения из seed, поэтому здесь только новые заявки.
 */
const SEED_PARTICIPATIONS = [
  { id: 'p-1', competitionId: 'c-informatics', studentId: 'u-student-masha', status: 'pending', score: 0, registeredAt: isoShift(-1), comment: '' },
  { id: 'p-2', competitionId: 'c-informatics', studentId: 'u-student-dima', status: 'pending', score: 0, registeredAt: isoShift(-1), comment: '' },
  { id: 'p-3', competitionId: 'c-math', studentId: 'u-student-vera', status: 'pending', score: 0, registeredAt: isoShift(-2), comment: '' },
  { id: 'p-4', competitionId: 'c-physics-lab', studentId: 'u-student-masha', status: 'approved', score: 81, registeredAt: isoShift(-4), comment: 'Аккуратные измерения, хорошая защита.' },
  { id: 'p-5', competitionId: 'c-informatics', studentId: 'u-student-igor', status: 'pending', score: 0, registeredAt: isoShift(0), comment: '' },
  { id: 'p-6', competitionId: 'c-math', studentId: 'u-student-kyrill', status: 'rejected', score: 0, registeredAt: isoShift(-5), comment: 'Не приложено доказательство — задача не засчитана.' },
];

/** Заполняет пустую базу. Вызывается из migrate-кода после создания таблиц. */
export function seedDatabase(db) {
  const current = db.prepare('SELECT value FROM meta WHERE key = ?').get('seed_version');
  if (current && Number(current.value) === SEED_VERSION) return false;

  const now = isoNow();
  const passwordHash = hashPassword(DEMO_PASSWORD);

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM sessions');
    db.exec('DELETE FROM achievements');
    db.exec('DELETE FROM participations');
    db.exec('DELETE FROM competitions');
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM meta');

    const insertUser = db.prepare(
      'INSERT INTO users (id, name, login_key, grade, role, subject, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const u of SEED_USERS) {
      insertUser.run(u.id, u.name, loginKey(u.name, u.grade), u.grade, u.role, u.subject, passwordHash, now);
    }

    const insertAchievement = db.prepare(
      'INSERT INTO achievements (id, student_id, category, title, awarded_on, points, status, source, comment, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const a of SEED_ACHIEVEMENTS) {
      const reviewedAt = a.status === 'pending' ? null : now;
      insertAchievement.run(a.id, a.studentId, a.category, a.title, a.awardedOn, a.points, a.status, a.source, a.comment, now, reviewedAt);
    }

    const insertCompetition = db.prepare(
      'INSERT INTO competitions (id, title, summary, description, track, starts_at, deadline, max_score, image, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const c of SEED_COMPETITIONS) {
      insertCompetition.run(c.id, c.title, c.summary, c.description, c.track, c.startsAt, c.deadline, c.maxScore, c.image, 'u-teacher-anna', now);
    }

    const insertParticipation = db.prepare(
      'INSERT INTO participations (id, competition_id, student_id, status, score, registered_at, reviewed_at, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const p of SEED_PARTICIPATIONS) {
      const reviewedAt = p.status === 'pending' ? null : now;
      insertParticipation.run(p.id, p.competitionId, p.studentId, p.status, p.score, p.registeredAt, reviewedAt, p.comment);
    }

    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('seed_version', String(SEED_VERSION));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return true;
}

/** Ключ входа: имя + класс в нижнем регистре. Одинаковые имена в разных классах разрешены. */
export function loginKey(name, grade) {
  return `${name.trim().toLowerCase()}|${grade.trim().toLowerCase()}`;
}