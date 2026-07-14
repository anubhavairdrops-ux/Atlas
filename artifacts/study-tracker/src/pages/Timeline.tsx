import { useState } from 'react';
import { useHistory, useAllSystems, useSubjects } from '@/db/hooks';
import { HistoryEntry, StudySystem } from '@/db/database';
import {
  TimelineEvent,
  TimelineFilter,
  TIMELINE_FILTERS,
  eventMatchesFilter,
} from '@/db/timeline';
import {
  format,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, BookOpen, Layers, CalendarDays, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isRevisionUpcoming, isRevisionOverdue, daysOverdue } from '@/db/revisionEngine';

// ── Map a HistoryEntry → completed TimelineEvent ──────────────────────────────
function historyToEvent(h: HistoryEntry): TimelineEvent {
  const typeMap: Record<string, TimelineEvent['eventType']> = {
    contentDone: 'contentCompleted',
    qbankDone:   'qbankDone',
    pyqsDone:    'pyqsDone',
    revision:    'revisionSystem',
  };
  return {
    id:          String(h.id ?? `${h.systemId}-${h.taskKey}-${h.completedAt}`),
    eventType:   typeMap[h.taskKey] ?? 'contentCompleted',
    entityName:  `${h.systemName} ${h.taskLabel}`,
    subjectName: h.subjectName,
    date:        new Date(h.completedAt),
    status:      'completed',
  };
}

// ── Map a StudySystem → upcoming / overdue TimelineEvent ─────────────────────
function systemToRevisionEvent(
  sys: StudySystem,
  subjectName: string,
  status: 'upcoming' | 'overdue',
): TimelineEvent {
  const days = daysOverdue(sys);
  return {
    id:          `rev-${sys.id}-${status}`,
    eventType:   'revisionSystem',
    entityName:  `${sys.name} Revision`,
    subjectName,
    date:        new Date(sys.nextRevisionDate!),
    status,
    meta:        status === 'overdue' ? { daysOverdue: days } : undefined,
  };
}

