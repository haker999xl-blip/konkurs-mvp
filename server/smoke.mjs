// Разовый смоук-тест API без Vite: поднимает http-сервер и проходит сценарии.
import http from 'node:http';
import { handleApi } from './api.js';

const server = http.createServer((req, res) => handleApi(req, res));
await new Promise((resolve) => server.listen(5311, '127.0.0.1', resolve));

const base = 'http://127.0.0.1:5311';
let cookie = '';

async function call(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (auth && cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const results = [];
function check(name, condition, extra = '') {
  results.push(`${condition ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
}

let r = await call('/api/auth/login', { method: 'POST', body: { name: 'Мария Соколова', grade: '8А', password: 'demo1234' }, auth: false });
check('логин ученика', r.status === 200 && r.data.user.id === 'u-student-masha', `status=${r.status}`);

r = await call('/api/achievements');
check('мои достижения', r.status === 200 && r.data.achievements.length === 4, `n=${r.data.achievements?.length} status=${r.status}`);

r = await call('/api/achievements?studentId=u-student-dima');
check('чужие достижения запрещены', r.status === 403, `status=${r.status}`);

r = await call('/api/achievements', { method: 'POST', body: { category: 'olympiad', title: 'Тестовое достижение', awardedOn: '2026-10-01', points: 30 } });
check('создание достижения', r.status === 200 && r.data.achievement.status === 'pending', `status=${r.status}`);

r = await call('/api/achievements', { method: 'POST', body: { category: 'olympiad', title: 'Минус', awardedOn: '2026-10-01', points: -5 } });
check('отрицательные баллы', r.status === 400, `status=${r.status}`);

r = await call('/api/achievements', { method: 'POST', body: { category: 'olympiad', title: 'Будущее', awardedOn: '2030-01-01', points: 5 } });
check('дата в будущем', r.status === 400, `status=${r.status}`);

r = await call('/api/achievements', { method: 'POST', body: { category: 'nope', title: 'Плохая категория', awardedOn: '2026-10-01', points: 5 } });
check('неизвестная категория', r.status === 400, `status=${r.status}`);

r = await call('/api/achievements', { method: 'POST', body: { category: 'project', title: '  ', awardedOn: '2026-10-01', points: 5 } });
check('пустое название', r.status === 400, `status=${r.status}`);

r = await call('/api/auth/demo-login', { method: 'POST', body: { userId: 'u-teacher-anna' }, auth: false });
check('демо-вход учителя', r.status === 200 && r.data.user.role === 'teacher', `status=${r.status}`);

r = await call('/api/auth/demo-accounts', { auth: false });
check('список демо-аккаунтов', r.status === 200 && r.data.accounts.length === 7, `n=${r.data.accounts?.length}`);

r = await call('/api/achievements?status=pending');
check('очередь на верификацию', r.status === 200 && r.data.achievements.length >= 2, `n=${r.data.achievements?.length}`);

const pending = r.data.achievements[0];
r = await call(`/api/achievements/${pending.id}`, { method: 'PATCH', body: { status: 'approved', comment: 'Принято', points: 33 } });
check(
  'верификация достижения + корректировка баллов',
  r.status === 200 && r.data.achievement.status === 'approved' && r.data.achievement.points === 33,
  `status=${r.status} points=${r.data.achievement?.points}`,
);

r = await call('/api/achievements', { method: 'POST', body: { studentId: 'u-student-vera', category: 'academic', title: 'Добавлено организатором', awardedOn: '2026-09-15', points: 12, status: 'approved' } });
check('админ добавляет ученику', r.status === 200 && r.data.achievement.status === 'approved' && r.data.achievement.studentId === 'u-student-vera', `status=${r.status}`);

r = await call('/api/users');
check('список пользователей', r.status === 200 && r.data.users.length === 7, `n=${r.data.users?.length}`);

r = await call('/api/participations');
check('заявки на конкурсы (учитель)', r.status === 200 && r.data.participations.length >= 6, `n=${r.data.participations?.length}`);

r = await call('/api/auth/register', { method: 'POST', body: { name: 'Мария Соколова', grade: '8А', password: 'test1234' }, auth: false });
check('дубль имя+класс', r.status === 409, `status=${r.status}`);

r = await call('/api/auth/register', { method: 'POST', body: { name: 'Новый Ученик', grade: '9В', password: 'test1234' }, auth: false });
check('регистрация', r.status === 200 && r.data.user.grade === '9В', `status=${r.status}`);

r = await call('/api/auth/register', { method: 'POST', body: { name: 'Без цифр', grade: '9Г', password: 'abcdef' }, auth: false });
check('пароль без цифр', r.status === 400, `status=${r.status}`);

r = await call('/api/auth/register', { method: 'POST', body: { name: 'Класс Кривой', grade: 'abc', password: 'test1234' }, auth: false });
check('некорректный класс', r.status === 400, `status=${r.status}`);

r = await call('/api/participations', { method: 'POST', body: { competitionId: 'c-physics' } });
check('запись на конкурс', r.status === 200 && r.data.participation.status === 'pending', `status=${r.status}`);

r = await call('/api/auth/logout', { method: 'POST' });
check('выход', r.status === 200, `status=${r.status}`);

r = await call('/api/achievements');
check('без сессии — 401', r.status === 401, `status=${r.status}`);

console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\nПровалено: ${failed}`);
server.close();
process.exit(failed ? 1 : 0);