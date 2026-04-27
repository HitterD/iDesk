import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, User, ShieldCheck, Database, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER',
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
  { id: EFormStatus.PENDING_MANAGER, label: 'Atasan', subLabel: 'Manager Review', icon: ShieldCheck },
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
  const activeSteps = pipelineSteps;

  const currentIndex = isRejected
    ? activeSteps.findIndex(s => s.id === EFormStatus.PENDING_MANAGER)
    : activeSteps.findIndex(s => s.id === currentStatus);

  return (
    <div className="w-full py-8">
      <div className="overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="min-w-[600px] flex justify-between relative px-8">
          
          {/* Track Container */}
          <div className="absolute top-[26px] left-24 right-24 h-1.5 bg-muted rounded-full -z-10">
            {!isRejected && (
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(currentIndex / (activeSteps.length - 1)) * 100}%` }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/80 to-primary rounded-full shadow-[0_0_12px_rgba(45,74,140,0.4)]"
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}
          </div>

          {activeSteps.map((step, index) => {
            const isActive = index === currentIndex && !isRejected;
            const isCompleted = index < currentIndex && !isRejected;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center relative z-10 w-32 group">
                {/* Icon Container */}
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  className={cn(
                    "w-14 h-14 rounded-2xl border-[2px] flex items-center justify-center transition-all duration-500 relative z-10",
                    isCompleted 
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30" 
                      : isActive 
                        ? "bg-background border-primary text-primary shadow-xl shadow-primary/20" 
                        : "bg-muted/30 border-muted-foreground/20 text-muted-foreground/40"
                  )}
                >
                  <Icon size={isCompleted ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                  
                  {/* Ping Effect for Active Step */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-2xl border-[3px] border-primary/30 animate-ping opacity-20" style={{ animationDuration: '3s' }} />
                  )}
                </motion.div>

                {/* Text Labels */}
                <div className="text-center mt-5 flex flex-col items-center">
                  <h3 className={cn(
                    "text-[11px] font-black uppercase tracking-[0.15em] transition-colors duration-300",
                    isActive ? "text-foreground" : isCompleted ? "text-foreground/80" : "text-muted-foreground/40"
                  )}>
                    {step.label}
                  </h3>
                  <p className={cn(
                    "text-[10px] mt-1 font-bold tracking-wider transition-colors duration-300",
                    isActive ? "text-primary" : "text-muted-foreground/40"
                  )}>
                    {step.subLabel}
                  </p>

                  {/* Status Indicator inside normal flow (Fixes scrollbar issue) */}
                  <div className="h-8 mt-3 flex items-start justify-center">
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase text-primary tracking-widest shadow-sm"
                        >
                          <Clock size={10} className="animate-spin-slow" /> 
                          <span>Diproses</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejection State */}
      <AnimatePresence>
        {isRejected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 mx-4 p-5 rounded-3xl bg-destructive/5 border border-destructive/20 flex items-start gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive" />
            <div className="h-12 w-12 rounded-2xl bg-background shadow-sm flex items-center justify-center text-destructive shrink-0 ring-1 ring-destructive/10">
              <Ban size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-destructive mb-1.5">Permintaan Ditolak</h4>
              <p className="text-sm font-semibold text-destructive/80 leading-relaxed">
                {rejectionReason || 'Tidak ada alasan penolakan yang diberikan.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
