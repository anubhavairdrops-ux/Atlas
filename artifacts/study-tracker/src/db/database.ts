import Dexie, { Table } from 'dexie';

export interface Subject {
  id?: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SystemStatus = 'Strong' | 'Average' | 'Weak';

export interface StudySystem {
  id?: number;
  subjectId: number;
  name: string;
  // Content — incremental progress
  contentInitialized: boolean;
  contentUnitsTotal: number;
  contentUnitsCompleted: number;
  contentCompleted: boolean;
  // QBank — binary
  qbankDone: boolean;
  // Notes & metadata
  weakAreas: string;
  // Confidence (Strong / Average / Weak) — doubles as spaced-rep confidence
  status: SystemStatus;
  updatedAt: Date;

  // ── Revision engine fields (v4) ─────────────────────────────────────────
  /** Set when both contentCompleted and qbankDone first become true. */
  completionDate: Date | null;
  /** How many revisions have been completed. */
  revisionCount: number;
  /** Date of most recent completed revision. */
  lastRevisionDate: Date | null;
  /** Current calculated interval in days. */
  currentRevisionInterval: number | null;
  /** Absolute date the next revision is due. */
  nextRevisionDate: Date | null;
}

export interface HistoryEntry {
  id?: number;
  subjectId: number;
  subjectName: string;
  systemId: number;
  systemName: string;
  taskKey: string;
  taskLabel: string;
  completedAt: Date;
}

export class AtlasDB extends Dexie {
  subjects!: Table<Subject, number>;
  systems!: Table<StudySystem, number>;
  history!: Table<HistoryEntry, number>;

  constructor() {
    super('AtlasDB');
    this.version(1).stores({
      subjects: '++id, name',
      systems: '++id, subjectId, name, updatedAt',
    });
    this.version(2).stores({
      subjects: '++id, name',
      systems: '++id, subjectId, name, updatedAt',
      history: '++id, subjectId, systemId, completedAt',
    });
    // v3: replace binary contentDone with incremental content progress
    this.version(3)
      .stores({
        subjects: '++id, name',
        systems: '++id, subjectId, name, updatedAt',
        history: '++id, subjectId, systemId, completedAt',
      })
      .upgrade(tx => {
        return tx
          .table('systems')
          .toCollection()
          .modify((sys: Record<string, unknown>) => {
            const wasDone = Boolean(sys['contentDone']);
            sys['contentInitialized'] = wasDone;
            sys['contentUnitsTotal'] = wasDone ? 1 : 0;
            sys['contentUnitsCompleted'] = wasDone ? 1 : 0;
            sys['contentCompleted'] = wasDone;
          });
      });
    // v4: add revision engine fields
    this.version(4)
      .stores({
        subjects: '++id, name',
        systems: '++id, subjectId, name, updatedAt, nextRevisionDate',
        history: '++id, subjectId, systemId, completedAt',
      })
      .upgrade(tx => {
        return tx
          .table('systems')
          .toCollection()
          .modify((sys: Record<string, unknown>) => {
            if (!('completionDate' in sys))         sys['completionDate'] = null;
            if (!('revisionCount' in sys))          sys['revisionCount'] = 0;
            if (!('lastRevisionDate' in sys))       sys['lastRevisionDate'] = null;
            if (!('currentRevisionInterval' in sys)) sys['currentRevisionInterval'] = null;
            if (!('nextRevisionDate' in sys))       sys['nextRevisionDate'] = null;
          });
      });
  }
}

export const db = new AtlasDB();

// ── Export / Import ────────────────────────────────────────────────────────

export async function exportData() {
  const subjects = await db.subjects.toArray();
  const systems = await db.systems.toArray();
  const history = await db.history.toArray();
  return { subjects, systems, history };
}

export async function importData(data: {
  subjects: Subject[];
  systems: StudySystem[];
  history?: HistoryEntry[];
}) {
  await db.transaction('rw', db.subjects, db.systems, db.history, async () => {
    await db.subjects.clear();
    await db.systems.clear();
    await db.history.clear();

    if (data.subjects?.length) {
      await db.subjects.bulkAdd(
        data.subjects.map(s => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      );
    }

    if (data.systems?.length) {
      await db.systems.bulkAdd(
        data.systems.map(s => {
          const base = { ...s, updatedAt: new Date(s.updatedAt) };
          // Migrate old-format backups (contentDone boolean → incremental fields)
          const old = s as Record<string, unknown>;
          if (typeof old['contentDone'] === 'boolean' && !('contentInitialized' in s)) {
            const wasDone = Boolean(old['contentDone']);
            base.contentInitialized = wasDone;
            base.contentUnitsTotal = wasDone ? 1 : 0;
            base.contentUnitsCompleted = wasDone ? 1 : 0;
            base.contentCompleted = wasDone;
          }
          // Default revision fields
          if (!('completionDate' in s)) base.completionDate = null;
          if (!('revisionCount' in s)) base.revisionCount = 0;
          if (!('lastRevisionDate' in s)) base.lastRevisionDate = null;
          if (!('currentRevisionInterval' in s)) base.currentRevisionInterval = null;
          if (!('nextRevisionDate' in s)) base.nextRevisionDate = null;
          // Coerce dates
          if (base.completionDate) base.completionDate = new Date(base.completionDate as unknown as string);
          if (base.lastRevisionDate) base.lastRevisionDate = new Date(base.lastRevisionDate as unknown as string);
          if (base.nextRevisionDate) base.nextRevisionDate = new Date(base.nextRevisionDate as unknown as string);
          return base;
        }),
      );
    }

    if (data.history?.length) {
      await db.history.bulkAdd(
        data.history.map(h => ({ ...h, completedAt: new Date(h.completedAt) })),
      );
    }
  });
}
