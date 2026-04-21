import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { HardwareRequestItem, ItemProcurementDecision } from '../../types';
import { cn } from '@/lib/utils';

interface ItemDecisionListProps {
  items: HardwareRequestItem[];
  decisions?: Record<string, ItemProcurementDecision | null>;
  onChange: (itemId: string, decision: ItemProcurementDecision) => void;
  disabled?: boolean;
}

export function ItemDecisionList({ items, decisions, onChange, disabled }: ItemDecisionListProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const current = decisions?.[item.id] ?? item.procurementDecision ?? null;
        return (
          <motion.div
            key={item.id}
            layout
            className={cn(
              'flex items-center justify-between rounded-2xl border bg-card/80 px-4 py-3 transition-colors backdrop-blur',
              current === 'APPROVED' && 'border-l-4 border-l-success border-success/40',
              current === 'REJECTED' && 'border-l-4 border-l-destructive border-destructive/40 opacity-70',
              !current && 'border-border/40',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name || item.categorySnapshot?.name || 'Item'}</p>
              <p className="text-sm text-muted-foreground">qty: {item.quantity}</p>
            </div>
            <div className="flex items-center gap-2">
              <DecisionButton
                label="approve"
                active={current === 'APPROVED'}
                color="success"
                onClick={() => onChange(item.id, 'APPROVED')}
                disabled={disabled}
              >
                <Check className="h-4 w-4" />
              </DecisionButton>
              <DecisionButton
                label="reject"
                active={current === 'REJECTED'}
                color="destructive"
                onClick={() => onChange(item.id, 'REJECTED')}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </DecisionButton>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

interface DecisionButtonProps {
  label: string;
  active: boolean;
  color: 'success' | 'destructive';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function DecisionButton({ label, active, color, onClick, disabled, children }: DecisionButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      role="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
        active && color === 'success' && 'border-success bg-success text-success-foreground',
        active && color === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
        !active && 'border-border/40 bg-background hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </motion.button>
  );
}
