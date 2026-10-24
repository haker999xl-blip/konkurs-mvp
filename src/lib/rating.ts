/**
 * Рейтинг считается по подтверждённым достижениям.
 * Два среза: по лицею (все ученики) и по классам (сумма класса).
 * Никаких «сырых» баллов: pending и rejected в зачёт не идут.
 */
import type { Achievement, User } from '../data/types';

export interface RatingEntry {
  student: User;
  points: number;
  approved: number;
  position: number;
}

export interface ClassRatingEntry {
  grade: string;
  points: number;
  approved: number;
  /** Сколько учеников класса принесли хотя бы одно подтверждённое достижение. */
  contributors: number;
  students: number;
  position: number;
}

/** Только подтверждённые достижения: единственный источник баллов. */
export function approvedAchievements(achievements: Achievement[]): Achievement[] {
  return achievements.filter((a) => a.status === 'approved');
}

/** Сумма подтверждённых баллов ученика. */
export function studentScore(achievements: Achievement[], studentId: string): number {
  return approvedAchievements(achievements)
    .filter((a) => a.studentId === studentId)
    .reduce((sum, a) => sum + a.points, 0);
}

/** Сумма подтверждённых баллов по всем ученикам. */
export function totalScore(achievements: Achievement[]): number {
  return approvedAchievements(achievements).reduce((sum, a) => sum + a.points, 0);
}

/** Рейтинг лицея: все ученики, включая нулевых — так честнее для показа. */
export function buildRating(users: User[], achievements: Achievement[]): RatingEntry[] {
  const approved = approvedAchievements(achievements);
  const students = users.filter((u) => u.role === 'student');

  const rows = students.map((student) => {
    const own = approved.filter((a) => a.studentId === student.id);
    return {
      student,
      points: own.reduce((sum, a) => sum + a.points, 0),
      approved: own.length,
    };
  });

  rows.sort((a, b) => b.points - a.points || a.student.name.localeCompare(b.student.name, 'ru'));
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

/** Рейтинг по классам: сумма баллов всех учеников класса. */
export function buildClassRating(users: User[], achievements: Achievement[]): ClassRatingEntry[] {
  const approved = approvedAchievements(achievements);
  const students = users.filter((u) => u.role === 'student' && u.grade);
  const grades = [...new Set(students.map((u) => u.grade))];

  const rows = grades.map((grade) => {
    const members = students.filter((u) => u.grade === grade);
    const memberIds = new Set(members.map((u) => u.id));
    const own = approved.filter((a) => memberIds.has(a.studentId));
    const contributors = new Set(own.map((a) => a.studentId)).size;
    return {
      grade,
      points: own.reduce((sum, a) => sum + a.points, 0),
      approved: own.length,
      contributors,
      students: members.length,
    };
  });

  rows.sort((a, b) => b.points - a.points || a.grade.localeCompare(b.grade, 'ru'));
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

/** Место ученика в рейтинге лицея. */
export function studentPosition(rating: RatingEntry[], studentId: string): number {
  return rating.find((entry) => entry.student.id === studentId)?.position ?? 0;
}

/** Сколько достижений ожидает проверки — для бейджа в админке. */
export function pendingCount(achievements: Achievement[]): number {
  return achievements.filter((a) => a.status === 'pending').length;
}

/** Прогресс до потолка: сколько баллов ученик набрал от максимума по своим заявкам. */
export function progressPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}