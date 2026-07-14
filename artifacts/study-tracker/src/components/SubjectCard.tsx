import { Link } from 'wouter';
import { Subject, StudySystem } from '@/db/database';
import { ProgressBar } from './ProgressBar';
import { ChevronRight } from 'lucide-react';

interface SubjectCardProps {
  subject: Subject;
  systems: StudySystem[];
}

export function SubjectCard({ subject, systems }: SubjectCardProps) {
  const totalTasks = systems.length * 2;
  const completedTasks = systems.reduce((acc, sys) => {
    let done = 0;
    if (sys.contentCompleted) done++;
    if (sys.qbankDone) done++;
    return acc + done;
  }, 0);

  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <Link href={`/subjects/${subject.id}`}>
      <div className="group block w-full bg-card hover:bg-card/90 transition-all rounded-2xl p-5 shadow-sm border border-card-border/50 hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-[23px] leading-tight text-card-foreground">{subject.name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </div>

        <ProgressBar progress={progress} className="h-2.5" />

        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          <span>{systems.length} systems</span>
          <span>{completedTasks}/{totalTasks} tasks</span>
        </div>
      </div>
    </Link>
  );
}