// ── Visual config ─────────────────────────────────────────────────────────────
const EVENT_STYLE: Record<TimelineEvent['eventType'], { bg: string; text: string; Icon: typeof BookOpen }> = {
  contentCompleted: { bg: 'bg-sky-100 dark:bg-sky-900/30',       text: 'text-sky-700 dark:text-sky-400',       Icon: BookOpen },
  qbankDone:        { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', Icon: Layers   },
  pyqsDone:         { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   Icon: BookOpen },
  revisionSystem:   { bg: 'bg-rose-100 dark:bg-rose-900/30',     text: 'text-rose-700 dark:text-rose-400',     Icon: Clock    },
  revisionSubject:  { bg: 'bg-rose-100 dark:bg-rose-900/30',     text: 'text-rose-700 dark:text-rose-400',     Icon: Clock    },
};

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event }: { event: TimelineEvent }) {
  const style = EVENT_STYLE[event.eventType];
  const { Icon } = style;
  const days = event.meta?.daysOverdue as number | undefined;
  return (
    <div className="bg-card border rounded-xl p-3 flex items-center gap-3 shadow-sm">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', style.bg)}>
        <Icon className={cn('w-4 h-4', style.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{event.entityName}</p>
        <div className="flex items-center gap-2">
          {event.subjectName && <p className="text-xs text-muted-foreground truncate">{event.subjectName}</p>}
          {event.status === 'overdue' && days !== undefined && (
            <p className="text-xs text-destructive font-medium shrink-0">{days} day{days !== 1 ? 's' : ''} overdue</p>
          )}
          {event.status === 'upcoming' && (
            <p className="text-xs text-muted-foreground shrink-0">{format(event.date, 'MMM d')}</p>
          )}
        </div>
      </div>
      {event.status === 'overdue' && <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconClass, events, emptyText }: {
  title: string; icon: typeof BookOpen; iconClass: string; events: TimelineEvent[]; emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('w-4 h-4 shrink-0', iconClass)} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {events.length > 0 && (
          <span className="ml-auto text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{events.length}</span>
        )}
      </div>
      {events.length === 0
        ? <p className="text-sm text-muted-foreground/60 pl-6 italic">{emptyText}</p>
        : <div className="space-y-2 pl-6">{events.map(e => <EventCard key={e.id} event={e} />)}</div>}
    </div>
  );
}

// ── Past-day group ────────────────────────────────────────────────────────────
function PastDayGroup({ date, events }: { date: Date; events: TimelineEvent[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center shrink-0 bg-muted">
          <span className="text-[10px] font-semibold uppercase leading-none opacity-70">{format(date, 'EEE')}</span>
          <span className="text-sm font-bold leading-none mt-0.5">{format(date, 'd')}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{format(date, 'MMMM d')}</p>
          <p className="text-xs text-muted-foreground">{events.length} task{events.length !== 1 ? 's' : ''} completed</p>
        </div>
      </div>
      <div className="space-y-2 pl-14">{events.map(e => <EventCard key={e.id} event={e} />)}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Timeline() {
  const history  = useHistory();
  const systems  = useAllSystems();
  const subjects = useSubjects();
  const [filter, setFilter]   = useState<TimelineFilter>('all');
  const [calDate, setCalDate] = useState(new Date());

  const now        = new Date();
  const monthStart = startOfMonth(calDate);
  const monthEnd   = endOfMonth(calDate);

  // ── Completed events in the visible month ────────────────────────────────
  const monthCompleted: TimelineEvent[] = history
    .map(historyToEvent)
    .filter(e => e.date >= monthStart && e.date <= monthEnd);

  // ── Upcoming revision events in the visible month ────────────────────────
  const upcomingRevisions: TimelineEvent[] = systems
    .filter(sys => {
      if (!sys.nextRevisionDate) return false;
      const d = new Date(sys.nextRevisionDate);
      return isRevisionUpcoming(sys) && d >= monthStart && d <= monthEnd;
    })
    .map(sys => {
      const sub = subjects.find(s => s.id === sys.subjectId);
      return systemToRevisionEvent(sys, sub?.name ?? '', 'upcoming');
    });

  // ── Overdue revision events — all still-outstanding overdue items ─────────
  // Shown regardless of month so the user always sees what needs action.
  const overdueRevisions: TimelineEvent[] = systems
    .filter(sys => isRevisionOverdue(sys))
    .map(sys => {
      const sub = subjects.find(s => s.id === sys.subjectId);
      return systemToRevisionEvent(sys, sub?.name ?? '', 'overdue');
    })
    .sort((a, b) => {
      const da = (a.meta?.daysOverdue as number) ?? 0;
      const db_ = (b.meta?.daysOverdue as number) ?? 0;
      return db_ - da; // most overdue first
    });

  // ── Calendar dot set ─────────────────────────────────────────────────────
  const calendarEvents = [
    ...monthCompleted,
    ...upcomingRevisions,
    ...(overdueRevisions.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    })),
  ];

  // ── Apply filter ──────────────────────────────────────────────────────────
  const filtered = (events: TimelineEvent[]) => events.filter(e => eventMatchesFilter(e, filter));

  // ── Calendar ──────────────────────────────────────────────────────────────
  const days     = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = (getDay(monthStart) + 6) % 7;
  const blanks   = Array.from({ length: startDow });
  const activeDates = new Set(filtered(calendarEvents).map(e => format(e.date, 'yyyy-MM-dd')));

  // ── Section data ──────────────────────────────────────────────────────────
  const todayCompleted       = filtered(monthCompleted).filter(e => isToday(e.date));
  const filteredUpcoming     = filtered(upcomingRevisions);
  const filteredOverdue      = filtered(overdueRevisions);

  // Past days in the month (not today), most recent first
  const pastEntries = filtered(monthCompleted).filter(e => !isToday(e.date));
  const pastGrouped: { date: Date; events: TimelineEvent[] }[] = [];
  pastEntries.forEach(event => {
    const existing = pastGrouped.find(g => isSameDay(g.date, event.date));
    if (existing) existing.events.push(event);
    else pastGrouped.push({ date: event.date, events: [event] });
  });
  pastGrouped.sort((a, b) => b.date.getTime() - a.date.getTime());

  const everythingEmpty =
    todayCompleted.length === 0 && filteredUpcoming.length === 0 &&
    filteredOverdue.length === 0 && pastGrouped.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight mb-2">Timeline</h1>
        <p className="text-sm text-muted-foreground">Your chronological view of knowledge.</p>
      </header>

      {/* ── Filter chips ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TIMELINE_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(prev => prev === key ? 'all' : key)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium border transition-all',
              filter === key ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:bg-muted')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-foreground">{format(calDate, 'MMMM yyyy')}</h2>
          <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            disabled={calDate >= startOfMonth(now)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {blanks.map((_, i) => <div key={`b-${i}`} />)}
          {days.map(day => {
            const key      = format(day, 'yyyy-MM-dd');
            const isTdy    = isSameDay(day, now);
            const active   = activeDates.has(key);
            return (
              <div key={key} className={cn(
                'aspect-square flex items-center justify-center rounded-full text-sm transition-all',
                active ? 'bg-primary text-primary-foreground font-bold shadow-sm' : isTdy ? 'border-2 border-primary text-primary font-semibold' : 'text-foreground/70',
              )}>
                {day.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Three sections + past days ────────────────────────────────────── */}
      <div className="space-y-8">
        <Section title="Today"    icon={CalendarDays} iconClass="text-primary"     events={todayCompleted}  emptyText="Nothing completed today yet." />
        <Section title="Upcoming" icon={Clock}        iconClass="text-amber-500"   events={filteredUpcoming} emptyText="No upcoming revisions this month." />
        <Section title="Overdue"  icon={AlertCircle}  iconClass="text-destructive" events={filteredOverdue}  emptyText="Nothing overdue." />

        {pastGrouped.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Earlier this month</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {pastGrouped.map(({ date, events }) => (
              <PastDayGroup key={date.toISOString()} date={date} events={events} />
            ))}
          </div>
        )}

        {everythingEmpty && (
          <div className="text-center py-14 px-4 bg-muted/20 rounded-3xl border border-dashed">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">
              {filter !== 'all'
                ? `No ${TIMELINE_FILTERS.find(f => f.key === filter)!.label} events for ${format(calDate, 'MMMM')}.`
                : `No activity recorded for ${format(calDate, 'MMMM yyyy')}.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
