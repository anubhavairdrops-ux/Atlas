import { StudySystem, SystemStatus } from './database';

// ── Configuration ─────────────────────────────────────────────────────────────
// All values are in days. Adjust here to change global behaviour.

export const REVISION_CONFIG = {
  INITIAL_INTERVALS: {
    Strong:  30,
    Average: 14,
    Weak:    7,
  } as Record<SystemStatus, number>,
  MULTIPLIERS: {
    Strong:  2.0,
    Average: 1.5,
    Weak:    0.5,
  } as Record<SystemStatus, number>,
  MIN_INTERVAL: 3,
  MAX_INTERVAL: 90,
} as const;

// ── Core calculations ─────────────────────────────────────────────────────────

/** Initial interval in days for a given confidence level. */
export function getInitialInterval(confidence: SystemStatus): number {
  return REVISION_CONFIG.INITIAL_INTERVALS[confidence];
}

/** Multiplier for a given confidence level. */
export function getMultiplier(confidence: SystemStatus): number {
  return REVISION_CONFIG.MULTIPLIERS[confidence];
}

/**
 * Calculate the next interval after a completed revision.
 * newInterval = clamp(previousInterval × multiplier, MIN, MAX)
 */
export function calculateNextInterval(currentInterval: number, confidence: SystemStatus): number {
  const raw = currentInterval * getMultiplier(confidence);
  return Math.round(
    Math.max(REVISION_CONFIG.MIN_INTERVAL, Math.min(REVISION_CONFIG.MAX_INTERVAL, raw)),
  );
}

/** Add `days` to a date, returning a new Date (time zeroed to midnight). */
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/** Today at midnight. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/**
 * Schedule the FIRST revision after initial evaluation.
 * Returns the fields that should be written to the system.
 */
export function scheduleFirstRevision(confidence: SystemStatus, now: Date = today()): {
  currentRevisionInterval: number;
  nextRevisionDate: Date;
} {
  const interval = getInitialInterval(confidence);
  return {
    currentRevisionInterval: interval,
    nextRevisionDate: addDays(now, interval),
  };
}

/**
 * Schedule the NEXT revision after a completed revision.
 * Returns the fields that should be written to the system.
 */
export function scheduleNextRevision(
  confidence: SystemStatus,
  currentInterval: number,
  now: Date = today(),
): {
  currentRevisionInterval: number;
  nextRevisionDate: Date;
} {
  const interval = calculateNextInterval(currentInterval, confidence);
  return {
    currentRevisionInterval: interval,
    nextRevisionDate: addDays(now, interval),
  };
}

// ── State queries ─────────────────────────────────────────────────────────────

/** True when a system has an initial completion and a scheduled revision. */
export function hasRevisionScheduled(sys: StudySystem): boolean {
  return Boolean(sys.completionDate && sys.nextRevisionDate);
}

/** True when the next revision date is today or in the past. */
export function isRevisionDue(sys: StudySystem, now: Date = today()): boolean {
  if (!hasRevisionScheduled(sys)) return false;
  const due = new Date(sys.nextRevisionDate!);
  due.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return due <= n;
}

/** True when the next revision date is strictly before today. */
export function isRevisionOverdue(sys: StudySystem, now: Date = today()): boolean {
  if (!hasRevisionScheduled(sys)) return false;
  const due = new Date(sys.nextRevisionDate!);
  due.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return due < n;
}

/** True when the next revision date is exactly today. */
export function isRevisionDueToday(sys: StudySystem, now: Date = today()): boolean {
  return isRevisionDue(sys, now) && !isRevisionOverdue(sys, now);
}

/** Number of days a revision is overdue (0 if not overdue). */
export function daysOverdue(sys: StudySystem, now: Date = today()): number {
  if (!isRevisionOverdue(sys, now)) return 0;
  const due = new Date(sys.nextRevisionDate!);
  due.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return Math.floor((n.getTime() - due.getTime()) / 86_400_000);
}

/** True when the revision is scheduled for a future date (not yet due). */
export function isRevisionUpcoming(sys: StudySystem, now: Date = today()): boolean {
  if (!hasRevisionScheduled(sys)) return false;
  const due = new Date(sys.nextRevisionDate!);
  due.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return due > n;
}
