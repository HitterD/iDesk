import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle, WifiOff, Lock, Sun, Moon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getErrorFromResponse, type LoginError, MAX_LOGIN_ATTEMPTS, RATE_LIMIT_WINDOW_SECONDS } from '../utils/loginErrorMapping';
import { useTheme } from '@/hooks/useTheme';
import { restoreSession } from '@/hooks/useSessionRestore';
import api from '../../../lib/api';
import { coordinateSession, SessionCoordinationUnavailableError } from '@/lib/sessionCoordinator';
import { getRoleHome } from '@/lib/roleHome';
import { MustChangePasswordDialog } from '../components/MustChangePasswordDialog';
import { ForgotPasswordDialog } from '../components/ForgotPasswordDialog';
import '../auth.css';

const ATTEMPT_WARNING_THRESHOLD = 3;
const CLOCK_TICK_MS = 1_000;

// Background slideshow — teknik foundation.html (full-bleed di belakang card, tanpa panel samping).
const PLANTS = [
    { src: '/login-plants/sidoarjo-plant.webp', alt: 'Sidoarjo Plant' },
    { src: '/login-plants/sukodono-plant.webp', alt: 'Sukodono Plant' },
    { src: '/login-plants/semarang-plant.webp', alt: 'Semarang Plant' },
    { src: '/login-plants/karawang-plant.webp', alt: 'Karawang Plant' },
    { src: '/login-plants/marketing-office.webp', alt: 'Marketing Office' },
] as const;
const SLIDE_INTERVAL_MS = 5200;

