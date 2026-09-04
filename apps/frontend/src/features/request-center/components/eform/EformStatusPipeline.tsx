import React from 'react';
import { Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EFormStatus, getStatusConfig } from './eform-vocabulary';

// Re-exported so existing `import { EFormStatus } from './EformStatusPipeline'` keeps working.
export { EFormStatus };

interface Step {
  id: EFormStatus;
  label: string;
  /** What happens at this step, in the user's words. */
  detail: string;
}

const pipelineSteps: Step[] = [
  { id: EFormStatus.DRAFT, label: 'Diajukan', detail: 'Formulir dikirim pemohon' },
  { id: EFormStatus.PENDING_MANAGER, label: 'Atasan', detail: 'Menunggu persetujuan' },
  { id: EFormStatus.PENDING_ICT, label: 'Tim ICT', detail: 'Akses disiapkan' },
  { id: EFormStatus.CONFIRMED, label: 'Selesai', detail: 'Kredensial tersedia' },
];

interface EformStatusPipelineProps {
  currentStatus: EFormStatus;
  formType?: string;
  rejectionReason?: string;
}

export const EformStatusPipeline: React.FC<EformStatusPipelineProps> = ({
  currentStatus,
  rejectionReason,
}) => {
  const isRejected = currentStatus === EFormStatus.REJECTED;

  const currentIndex = isRejected
    ? pipelineSteps.findIndex(s => s.id === EFormStatus.PENDING_MANAGER)
    : pipelineSteps.findIndex(s => s.id === currentStatus);

  const status = getStatusConfig(currentStatus);
  const progressPct = currentIndex <= 0 ? 0 : (currentIndex / (pipelineSteps.length - 1)) * 100;

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">{status.label}</h2>
        <p className="text-sm text-muted-foreground">{status.hint}</p>
      </div>

      <ol className="relative flex justify-between gap-2">
        {/* Rail */}
        <div className="absolute left-4 right-4 sm:left-5 sm:right-5 top-4 sm:top-5 h-px bg-border" aria-hidden="true">
          {!isRejected && (
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          )}
        </div>

        {pipelineSteps.map((step, index) => {
          const isActive = index === currentIndex && !isRejected;
          const isCompleted = index < currentIndex && !isRejected;

          return (
            <li
              key={step.id}
              className="relative z-10 flex flex-1 flex-col items-center text-center"
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border text-xs sm:text-sm font-bold transition-colors shrink-0',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary bg-background text-primary ring-3 sm:ring-4 ring-primary/15',
                  !isActive && !isCompleted && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  'mt-2 sm:mt-3 text-xs sm:text-sm font-bold truncate max-w-full px-0.5',
                  isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
              <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                {step.detail}
              </span>
            </li>
          );
        })}
      </ol>

      {isRejected && (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <Ban size={18} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-destructive">Permintaan ditolak</h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {rejectionReason || 'Tidak ada alasan penolakan yang diberikan.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
