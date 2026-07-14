import { SystemStatus } from '@/db/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfidenceDialogProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onSelect: (confidence: SystemStatus) => void;
  onClose?: () => void;
}

const OPTIONS: { value: SystemStatus; emoji: string; label: string; bg: string; border: string; text: string }[] = [
  {
    value:  'Strong',
    emoji:  '🟢',
    label:  'Strong',
    bg:     'hover:bg-green-50 dark:hover:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800/50 hover:border-green-400 dark:hover:border-green-600',
    text:   'text-green-800 dark:text-green-400',
  },
  {
    value:  'Average',
    emoji:  '🟡',
    label:  'Average',
    bg:     'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600',
    text:   'text-amber-800 dark:text-amber-400',
  },
  {
    value:  'Weak',
    emoji:  '🔴',
    label:  'Weak',
    bg:     'hover:bg-red-50 dark:hover:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/50 hover:border-red-400 dark:hover:border-red-600',
    text:   'text-red-800 dark:text-red-400',
  },
];

export function ConfidenceDialog({
  open,
  title = 'How well do you know this system?',
  subtitle,
  onSelect,
  onClose,
}: ConfidenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={open => { if (!open && onClose) onClose(); }}>
      <DialogContent className="sm:max-w-[380px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-snug">{title}</DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </DialogHeader>
        <div className="py-4 space-y-3">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={cn(
                'w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all duration-150 text-left',
                'bg-card active:scale-[0.98]',
                opt.bg,
                opt.border,
              )}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              <span className={cn('text-base font-semibold', opt.text)}>{opt.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
