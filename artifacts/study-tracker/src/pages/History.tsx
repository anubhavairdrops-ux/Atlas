import { useState } from 'react';
import { useHistory } from '@/db/hooks';
import { HistoryEntry } from '@/db/database';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, BookOpen, Layers, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

type StageKey = 'contentDone' | 'qbankDone';

const STAGES: { key: StageKey; label: string; color: string; bg: string }[] = [
  { key: 'contentDone', label: 'Content', color: 'text-sky-600 dark:text-sky-400',    bg: 'bg-sky-100 dark:bg-sky-900/30' },
  { key: 'qbankDone',   label: 'QBank',   color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
];

const STAGE_ICONS: Record<StageKey, typeof BookOpen> = {
  contentDone: BookOpen,
  qbankDone:   Layers,
};

function isMatchingStage(entry: HistoryEntry, filter: StageKey | null): boolean {
  if (!filter) return true;
  return entry.taskKey === filter;
}

export default function History() {
  const history = useHistory();
  const [filter, setFilter] = useState<StageKey | null>(null);
  const [calDate, setCalDate] = useState(new Date());

  const now = new Date();

  // ── Calendar ─────────────────────────────────────────────────────────────
  const monthStart = startOfMonth(calDate);
  const monthEnd   = endOfMonth(calDate);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Blank cells before the 1st (week starts Monday: 0=Mon … 6=Sun)
  const startDow = (getDay(monthStart) + 6) % 7; // 0=Mon
  const blanks   = Array.from({ length: startDow });

  const activeDates = new Set(
    history
      .filter(e => isMatchingStage(e, filter))
      .map(e => format(new Date(e.completedAt), 'yyyy-MM-dd')),
  );

  // ── List: entries in the current calendar month that match filter ─────────
  const visibleEntries = history.filter(e => {
    const d = new Date(e.completedAt);
    return (
      d >= monthStart &&
      d <= monthEnd &&
      isMatchingStage(e, filter)
    );
  });

  // Group by day
  const grouped: { date: Date; entries: HistoryEntry[] }[] = [];
  visibleEntries.forEach(entry => {
    const d = new Date(entry.completedAt);
    const existing = grouped.find(g => isSameDay(g.date, d));
    if (existing) existing.entries.push(entry);
    else grouped.push({ date: d, entries: [entry] });
  });

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight mb-2">History</h1>
        <p className="text-sm text-muted-foreground">Your completed tasks, month by month.</p>
      </header>

      {/* ── Stage filter chips ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium border transition-all',
            !filter
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-muted-foreground border-border hover:bg-muted',
          )}
        >
          All
        </button>
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(prev => prev === s.key ? null : s.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium border transition-all',
              filter === s.key
                ? `${s.bg} ${s.color} border-current shadow-sm`
                : 'bg-card text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm mb-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-foreground">
            {format(calDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            disabled={calDate >= startOfMonth(now)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day-of-week headers (Mon–Sun) */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {blanks.map((_, i) => <div key={`b-${i}`} />)}
          {days.map(day => {
            const key   = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, now);
            const active  = activeDates.has(key);
            return (
              <div
                key={key}
                className={cn(
                  'aspect-square flex items-center justify-center rounded-full text-sm transition-all',
                  active
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : isToday
                      ? 'border-2 border-primary text-primary font-semibold'
                      : 'text-foreground/70',
                )}
              >
                {day.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Daily log ─────────────────────────────────────────────────────── */}
      {grouped.length === 0 ? (
        <div className="text-center py-14 px-4 bg-muted/20 rounded-3xl border border-dashed">
          <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">No entries this month</p>
          <p className="text-sm text-muted-foreground">
            {filter ? `No ${STAGES.find(s => s.key === filter)!.label} completions recorded.` : 'Nothing recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, entries }) => (
            <div key={date.toISOString()}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center shrink-0', isSameDay(date, now) ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <span className="text-[10px] font-semibold uppercase leading-none opacity-70">{format(date, 'EEE')}</span>
                  <span className="text-sm font-bold leading-none mt-0.5">{format(date, 'd')}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{format(date, 'MMMM d')}</p>
                  <p className="text-xs text-muted-foreground">{entries.length} task{entries.length !== 1 ? 's' : ''} completed</p>
                </div>
              </div>

              <div className="space-y-2 pl-12">
                {entries.map((entry, idx) => {
                  const stage    = STAGES.find(s => s.key === (entry.taskKey as StageKey)) ?? STAGES[0];
                  const IconComp = STAGE_ICONS[entry.taskKey as StageKey] ?? BookOpen;
                  return (
                    <div key={idx} className="bg-card border rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', stage.bg)}>
                        <IconComp className={cn('w-4 h-4', stage.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{entry.systemName}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.subjectName}</p>
                      </div>
                      <span className={cn('shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full', stage.bg, stage.color)}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
