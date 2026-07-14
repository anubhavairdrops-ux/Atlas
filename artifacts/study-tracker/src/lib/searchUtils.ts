import { StudySystem, Subject } from '@/db/database';
import { isRevisionDue, isRevisionOverdue } from '@/db/revisionEngine';

export type Keyword = 'strong' | 'average' | 'weak' | 'revision' | 'due' | 'overdue' | 'completed';

export const KEYWORDS: Keyword[] = ['strong', 'average', 'weak', 'revision', 'due', 'overdue', 'completed'];

/** Split a raw query string into recognised keywords and remaining free text. */
export function extractKeywords(q: string): { keywords: Keyword[]; freeText: string } {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const keywords: Keyword[] = [];
  const rest: string[] = [];
  for (const w of words) {
    if ((KEYWORDS as string[]).includes(w)) keywords.push(w as Keyword);
    else rest.push(w);
  }
  return { keywords, freeText: rest.join(' ') };
}

/** True when a system satisfies ALL supplied keyword filters. */
export function systemMatchesKeywords(sys: StudySystem, keywords: Keyword[]): boolean {
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

export interface SearchResult {
  subjects: Subject[];
  systems: (StudySystem & { subjectName: string })[];
}

/**
 * Run the full search against subjects and systems.
 * Returns empty arrays when the query is blank.
 */
export function runSearch(
  rawQuery: string,
  subjects: Subject[],
  systems: StudySystem[],
): SearchResult {
  const { keywords, freeText } = extractKeywords(rawQuery);
  const ft = freeText.toLowerCase().trim();
  const hasFilter = ft.length > 0 || keywords.length > 0;
  if (!hasFilter) return { subjects: [], systems: [] };

  // Subjects — only matched by free text
  const matchedSubjects = ft
    ? subjects.filter(s => s.name.toLowerCase().includes(ft))
    : [];

  // Systems — must match free text (if any) AND all keywords (if any)
  const matchedSystems = systems
    .filter(sys => {
      const sub = subjects.find(s => s.id === sys.subjectId);
      const subName = sub?.name.toLowerCase() ?? '';
      const nameMatch = ft
        ? sys.name.toLowerCase().includes(ft) || subName.includes(ft)
        : true;
      return nameMatch && systemMatchesKeywords(sys, keywords);
    })
    .map(sys => {
      const sub = subjects.find(s => s.id === sys.subjectId);
      return { ...sys, subjectName: sub?.name ?? 'Unknown' };
    });

  return { subjects: matchedSubjects, systems: matchedSystems };
}
