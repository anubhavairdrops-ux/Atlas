import { useState } from 'react';
import { useSubjects, useAllSystems, addSubject } from '@/db/hooks';
import { SubjectCard } from '@/components/SubjectCard';
import { AddDialog } from '@/components/AddDialog';
import { Plus, BookOpen, Layers } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';

export default function Home() {
  const subjects = useSubjects();
  const systems = useAllSystems();
  const [showAddSubject, setShowAddSubject] = useState(false);

  const totalTasks = systems.length * 2;
  const completedTasks = systems.reduce((acc, sys) => {
    let done = 0;
    if (sys.contentCompleted) done++;
    if (sys.qbankDone) done++;
    return acc + done;
  }, 0);

  const overallProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const pendingTasks = totalTasks - completedTasks;

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-[44px] leading-tight font-bold text-foreground tracking-tight mb-2">Atlas</h1>
        <p className="text-base text-muted-foreground">Welcome back. Stay focused, stay consistent.</p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 mb-10">
        <div className="col-span-2 bg-primary/10 rounded-2xl p-5 border border-primary/20">
          <div className="flex justify-between items-end mb-2">
            <h2 className="font-semibold text-primary/80">Overall Progress</h2>
            <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
          </div>
          <ProgressBar progress={overallProgress} className="h-3 bg-primary/20" />
          <p className="text-xs text-primary/70 mt-3 font-medium">{completedTasks} of {totalTasks} tasks completed</p>
        </div>

        <div className="bg-card rounded-2xl p-4 border shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Subjects</span>
          </div>
          <span className="text-3xl font-bold text-foreground">{subjects.length}</span>
        </div>

        <div className="bg-card rounded-2xl p-4 border shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-amber-600/80">
            <Layers className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
          </div>
          <span className="text-3xl font-bold text-amber-700 dark:text-amber-500">{pendingTasks}</span>
        </div>
      </section>

      {/* Subjects List */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-bold text-foreground tracking-tight">Your Subjects</h2>
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Ready to begin?</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-[250px] mx-auto">
              Create your first subject to start organizing your study material.
            </p>
            <button
              onClick={() => setShowAddSubject(true)}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors"
            >
              Add Subject
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {subjects.map(subject => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                systems={systems.filter(s => s.subjectId === subject.id)}
              />
            ))}
          </div>
        )}
      </section>

      {subjects.length > 0 && (
        <button
          onClick={() => setShowAddSubject(true)}
          className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
          aria-label="Add Subject"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <AddDialog
        open={showAddSubject}
        onOpenChange={setShowAddSubject}
        title="New Subject"
        placeholder="e.g. Internal Medicine"
        onSave={addSubject}
      />
    </div>
  );
}
