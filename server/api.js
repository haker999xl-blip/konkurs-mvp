/**
 * HTTP-API платформы достижений лицея.
 * Один обработчик на всё: он разбирает путь и метод и отвечает JSON.
 * Правила доступа: гость видит афишу и рейтинг; ученик работает со своими
 * достижениями; организатор верифицирует и правит всё.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './db.js';
import { hashPassword, verifyPassword } from './password.js';
import { loginKey, seedDatabase } from './seed.js';

const SESSION_COOKIE = 'hackathon_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Границы данных: не даём сохранить мусор даже в обход интерфейса. */
const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  passwordMin: 6,
  passwordMax: 128,
  gradeMax: 8,
  titleMin: 3,
  titleMax: 120,
  pointsMin: 0,
  pointsMax: 500,
  subjectMax: 120,
  commentMax: 600,
};

export const ACHIEVEMENT_CATEGORIES = ['academic', 'olympiad', 'project', 'volunteer'];
const STATUSES = ['pending', 'approved', 'rejected'];
const SOURCES = ['student', 'admin', 'contest'];
const TRACKS = ['science', 'math', 'sport', 'language', 'tech'];

/** Ошибка с HTTP-кодом: роутер превращает её в JSON-ответ. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Обёртка любого обработчика: ошибки уходят в JSON, res всегда закрывается. */
function handler(fn) {
  return async (req, res, url) => {
    try {
      const result = await fn(req, res, url);
      if (res.writableEnded) return;
      sendJson(res, 200, result ?? { ok: true });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('[api]', error);
      sendJson(res, status, { error: error instanceof HttpError ? error.message : 'Внутренняя ошибка сервера' });
    }
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

/** Тело запроса читаем руками: express не нужен, лимит защищает от мусора. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'Слишком большой запрос');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Некорректный JSON в теле запроса');
  }
  // null, массив или строка в теле — не объект: дальше читаем поля, он должен быть объектом.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Тело запроса должно быть JSON-объектом');
  }
  return parsed;
}

function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const raw = part.slice(index + 1).trim();
    // Битый процент в cookie не должен ронять запрос: читаем как есть.
    try {
      out[part.slice(0, index).trim()] = decodeURIComponent(raw);
    } catch {
      out[part.slice(0, index).trim()] = raw;
    }
  }
  return out;
}

function sessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/** Текущая сессия по cookie или null. Протухшие сессии не отдаём. */
function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare('SELECT u.*, s.created_at AS session_created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token);
  if (!row) return null;
  const age = Date.now() - new Date(row.session_created_at).getTime();
  if (!Number.isFinite(age) || age > SESSION_TTL_MS) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return toUser(row);
}

/** Требует любую роль из списка, иначе 401/403. */
function requireUser(req, roles = ['student', 'teacher']) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Нужно войти в аккаунт');
  if (!roles.includes(user.role)) throw new HttpError(403, 'Недостаточно прав');
  return user;
}

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    role: row.role,
    subject: row.subject,
  };
}

