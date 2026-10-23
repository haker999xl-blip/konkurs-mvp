import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../state/session';
import { getRepository } from '../data/localRepository';
import type { Competition, Participation, User } from '../data/types';
import { buildRating, type RatingEntry } from '../lib/rating';

/**
 * Живой снимок данных. Пересчитывается при revision из сессии
 * (внешние вкладки) и при явном `refresh()` после мутаций.
 */
export interface DataSnapshot {
  users: User[];
  competitions: Competition[];
  participations: Participation[];
  rating: RatingEntry[];
  refresh: () => void;
}

export function useData(): DataSnapshot {
  const repo = getRepository();
  const { revision } = useSession();
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [revision]);

  return useMemo(() => {
    const users = repo.getUsers();
    const competitions = repo.getCompetitions();
    const participations = repo.getParticipations();
    return {
      users,
      competitions,
      participations,
      rating: buildRating(users, participations),
      refresh,
    };
  }, [repo, revision, tick, refresh]);
}
