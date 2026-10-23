import type { Competition, Participation, User } from '../data/types';

export interface RatingEntry {
  student: User;
  points: number;
  approved: number;
  position: number;
}

/**
 * Рейтинг — производная от подтверждённых участий.
 * Суммирует баллы approved; сортировка по убыванию, позиция = индекс+1.
 */
export function buildRating(users: User[], participations: Participation[]): RatingEntry[] {
  const pointsByStudent = new Map<string, { points: number; approved: number }>();
  participations
    .filter((p) => p.status === 'approved')
    .forEach((p) => {
      const prev = pointsByStudent.get(p.studentId) ?? { points: 0, approved: 0 };
      pointsByStudent.set(p.studentId, {
        points: prev.points + p.score,
        approved: prev.approved + 1,
      });
    });

  return users
    .filter((u) => u.role === 'student')
    .map((student) => {
      const stat = pointsByStudent.get(student.id) ?? { points: 0, approved: 0 };
      return { student, points: stat.points, approved: stat.approved, position: 0 };
    })
    .sort((a, b) => b.points - a.points || a.student.name.localeCompare(b.student.name, 'ru'))
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

/** Позиция ученика в рейтинге (0, если не найден). */
export function studentPosition(rating: RatingEntry[], studentId: string): number {
  return rating.find((entry) => entry.student.id === studentId)?.position ?? 0;
}

/** Общее количество подтверждённых участий ученика. */
export function approvedCount(participations: Participation[]): number {
  return participations.filter((p) => p.status === 'approved').length;
}

/** Сумма баллов ученика. */
export function totalScore(participations: Participation[]): number {
  return participations
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.score, 0);
}

/** Максимально возможная сумма баллов по конкурсам, в которых ученик участвовал. */
export function maxPossibleScore(
  participations: Participation[],
  competitions: Competition[],
): number {
  const byId = new Map(competitions.map((c) => [c.id, c]));
  return participations.reduce((sum, p) => sum + (byId.get(p.competitionId)?.maxScore ?? 0), 0);
}

/** Прогресс к полному максимуму, 0..100. */
export function progressPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}