function toAchievement(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    category: row.category,
    title: row.title,
    awardedOn: row.awarded_on,
    points: row.points,
    status: row.status,
    source: row.source,
    comment: row.comment,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

function toCompetition(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    track: row.track,
    startsAt: row.starts_at,
    deadline: row.deadline,
    maxScore: row.max_score,
    image: row.image ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toParticipation(row) {
  return {
    id: row.id,
    competitionId: row.competition_id,
    studentId: row.student_id,
    status: row.status,
    score: row.score,
    registeredAt: row.registered_at,
    reviewedAt: row.reviewed_at,
    comment: row.comment,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function text(value, field, { min = 0, max = 200 } = {}) {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (normalized.length < min) throw new HttpError(400, `${field}: нужно минимум ${min} символа`);
  if (normalized.length > max) throw new HttpError(400, `${field}: не длиннее ${max} символов`);
  return normalized;
}

/**
 * Класс — короткий маркер вида «8А».
 * Учитель входит по имени и паролю, поэтому его «класс» в ключе всегда пустой:
 * что бы ни прислал клиент, для роли teacher значение обнуляется.
 */
function gradeValue(value, role) {
  if (role === 'teacher') return '';
  const normalized = typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : '';
  if (!normalized) throw new HttpError(400, 'Класс: укажите класс, например 8А');
  if (normalized.length > LIMITS.gradeMax) throw new HttpError(400, 'Класс: слишком длинное значение');
  if (!/^[0-9]{1,2}[А-ЯЁ]$/.test(normalized)) throw new HttpError(400, 'Класс: формат «8А» или «10Б»');
  return normalized;
}

function passwordValue(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Пароль: обязательное поле');
  if (value.length < LIMITS.passwordMin) throw new HttpError(400, `Пароль: минимум ${LIMITS.passwordMin} символов`);
  if (value.length > LIMITS.passwordMax) throw new HttpError(400, 'Пароль: слишком длинный');
  if (!/\D/.test(value) || !/\d/.test(value)) throw new HttpError(400, 'Пароль: нужны и буквы, и цифры');
  return value;
}

/**
 * Дата в формате YYYY-MM-DD.
 * `noFuture` — для достижений (событие уже произошло); конкурсы живут будущим,
 * поэтому для них ограничение по верхней границе выключается.
 */
function dateValue(value, field, { noFuture = false } = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${field}: нужна дата в формате ГГГГ-ММ-ДД`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${field}: несуществующая дата`);
  // «2026-02-31» парсится в март — сверяем обратно, что день не переехал.
  if (parsed.toISOString().slice(0, 10) !== value) throw new HttpError(400, `${field}: несуществующая дата`);
  if (noFuture) {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (parsed > tomorrow) throw new HttpError(400, `${field}: дата не может быть в будущем`);
  }
  return value;
}

function pointsValue(value) {
  const points = Number(value);
  if (!Number.isInteger(points)) throw new HttpError(400, 'Баллы: нужно целое число');
  if (points < LIMITS.pointsMin) throw new HttpError(400, 'Баллы: отрицательные значения запрещены');
  if (points > LIMITS.pointsMax) throw new HttpError(400, `Баллы: не больше ${LIMITS.pointsMax}`);
  return points;
}

/* ─────────────── Сессия и аккаунты ─────────────── */

const register = handler(async (req, res) => {
  const body = await readBody(req);
  const role = body.role === 'teacher' ? 'teacher' : 'student';
  const name = text(body.name, 'Имя', { min: LIMITS.nameMin, max: LIMITS.nameMax });
  const grade = gradeValue(body.grade, role);
  const subject = role === 'teacher' ? text(body.subject ?? '', 'Предмет', { max: LIMITS.subjectMax }) : '';
  const password = passwordValue(body.password);
  const db = getDb();

  const key = loginKey(name, grade);
  if (db.prepare('SELECT 1 FROM users WHERE login_key = ?').get(key)) {
    throw new HttpError(409, 'Такое имя и класс уже зарегистрированы — войдите или добавьте уточнение к фамилии');
  }

  const id = `u-${randomUUID()}`;
  db.prepare(
    'INSERT INTO users (id, name, login_key, grade, role, subject, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, key, grade, role, subject, hashPassword(password), nowIso());

  const user = toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  startSession(res, user.id);
  return { user };
});

const login = handler(async (req, res) => {
  const body = await readBody(req);
  const name = text(body.name, 'Имя', { min: 1, max: LIMITS.nameMax });
  const gradeRaw = typeof body.grade === 'string' ? body.grade.trim().toUpperCase().replace(/\s+/g, '') : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const db = getDb();

  // Учитель входит по имени: сначала ищем его без класса, потом — ученика по паре имя+класс.
  let row = db.prepare("SELECT * FROM users WHERE login_key = ?").get(loginKey(name, ''));
  if (!row && gradeRaw) {
    row = db.prepare('SELECT * FROM users WHERE login_key = ?').get(loginKey(name, gradeRaw));
  }
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new HttpError(401, 'Неверное имя, класс или пароль');
  }
  const user = toUser(row);
  startSession(res, user.id);
  return { user };
});

/**
 * Быстрый вход для демо: по одному id аккаунта, без пароля.
 * Нужен, чтобы на защите переключаться между ролями в один клик.
 * Доступен, только когда сервер запущен в демо-режиме (HACKATHON_DEMO_LOGIN !== '0').
 */
const demoLogin = handler(async (req, res) => {
  if (process.env.HACKATHON_DEMO_LOGIN === '0') {
    throw new HttpError(403, 'Быстрый вход отключён на этом сервере');
  }
  const body = await readBody(req);
  const userId = String(body.userId ?? '');
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) throw new HttpError(404, 'Аккаунт не найден');
  startSession(res, row.id);
  return { user: toUser(row) };
});

/** Список аккаунтов для быстрого демо-входа — без паролей и без сессии. */
const demoAccounts = handler(async () => {
  if (process.env.HACKATHON_DEMO_LOGIN === '0') return { accounts: [] };
  const rows = getDb()
    .prepare('SELECT id, name, grade, role, subject FROM users ORDER BY role DESC, grade, name')
    .all();
  return { accounts: rows.map(toUser) };
});

/** Создаёт сессию и ставит httpOnly cookie — JS из браузера токен не читает. */
function startSession(res, userId) {
  const token = randomBytes(24).toString('hex');
  getDb()
    .prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, nowIso());
  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)));
}