function getNextPath(search: string): string | null {
    try {
        const params = new URLSearchParams(search);
        const next = params.get('next');
        if (!next) return null;
        // Only allow same-origin relative paths; reject //, http:, javascript:, etc.
        if (next.startsWith('//') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return null;
        if (!next.startsWith('/')) return null;
        return next;
    } catch { return null; }
}

/** Messages for ?sso_error= set by the backend's Sign in with iPop callback. */
const SSO_ERRORS: Record<string, LoginError> = {
    ipop_not_linked: { type: 'error', message: 'Akun iDesk belum terhubung', details: 'Akun iPop Anda belum terhubung ke akun iDesk. Hubungi ICT (ext. 1604).' },
    account_disabled: { type: 'error', message: 'Akun dinonaktifkan', details: 'Hubungi administrator.' },
    ipop_denied: { type: 'warning', message: 'Masuk dengan iPop dibatalkan' },
    ipop_expired: { type: 'warning', message: 'Sesi masuk iPop kedaluwarsa', details: 'Silakan coba lagi.' },
    ipop_unavailable: { type: 'error', message: 'iPop tidak dapat dihubungi', details: 'Coba lagi nanti atau masuk dengan NIK dan password.' },
    ipop_disabled: { type: 'warning', message: 'Masuk dengan iPop belum diaktifkan' },
    ipop_failed: { type: 'error', message: 'Masuk dengan iPop gagal', details: 'Silakan coba lagi.' },
};

export const BentoLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<LoginError | null>(null);
    const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccessTransition, setIsSuccessTransition] = useState(false);
    const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [rememberMe, setRememberMe] = useState(true);
    const { theme, toggle: toggleTheme } = useTheme();
    const [mustChange, setMustChange] = useState<{ password: string } | null>(null);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const login = useAuth((state) => state.login);
    const updateUser = useAuth((state) => state.updateUser);
    const navigate = useNavigate();
    const location = useLocation();
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const nextPath = useMemo(() => getNextPath(location.search), [location.search]);
    const [ipopEnabled, setIpopEnabled] = useState(false);
    const ssoError = useMemo(() => {
        try { const code = new URLSearchParams(location.search).get('sso_error'); return code ? (SSO_ERRORS[code] ?? SSO_ERRORS.ipop_failed) : null; } catch { return null; }
    }, [location.search]);
    const expiredNotice = useMemo(() => {
        try { return new URLSearchParams(location.search).get('reason') === 'expired'; } catch { return false; }
    }, [location.search]);

    const [active, setActive] = useState(0);
    // Slide tertinggi yang sudah pernah tampil — slide sesudahnya belum dirender agar tidak ikut diunduh
    const [furthestSlide, setFurthestSlide] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    // Preload hanya slide berikutnya agar crossfade tidak kedip, tanpa mengunduh semua di awal
    useEffect(() => {
        setFurthestSlide((f) => Math.max(f, active));
        const img = new Image();
        img.src = PLANTS[(active + 1) % PLANTS.length].src;
    }, [active]);

    useEffect(() => {
        // Pre-warm destination chunks in background without blocking
        const prefetch = () => {
            import('../../../components/layout/BentoLayout');
            import('../../../components/layout/ManagerLayout');
            import('../../../components/layout/ClientLayout');
            import('../../dashboard/pages/BentoDashboardPage');
            import('../../manager/pages/ManagerDashboard');
            import('../../client/pages/BentoMyTicketsPage');
            import('../../ticket-board/pages/BentoOracleK2TicketsPage');
        };

        if (typeof window !== 'undefined') {
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(prefetch);
            } else {
                setTimeout(prefetch, 1000);
            }
        }
    }, []);

    // Auto-rotate selalu jalan — reducedMotion hanya matikan zoom, bukan stop ganti gambar
    useEffect(() => {
        const id = setInterval(() => setActive((i) => (i + 1) % PLANTS.length), SLIDE_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    const navigateByRole = useCallback((role: string) => {
        if (nextPath) {
            navigate(nextPath, { replace: true });
            return;
        }
        navigate(getRoleHome(role));
    }, [navigate, nextPath]);

    // Handle stale session cleanup or auto-redirect if already validly authenticated / restorable
    useEffect(() => {
        (api as any)?.resetLoginRedirectState?.();
        const getState = (useAuth as any)?.getState;
        if (typeof getState !== 'function') return;

        if (expiredNotice) return;

        const authState = getState();
        if (authState?.isAuthenticated && authState?.user && !authState?.isSessionExpired?.()) {
            navigateByRole(authState.user.role);
            return;
        }

        // Proactively attempt session restoration from refresh token cookie
        let active = true;
        restoreSession().then((success) => {
            if (active && success) {
                const refreshed = (useAuth as any)?.getState?.();
                if (refreshed?.user) {
                    navigateByRole(refreshed.user.role);
                }
            }
        });

        return () => {
            active = false;
        };
    }, [expiredNotice, navigateByRole]);

    useEffect(() => {
        if (ssoError) setLoginError(ssoError);
    }, [ssoError]);

    useEffect(() => {
        let active = true;
        api.get('/auth/oidc/status', { skipToast: true, skipSessionRefresh: true } as any)
            .then((res) => { if (active) setIpopEnabled(res.data?.enabled === true); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const signInWithIpop = useCallback(() => {
        const returnTo = encodeURIComponent(nextPath ?? '/');
        window.location.assign(`${import.meta.env.VITE_API_URL || ''}/v1/auth/oidc/start?returnTo=${returnTo}`);
    }, [nextPath]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const clockRef = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const update = () => {
            const el = clockRef.current;
            if (!el) return;
            const d = new Date();
            const timeStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            el.textContent = `${timeStr} WIB`;
        };
        update();
        const id = setInterval(update, CLOCK_TICK_MS);
        return () => clearInterval(id);
    }, []);

    const getStorageKey = useCallback((identifier: string) => {
        const trimmed = identifier.trim().toLowerCase();
        return trimmed ? `idesk_rl_${trimmed}` : null;
    }, []);

    useEffect(() => {
        const key = getStorageKey(email);
        if (!key) { setRateLimitSeconds(0); return; }
        try {
            const stored = localStorage.getItem(key);
            if (!stored) { setRateLimitSeconds(0); return; }
            const expiry = parseInt(stored, 10);
            if (!isNaN(expiry) && expiry > Date.now()) {
                const remaining = Math.ceil((expiry - Date.now()) / 1000);
                setRateLimitSeconds(remaining);
            } else { localStorage.removeItem(key); setRateLimitSeconds(0); }
        } catch { /* ignore */ }
    }, [email, getStorageKey]);

    useEffect(() => {
        if (rateLimitSeconds <= 0) return;
        const interval = setInterval(() => {
            setRateLimitSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    const key = getStorageKey(email);
                    if (key) { try { localStorage.removeItem(key); } catch {} }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [rateLimitSeconds, email, getStorageKey]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
        if (e.key === 'Escape') {
            setEmail('');
            setPassword('');
            setLoginError(null);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSuccessTransition) return;
        if (!email.trim() || !password) {
            const emailMissing = !email.trim();
            setLoginError({
                type: 'warning',
                message: emailMissing ? 'NIK / Email wajib diisi.' : 'Password wajib diisi.',
            });
            (emailMissing ? emailRef : passwordRef).current?.focus();
            return;
        }
        if (!isOnline) {
            setLoginError({ type: 'error', message: 'Tidak ada koneksi', details: 'Periksa jaringan Anda lalu coba lagi.' });
            return;
        }
        if (rateLimitSeconds > 0) return;
        setIsLoading(true);
        try {
            const res = await coordinateSession(async () => {
                const response = await api.post('/auth/login', { email, password, rememberMe });
                login(response.data.user, response.data.expiresAt ?? null);
                return response;
            });
            const { user, expiresAt } = res.data as { user: Parameters<typeof login>[0]; expiresAt?: string };
            setFailedAttempts(0);
            setLoginError(null);
            const key = getStorageKey(email);
            if (key) { try { localStorage.removeItem(key); } catch {} }


            // Auto-sync ke SJA Desktop Notifier jika aplikasi berjalan di PC lokal (port 18399)
            try {
                fetch('http://127.0.0.1:18399/session/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identifier: email,
                        password,
                        user: {
                            employeeId: (user as any).employeeId || (user as any).nik || email,
                            name: (user as any).fullName || (user as any).name,
                            email: (user as any).email || email,
                            siteCode: (user as any).siteCode || (user as any).siteId || 'SPJ',
                        },
                    }),
                }).catch(() => {
                    // Desktop client mungkin tidak terpasang di PC ini, abaikan
                });
            } catch {
                // Ignore network errors
            }

            if (user.mustChangePassword) {
                setMustChange({ password });
            } else {
                setAuthenticatedUser(user);
                setIsSuccessTransition(true);

                // Snappy cinematic transition timing (380ms)
                setTimeout(() => {
                    navigateByRole(user.role);
                }, 380);
            }
        } catch (err: unknown) {
            if (err instanceof SessionCoordinationUnavailableError) {
                setLoginError({ type: 'error', message: 'Koordinasi sesi tidak tersedia', details: err.message });
                return;
            }
            const newAttemptCount = failedAttempts + 1;
            const error = getErrorFromResponse(err, failedAttempts);
            if (axios.isAxiosError(err) && err.response?.status === 429) {
                const retryAfterHeader = err.response.headers?.['retry-after'];
                const parsedHeader = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
                const seconds = !isNaN(parsedHeader) && parsedHeader > 0 ? parsedHeader : RATE_LIMIT_WINDOW_SECONDS;
                setRateLimitSeconds(seconds);
                const key = getStorageKey(email);
                if (key) { try { localStorage.setItem(key, String(Date.now() + seconds * 1000)); } catch {} }
                setLoginError((prev) => (prev ? prev : error));
            } else {
                setLoginError(error);
                if (error.type === 'error' && error.errorCode !== 'USER_NOT_FOUND') setFailedAttempts(newAttemptCount);
            }
        } finally {
            if (!isSuccessTransition) {
                setIsLoading(false);
            }
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="w-5 h-5 shrink-0" />;
            default: return <Lock className="w-5 h-5 shrink-0" />;
        }
    };
    const isRateLimitError = loginError?.message === 'Rate limit exceeded';

    return (
        <div className="relative min-h-[100dvh] flex flex-col justify-between overflow-hidden" onKeyDown={handleKeyDown}>
            {/* Background slideshow — smooth crossfade & cinematic transition */}
            <motion.div
                animate={{
                    scale: isSuccessTransition ? (reducedMotion ? 1 : 1.05) : 1,
                    opacity: isSuccessTransition ? 0 : 1,
                    filter: isSuccessTransition ? 'blur(12px)' : 'blur(0px)',
                }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 overflow-hidden bg-[#090e1c] dark:bg-[#060a14]"
                aria-hidden="true"
            >
                {PLANTS.map((p, i) => {
                    const isActive = i === active;
                    if (i > furthestSlide + 1) return null;
                    return (
                        <img
                            key={p.src}
                            src={p.src}
                            alt=""
                            loading={i === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                            // @ts-ignore - fetchPriority is valid for eager first image
                            fetchPriority={i === 0 ? 'high' : 'auto'}
                            className={cn(
                                'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out',
                                isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                            )}
                            style={{
                                zIndex: isActive ? 1 : 0,
                            }}
                        />
                    );
                })}
                {/* Veil tipis — memastikan kontras teks & card tetap tajam dan nyaman */}
                <div className="absolute inset-0 z-[2] bg-background/25 dark:bg-background/45 backdrop-blur-[0.5px]" />
                <div className="absolute inset-0 z-[2] bg-gradient-to-b from-background/30 via-transparent to-background/50 dark:from-background/50 dark:via-transparent dark:to-background/70" />
            </motion.div>

            {/* Topbar */}
            <motion.header
                animate={{
                    opacity: isSuccessTransition ? 0 : 1,
                    y: isSuccessTransition ? -12 : 0
                }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-between px-6 sm:px-9 py-5 shrink-0 relative z-10"
            >
                <div className="w-8" aria-hidden />
                <div className="auth-chip">
                    <span className="font-mono tabular-nums" ref={clockRef} aria-hidden="true">--:--:-- WIB</span>
                    <div className="w-px h-3 bg-[hsl(var(--idesk-border))]" aria-hidden />
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
                        className="w-6 h-6 grid place-items-center rounded-full text-[hsl(var(--idesk-text))] hover:bg-[hsl(var(--idesk-surface-raised))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))]"
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                                key={theme}
                                initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                                transition={{ duration: 0.2 }}
                                className="grid place-items-center"
                            >
                                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                            </motion.span>
                        </AnimatePresence>
                    </button>
                </div>
            </motion.header>

            {/* Stage (centered card) */}
            <main className="flex-1 grid place-items-center px-4 py-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{
                        opacity: isSuccessTransition ? 0 : 1,
                        y: isSuccessTransition ? (reducedMotion ? 0 : -20) : 0,
                        scale: isSuccessTransition ? (reducedMotion ? 1 : 1.05) : 1,
                        filter: isSuccessTransition ? 'blur(8px)' : 'blur(0px)',
                    }}
                    transition={{
                        duration: isSuccessTransition ? 0.38 : 0.4,
                        ease: [0.16, 1, 0.3, 1]
                    }}
                    className="auth-card w-full max-w-[420px] rounded-[24px] p-7 sm:p-8 relative overflow-hidden text-[hsl(var(--idesk-text))]"
                >
                    {/* Corporate Umbrella Branding Pill (Kapal Api Group | PT Santos Jaya Abadi) */}
                    <div className="bg-white rounded-2xl border border-black/5 py-3 px-5 sm:px-6 shadow-sm mb-5 flex items-center justify-between sm:justify-around gap-4 sm:gap-6 select-none">
                        <img
                            src="/logos/kapal-api-group.webp"
                            alt="Kapal Api Group"
                            className="h-11 sm:h-13 w-auto object-contain max-h-[52px]"
                        />
                        <div className="w-px h-9 sm:h-11 bg-slate-300 shrink-0" aria-hidden="true" />
                        <img
                            src="/logos/sja-logo.webp"
                            alt="PT Santos Jaya Abadi"
                            className="h-11 sm:h-13 w-auto object-contain max-h-[52px]"
                        />
                    </div>

                    <div className="flex flex-col items-center justify-center mb-6 text-center">
                        <span className="auth-logo-plate">
                            <img src="/idesk-logo.webp" alt="iDesk" className="w-24 sm:w-28 h-auto object-contain" />
                        </span>
                        <p className="mt-3 text-[13px] text-[hsl(var(--idesk-text-secondary))]">Masuk untuk melanjutkan ke IT Helpdesk</p>
                    </div>

                    {expiredNotice && !loginError && rateLimitSeconds === 0 && (
                        <div role="status" className="flex items-start gap-3 p-3 mb-4 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold">Sesi berakhir</p>
                                <p className="text-xs mt-0.5 opacity-90">Silakan login kembali untuk melanjutkan.</p>
                            </div>
                        </div>
                    )}

                    {!isOnline && (
                        <div role="status" className="flex items-start gap-3 p-3 mb-4 bg-secondary/80 border border-border rounded-lg text-muted-foreground">
                            <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Anda sedang offline</p>
                                <p className="text-xs mt-0.5">Periksa koneksi jaringan untuk bisa masuk.</p>
                            </div>
                        </div>
                    )}

                    {rateLimitSeconds > 0 && (
                        <div role="alert" className="flex items-start gap-3 p-3 mb-4 rounded-lg border bg-warning-500/10 border-warning-500/20 text-warning-600 dark:text-warning-500 animate-pulse motion-reduce:animate-none">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold">Terlalu banyak percobaan</p>
                                <p className="text-xs opacity-90 mt-0.5">Tunggu {rateLimitSeconds} detik.</p>
                            </div>
                        </div>
                    )}

                    {loginError && (!rateLimitSeconds || !isRateLimitError) && (
                        <div role="alert" id="login-error" className={cn('flex items-start gap-3 p-3 mb-4 rounded-lg border', loginError.type === 'warning' ? 'bg-warning-500/10 border-warning-500/20 text-warning-600 dark:text-warning-500' : 'bg-destructive/10 border-destructive/20 text-destructive')}>
                            {getAlertIcon(loginError.type)}
                            <div>
                                <p className="text-sm font-semibold">{loginError.message}</p>
                                {loginError.details && <p className="text-xs opacity-80 mt-0.5">{loginError.details}</p>}
                            </div>
                        </div>
                    )}

                    {failedAttempts >= ATTEMPT_WARNING_THRESHOLD && !loginError && (
                        <div role="status" className="flex items-center gap-2 text-warning-500 text-xs font-semibold mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            {MAX_LOGIN_ATTEMPTS - failedAttempts > 0 ? `Sisa ${MAX_LOGIN_ATTEMPTS - failedAttempts} percobaan lagi` : 'Percobaan berikutnya akan mengunci sementara'}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className={cn('space-y-4', loginError && 'animate-shake')}>
                        <AnimatePresence mode="wait">
                            {!isSuccessTransition ? (
                                <motion.div
                                    key="inputs"
                                    initial={{ opacity: 1 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    <div className="space-y-2">
                                        <label htmlFor="login-email" className="auth-label">NIK / Email</label>
                                        <input id="login-email" ref={emailRef} type="text" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} aria-invalid={loginError?.type === 'error' || undefined} aria-describedby={loginError ? 'login-error' : undefined} className="auth-input" placeholder="Masukkan NIK atau email" autoComplete="username" disabled={isLoading || rateLimitSeconds > 0} />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <label htmlFor="login-password" className="auth-label">Password</label>
                                            {capsLockOn && <span role="status" className="text-xs font-semibold text-warning-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" aria-hidden="true" /> Caps Lock aktif</span>}
                                        </div>
                                        <div className="relative">
                                            <input id="login-password" ref={passwordRef} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} aria-invalid={loginError?.type === 'error' || undefined} aria-describedby={loginError ? 'login-error' : undefined} className="auth-input pr-12" placeholder="Masukkan password" autoComplete="current-password" disabled={isLoading || rateLimitSeconds > 0} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[hsl(var(--idesk-text-secondary))] hover:text-[hsl(var(--idesk-text))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))]" aria-pressed={showPassword} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                                                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="auth-check" disabled={isLoading || rateLimitSeconds > 0} />
                                            <span className="text-[13px] font-medium text-[hsl(var(--idesk-text-secondary))] group-hover:text-[hsl(var(--idesk-text))] transition-colors select-none">Ingat saya</span>
                                        </label>
                                        <button type="button" onClick={() => setShowForgotPassword(true)} className="auth-link" disabled={isLoading}>
                                            Lupa password?
                                        </button>
                                    </div>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>

                        {/* Submit button with Morph Transition */}
                        {!isSuccessTransition ? (
                            <Button
                                variant="primary"
                                size="lg"
                                type="submit"
                                loading={isLoading}
                                disabled={!isOnline || rateLimitSeconds > 0}
                                className="w-full !h-12 active:scale-[0.99]"
                            >
                                {rateLimitSeconds > 0 ? `Tunggu (${rateLimitSeconds} dtk)` : isLoading ? 'Memverifikasi…' : 'Masuk'}
                            </Button>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                className="w-full h-12 rounded-xl bg-[hsl(var(--ticket-green-ink))] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg"
                            >
                                <motion.span
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: 'spring', stiffness: 450, damping: 20, delay: 0.05 }}
                                >
                                    <Check className="w-5 h-5 text-white" />
                                </motion.span>
                                <span>Selamat datang, {authenticatedUser?.fullName?.split(' ')[0] || 'User'}</span>
                            </motion.div>
                        )}
                    </form>

                    {ipopEnabled && !isSuccessTransition && (
                        <div className="mt-4">
                            <div className="flex items-center gap-3 mb-4 text-xs text-[hsl(var(--idesk-text-secondary))]" aria-hidden>
                                <div className="flex-1 h-px bg-[hsl(var(--idesk-border))]" />
                                <span>atau</span>
                                <div className="flex-1 h-px bg-[hsl(var(--idesk-border))]" />
                            </div>
                            <button
                                type="button"
                                onClick={signInWithIpop}
                                disabled={!isOnline}
                                className="idesk-btn is-lg w-full !h-12 active:scale-[0.99]"
                            >
                                <img src="/logos/ipop-mark.png" alt="" aria-hidden className="w-5 h-5 rounded" />
                                Masuk dengan iPop
                            </button>
                        </div>
                    )}

                </motion.div>
            </main>

            {/* Footer */}
            <motion.footer
                animate={{
                    opacity: isSuccessTransition ? 0 : 1,
                    y: isSuccessTransition ? 12 : 0
                }}
                transition={{ duration: 0.25 }}
                className="px-6 sm:px-9 pb-6 shrink-0 relative z-10 flex justify-center"
            >
                <div className="auth-chip font-mono opacity-80">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ticket-green))]" />
                    <span>v3.18.2</span>
                    <span aria-hidden>·</span>
                    <span>© 2026 iDesk</span>
                </div>
            </motion.footer>

            {showForgotPassword && <ForgotPasswordDialog onClose={() => setShowForgotPassword(false)} />}

            {mustChange && (
                <MustChangePasswordDialog currentPassword={mustChange.password} onSuccess={() => { const role = useAuth.getState().user?.role; updateUser({ mustChangePassword: false }); setMustChange(null); if (role) navigateByRole(role); }} />
            )}
        </div>
    );
};

export default BentoLoginPage;
