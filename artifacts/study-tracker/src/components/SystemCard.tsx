import { useRef, useState } from 'react';
import { StudySystem } from '@/db/database';
import { updateSystem, deleteSystem, logCompletion } from '@/db/hooks';
import { ProgressBar } from './ProgressBar';
import { ChevronDown, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SystemCardProps {
  system: StudySystem;
  subjectName: string;
}

// ── Circular progress indicator ─────────────────────────────────────────────
function ContentCircle({ pct }: { pct: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      className="shrink-0 -rotate-90"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-muted-foreground/25"
      />
      {/* Progress arc */}
      {pct > 0 && (
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className="text-primary transition-all duration-300"
        />
      )}
    </svg>
  );
}

// ── SystemCard ───────────────────────────────────────────────────────────────
export function SystemCard({ system, subjectName }: SystemCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Content dialogs
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [initValue, setInitValue] = useState('');
  const [showEditContent, setShowEditContent] = useState(false);
  const [editCompleted, setEditCompleted] = useState('');
  const [editTotal, setEditTotal] = useState('');

  // Long-press detection for the Content row
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  // Progress
  const completedCount = (system.contentCompleted ? 1 : 0) + (system.qbankDone ? 1 : 0);
  const progress = (completedCount / 2) * 100;

  const contentPct =
    system.contentInitialized && system.contentUnitsTotal > 0
      ? (system.contentUnitsCompleted / system.contentUnitsTotal) * 100
      : 0;

  // ── Content tap ────────────────────────────────────────────────────────────
  const handleContentTap = () => {
    if (isLongPress.current) return; // consumed by long press

    if (!system.contentInitialized) {
      setInitValue('');
      setShowInitDialog(true);
      return;
    }
    if (system.contentCompleted) return; // done — edit via long press

    const newCompleted = system.contentUnitsCompleted + 1;
    const isNowDone = newCompleted >= system.contentUnitsTotal;

    updateSystem(system.id!, {
      contentUnitsCompleted: newCompleted,
      contentCompleted: isNowDone,
    });

    if (isNowDone) {
      if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
      logCompletion({
        subjectId: system.subjectId,
        subjectName,
        systemId: system.id!,
        systemName: system.name,
        taskKey: 'contentDone',
        taskLabel: 'Content',
        completedAt: new Date(),
      });
    }
  };

  const handleContentPointerDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      setEditCompleted(String(system.contentUnitsCompleted));
      setEditTotal(String(system.contentUnitsTotal));
      setShowEditContent(true);
    }, 500);
  };

  const handleContentPointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleContentPointerLeave = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // ── Content init ───────────────────────────────────────────────────────────
  const handleInitSave = () => {
    const total = parseInt(initValue, 10);
    if (!total || total <= 0) return;
    updateSystem(system.id!, {
      contentInitialized: true,
      contentUnitsTotal: total,
      contentUnitsCompleted: 0,
      contentCompleted: false,
    });
    setShowInitDialog(false);
    setInitValue('');
  };

  // ── Content edit ───────────────────────────────────────────────────────────
  const handleEditSave = () => {
    const total = parseInt(editTotal, 10);
    const completed = parseInt(editCompleted, 10);
    if (isNaN(total) || total <= 0 || isNaN(completed) || completed < 0) return;
    const clamped = Math.min(completed, total);
    const isNowDone = clamped >= total;
    updateSystem(system.id!, {
      contentInitialized: true,
      contentUnitsTotal: total,
      contentUnitsCompleted: clamped,
      contentCompleted: isNowDone,
    });
    setShowEditContent(false);
  };

  const handleEditReset = () => {
    updateSystem(system.id!, {
      contentInitialized: false,
      contentUnitsTotal: 0,
      contentUnitsCompleted: 0,
      contentCompleted: false,
    });
    setShowEditContent(false);
  };

  // ── QBank toggle ───────────────────────────────────────────────────────────
  const toggleQBank = () => {
    const wasChecked = system.qbankDone;
    updateSystem(system.id!, { qbankDone: !wasChecked });
    if (!wasChecked) {
      logCompletion({
        subjectId: system.subjectId,
        subjectName,
        systemId: system.id!,
        systemName: system.name,
        taskKey: 'qbankDone',
        taskLabel: 'Qbank',
        completedAt: new Date(),
      });
    }
  };

  const handleStatusChange = (status: 'Strong' | 'Average' | 'Weak') => {
    updateSystem(system.id!, { status });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSystem(system.id!, { weakAreas: e.target.value });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this system?')) {
      deleteSystem(system.id!);
    }
  };

  const statusColors = {
    Strong: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50',
    Average: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
    Weak: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50',
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden transition-all duration-300">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors focus:outline-none"
        >
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-semibold text-[23px] leading-tight text-foreground">{system.name}</h4>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border', statusColors[system.status])}>
                {system.status}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ProgressBar progress={progress} className="flex-1 h-1.5" />
              <span className="text-xs font-medium text-muted-foreground min-w-[3ch]">{completedCount}/2</span>
            </div>
          </div>
          <div className={cn('p-2 rounded-full bg-secondary/50 text-secondary-foreground transition-transform duration-300', expanded && 'rotate-180')}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>

        {/* Expanded content */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="p-4 pt-0 border-t border-border/50 bg-card">
              <div className="grid gap-2 py-4">

                {/* ── Content row ── */}
                <div
                  className={cn(
                    'flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left select-none',
                    !system.contentCompleted && 'hover:bg-muted/50 cursor-pointer',
                    system.contentCompleted && 'cursor-default',
                  )}
                  onClick={handleContentTap}
                  onPointerDown={handleContentPointerDown}
                  onPointerUp={handleContentPointerUp}
                  onPointerLeave={handleContentPointerLeave}
                  onContextMenu={e => e.preventDefault()}
                >
                  {system.contentCompleted ? (
                    // Completed: no circle, no fraction, strikethrough
                    <div className="w-[22px] h-[22px] shrink-0" />
                  ) : (
                    <ContentCircle pct={contentPct} />
                  )}

                  <span
                    className={cn(
                      'text-sm font-medium flex-1 transition-all duration-500',
                      system.contentCompleted
                        ? 'text-muted-foreground/40 line-through'
                        : 'text-foreground',
                    )}
                  >
                    Content
                  </span>

                  {system.contentInitialized && !system.contentCompleted && (
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {system.contentUnitsCompleted}/{system.contentUnitsTotal}
                    </span>
                  )}
                </div>

                {/* ── QBank row ── */}
                <button
                  onClick={toggleQBank}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 border-2',
                      system.qbankDone
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'border-muted-foreground/30 bg-background group-hover:border-primary/50',
                    )}
                  >
                    {system.qbankDone && <Check className="w-4 h-4" />}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors duration-200',
                      system.qbankDone ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    Qbank
                  </span>
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {/* Status selector */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Confidence Level
                  </label>
                  <div className="flex gap-2">
                    {(['Strong', 'Average', 'Weak'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={cn(
                          'flex-1 py-2 px-3 text-sm font-medium rounded-xl border transition-all',
                          system.status === s
                            ? statusColors[s] + ' ring-2 ring-offset-2 ring-background ring-offset-transparent shadow-sm'
                            : 'bg-background border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Weak Areas / Notes
                  </label>
                  <Textarea
                    value={system.weakAreas}
                    onChange={handleNotesChange}
                    placeholder="Note down concepts you struggle with..."
                    className="min-h-[100px] resize-none rounded-xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:border-primary"
                  />
                </div>

                {/* Delete */}
                <div className="flex justify-end pt-4 mt-2 border-t border-border/50">
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 font-medium px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete System
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Init dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">How many content units does this system have?</DialogTitle>
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
            <Button variant="ghost" onClick={() => setShowInitDialog(false)} className="rounded-xl">Cancel</Button>
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

      {/* ── Edit dialog (long press) ─────────────────────────────────────── */}
      <Dialog open={showEditContent} onOpenChange={setShowEditContent}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Content Progress</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Completed Units
              </label>
              <Input
                autoFocus
                type="number"
                min="0"
                value={editCompleted}
                onChange={e => setEditCompleted(e.target.value)}
                className="text-lg py-5 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Total Units
              </label>
              <Input
                type="number"
                min="1"
                value={editTotal}
                onChange={e => setEditTotal(e.target.value)}
                className="text-lg py-5 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex gap-2 w-full">
              <Button variant="ghost" onClick={() => setShowEditContent(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button
                onClick={handleEditSave}
                disabled={
                  !editTotal || parseInt(editTotal, 10) <= 0 ||
                  !editCompleted || parseInt(editCompleted, 10) < 0
                }
                className="flex-1 rounded-xl font-semibold shadow-sm"
              >
                Save
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={handleEditReset}
              className="w-full rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            >
              Reset Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
