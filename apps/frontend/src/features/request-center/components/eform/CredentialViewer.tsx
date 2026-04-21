import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, Copy, Check, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CredentialViewerProps {
  username?: string;
  password?: string;
  isRequester: boolean;
}

export const CredentialViewer: React.FC<CredentialViewerProps> = ({ 
  username = '', 
  password = '', 
  isRequester 
}) => {
  const [showUsername, setShowUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsVisible(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isRequester) return null;

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md mx-auto"
        >
          <Card className="p-6 rounded-[2rem] border-2 border-primary/20 shadow-2xl shadow-primary/10 overflow-hidden relative">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 -z-10" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-primary">Kredensial VPN</h3>
                <p className="text-[10px] opacity-60 font-bold uppercase tracking-tighter">Akses Anda telah siap</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-40">Username</label>
                <div className="flex gap-2">
                  <div className="flex-1 h-11 bg-muted/50 rounded-xl border border-border/50 flex items-center px-4 font-mono text-sm font-bold overflow-hidden">
                    {showUsername ? username : '••••••••••••'}
                  </div>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => setShowUsername(!showUsername)}>
                    {showUsername ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => handleCopy(username, 'user')}>
                    {copiedField === 'user' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-40">Password</label>
                <div className="flex gap-2">
                  <div className="flex-1 h-11 bg-muted/50 rounded-xl border border-border/50 flex items-center px-4 font-mono text-sm font-bold overflow-hidden">
                    {showPassword ? password : '••••••••••••'}
                  </div>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => handleCopy(password, 'pass')}>
                    {copiedField === 'pass' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/30 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                <span className="flex items-center gap-1"><Clock size={12} /> Auto-hide dalam</span>
                <span>{timeLeft}s</span>
              </div>
              <Progress value={(timeLeft / 60) * 100} className="h-1 rounded-full bg-primary/10" />
              
              <div className="p-3 rounded-2xl bg-amber-500/5 flex items-start gap-2 border border-amber-500/10">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold leading-tight text-amber-700/70 uppercase tracking-tight">
                  Kredensial ini bersifat rahasia. Harap simpan di tempat yang aman dan jangan bagikan kepada siapa pun.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center p-8 rounded-[2rem] border-2 border-dashed border-border/50"
        >
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground mb-4">
            <ShieldCheck size={24} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest opacity-40">Kredensial Tersembunyi</h3>
          <p className="text-[10px] font-bold uppercase tracking-tighter opacity-30 mb-4">Waktu tampilan telah habis demi keamanan</p>
          <Button variant="outline" size="sm" onClick={() => { setTimeLeft(60); setIsVisible(true); }} className="rounded-xl h-9 text-[10px] font-extrabold uppercase tracking-widest">
            Tampilkan Lagi
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
