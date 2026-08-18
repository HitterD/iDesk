import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Copy, CheckCircle2, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEformDetail, useGetCredentials, useSubmitCredentials } from '../api/eform-request.api';
import { EFormStatus } from '../components/eform/EformStatusPipeline';
import { EformTypeBadge, getTypeConfig } from '../components/eform/eform-vocabulary';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

const MASK = '••••••••••';

export const EformCredentialPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eform, isLoading } = useEformDetail(id!);

  const isICT = ICT_ROLES.includes(user?.role || '');
  const isRequester = eform?.requesterId === user?.id;
  const canView = isICT || isRequester;

  const { data: credentials, refetch: fetchCredentials, isFetching } = useGetCredentials(
    id!,
    eform?.status === EFormStatus.CONFIRMED && (isRequester || isICT),
  );
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

  const backButton = (
    <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-semibold">
      <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
    </Button>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!eform) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-foreground">Permintaan tidak ditemukan</h2>
        <p className="text-sm text-muted-foreground">Permintaan ini mungkin sudah dihapus.</p>
        {backButton}
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <Lock size={40} className="mx-auto text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-bold text-foreground">Akses ditolak</h2>
        <p className="text-sm text-muted-foreground">
          Halaman ini hanya dapat diakses oleh tim ICT dan pemohon.
        </p>
        {backButton}
      </div>
    );
  }

  const type = getTypeConfig(eform.formType);
  const isIctInput = isICT && eform.status === EFormStatus.PENDING_ICT;

  const credentialRows = credentials
    ? [
        { label: 'Username', value: credentials.username, sensitive: false },
        { label: 'Password Awal', value: credentials.password, sensitive: true },
        ...(credentials.vpnServer
          ? [{ label: 'VPN Server', value: credentials.vpnServer, sensitive: false }]
          : []),
      ]
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 animate-fade-in-up">
      {backButton}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-6 py-5">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              {isIctInput ? 'Siapkan Akses' : 'Kredensial Akses'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {eform.requesterName} — {type.label}
            </p>
          </div>
          <EformTypeBadge type={eform.formType} />
        </div>

        <div className="space-y-5 px-6 py-6">
          {/* ICT input form */}
          {isIctInput && (
            <>
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Pemohon</dt>
                  <dd className="mt-0.5 text-sm font-bold text-foreground">{eform.requesterName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Jenis akses</dt>
                  <dd className="mt-0.5 text-sm font-bold text-foreground">{type.label}</dd>
                </div>
              </dl>

              <div className="space-y-4 border-t border-border pt-5">
                <h2 className="text-sm font-bold text-foreground">Input kredensial</h2>

                <div className="space-y-2">
                  <label htmlFor="cred-username" className="block text-sm font-semibold text-foreground">
                    Username <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="cred-username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="nama.user@company.vpn"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="cred-password" className="block text-sm font-semibold text-foreground">
                    Password awal <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      id="cred-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password awal untuk user"
                      className="h-11 rounded-xl pr-12 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="cred-server" className="block text-sm font-semibold text-foreground">
                    VPN server / host
                  </label>
                  <Input
                    id="cred-server"
                    value={vpnServer}
                    onChange={e => setVpnServer(e.target.value)}
                    placeholder="vpn.company.com:1194"
                    className="h-11 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="cred-notes" className="block text-sm font-semibold text-foreground">
                    Catatan ICT <span className="font-normal text-muted-foreground">(opsional)</span>
                  </label>
                  <textarea
                    id="cred-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instruksi tambahan untuk user…"
                    className="min-h-[80px] w-full resize-none rounded-xl border border-border bg-background p-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!username || !password || submitMutation.isPending}
                  className="h-12 w-full rounded-xl text-sm font-bold"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan…</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Kirim kredensial ke pemohon</>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Reveal after CONFIRMED */}
          {eform.status === EFormStatus.CONFIRMED && (
            <div className="space-y-4">
              {!credentials && !credsFetched ? (
                <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
                  <Lock size={22} className="mx-auto text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    Kredensial disembunyikan sampai Anda memintanya.
                  </p>
                  <Button
                    onClick={async () => {
                      await fetchCredentials();
                      setCredsFetched(true);
                    }}
                    disabled={isFetching}
                    variant="outline"
                    className="h-11 w-full rounded-xl text-sm font-bold"
                  >
                    {isFetching ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat…</>
                    ) : (
                      <><Eye className="mr-2 h-4 w-4" /> Tampilkan kredensial</>
                    )}
                  </Button>
                </div>
              ) : credentials ? (
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Lock size={14} className="text-primary" aria-hidden="true" />
                    Kredensial {type.label}
                  </h2>

                  <dl className="space-y-2">
                    {credentialRows.map(({ label, value, sensitive }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <div className="min-w-0">
                          <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                          <dd className="mt-0.5 truncate font-mono text-sm font-bold text-foreground">
                            {sensitive && !showPassword ? MASK : value}
                          </dd>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {sensitive && (
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(value, label)}
                            aria-label={`Salin ${label}`}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Copy size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </dl>

                  {credentials.notes && (
                    <div className="rounded-xl border border-border bg-card px-4 py-3">
                      <h3 className="text-xs font-semibold text-muted-foreground">Catatan ICT</h3>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{credentials.notes}</p>
                    </div>
                  )}

                  <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                    Segera ganti password setelah login pertama.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {eform.status !== EFormStatus.PENDING_ICT && eform.status !== EFormStatus.CONFIRMED && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">Kredensial belum tersedia</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Akses baru disiapkan setelah permintaan disetujui atasan dan diproses tim ICT.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
