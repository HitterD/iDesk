import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Copy, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEformDetail, useGetCredentials, useSubmitCredentials } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

export const EformCredentialPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eform, isLoading } = useEformDetail(id!);

  const isICT = ICT_ROLES.includes(user?.role || '');
  const isRequester = eform?.requesterId === user?.id;
  const canView = isICT || isRequester;

  const { data: credentials, refetch: fetchCredentials, isFetching } = useGetCredentials(id!, eform?.status === 'CONFIRMED' && (isRequester || isICT));
  const submitMutation = useSubmitCredentials();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vpnServer, setVpnServer] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credsFetched, setCredsFetched] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      toast.error('Username dan password wajib diisi');
      return;
    }
    try {
      await submitMutation.mutateAsync({ id: id!, username, password, vpnServer, notes });
      toast.success('Kredensial berhasil disimpan dan dikirimkan ke user');
      navigate(-1);
    } catch {
      toast.error('Gagal menyimpan kredensial');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin`);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
  if (!eform) return <div className="p-8 text-center text-muted-foreground">Permintaan tidak ditemukan</div>;

  if (!canView) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <Lock size={48} className="mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-black uppercase tracking-tighter">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground">Halaman ini hanya dapat diakses oleh tim ICT dan pemohon.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
      </div>

      <div className="rounded-[2rem] overflow-hidden border border-primary/10 shadow-xl">
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8 py-6">
          <h1 className="text-xl font-black tracking-tighter uppercase text-white">
            {isICT && eform.status === 'PENDING_ICT' ? 'Buat Akses' : 'Kredensial Akses'}
          </h1>
          <p className="text-[11px] text-white/60 mt-1">{eform.requesterName} — {eform.formType}</p>
        </div>

        <div className="px-8 py-6 bg-background space-y-5">
          {/* ICT input form */}
          {isICT && eform.status === 'PENDING_ICT' && (
            <>
              <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-2xl p-4">
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Pemohon</div>
                  <div className="text-sm font-bold mt-1">{eform.requesterName}</div>
                </div>
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Jenis</div>
                  <div className="text-sm font-bold mt-1">{eform.formType}</div>
                </div>
              </div>

              <div className="border-t border-dashed border-border/40 pt-4 space-y-4">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-violet-500">
                  Input Kredensial
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Username *</label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="nama.user@company.vpn" className="h-11 rounded-xl font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Password Awal *</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password awal untuk user"
                      className="h-11 rounded-xl font-mono pr-12"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">VPN Server / Host</label>
                  <Input value={vpnServer} onChange={e => setVpnServer(e.target.value)} placeholder="vpn.company.com:1194" className="h-11 rounded-xl font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Catatan ICT (Opsional)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instruksi tambahan untuk user..."
                    className="w-full min-h-[70px] p-4 rounded-2xl border-2 border-border/50 bg-background text-sm font-medium outline-none resize-none focus:border-primary/30 transition-colors"
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!username || !password || submitMutation.isPending}
                  className="w-full rounded-2xl h-12 bg-violet-600 hover:bg-violet-700 font-black uppercase tracking-widest text-[10px] text-white shadow-lg shadow-violet-500/20"
                >
                  <CheckCircle2 className="mr-2 w-4 h-4" />
                  {submitMutation.isPending ? 'Menyimpan...' : 'Selesai — Kirim Kredensial ke User'}
                </Button>
              </div>
            </>
          )}

          {/* User/ICT view after CONFIRMED */}
          {eform.status === 'CONFIRMED' && (
            <div className="space-y-4">
              {!credentials && !credsFetched ? (
                <Button
                  onClick={async () => { await fetchCredentials(); setCredsFetched(true); }}
                  disabled={isFetching}
                  variant="outline"
                  className="w-full rounded-2xl h-11 font-black uppercase tracking-widest text-[10px]"
                >
                  <Eye className="mr-2 w-4 h-4" /> {isFetching ? 'Memuat...' : 'Tampilkan Kredensial'}
                </Button>
              ) : credentials ? (
                <div className="bg-slate-950 border border-blue-500/20 rounded-2xl p-5 space-y-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <Lock size={11} /> Kredensial Akses {eform.formType}
                  </div>
                  {[
                    { label: 'Username', value: credentials.username },
                    { label: 'Password Awal', value: credentials.password, mono: true, sensitive: true },
                    ...(credentials.vpnServer ? [{ label: 'VPN Server', value: credentials.vpnServer, mono: true }] : []),
                  ].map(({ label, value, mono, sensitive }) => (
                    <div key={label} className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3">
                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{label}</div>
                        <div className={`text-sm font-bold text-blue-300 mt-0.5 ${mono ? 'font-mono' : ''}`}>
                          {sensitive && !showPassword ? '••••••••••' : value}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {sensitive && (
                          <button onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-slate-300">
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button onClick={() => handleCopy(value, label)} className="text-slate-500 hover:text-slate-300">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {credentials.notes && (
                    <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl px-4 py-3">
                      <div className="text-[9px] font-extrabold uppercase tracking-widest text-amber-500 mb-1">Catatan ICT</div>
                      <p className="text-xs text-amber-300/80">{credentials.notes}</p>
                    </div>
                  )}
                  <div className="bg-amber-950/20 rounded-xl px-4 py-2 text-[10px] text-amber-400 font-bold">
                    ⚠ Segera ganti password setelah login pertama
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {eform.status !== 'PENDING_ICT' && eform.status !== 'CONFIRMED' && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Kredensial belum tersedia. Status: {eform.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
