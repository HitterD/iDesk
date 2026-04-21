import React from 'react';
import { motion } from 'framer-motion';
import { Info, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface TermsAndConditionsProps {
  content: string;
  accepted: boolean;
  onAccept: (accepted: boolean) => void;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ 
  content, 
  accepted, 
  onAccept 
}) => {
  return (
    <Card className="p-6 rounded-[2rem] border-2 border-amber-500/10 bg-amber-500/[0.02] space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-700">Syarat & Ketentuan</h3>
          <p className="text-[10px] opacity-60 font-bold uppercase tracking-tighter">Harap baca dengan saksama</p>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        <div 
          className="text-xs font-medium leading-relaxed text-foreground/70 prose prose-sm prose-amber"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      <div className="pt-4 border-t border-amber-500/10">
        <div 
          className={cn(
            "flex items-start gap-3 p-4 rounded-2xl transition-colors duration-150 cursor-pointer",
            accepted ? "bg-amber-500/10 border border-amber-500/20" : "bg-white border border-border/50 hover:border-amber-500/30"
          )}
          onClick={() => onAccept(!accepted)}
        >
          <Checkbox 
            id="terms" 
            checked={accepted} 
            onCheckedChange={(checked) => onAccept(checked as boolean)}
            className="mt-0.5"
          />
          <label 
            htmlFor="terms" 
            className="text-xs font-bold leading-tight cursor-pointer select-none"
          >
            Saya telah membaca, memahami, dan setuju untuk mematuhi seluruh syarat dan ketentuan penggunaan layanan VPN PT. Santos Jaya Abadi.
          </label>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[10px] opacity-40 italic">
        <Info size={12} className="shrink-0 mt-0.5" />
        <p>Pelanggaran terhadap ketentuan di atas dapat berakibat pada pencabutan hak akses dan sanksi sesuai peraturan perusahaan.</p>
      </div>
    </Card>
  );
};

// Internal CSS helper (since tailwind classes inside dangerouslySetInnerHTML are tricky)
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
