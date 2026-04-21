import React from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, User, ShieldCheck, Database, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER_1 = 'PENDING_MANAGER_1',
  PENDING_MANAGER_2 = 'PENDING_MANAGER_2',
  PENDING_ICT = 'PENDING_ICT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
}

interface Step {
  id: EFormStatus;
  label: string;
  subLabel: string;
  icon: React.ElementType;
}

const pipelineSteps: Step[] = [
  { id: EFormStatus.DRAFT, label: 'Pengajuan', subLabel: 'User Draft', icon: User },
  { id: EFormStatus.PENDING_MANAGER_1, label: 'Atasan 1', subLabel: 'Manager Review', icon: ShieldCheck },
  { id: EFormStatus.PENDING_MANAGER_2, label: 'Atasan 2', subLabel: 'GM Review', icon: ShieldCheck },
  { id: EFormStatus.PENDING_ICT, label: 'Provisioning', subLabel: 'ICT Admin', icon: Database },
  { id: EFormStatus.CONFIRMED, label: 'Selesai', subLabel: 'Access Ready', icon: Check },
];

interface EformStatusPipelineProps {
  currentStatus: EFormStatus;
  formType?: string;
  rejectionReason?: string;
}

export const EformStatusPipeline: React.FC<EformStatusPipelineProps> = ({ 
  currentStatus,
  formType = 'VPN',
  rejectionReason 
}) => {
  const isRejected = currentStatus === EFormStatus.REJECTED;
  
  // Filter out MANAGER_2 for non-VPN forms
  const activeSteps = formType === 'VPN' 
    ? pipelineSteps 
    : pipelineSteps.filter(s => s.id !== EFormStatus.PENDING_MANAGER_2);

  const currentIndex = isRejected 
    ? activeSteps.findIndex(s => s.id === EFormStatus.PENDING_MANAGER_1) // Just as marker
    : activeSteps.findIndex(s => s.id === currentStatus);

  return (
    <div className="w-full py-8 px-4 overflow-x-auto">
      <div className="min-w-[700px] flex justify-between relative">
        {/* Background Connector Line */}
        <div className="absolute top-6 left-[5%] right-[5%] h-[2px] bg-border/40 -z-10" />
        
        {/* Active Connector Line */}
        {!isRejected && (
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(currentIndex / (activeSteps.length - 1)) * 90}%` }}
            className="absolute top-6 left-[5%] h-[2px] bg-primary/60 -z-10 shadow-[0_0_8px_rgba(45,74,140,0.3)]"
          />
        )}

        {activeSteps.map((step, index) => {
          const isActive = index === currentIndex && !isRejected;
          const isCompleted = index < currentIndex && !isRejected;
          const isPending = index > currentIndex && !isRejected;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center gap-3 relative z-10 w-32">
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.2 : 1,
                  backgroundColor: isCompleted ? 'var(--primary)' : isActive ? 'var(--background)' : 'var(--background)',
                  borderColor: isCompleted ? 'var(--primary)' : isActive ? 'var(--primary)' : 'var(--border)',
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-[opacity,transform,colors] duration-200 ease-out ",
                  isCompleted ? "text-white shadow-lg shadow-primary/20" : isActive ? "text-primary shadow-xl border-primary" : "text-muted-foreground/40"
                )}
              >
                {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                
                {isActive && (
                  <motion.div
                    layoutId="active-glow"
                    className="absolute inset-0 rounded-2xl bg-primary/10 -z-10"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
              </motion.div>

              <div className="text-center space-y-1">
                <p className={cn(
                  "text-[10px] font-extrabold uppercase tracking-widest",
                  isActive ? "text-primary" : isCompleted ? "text-primary/70" : "text-muted-foreground/40"
                )}>
                  {step.label}
                </p>
                <p className="text-[9px] opacity-40 font-bold leading-none">
                  {step.subLabel}
                </p>
              </div>

              {isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-6 flex items-center gap-1 text-[8px] font-black uppercase text-primary tracking-tighter"
                >
                  <Clock size={10} className="animate-spin-slow" /> Sedang Diproses
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {isRejected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-12 p-4 rounded-3xl bg-destructive/5 border-2 border-dashed border-destructive/20 flex items-start gap-4 mx-4"
        >
          <div className="h-10 w-10 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
            <Ban size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-destructive mb-1">Permintaan Ditolak</h4>
            <p className="text-sm font-medium text-destructive/80 italic">
              "{rejectionReason || 'Tidak ada alasan penolakan yang diberikan.'}"
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
