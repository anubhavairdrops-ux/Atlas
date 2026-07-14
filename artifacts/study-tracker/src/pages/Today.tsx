import { useState } from 'react';
import { useSubjects, useAllSystems, updateSystem, logCompletion, completeRevision } from '@/db/hooks';
import { Subject, StudySystem, SystemStatus } from '@/db/database';
import { ConfidenceDialog } from '@/components/ConfidenceDialog';
import {
  Check, CheckCircle2, Trophy, ChevronDown, ChevronRight,
  RotateCcw, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isRevisionDue, isRevisionOverdue, daysOverdue } from '@/db/revisionEngine';

// ── Types ──────────────────────────────────────────────────────────────────

type ActionKind = 'revision-overdue' | 'revision-due' | 'content' | 'qbank';

interface ActionItem {
  kind:       ActionKind;
  system:     StudySystem;
  subject:    Subject;
  overdueDays?: number;
}

interface SubjectRow {
  subject:      Subject;
  systems:      StudySystem[];
  pendingCount: number; // systems with any actionable work
  isComplete:   boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function systemHasAction(sys: StudySystem): boolean {
  return !sys.contentCompleted || !sys.qbankDone || isRevisionDue(sys);
}

function systemPendingStudy(sys: StudySystem): boolean {
  return !sys.contentCompleted || !sys.qbankDone;
}

// ── Action Required item row ───────────────────────────────────────────────

interface ActionRowProps {
  item:            ActionItem;
  onMarkStudy:     (item: ActionItem) => void;
  onMarkRevision:  (item: ActionItem) => void;
}

function ActionRow({ item, onMarkStudy, onMarkRevision }: ActionRowProps) {
  const isRevision = item.kind === 'revision-overdue' || item.kind === 'revision-due';
  const isOverdue  = item.kind === 'revision-overdue';

  const label =
    item.kind === 'revision-overdue' || item.kind === 'revision-due'
      ? 'Revision'
      : item.kind === 'content'
        ? 'Content'
        : 'QBank';

  const badgeClass = {
    'revision-overdue': 'bg-destructive/10 text-destructive',
    'revision-due':     'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'content':          'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    'qbank':            'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  }[item.kind];

  return (
    <div className={cn(
      'bg-card rounded-2xl border shadow-sm p-3.5 flex items-center gap-3',
      isOverdue && 'border-destructive/30',
    )}>
      {/* Action button */}
      <button
        onClick={() => isRevision ? onMarkRevision(item) : onMarkStudy(item)}
        className={cn(
          'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all duration-150 active:scale-90 group',
          isOverdue
            ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/15 hover:border-destructive'
            : isRevision
              ? 'border-amber-300/60 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400'
              : 'border-muted-foreground/25 bg-background hover:border-primary hover:bg-primary/10',
        )}
      >
        {isRevision
          ? <RotateCcw className={cn('w-3.5 h-3.5 transition-colors', isOverdue ? 'text-destructive/60 group-hover:text-destructive' : 'text-amber-500/70 group-hover:text-amber-600')} />
          : <Check className="w-4 h-4 text-muted-foreground/35 group-hover:text-primary transition-colors" />
        }
      </button>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.system.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full font-semibold', badgeClass)}>
            {label}
          </span>
          {isOverdue && item.overdueDays !== undefined && (
            <span className="flex items-center gap-0.5 text-[10px] text-destructive">
              <AlertCircle className="w-2.5 h-2.5" />
              {item.overdueDays}d overdue
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{item.subject.name}</span>
        </div>
      </div>
    </div>
  );
}

// ── Expanded system task rows ────────────────────────────────────────────────

interface SystemTasksProps {
  sys:             StudySystem;
  subject:         Subject;
  onMarkStudy:     (sys: StudySystem, taskKey: 'contentCompleted' | 'qbankDone') => void;
  onMarkRevision:  (sys: StudySystem, subject: Subject) => void;
}

function SystemTasks({ sys, subject, onMarkStudy, onMarkRevision }: SystemTasksProps) {
  const tasks: { key: 'contentCompleted' | 'qbankDone'; label: string; done: boolean }[] = [
    { key: 'contentCompleted', label: 'Content', done: sys.contentCompleted },
    { key: 'qbankDone',        label: 'QBank',   done: sys.qbankDone },
  ];

  const pendingStudy = tasks.filter(t => !t.done);
  const revDue       = isRevisionDue(sys);
  const revOverdue   = isRevisionOverdue(sys);
  const overdueDays_ = daysOverdue(sys);

  // Only render if there's something to do
  if (pendingStudy.length === 0 && !revDue) return null;

  const stepColors: Record<string, string> = {
    contentCompleted: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    qbankDone:        'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground/70 px-1 pt-0.5">{sys.name}</p>

      {/* Study tasks */}
      {pendingStudy.map(task => (
        <div key={task.key} className="bg-card rounded-xl border shadow-sm p-3 flex items-center gap-3">
          <button
            onClick={() => onMarkStudy(sys, task.key)}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-2 border-muted-foreground/25 bg-background hover:border-primary hover:bg-primary/10 active:scale-90 group transition-all duration-150"
          >
            <Check className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full font-semibold', stepColors[task.key])}>
              {task.label}
            </span>
            {task.key === 'contentCompleted' && sys.contentInitialized && !sys.contentCompleted && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {sys.contentUnitsCompleted}/{sys.contentUnitsTotal}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Revision task */}
      {revDue && (
        <div className={cn('bg-card rounded-xl border shadow-sm p-3 flex items-center gap-3', revOverdue && 'border-destructive/30')}>
          <button
            onClick={() => onMarkRevision(sys, subject)}
            className={cn(
              'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all duration-150 active:scale-90 group',
              revOverdue
                ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/15 hover:border-destructive'
                : 'border-amber-300/60 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400',
            )}
          >
            <RotateCcw className={cn('w-3.5 h-3.5 transition-colors', revOverdue ? 'text-destructive/60 group-hover:text-destructive' : 'text-amber-500/70 group-hover:text-amber-600')} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full font-semibold', revOverdue ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400')}>
              Revision
            </span>
            {revOverdue && overdueDays_ > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                <AlertCircle className="w-2.5 h-2.5" />{overdueDays_}d overdue
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subject row (collapsible) ─────────────────────────────────────────────────

interface SubjectSectionProps {
  row:             SubjectRow;
  expanded:        boolean;
  onToggle:        () => void;
  onMarkStudy:     (sys: StudySystem, taskKey: 'contentCompleted' | 'qbankDone') => void;
  onMarkRevision:  (sys: StudySystem, subject: Subject) => void;
}

function SubjectSection({ row, expanded, onToggle, onMarkStudy, onMarkRevision }: SubjectSectionProps) {
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors focus:outline-none"
      >
        <Chevron className="w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-200" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{row.subject.name}</p>
          <p className={cn('text-xs mt-0.5', row.isComplete ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground')}>
            {row.isComplete ? 'Completed' : `${row.pendingCount} System${row.pendingCount !== 1 ? 's' : ''} Pending`}
          </p>
        </div>
        <Link href={`/subjects/${row.subject.id}`} onClick={e => e.stopPropagation()}>
          <span className="text-[11px] text-primary font-medium hover:underline shrink-0 pr-1">View</span>
        </Link>
      </button>

      {/* Expanded body */}
      <div className={cn(
        'grid transition-all duration-300 ease-in-out',
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-4">
            {row.systems
              .filter(sys => systemHasAction(sys))
              .map(sys => (
                <SystemTasks
                  key={sys.id}
                  sys={sys}
                  subject={row.subject}
                  onMarkStudy={onMarkStudy}
                  onMarkRevision={onMarkRevision}
                />
              ))}
            {row.isComplete && (
              <p className="text-sm text-muted-foreground text-center py-2">
                All systems complete — great work!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Today() {
  const subjects = useSubjects();
  const systems  = useAllSystems();

  // Collapsed state — all subjects start collapsed
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Content init dialog
  const [initSys,    setInitSys]    = useState<{ sys: StudySystem; subject: Subject; taskKey: 'contentCompleted' | 'qbankDone' } | null>(null);
  const [initValue,  setInitValue]  = useState('');

  // Revision confidence dialog
  const [revTarget,      setRevTarget]      = useState<{ sys: StudySystem; subject: Subject } | null>(null);
  const [showRevDialog,  setShowRevDialog]  = useState(false);

  const toggleSubject = (id: number) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Build Action Required list ─────────────────────────────────────────────
  const actionItems: ActionItem[] = [];

  systems.forEach(sys => {
    const subject = subjects.find(s => s.id === sys.subjectId);
    if (!subject) return;

    if (isRevisionOverdue(sys)) {
      actionItems.push({ kind: 'revision-overdue', system: sys, subject, overdueDays: daysOverdue(sys) });
    } else if (isRevisionDue(sys)) {
      actionItems.push({ kind: 'revision-due', system: sys, subject });
    }
  });

  systems.forEach(sys => {
    const subject = subjects.find(s => s.id === sys.subjectId);
    if (!subject) return;
    if (!sys.contentCompleted) actionItems.push({ kind: 'content', system: sys, subject });
  });

  systems.forEach(sys => {
    const subject = subjects.find(s => s.id === sys.subjectId);
    if (!subject) return;
    if (!sys.qbankDone) actionItems.push({ kind: 'qbank', system: sys, subject });
  });

  // Priority order is already maintained by push order:
  // revision-overdue → revision-due → content → qbank
  // Within each group sort overdue by days desc, others alphabetically
  const sortedActions = [
    ...actionItems.filter(i => i.kind === 'revision-overdue').sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0)),
    ...actionItems.filter(i => i.kind === 'revision-due').sort((a, b) => a.system.name.localeCompare(b.system.name)),
    ...actionItems.filter(i => i.kind === 'content').sort((a, b) => a.system.name.localeCompare(b.system.name)),
    ...actionItems.filter(i => i.kind === 'qbank').sort((a, b) => a.system.name.localeCompare(b.system.name)),
  ];

  // ── Build subject rows ─────────────────────────────────────────────────────
  const subjectRows: SubjectRow[] = subjects
    .map(subject => {
      const subSystems = systems.filter(s => s.subjectId === subject.id);
      const pendingCount = subSystems.filter(systemHasAction).length;
      const isComplete   = subSystems.length > 0 && pendingCount === 0;
      return { subject, systems: subSystems, pendingCount, isComplete };
    })
    .sort((a, b) => a.subject.name.localeCompare(b.subject.name));

  const nothingAtAll = sortedActions.length === 0 && subjectRows.length === 0;

  // ── Mark study step done ───────────────────────────────────────────────────
  const markStudyDone = (sys: StudySystem, taskKey: 'contentCompleted' | 'qbankDone') => {
    const subject = subjects.find(s => s.id === sys.subjectId)!;

    if (taskKey === 'contentCompleted') {
      if (!sys.contentInitialized) {
        setInitValue('');
        setInitSys({ sys, subject, taskKey });
        return;
      }
      const newCompleted = sys.contentUnitsCompleted + 1;
      const isNowDone    = newCompleted >= sys.contentUnitsTotal;
      updateSystem(sys.id!, { contentUnitsCompleted: newCompleted, contentCompleted: isNowDone });
      if (isNowDone) {
        if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
        logCompletion({ subjectId: subject.id!, subjectName: subject.name, systemId: sys.id!, systemName: sys.name, taskKey: 'contentDone', taskLabel: 'Content', completedAt: new Date() });
      }
    } else {
      updateSystem(sys.id!, { qbankDone: true });
      logCompletion({ subjectId: subject.id!, subjectName: subject.name, systemId: sys.id!, systemName: sys.name, taskKey: 'qbankDone', taskLabel: 'QBank', completedAt: new Date() });
    }
  };

  // Action row version (same logic, via ActionItem)
  const markActionStudy = (item: ActionItem) => {
    markStudyDone(item.system, item.kind === 'content' ? 'contentCompleted' : 'qbankDone');
  };

  const handleInitSave = () => {
    if (!initSys) return;
    const total = parseInt(initValue, 10);
    if (!total || total <= 0) return;
    updateSystem(initSys.sys.id!, { contentInitialized: true, contentUnitsTotal: total, contentUnitsCompleted: 0, contentCompleted: false });
    setInitSys(null); setInitValue('');
  };

  // ── Revision ───────────────────────────────────────────────────────────────
  const openRevDialog = (sys: StudySystem, subject: Subject) => {
    setRevTarget({ sys, subject });
    setShowRevDialog(true);
  };
  const markActionRevision = (item: ActionItem) => openRevDialog(item.system, item.subject);

  const handleRevisionConfidence = async (confidence: SystemStatus) => {
    setShowRevDialog(false);
    if (!revTarget) return;
    await completeRevision(
      revTarget.sys.id!, confidence,
      revTarget.subject.id!, revTarget.subject.name, revTarget.sys.name,
    );
    setRevTarget(null);
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight mb-2">
          Today's Focus
        </h1>
        <p className="text-sm text-muted-foreground">What should you work on right now?</p>
      </header>

      {nothingAtAll ? (
        /* ── All done ───────────────────────────────────────────────────── */
        <div className="text-center py-20 px-4 bg-muted/20 rounded-3xl border border-dashed mt-4 flex flex-col items-center">
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
            <div className="relative bg-primary text-primary-foreground rounded-full p-4 shadow-lg">
              <Trophy className="w-10 h-10" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">All caught up!</h2>
          <p className="text-muted-foreground mb-8 max-w-[280px]">
            No pending study steps and no revisions due. Take a well-deserved break.
          </p>
          <Link href="/">
            <button className="bg-card border shadow-sm px-6 py-3 rounded-xl font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />View Dashboard
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Action Required ──────────────────────────────────────────── */}
          {sortedActions.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pl-1">
                Action Required
              </h2>
              <div className="space-y-2">
                {sortedActions.map((item, idx) => (
                  <ActionRow
                    key={`${item.kind}-${item.system.id}-${idx}`}
                    item={item}
                    onMarkStudy={markActionStudy}
                    onMarkRevision={markActionRevision}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Subjects ─────────────────────────────────────────────────── */}
          {subjectRows.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pl-1">
                Subjects
              </h2>
              <div className="space-y-2">
                {subjectRows.map(row => (
                  <SubjectSection
                    key={row.subject.id}
                    row={row}
                    expanded={!!expanded[row.subject.id!]}
                    onToggle={() => toggleSubject(row.subject.id!)}
                    onMarkStudy={markStudyDone}
                    onMarkRevision={openRevDialog}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Content init dialog ────────────────────────────────────────────── */}
      <Dialog open={!!initSys} onOpenChange={open => { if (!open) setInitSys(null); }}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              How many content units does this system have?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus type="number" min="1" placeholder="e.g. 15"
              value={initValue} onChange={e => setInitValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInitSave(); } }}
              className="text-lg py-6 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInitSys(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleInitSave} disabled={!initValue || parseInt(initValue, 10) <= 0} className="rounded-xl font-semibold px-8 shadow-sm">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revision confidence dialog ─────────────────────────────────────── */}
      <ConfidenceDialog
        open={showRevDialog}
        title="How well do you know this system?"
        subtitle={revTarget ? `Rate your confidence for ${revTarget.sys.name} after this revision.` : undefined}
        onSelect={handleRevisionConfidence}
        onClose={() => { setShowRevDialog(false); setRevTarget(null); }}
      />
    </div>
  );
}