const logout = handler(async (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return { ok: true };
});

const me = handler(async (req) => ({ user: currentUser(req) }));

/* ─────────────── Пользователи ─────────────── */

const listUsers = handler(async (req) => {
  requireUser(req);
  const rows = getDb().prepare('SELECT * FROM users ORDER BY role DESC, grade, name').all();
  return { users: rows.map(toUser) };
});

/* ─────────────── Достижения ─────────────── */

const listAchievements = handler(async (req, _res, url) => {
  const user = requireUser(req);
  const db = getDb();
  const studentId = url.searchParams.get('studentId');
  const status = url.searchParams.get('status');

  let rows;
  if (user.role === 'teacher') {
    rows = studentId
      ? db.prepare('SELECT * FROM achievements WHERE student_id = ? ORDER BY awarded_on DESC').all(studentId)
      : db.prepare('SELECT * FROM achievements ORDER BY awarded_on DESC').all();
  } else {
    const target = studentId && studentId !== user.id ? studentId : user.id;
    if (target !== user.id) throw new HttpError(403, 'Чужие достижения недоступны');
    rows = db.prepare('SELECT * FROM achievements WHERE student_id = ? ORDER BY awarded_on DESC').all(target);
  }

  let achievements = rows.map(toAchievement);
  if (status) achievements = achievements.filter((a) => a.status === status);
  return { achievements };
});

/** Организатор вправе выдать ученику достижение, сразу подтвердив его. */
function achievementStatusValue(value, isTeacher) {
  if (!isTeacher) return 'pending';
  if (value === 'approved') return 'approved';
  return 'pending';
}

/** Ученик заявляет достижение: оно уходит на верификацию со статусом pending. */
const createAchievement = handler(async (req) => {
  const user = requireUser(req);
  const body = await readBody(req);
  const category = String(body.category ?? '');
  if (!ACHIEVEMENT_CATEGORIES.includes(category)) {
    throw new HttpError(400, 'Категория: выберите из списка');
  }
  const title = text(body.title, 'Название', { min: LIMITS.titleMin, max: LIMITS.titleMax });
  const awardedOn = dateValue(body.awardedOn, 'Дата', { noFuture: true });
  const points = pointsValue(body.points);
  const comment =
    typeof body.comment === 'string' ? text(body.comment, 'Комментарий', { max: LIMITS.commentMax }) : '';
  const db = getDb();

  const isTeacher = user.role === 'teacher';
  const studentId = isTeacher ? String(body.studentId ?? '') : user.id;
  const student = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId);
  if (!student || student.role !== 'student') {
    throw new HttpError(400, 'Ученик не найден');
  }

  const status = achievementStatusValue(body.status, isTeacher);
  const source = isTeacher ? 'admin' : 'student';
  const now = nowIso();

  const id = `a-${randomUUID()}`;
  db.prepare(
    'INSERT INTO achievements (id, student_id, category, title, awarded_on, points, status, source, comment, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, studentId, category, title, awardedOn, points, status, source, comment, now, status === 'approved' ? now : null);

  return { achievement: toAchievement(db.prepare('SELECT * FROM achievements WHERE id = ?').get(id)) };
});

