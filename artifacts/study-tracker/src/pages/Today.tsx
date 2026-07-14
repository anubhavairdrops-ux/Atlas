import { useState, useRef } from 'react';
import { useSubjects, useAllSystems, updateSystem, logCompletion } from '@/db/hooks';
import { Subject, StudySystem } from '@/db/database';
import { Check, CheckCircle2, Trophy, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Ordered workflow — 2 steps per system
const WORKFLOW: { key: 'contentCompleted' | 'qbankDone'; label: string }[] = [
  { key: 'contentCompleted', label: 'Content' },
  { key: 'qbankDone',        label: 'Qbank'   },
];

const STEP_COLORS: Record<string, string> = {
  contentCompleted: 'bg-sky-100    text-sky-800    dark:bg-sky-900/30    dark:text-sky-400',
  qbankDone:        'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

type NextTask = {
  system: StudySystem;
  subject: Subject;
  taskKey: 'contentCompleted' | 'qbankDone';
  taskLabel: string;
  stepIndex: number;
};

export default function Today() {
  const subjects = useSubjects();
  const systems  = useAllSystems();

  // Content init dialog — triggered when tapping an un-initialized content row
  const [initTarget, setInitTarget] = useState<NextTask | null>(null);
  const [initValue, setInitValue]   = useState('');

  // For each system find the first incomplete step
  const nextTasks: NextTask[] = [];
  systems.forEach(sys => {
    const subject = subjects.find(s => s.id === sys.subjectId);
    if (!subject) return;
    const nextStep = WORKFLOW.find(step => !sys[step.key]);
    if (!nextStep) return;
    nextTasks.push({
      system: sys,
      subject,
      taskKey: nextStep.key,
      taskLabel: nextStep.label,
      stepIndex: WORKFLOW.indexOf(nextStep),
    });
  });

  // Group by subject, alphabetically
  const grouped: Record<number, { subject: Subject; tasks: NextTask[] }> = {};
  nextTasks.forEach(item => {
    const sid = item.subject.id!;
    if (!grouped[sid]) grouped[sid] = { subject: item.subject, tasks: [] };
    grouped[sid].tasks.push(item);
  });
  const subjectGroups = Object.values(grouped).sort((a, b) =>
    a.subject.name.localeCompare(b.subject.name),
  );

  // ── Mark done ────────────────────────────────────────────────────────────
  const markDone = (item: NextTask) => {
    if (item.taskKey === 'contentCompleted') {
      const sys = item.system;

      // Not yet initialized — ask for unit count first
      if (!sys.contentInitialized) {
        setInitValue('');
        setInitTarget(item);
        return;
      }

      // Increment
      const newCompleted = sys.contentUnitsCompleted + 1;
      const isNowDone    = newCompleted >= sys.contentUnitsTotal;
      updateSystem(sys.id!, {
        contentUnitsCompleted: newCompleted,
        contentCompleted: isNowDone,
      });

      if (isNowDone) {
        if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
        logCompletion({
          subjectId:   item.subject.id!,
          subjectName: item.subject.name,
          systemId:    sys.id!,
          systemName:  sys.name,
          taskKey:     'contentDone',
          taskLabel:   'Content',
          completedAt: new Date(),
        });
      }
    } else {
      // QBank — simple toggle to done
      updateSystem(item.system.id!, { [item.taskKey]: true });
      logCompletion({
        subjectId:   item.subject.id!,
        subjectName: item.subject.name,
        systemId:    item.system.id!,
        systemName:  item.system.name,
        taskKey:     item.taskKey,
        taskLabel:   item.taskLabel,
        completedAt: new Date(),
      });
    }
  };

  // ── Content init save ─────────────────────────────────────────────────────
  const handleInitSave = () => {
    if (!initTarget) return;
    const total = parseInt(initValue, 10);
    if (!total || total <= 0) return;
    updateSystem(initTarget.system.id!, {
      contentInitialized: true,
      contentUnitsTotal: total,
      contentUnitsCompleted: 0,
      contentCompleted: false,
    });
    setInitTarget(null);
    setInitValue('');
  };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight mb-2">Today's Focus</h1>
        <p className="text-sm text-muted-foreground">
          The next step to complete for each system, in workflow order.
        </p>
      </header>

      {subjectGroups.length === 0 ? (
        <div className="text-center py-20 px-4 bg-muted/20 rounded-3xl border border-dashed mt-12 flex flex-col items-center">
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
            <div className="relative bg-primary text-primary-foreground rounded-full p-4 shadow-lg">
              <Trophy className="w-10 h-10" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">All caught up!</h2>
          <p className="text-muted-foreground mb-8 max-w-[280px]">
            Every system has completed all steps. Take a well-deserved break.
          </p>
          <Link href="/">
            <button className="bg-card border shadow-sm px-6 py-3 rounded-xl font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              View Dashboard
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {subjectGroups.map(({ subject, tasks }) => (
            <div key={subject.id}>
              <h2 className="text-lg font-bold text-foreground mb-4 pl-4 border-l-4 border-primary">
                {subject.name}
              </h2>

              <div className="space-y-3 pl-4">
                {tasks.map(item => {
                  const badgeClass = STEP_COLORS[item.taskKey] ?? '';
                  const nextStep   = WORKFLOW[item.stepIndex + 1];
                  const isContent  = item.taskKey === 'contentCompleted';
                  const sys        = item.system;

                  return (
                    <div
                      key={item.system.id}
                      className="bg-card rounded-2xl border shadow-sm p-4 flex items-center gap-4"
                    >
                      {/* Check button */}
                      <button
                        onClick={() => markDone(item)}
                        className={cn(
                          'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-200',
                          'border-muted-foreground/30 bg-background hover:border-primary hover:bg-primary/10',
                          'active:scale-90 active:bg-primary active:border-primary group',
                        )}
                        title={`Mark ${item.taskLabel} done`}
                      >
                        <Check className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-active:text-primary-foreground transition-colors" />
                      </button>

                      {/* System name + step info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{sys.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold', badgeClass)}>
                            {item.taskLabel}
                          </span>

                          {/* Content progress fraction */}
                          {isContent && sys.contentInitialized && (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {sys.contentUnitsCompleted}/{sys.contentUnitsTotal}
                            </span>
                          )}

                          {nextStep && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <ArrowRight className="w-3 h-3" />
                              {nextStep.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Step counter */}
                      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                        {item.stepIndex + 1} / {WORKFLOW.length}
                      </span>

                      {/* Deep-link */}
                      <Link href={`/subjects/${subject.id}`}>
                        <span className="shrink-0 text-xs text-primary font-medium hover:underline cursor-pointer">
                          View
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Content init dialog ──────────────────────────────────────────── */}
      <Dialog open={!!initTarget} onOpenChange={open => { if (!open) setInitTarget(null); }}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              How many content units does this system have?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              type="number"
              min="1"
              placeholder="e.g. 15"
              value={initValue}
              onChange={e => setInitValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleInitSave(); }
              }}
              className="text-lg py-6 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInitTarget(null)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleInitSave}
              disabled={!initValue || parseInt(initValue, 10) <= 0}
              className="rounded-xl font-semibold px-8 shadow-sm"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
