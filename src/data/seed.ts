import type { Competition, Participation, User } from './types';

/** Сценарий (Track) → метка и цветовой маркер. Используется в афише и фильтрах. */
export const TRACKS = [
  { id: 'science', label: 'Наука', short: 'Наука' },
  { id: 'art', label: 'Творчество', short: 'Творчество' },
  { id: 'sport', label: 'Спорт', short: 'Спорт' },
  { id: 'language', label: 'Языки', short: 'Языки' },
  { id: 'tech', label: 'Технологии', short: 'Технологии' },
] as const;

export const SEED_VERSION = 4;

export const SEED_USERS: User[] = [
  {
    id: 'u-teacher-anna',
    name: 'Анна Николаевна',
    grade: '',
    role: 'teacher',
    subject: 'Физика, классный руководитель 8А',
  },
  {
    id: 'u-student-masha',
    name: 'Мария Соколова',
    grade: '8А',
    role: 'student',
    subject: '',
  },
  {
    id: 'u-student-dima',
    name: 'Дмитрий Ковалёв',
    grade: '8Б',
    role: 'student',
    subject: '',
  },
  {
    id: 'u-student-alina',
    name: 'Алина Ветрова',
    grade: '7А',
    role: 'student',
    subject: '',
  },
  {
    id: 'u-student-igor',
    name: 'Игорь Лебедев',
    grade: '8А',
    role: 'student',
    subject: '',
  },
  {
    id: 'u-student-vera',
    name: 'Вера Тимофеева',
    grade: '7Б',
    role: 'student',
    subject: '',
  },
  {
    id: 'u-student-kyrill',
    name: 'Кирилл Орлов',
    grade: '8Б',
    role: 'student',
    subject: '',
  },
];

/**
 * Seed конкурсов. Даты относительные от «сегодня», чтобы демо всегда выглядело живым:
 * finished / active / upcoming присутствуют на афише в любом запуске.
 */
function isoShift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoNow(): string {
  return new Date().toISOString();
}

export function buildSeedCompetitions(): Competition[] {
  return [
    {
      id: 'c-lections',
      title: 'Научные чтения «Первая гипотеза»',
      summary:
        'Защита мини-исследования: гипотеза, метод, вывод. Ищем не идеальный результат, а честный научный путь.',
      description:
        'Вы выбираете любую гипотезу — от поведения стримера до теплопроводности ложки — и проводите мини-исследование. Формат: 3-минутная защита перед жюри и одна страница с методом. Важна логика, а не сложность оборудования.',
      track: 'science',
      startsAt: isoShift(-20),
      deadline: isoShift(-7),
      maxScore: 100,
      image: '/poster-lections.svg',
      createdBy: 'u-teacher-anna',
      createdAt: isoNow(),
    },
    {
      id: 'c-poetry',
      title: 'Фестиваль чтения «Своими словами»',
      summary:
        'Один текст — наизусть или написанный вами. Читаем живо, оцениваем смелость, а не безупречность.',
      description:
        'Номинации: авторское стихотворение, художественное чтение, короткий рассказ. Один участник — одна номинация. Объём текста — до 60 строк. Оценка: эмоциональная точность, ритм, взгляд, походка к микрофону.',
      track: 'art',
      startsAt: isoShift(-12),
      deadline: isoShift(2),
      maxScore: 80,
      image: '/poster-poetry.svg',
      createdBy: 'u-teacher-anna',
      createdAt: isoNow(),
    },
    {
      id: 'c-rally',
      title: 'Кибертурнир «Быстрый ход»',
      summary:
        'Шахматы и турнир по быстрым решениям. 5 туров, контроль времени, личный зачёт и школьный рейтинг.',
      description:
        'Турнир по быстрым шахматам (10+5) и блиц-задачи на логику. 5 туров, личный зачёт и командный по классам. Участие бесплатное, регистрация через платформу до дедлайна.',
      track: 'sport',
      startsAt: isoShift(4),
      deadline: isoShift(12),
      maxScore: 120,
      image: '/poster-rally.svg',
      createdBy: 'u-teacher-anna',
      createdAt: isoNow(),
    },
    {
      id: 'c-english',
      title: 'SpeakUp: конкурс speaking',
      summary:
        'Две минуты на английском о том, что заботит. Жюри — не на цензуру, а на понятность и голос.',
      description:
        'Тема свободная. Один монолог 1:30–2:00 на английском. Критерии: понятность, произношение, структура и уверенность. Можно принести одну картинку-опору. Без бумажек с текстом.',
      track: 'language',
      startsAt: isoShift(-3),
      deadline: isoShift(5),
      maxScore: 90,
      image: '/poster-english.svg',
      createdBy: 'u-teacher-anna',
      createdAt: isoNow(),
    },
  ];
}