/** Организатор подтверждает или отклоняет достижение. Подтверждение начисляет баллы. */
const reviewAchievement = handler(async (req, _res, url) => {
  requireUser(req, ['teacher']);
  const body = await readBody(req);
  const id = url.pathname.split('/')[3];
  const status = String(body.status ?? '');
  if (!['approved', 'rejected'].includes(status)) {
    throw new HttpError(400, 'Статус: только approved или rejected');
  }
  const db = getDb();
  const row = db.prepare('SELECT * FROM achievements WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Достижение не найдено');

  const comment =
    typeof body.comment === 'string' ? text(body.comment, 'Комментарий', { max: LIMITS.commentMax }) : row.comment;
  // Организатор вправе уточнить баллы при проверке: заявленные учеником — только ориентир.
  const points = body.points === undefined ? row.points : pointsValue(body.points);
  db.prepare('UPDATE achievements SET status = ?, comment = ?, points = ?, reviewed_at = ? WHERE id = ?').run(
    status,
    comment,
    points,
    nowIso(),
    id,
  );
  return { achievement: toAchievement(db.prepare('SELECT * FROM achievements WHERE id = ?').get(id)) };
});

/** Удалить достижение может только его автор-ученик (пока pending) или организатор. */
const deleteAchievement = handler(async (req, _res, url) => {
  const user = requireUser(req);
  const id = url.pathname.split('/')[3];
  const db = getDb();
  const row = db.prepare('SELECT * FROM achievements WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Достижение не найдено');
  if (user.role !== 'teacher' && (row.student_id !== user.id || row.status !== 'pending')) {
    throw new HttpError(403, 'Можно удалить только своё достижение на проверке');
  }
  db.prepare('DELETE FROM achievements WHERE id = ?').run(id);
  return { ok: true };
});

/* ─────────────── Конкурсы и участия ─────────────── */

const listCompetitions = handler(async () => {
  const rows = getDb().prepare('SELECT * FROM competitions ORDER BY starts_at DESC').all();
  return { competitions: rows.map(toCompetition) };
});

