import { useLiveQuery } from 'dexie-react-hooks';
import { db, Subject, StudySystem, HistoryEntry } from './database';
import { SystemStatus } from './database';
import { scheduleFirstRevision, scheduleNextRevision, isRevisionDue, today } from './revisionEngine';

export function useSubjects() {
  return useLiveQuery(() => db.subjects.toArray()) ?? [];
}

export function useSubject(id: number) {
  return useLiveQuery(() => db.subjects.get(id), [id]);
}

export function useSystemsBySubject(subjectId: number) {
  return useLiveQuery(() => db.systems.where('subjectId').equals(subjectId).toArray(), [subjectId]) ?? [];
}

export function useAllSystems() {
  return useLiveQuery(() => db.systems.toArray()) ?? [];
}

export function useSystem(id: number) {
  return useLiveQuery(() => db.systems.get(id), [id]);
}

export function useHistory() {
  return useLiveQuery(() => db.history.orderBy('completedAt').reverse().toArray()) ?? [];
}

export function useHistoryByMonth(year: number, month: number) {
  return useLiveQuery(() => {
    const start = new Date(year, month, 1);
    const end   = new Date(year, month + 1, 1);
    return db.history
      .where('completedAt')
      .between(start, end, true, false)
      .reverse()
      .toArray();
  }, [year, month]) ?? [];
}

export function useEarliestHistoryDate(): Date | null {
  return useLiveQuery(async () => {
    const entry = await db.history.orderBy('completedAt').first();
    return entry ? new Date(entry.completedAt) : null;
  }) ?? null;
}

/** All systems that have a revision due today or overdue. */
export function useRevisionsDue(): StudySystem[] {
  const systems = useLiveQuery(() => db.systems.toArray()) ?? [];
  const now = today();
  return systems.filter(s => isRevisionDue(s, now));
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function addSubject(name: string) {
  return await db.subjects.add({
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function updateSubject(id: number, name: string) {
  return await db.subjects.update(id, { name, updatedAt: new Date() });
}

export async function deleteSubject(id: number) {
  await db.transaction('rw', db.subjects, db.systems, db.history, async () => {
    await db.history.where('subjectId').equals(id).delete();
    await db.systems.where('subjectId').equals(id).delete();
    await db.subjects.delete(id);
  });
}

export async function addSystem(subjectId: number, name: string) {
  return await db.systems.add({
    subjectId,
    name,
    contentInitialized: false,
    contentUnitsTotal: 0,
    contentUnitsCompleted: 0,
    contentCompleted: false,
    qbankDone: false,
    weakAreas: '',
    status: 'Average',
    updatedAt: new Date(),
    completionDate: null,
    revisionCount: 0,
    lastRevisionDate: null,
    currentRevisionInterval: null,
    nextRevisionDate: null,
  });
}

export async function updateSystem(id: number, changes: Partial<StudySystem>) {
  return await db.systems.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteSystem(id: number) {
  await db.transaction('rw', db.systems, db.history, async () => {
    await db.history.where('systemId').equals(id).delete();
    await db.systems.delete(id);
  });
}

export async function logCompletion(entry: Omit<HistoryEntry, 'id'>) {
  return await db.history.add(entry);
}

/**
 * Record the initial evaluation after a system is first fully completed.
 * Sets completionDate, confidence (status), and schedules the first revision.
 */
export async function recordInitialEvaluation(
  systemId: number,
  confidence: SystemStatus,
) {
  const now = today();
  const { currentRevisionInterval, nextRevisionDate } = scheduleFirstRevision(confidence, now);
  await updateSystem(systemId, {
    status: confidence,
    completionDate: new Date(),
    revisionCount: 0,
    lastRevisionDate: null,
    currentRevisionInterval,
    nextRevisionDate,
  });
}

/**
 * Mark a revision as completed.
 * Increments revisionCount, updates confidence + lastRevisionDate,
 * calculates and schedules the next revision, logs a history entry.
 */
export async function completeRevision(
  systemId: number,
  confidence: SystemStatus,
  subjectId: number,
  subjectName: string,
  systemName: string,
) {
  const sys = await db.systems.get(systemId);
  if (!sys) return;

  const now = today();
  const currentInterval = sys.currentRevisionInterval ?? 14;
  const { currentRevisionInterval, nextRevisionDate } = scheduleNextRevision(confidence, currentInterval, now);

  await updateSystem(systemId, {
    status: confidence,
    revisionCount: (sys.revisionCount ?? 0) + 1,
    lastRevisionDate: new Date(),
    currentRevisionInterval,
    nextRevisionDate,
  });

  await logCompletion({
    subjectId,
    subjectName,
    systemId,
    systemName,
    taskKey: 'revision',
    taskLabel: 'Revision',
    completedAt: new Date(),
  });
}

export async function clearHistory() {
  return await db.history.clear();
}
