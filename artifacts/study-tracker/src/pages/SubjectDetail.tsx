import { useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useSubject, useSystemsBySubject, addSystem, updateSubject, deleteSubject } from '@/db/hooks';
import { SystemCard } from '@/components/SystemCard';
import { AddDialog } from '@/components/AddDialog';
import { ProgressBar } from '@/components/ProgressBar';
import { StageDonut } from '@/components/StageDonut';
import { ChevronLeft, Plus, Trash2, Edit2, LayoutList } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudySystem } from '@/db/database';

type StageKey = 'contentCompleted' | 'qbankDone';

const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: 'contentCompleted', label: 'Content', color: '#3b82f6' },
  { key: 'qbankDone',        label: 'QBank',   color: '#10b981' },
];

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const subjectId = parseInt(id || '0', 10);
  const [, setLocation] = useLocation();

  const subject = useSubject(subjectId);
  const systems = useSystemsBySubject(subjectId);

  const [showAddSystem, setShowAddSystem] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [activeFilter, setActiveFilter] = useState<StageKey | null>(null);

  if (!subject && id) {
    return <div className="p-8 text-center text-muted-foreground mt-20">Loading or subject not found.</div>;
  }
  if (!subject) return null;

  // Overall progress (2 steps per system)
  const totalTasks = systems.length * 2;
  const completedTasks = systems.reduce((acc, sys) => {
    let done = 0;
    if (sys.contentCompleted) done++;
    if (sys.qbankDone) done++;
    return acc + done;
  }, 0);
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Per-stage percentages (% of systems that have completed this stage)
  const stagePct = (key: StageKey) => {
    if (systems.length === 0) return 0;
    const done = systems.filter(s => s[key]).length;
    return Math.round((done / systems.length) * 100);
  };

  // Filtered systems (show systems missing the active filter stage)
  const visibleSystems: StudySystem[] = activeFilter
    ? systems.filter(s => !s[activeFilter])
    : systems;

  const handleDonutClick = (key: StageKey) => {
    setActiveFilter(prev => (prev === key ? null : key));
  };

  const handleSaveEdit = async () => {
    if (editName.trim()) {
      await updateSubject(subject.id!, editName.trim());
      setShowEdit(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this subject and all its systems? This cannot be undone.')) {
      await deleteSubject(subject.id!);
      setLocation('/');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-6 pb-24 max-w-3xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/">
            <button className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors focus:outline-none">
              <div className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onClick={() => { setEditName(subject.name); setShowEdit(true); }} className="gap-2 py-3 cursor-pointer">
                <Edit2 className="w-4 h-4" /> Rename Subject
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive gap-2 py-3 cursor-pointer">
                <Trash2 className="w-4 h-4" /> Delete Subject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight mb-4">{subject.name}</h1>

        {/* Overall progress card */}
        <div className="bg-card border shadow-sm p-4 rounded-2xl flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2 text-sm">
              <span className="font-semibold text-foreground">Progress</span>
              <span className="font-bold text-primary">{progress}%</span>
            </div>
            <ProgressBar progress={progress} className="h-2.5" />
          </div>
          <div className="h-10 w-px bg-border mx-2" />
          <div className="text-center min-w-[3rem]">
            <div className="text-xl font-bold text-foreground leading-none mb-1">{systems.length}</div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Systems</div>
          </div>
        </div>

        {/* Stage donuts */}
        {systems.length > 0 && (
          <div className="mt-3 bg-card border rounded-2xl px-3 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Learning Progress
            </p>
            <div className="grid grid-cols-2 gap-y-1">
              {STAGES.map(({ key, label, color }) => (
                <StageDonut
                  key={key}
                  label={label}
                  pct={stagePct(key)}
                  color={color}
                  active={activeFilter === key}
                  onClick={() => handleDonutClick(key)}
                />
              ))}
            </div>
            {activeFilter && (
              <p className="text-[11px] text-muted-foreground text-center mt-2 pb-0.5">
                Showing{' '}
                <span className="font-semibold text-foreground">{visibleSystems.length}</span>
                {' '}system{visibleSystems.length !== 1 ? 's' : ''} without{' '}
                <span className="font-medium" style={{ color: STAGES.find(s => s.key === activeFilter)!.color }}>
                  {STAGES.find(s => s.key === activeFilter)!.label}
                </span>
                {' '}— tap again to clear
              </p>
            )}
          </div>
        )}
      </header>

      {/* Systems list */}
      <section>
        {systems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-dashed mt-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No systems yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-[250px] mx-auto">
              Break down {subject.name} into smaller, manageable systems or topics.
            </p>
            <button
              onClick={() => setShowAddSystem(true)}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors"
            >
              Add First System
            </button>
          </div>
        ) : visibleSystems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-muted/30 rounded-3xl border border-dashed">
            <p className="text-foreground font-semibold mb-1">All systems complete</p>
            <p className="text-sm text-muted-foreground">
              Every system has{' '}
              <span className="font-medium" style={{ color: STAGES.find(s => s.key === activeFilter)!.color }}>
                {STAGES.find(s => s.key === activeFilter)!.label}
              </span>{' '}
              done.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleSystems.map(system => (
              <SystemCard key={system.id} system={system} subjectName={subject.name} />
            ))}
          </div>
        )}
      </section>

      {/* FAB */}
      {systems.length > 0 && (
        <button
          onClick={() => setShowAddSystem(true)}
          className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
          aria-label="Add System"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <AddDialog
        open={showAddSystem}
        onOpenChange={setShowAddSystem}
        title="New System"
        placeholder="e.g. Cardiology"
        onSave={(name) => addSystem(subject.id!, name)}
      />

      {/* Rename dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Rename Subject</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="text-lg py-6 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEdit(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim() || editName === subject.name}
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