/** Организатор создаёт конкурс: он попадает на афишу. */
const createCompetition = handler(async (req) => {
  const user = requireUser(req, ['teacher']);
  const body = await readBody(req);
  const title = text(body.title, 'Название', { min: 3, max: 120 });
  const summary = text(body.summary, 'Описание', { min: 10, max: 300 });
  const description = text(body.description ?? summary, 'Полное описание', { min: 1, max: 2000 });
  const track = TRACKS.includes(body.track) ? body.track : 'science';
  const startsAt = dateValue(body.startsAt, 'Начало приёма');
  const deadline = dateValue(body.deadline, 'Дедлайн');
  if (deadline < startsAt) throw new HttpError(400, 'Дедлайн не может быть раньше старта');
  const maxScore = pointsValue(body.maxScore);
  if (maxScore < 1) throw new HttpError(400, 'Максимум баллов — от 1');
  const db = getDb();
  const id = `c-${randomUUID()}`;
  db.prepare(
    'INSERT INTO competitions (id, title, summary, description, track, starts_at, deadline, max_score, image, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, title, summary, description, track, startsAt, deadline, maxScore, null, user.id, nowIso());
  return { competition: toCompetition(db.prepare('SELECT * FROM competitions WHERE id = ?').get(id)) };
});

/** Организатор правит конкурс. Заявки и достижения за ним сохраняются. */
const updateCompetition = handler(async (req, _res, url) => {
  requireUser(req, ['teacher']);
  const body = await readBody(req);
  const id = url.pathname.split('/')[3];
  const db = getDb();
  const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Конкурс не найден');

  const title = body.title === undefined ? row.title : text(body.title, 'Название', { min: 3, max: 120 });
  const summary = body.summary === undefined ? row.summary : text(body.summary, 'Описание', { min: 10, max: 300 });
  const description =
    body.description === undefined ? row.description : text(body.description, 'Полное описание', { min: 1, max: 2000 });
  const track = body.track === undefined ? row.track : TRACKS.includes(body.track) ? body.track : row.track;
  const startsAt = body.startsAt === undefined ? row.starts_at : dateValue(body.startsAt, 'Начало приёма');
  const deadline = body.deadline === undefined ? row.deadline : dateValue(body.deadline, 'Дедлайн');
  if (deadline < startsAt) throw new HttpError(400, 'Дедлайн не может быть раньше старта');
  const maxScore = body.maxScore === undefined ? row.max_score : pointsValue(body.maxScore);
  if (maxScore < 1) throw new HttpError(400, 'Максимум баллов — от 1');

  db.prepare(
    'UPDATE competitions SET title = ?, summary = ?, description = ?, track = ?, starts_at = ?, deadline = ?, max_score = ? WHERE id = ?',
  ).run(title, summary, description, track, startsAt, deadline, maxScore, id);
  return { competition: toCompetition(db.prepare('SELECT * FROM competitions WHERE id = ?').get(id)) };
});

const listParticipations = handler(async (req, _res, url) => {
  const user = requireUser(req);
  const db = getDb();
  const competitionId = url.searchParams.get('competitionId');
  let rows;
  if (user.role === 'teacher') {
    rows = competitionId
      ? db.prepare('SELECT * FROM participations WHERE competition_id = ?').all(competitionId)
      : db.prepare('SELECT * FROM participations').all();
  } else {
    rows = db.prepare('SELECT * FROM participations WHERE student_id = ?').all(user.id);
  }
  return { participations: rows.map(toParticipation) };
});

/** Ученик записывается на конкурс. Повторная запись отклоняется базой (UNIQUE). */
const createParticipation = handler(async (req) => {
  const user = requireUser(req, ['student']);
  const body = await readBody(req);
  const competitionId = String(body.competitionId ?? '');
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM competitions WHERE id = ?').get(competitionId)) {
    throw new HttpError(404, 'Конкурс не найден');
  }
  if (db.prepare('SELECT 1 FROM participations WHERE competition_id = ? AND student_id = ?').get(competitionId, user.id)) {
    throw new HttpError(409, 'Вы уже записаны на этот конкурс');
  }
  const id = `p-${randomUUID()}`;
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    'INSERT INTO participations (id, competition_id, student_id, status, score, registered_at, reviewed_at, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, competitionId, user.id, 'pending', 0, today, null, '');
  return { participation: toParticipation(db.prepare('SELECT * FROM participations WHERE id = ?').get(id)) };
});

/**
 * Организатор подтверждает участие. Подтверждение атомарно создаёт достижение
 * категории «олимпиада» — это связка «конкурс → достижение → баллы в рейтинге».
 * Отклонение снимает созданное ранее достижение: баллы не должны оставаться.
 */