/**
 * Seed участий. Покрывает все статусы: approved (с баллами), pending
 * (в письме админа — то самое «ожидает подтверждения»), и один rejected.
 */
export function buildSeedParticipations(): Participation[] {
  return [
    {
      id: 'p-1',
      competitionId: 'c-lections',
      studentId: 'u-student-masha',
      status: 'approved',
      score: 88,
      registeredAt: isoShift(-19),
      reviewedAt: isoNow(),
      comment: 'Уверенная защита гипотезы, вопросы жюри раскрыла спокойно.',
    },
    {
      id: 'p-2',
      competitionId: 'c-poetry',
      studentId: 'u-student-masha',
      status: 'approved',
      score: 74,
      registeredAt: isoShift(-10),
      reviewedAt: isoNow(),
      comment: 'Сильная подача, поправь темп в последней строфе.',
    },
    {
      id: 'p-3',
      competitionId: 'c-rally',
      studentId: 'u-student-masha',
      status: 'pending',
      score: 0,
      registeredAt: isoShift(-1),
      reviewedAt: null,
      comment: '',
    },
    {
      id: 'p-4',
      competitionId: 'c-english',
      studentId: 'u-student-masha',
      status: 'approved',
      score: 81,
      registeredAt: isoShift(-4),
      reviewedAt: isoNow(),
      comment: 'Хорошее произношение, не хватило чёткой структуры.',
    },
    {
      id: 'p-5',
      competitionId: 'c-lections',
      studentId: 'u-student-dima',
      status: 'approved',
      score: 95,
      registeredAt: isoShift(-18),
      reviewedAt: isoNow(),
      comment: 'Лучшая защита в потоке, обоснованная постановка эксперимента.',
    },
    {
      id: 'p-6',
      competitionId: 'c-poetry',
      studentId: 'u-student-alina',
      status: 'approved',
      score: 92,
      registeredAt: isoShift(-9),
      reviewedAt: isoNow(),
      comment: 'Авторский текст, точная интонация.',
    },
    {
      id: 'p-7',
      competitionId: 'c-lections',
      studentId: 'u-student-alina',
      status: 'approved',
      score: 79,
      registeredAt: isoShift(-17),
      reviewedAt: isoNow(),
      comment: 'Гипотеза сформулирована хорошо, метод стоит расширить.',
    },
    {
      id: 'p-8',
      competitionId: 'c-english',
      studentId: 'u-student-igor',
      status: 'approved',
      score: 86,
      registeredAt: isoShift(-3),
      reviewedAt: isoNow(),
      comment: 'Уверенно, живо, хорошая структура.',
    },
    {
      id: 'p-9',
      competitionId: 'c-poetry',
      studentId: 'u-student-vera',
      status: 'pending',
      score: 0,
      registeredAt: isoShift(-2),
      reviewedAt: null,
      comment: '',
    },
    {
      id: 'p-10',
      competitionId: 'c-english',
      studentId: 'u-student-kyrill',
      status: 'rejected',
      score: 0,
      registeredAt: isoShift(-5),
      reviewedAt: isoNow(),
      comment: 'Монолог длился меньше 40 секунд — не уложился в регламент.',
    },
    {
      id: 'p-11',
      competitionId: 'c-rally',
      studentId: 'u-student-dima',
      status: 'pending',
      score: 0,
      registeredAt: isoShift(-1),
      reviewedAt: null,
      comment: '',
    },
    {
      id: 'p-12',
      competitionId: 'c-rally',
      studentId: 'u-student-igor',
      status: 'pending',
      score: 0,
      registeredAt: isoShift(0),
      reviewedAt: null,
      comment: '',
    },
  ];
}
