import React, { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/stores/useAuth';
import api from '@/lib/api';
import { ShieldCheck, Laptop, CheckCircle2, AlertCircle, ArrowRight, Lock, KeyRound } from 'lucide-react';

const DeviceActivationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialCode = (searchParams.get('code') || '').slice(0, 6);
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = new Array(6).fill('');
    for (let i = 0; i < initialCode.length; i++) {
      arr[i] = initialCode[i];
    }
    return arr;
  });
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [status, setStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const codeString = digits.join('');

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    const newDigits = [...digits];
    if (clean.length === 1) {
      newDigits[index] = clean;
      setDigits(newDigits);
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      // Paste handling
      for (let i = 0; i < 6 && i < clean.length; i++) {
        newDigits[i] = clean[i];
      }
      setDigits(newDigits);
      const nextIndex = Math.min(clean.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleApprove = async () => {
    if (codeString.length !== 6 || !user) return;
    setLoading(true);
    setStatus('Menghubungkan perangkat ke SJA Notification Center...');

    try {
      // Panggil endpoint internal iDesk proxy yang terlindungi otentikasi JWT
      await api.post('/notifications/devices/activation/approve', {
        code: codeString,
      });

      setIsSuccess(true);
      setStatus('Perangkat Windows Anda berhasil terhubung! Anda dapat kembali ke aplikasi desktop.');
    } catch (err: any) {
      setIsSuccess(false);
      const errMsg = err.response?.data?.message || err.message || 'Gagal mengaktifkan perangkat';
      setStatus(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 text-slate-900 font-sans p-4 sm:p-6">
      {/* Top Header Strip */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F4C81] text-white flex items-center justify-center font-bold text-base shadow-sm">
            SJA
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-slate-800">PT Santos Jaya Abadi</div>
            <div className="text-xs text-slate-500">SJA Notification Suite</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
          <Lock size={13} className="text-emerald-600" />
          <span>Otentikasi End-to-End</span>
        </div>
      </header>

      {/* Main Activation Card */}
      <main className="max-w-lg mx-auto w-full my-auto">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-10 space-y-8 transition-all">
          {/* Visual Icon Badge */}
          <div className="text-center space-y-3">
            <div className="inline-flex relative">
              <div className="w-20 h-20 rounded-3xl bg-blue-50 text-[#0F4C81] flex items-center justify-center border border-blue-100 shadow-inner">
                <Laptop size={38} strokeWidth={1.75} />
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-[#EAB308] text-slate-900 flex items-center justify-center shadow-md">
                <KeyRound size={15} />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
              Aktivasi SJA Notifier
            </h1>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Konfirmasikan koneksi PC Windows Anda untuk mulai menerima peringatan tiket, renewal, dan persetujuan iDesk langsung di taskbar.
            </p>
          </div>

          {/* 6 Digit Input Slots */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Kode Verifikasi 6-Digit
              </span>
              <span className="text-xs text-slate-400">Dari jendela SJA Notifier</span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:gap-3">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={isSuccess || loading}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="h-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-bold rounded-2xl border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0F4C81] focus:ring-4 focus:ring-blue-100 text-slate-800 outline-none transition-all disabled:opacity-60 shadow-inner"
                />
              ))}
            </div>
          </div>

          {/* Current User Binding Card */}
          {user ? (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0F4C81] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Akun Terautentikasi</div>
                  <div className="text-sm font-bold text-slate-800">{user.fullName}</div>
                  <div className="text-xs font-mono text-slate-500">{user.employeeId || user.email}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
                  Karyawan SJA
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-amber-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-amber-900">Belum Login di Browser Ini</div>
                  <div className="text-xs text-amber-700">Silakan login ke akun iDesk Anda pada tab atau jendela ini terlebih dahulu.</div>
                </div>
              </div>
            </div>
          )}

          {/* Action CTA Button */}
          {!user ? (
            <a
              href={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
              className="w-full py-4 bg-[#0F4C81] hover:bg-blue-900 active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 text-base text-center"
            >
              <Lock size={18} />
              <span>Login ke Akun iDesk Terlebih Dahulu</span>
              <ArrowRight size={18} />
            </a>
          ) : (
            <button
              onClick={handleApprove}
              disabled={codeString.length !== 6 || loading || isSuccess}
              className="w-full py-4 bg-[#0F4C81] hover:bg-blue-900 active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 text-base"
            >
              {loading ? (
                <span>Menghubungkan Perangkat...</span>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 size={20} className="text-emerald-300" />
                  <span>Perangkat Terhubung</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={20} />
                  <span>Izinkan Perangkat Ini</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          )}

          {/* Status Message Display */}
          {status && (
            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-start gap-3 transition-all ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{status}</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer Strip */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-xs text-slate-500">
        Hak Cipta © 2026 PT Santos Jaya Abadi. Seluruh hak dilindungi undang-undang.
      </footer>
    </div>
  );
};

export default DeviceActivationPage;