const reviewParticipation = handler(async (req, _res, url) => {
  requireUser(req, ['teacher']);
  const body = await readBody(req);
  const id = url.pathname.split('/')[3];
  const status = String(body.status ?? '');
  if (!['approved', 'rejected'].includes(status)) {
    throw new HttpError(400, 'Статус: только approved или rejected');
  }
  const db = getDb();
  const row = db.prepare('SELECT * FROM participations WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Заявка не найдена');
  const competition = db.prepare('SELECT * FROM competitions WHERE id = ?').get(row.competition_id);

  const score = status === 'approved' ? pointsValue(body.score) : 0;
  if (status === 'approved' && competition && score > competition.max_score) {
    throw new HttpError(400, `Баллы: максимум для конкурса — ${competition.max_score}`);
  }
  const comment =
    typeof body.comment === 'string' ? text(body.comment, 'Комментарий', { max: LIMITS.commentMax }) : row.comment;
  const reviewedAt = nowIso();

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE participations SET status = ?, score = ?, comment = ?, reviewed_at = ? WHERE id = ?').run(
      status,
      score,
      comment,
      reviewedAt,
      id,
    );

    if (competition) {
      // Идемпотентность: одно участие даёт ровно одно достижение (ищем по заявке).
      const existing = db
        .prepare('SELECT id FROM achievements WHERE student_id = ? AND source = ? AND title = ?')
        .get(row.student_id, 'contest', competition.title);

      if (status === 'approved') {
        if (existing) {
          db.prepare('UPDATE achievements SET points = ?, status = ?, comment = ?, reviewed_at = ? WHERE id = ?').run(
            score,
            'approved',
            comment,
            reviewedAt,
            existing.id,
          );
        } else {
          db.prepare(
            'INSERT INTO achievements (id, student_id, category, title, awarded_on, points, status, source, comment, created_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).run(
            `a-${randomUUID()}`,
            row.student_id,
            'olympiad',
            competition.title,
            row.registered_at,
            score,
            'approved',
            'contest',
            comment,
            reviewedAt,
            reviewedAt,
          );
        }
      } else if (existing) {
        db.prepare('DELETE FROM achievements WHERE id = ?').run(existing.id);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { participation: toParticipation(db.prepare('SELECT * FROM participations WHERE id = ?').get(id)) };
});

/* ─────────────── Демо-сброс ─────────────── */

const resetDemo = handler(async (req) => {
  requireUser(req, ['teacher']);
  const db = getDb();
  db.prepare("DELETE FROM meta WHERE key = 'seed_version'").run();
  seedDatabase(db);
  return { ok: true };
});

/* ─────────────── Роутер ─────────────── */

/** Таблица маршрутов: метод + регулярное выражение → обработчик. */
const ROUTES = [
  ['POST', /^\/api\/auth\/register$/, register],
  ['POST', /^\/api\/auth\/login$/, login],
  ['POST', /^\/api\/auth\/demo-login$/, demoLogin],
  ['GET', /^\/api\/auth\/demo-accounts$/, demoAccounts],
  ['POST', /^\/api\/auth\/logout$/, logout],
  ['GET', /^\/api\/auth\/me$/, me],
  ['GET', /^\/api\/users$/, listUsers],
  ['GET', /^\/api\/achievements$/, listAchievements],
  ['POST', /^\/api\/achievements$/, createAchievement],
  ['PATCH', /^\/api\/achievements\/[^/]+$/, reviewAchievement],
  ['DELETE', /^\/api\/achievements\/[^/]+$/, deleteAchievement],
  ['GET', /^\/api\/competitions$/, listCompetitions],
  ['POST', /^\/api\/competitions$/, createCompetition],
  ['PATCH', /^\/api\/competitions\/[^/]+$/, updateCompetition],
  ['GET', /^\/api\/participations$/, listParticipations],
  ['POST', /^\/api\/participations$/, createParticipation],
  ['PATCH', /^\/api\/participations\/[^/]+$/, reviewParticipation],
  ['POST', /^\/api\/demo\/reset$/, resetDemo],
];

/** Публичный вход: вызывается из Vite-плагина (dev) и из server/index.js (prod). */
export async function handleApi(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = ROUTES.find(([method, pattern]) => method === req.method && pattern.test(url.pathname));
  if (!route) {
    sendJson(res, 404, { error: 'Такого метода API нет' });
    return;
  }
  await route[2](req, res, url);
}

export { STATUSES, SOURCES, TRACKS };