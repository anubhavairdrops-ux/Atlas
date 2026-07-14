import { useState, useMemo } from 'react';
import { useSubjects, useAllSystems } from '@/db/hooks';
import { StudySystem } from '@/db/database';
import { Link } from 'wouter';
import { Search as SearchIcon, BookOpen, LayoutList, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isRevisionDue, isRevisionOverdue } from '@/db/revisionEngine';
import { format } from 'date-fns';

// ── Keyword taxonomy ──────────────────────────────────────────────────────────
type Keyword = 'strong' | 'average' | 'weak' | 'revision' | 'due' | 'overdue' | 'completed';

const KEYWORDS: Keyword[] = ['strong', 'average', 'weak', 'revision', 'due', 'overdue', 'completed'];

function extractKeywords(q: string): { keywords: Keyword[]; freeText: string } {
  const words = q.toLowerCase().trim().split(/\s+/);
  const keywords: Keyword[] = [];
  const rest: string[] = [];
  for (const w of words) {
    if ((KEYWORDS as string[]).includes(w)) keywords.push(w as Keyword);
    else rest.push(w);
  }
  return { keywords, freeText: rest.join(' ') };
}

function systemMatchesKeywords(sys: StudySystem, keywords: Keyword[]): boolean {
  if (keywords.length === 0) return true;
  return keywords.every(kw => {
    switch (kw) {
      case 'strong':    return sys.status === 'Strong';
      case 'average':   return sys.status === 'Average';
      case 'weak':      return sys.status === 'Weak';
      case 'revision':  return Boolean(sys.completionDate);
      case 'due':       return isRevisionDue(sys);
      case 'overdue':   return isRevisionOverdue(sys);
      case 'completed': return sys.contentCompleted && sys.qbankDone;
    }
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ sys }: { sys: StudySystem }) {
  const colors = {
    Strong:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Average: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Weak:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0', colors[sys.status])}>
      {sys.status}
    </span>
  );
}

// ── Revision indicator ────────────────────────────────────────────────────────
function RevisionIndicator({ sys }: { sys: StudySystem }) {
  if (!sys.completionDate) return null;
  const overdue = isRevisionOverdue(sys);
  const due     = isRevisionDue(sys);
  if (overdue) return (
    <span className="flex items-center gap-1 text-[10px] text-destructive font-semibold shrink-0">
      <AlertCircle className="w-3 h-3" />Overdue
    </span>
  );
  if (due) return (
    <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold shrink-0">
      <Clock className="w-3 h-3" />Due today
    </span>
  );
  if (sys.nextRevisionDate) return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
      <Clock className="w-3 h-3" />{format(new Date(sys.nextRevisionDate), 'MMM d')}
    </span>
  );
  return null;
}

// ── Keyword chip ──────────────────────────────────────────────────────────────
function KeywordChip({ kw, active, onToggle }: { kw: Keyword; active: boolean; onToggle: (kw: Keyword) => void }) {
  return (
    <button
      onClick={() => onToggle(kw)}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize',
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted',
      )}
    >
      {kw}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Search() {
  const [query, setQuery]       = useState('');
  const [activeKws, setActiveKws] = useState<Set<Keyword>>(new Set());
  const subjects = useSubjects();
  const systems  = useAllSystems();

  const toggleKw = (kw: Keyword) => {
    setActiveKws(prev => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw); else next.add(kw);
      return next;
    });
  };

  const results = useMemo(() => {
    const { keywords: qKeywords, freeText } = extractKeywords(query);
    const allKeywords = [...qKeywords, ...activeKws];
    const ft = freeText.toLowerCase().trim();
    const hasFilter = ft || allKeywords.length > 0;
    if (!hasFilter) return { subjects: [], systems: [] };

    const matchedSubjects = ft
      ? subjects.filter(s => s.name.toLowerCase().includes(ft))
      : [];

    const matchedSystems = systems
      .filter(sys => {
        const nameMatch = ft ? sys.name.toLowerCase().includes(ft) : true;
        const kwMatch   = systemMatchesKeywords(sys, allKeywords);
        return nameMatch && kwMatch;
      })
      .map(sys => {
        const sub = subjects.find(s => s.id === sys.subjectId);
        return { ...sys, subjectName: sub?.name ?? 'Unknown' };
      });

    return { subjects: matchedSubjects, systems: matchedSystems };
  }, [query, activeKws, subjects, systems]);

  const hasQuery = query.trim() || activeKws.size > 0;

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto flex flex-col">
      {/* Search bar */}
      <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-4 -mx-4 px-4 mb-2 space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="strong medicine, overdue, weak surgery…"
            className="w-full pl-12 py-6 text-base rounded-2xl bg-card border-card-border shadow-sm focus-visible:ring-primary placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Keyword chips */}
        <div className="flex flex-wrap gap-2">
          {KEYWORDS.map(kw => (
            <KeywordChip key={kw} kw={kw} active={activeKws.has(kw)} onToggle={toggleKw} />
          ))}
        </div>
      </div>

      <div className="flex-1 mt-2">
        {!hasQuery ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground mt-20">
            <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">Type or tap a filter to search</p>
          </div>
        ) : results.subjects.length === 0 && results.systems.length === 0 ? (
          <div className="text-center mt-20 text-muted-foreground">
            <p>No results{query.trim() ? ` for "${query.trim()}"` : ''}</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Subjects */}
            {results.subjects.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Subjects
                </h3>
                <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y">
                  {results.subjects.map(sub => (
                    <Link key={sub.id} href={`/subjects/${sub.id}`}>
                      <div className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group">
                        <span className="font-semibold text-foreground">{sub.name}</span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Systems */}
            {results.systems.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <LayoutList className="w-4 h-4" /> Systems
                  <span className="ml-auto text-xs font-normal normal-case tracking-normal">{results.systems.length}</span>
                </h3>
                <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y">
                  {results.systems.map(sys => (
                    <Link key={sys.id} href={`/subjects/${sys.subjectId}`}>
                      <div className="p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 cursor-pointer group">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground mb-1 truncate">{sys.name}</div>
                          <div className="text-xs text-muted-foreground font-medium">{sys.subjectName}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge sys={sys} />
                          <RevisionIndicator sys={sys} />
                          <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
