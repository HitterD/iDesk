import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle, WifiOff, Lock, Sun, Moon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorFromResponse, type LoginError, MAX_LOGIN_ATTEMPTS, RATE_LIMIT_WINDOW_SECONDS } from '../utils/loginErrorMapping';
import { useTheme } from '@/hooks/useTheme';
import api from '../../../lib/api';
import { MustChangePasswordDialog } from '../components/MustChangePasswordDialog';

const DASHBOARD_ROLES = new Set(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE']);
/** Start counting down the remaining attempts once the user is this far in. */
const ATTEMPT_WARNING_THRESHOLD = 3;
const CLOCK_TICK_MS = 1_000;

export const BentoLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<LoginError | null>(null);
    const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [rememberMe, setRememberMe] = useState(false);
    const { theme, toggle: toggleTheme } = useTheme();
    const [mustChange, setMustChange] = useState<{ password: string } | null>(null);
    const login = useAuth((state) => state.login);
    const updateUser = useAuth((state) => state.updateUser);
    const navigate = useNavigate();
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const navigateByRole = useCallback((role: string) => {
        if (DASHBOARD_ROLES.has(role)) {
            navigate('/dashboard');
        } else if (role === 'MANAGER') {
            navigate('/manager/dashboard');
        } else {
            navigate('/client/my-tickets');
        }
    }, [navigate]);

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

    // Written straight to the node: this ticks every second and going through state
    // would re-render the whole form (and every input) once per tick.
    const clockRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const update = () => {
            const el = clockRef.current;
            if (!el) return;
            const d = new Date();
            const timeStr = d.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Jakarta',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
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
        if (!key) {
            setRateLimitSeconds(0);
            return;
        }
        try {
            const stored = localStorage.getItem(key);
            if (!stored) {
                setRateLimitSeconds(0);
                return;
            }
            const expiry = parseInt(stored, 10);
            if (!isNaN(expiry) && expiry > Date.now()) {
                const remaining = Math.ceil((expiry - Date.now()) / 1000);
                setRateLimitSeconds(remaining);
            } else {
                localStorage.removeItem(key);
                setRateLimitSeconds(0);
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [email, getStorageKey]);

    useEffect(() => {
        if (rateLimitSeconds <= 0) return;
        const interval = setInterval(() => {
            setRateLimitSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    const key = getStorageKey(email);
                    if (key) {
                        try { localStorage.removeItem(key); } catch {}
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [rateLimitSeconds > 0, email, getStorageKey]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
        // The card footer advertises "Esc Clear"; make that true instead of a lie.
        if (e.key === 'Escape') {
            setEmail('');
            setPassword('');
            setLoginError(null);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            const emailMissing = !email.trim();
            setLoginError({
                type: 'warning',
                message: emailMissing ? 'NIK / Email is required.' : 'Password is required.',
                details: 'NIK/Email dan password wajib diisi.',
            });
            // Land the caret on the field that is actually at fault; otherwise a
            // keyboard user has to hunt for it from wherever focus happened to be.
            (emailMissing ? emailRef : passwordRef).current?.focus();
            return;
        }

        if (!isOnline) {
            setLoginError({
                type: 'error',
                message: 'Network disconnected',
                details: 'Offline mode active. Connection required for authentication.',
            });
            return;
        }

        if (rateLimitSeconds > 0) return;

        setIsLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password, rememberMe });
            const { user } = res.data;
            setFailedAttempts(0);
            setLoginError(null);
            const key = getStorageKey(email);
            if (key) {
                try { localStorage.removeItem(key); } catch {}
            }
            login(user);

            if (user.mustChangePassword) {
                setMustChange({ password });
            } else {
                navigateByRole(user.role);
            }
        } catch (err: unknown) {
            const newAttemptCount = failedAttempts + 1;
            const error = getErrorFromResponse(err, failedAttempts);

            if (axios.isAxiosError(err) && err.response?.status === 429) {
                const retryAfterHeader = err.response.headers?.['retry-after'];
                const parsedHeader = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
                const seconds = !isNaN(parsedHeader) && parsedHeader > 0 ? parsedHeader : RATE_LIMIT_WINDOW_SECONDS;
                setRateLimitSeconds(seconds);

                const key = getStorageKey(email);
                if (key) {
                    try {
                        localStorage.setItem(key, String(Date.now() + seconds * 1000));
                    } catch {}
                }

                setLoginError((prev) => (prev ? prev : error));
            } else {
                setLoginError(error);
                if (error.type === 'error' && error.errorCode !== 'USER_NOT_FOUND') {
                    setFailedAttempts(newAttemptCount);
                }
            }
        } finally {
            setIsLoading(false);
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
        <div className="min-h-screen flex flex-col">
            <header className="flex items-center justify-between px-9 py-5 animate-fade-down">
                <div />
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span className="tabular-nums" ref={clockRef} aria-hidden="true">--:--:-- WIB</span>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                        className="w-8 h-8 grid place-items-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>
            </header>

            <main className="flex-1 grid place-items-center px-4 py-6">
                <div className="w-full max-w-[440px] bg-card border border-border rounded-2xl shadow-2xl p-8 relative animate-rise">
                    {/* Corner ticks */}
                    <span className="absolute top-0 left-0 w-3 h-3 border-t-[1.5px] border-l-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.1s' }} />
                    <span className="absolute top-0 right-0 w-3 h-3 border-t-[1.5px] border-r-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.16s' }} />
                    <span className="absolute bottom-0 left-0 w-3 h-3 border-b-[1.5px] border-l-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.22s' }} />
                    <span className="absolute bottom-0 right-0 w-3 h-3 border-b-[1.5px] border-r-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.28s' }} />

                    {/* Logo inside card top with opening animation */}
                    <div className="flex flex-col items-center justify-center mb-6 animate-logo-entrance animate-logo-float">
                        <img
                            src="/idesk-logo.png"
                            alt="iDesk Logo"
                            className="w-48 sm:w-56 h-auto object-contain transition-transform duration-300 hover:scale-105"
                        />
                    </div>
                    <hr className="border-border mb-6 animate-hairline" style={{ animationDelay: '0.28s' }} />

                    {!isOnline && (
                        <div role="status" className="flex items-start gap-3 p-3 mb-4 bg-secondary/80 border border-border rounded-lg text-muted-foreground">
                            <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">System Offline</p>
                                <p className="text-xs mt-0.5">Check your network connection to authenticate.</p>
                            </div>
                        </div>
                    )}

                    {rateLimitSeconds > 0 && (
                        <div role="alert" className="flex items-start gap-3 p-3 mb-4 rounded-lg border bg-warning-500/10 border-warning-500/20 text-warning-600 dark:text-warning-500 animate-pulse motion-reduce:animate-none">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold">Rate limit exceeded</p>
                                <p className="text-xs opacity-90 mt-0.5">
                                    Wait {rateLimitSeconds} second{rateLimitSeconds === 1 ? '' : 's'}.
                                </p>
                            </div>
                        </div>
                    )}

                    {loginError && (!rateLimitSeconds || !isRateLimitError) && (
                        <div
                            role="alert"
                            id="login-error"
                            className={cn(
                                'flex items-start gap-3 p-3 mb-4 rounded-lg border',
                                loginError.type === 'warning'
                                    ? 'bg-warning-500/10 border-warning-500/20 text-warning-600 dark:text-warning-500'
                                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                            )}
                        >
                            {getAlertIcon(loginError.type)}
                            <div>
                                <p className="text-sm font-semibold">{loginError.message}</p>
                                {loginError.details && (
                                    <p className="text-xs opacity-80 mt-0.5">{loginError.details}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {failedAttempts >= ATTEMPT_WARNING_THRESHOLD && !loginError && (
                        <div role="status" className="flex items-center gap-2 text-warning-500 text-xs font-mono mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            {MAX_LOGIN_ATTEMPTS - failedAttempts > 0
                                ? `WARNING: ${MAX_LOGIN_ATTEMPTS - failedAttempts} ATTEMPT(S) REMAINING`
                                : 'CRITICAL: LOGIN SYSTEM LOCKOUT IMMINENT'}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className={cn("space-y-4 animate-rise", loginError && "animate-shake")} style={{ animationDelay: '0.34s' }}>
                        <div className="space-y-2">
                            <label htmlFor="login-email" className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                                NIK / Email
                            </label>
                            <input
                                id="login-email"
                                ref={emailRef}
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                aria-invalid={loginError?.type === 'error' || undefined}
                                aria-describedby={loginError ? 'login-error' : undefined}
                                className={cn(
                                    "w-full px-4 py-3 bg-background/50 border border-border/50 rounded-lg text-foreground font-medium shadow-sm",
                                    "placeholder:text-muted-foreground/60 transition-colors duration-150",
                                    "focus:outline-none focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20",
                                    "hover:border-border",
                                    loginError?.type === 'error' && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                )}
                                placeholder="NIK atau email"
                                autoComplete="username"
                                disabled={isLoading || rateLimitSeconds > 0}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label htmlFor="login-password" className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Password
                                </label>
                                {capsLockOn && (
                                    <span role="status" className="text-[10px] font-bold tracking-widest text-warning-500 uppercase flex items-center gap-1 animate-pulse motion-reduce:animate-none">
                                        <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Caps Lock is on
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    ref={passwordRef}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    aria-invalid={loginError?.type === 'error' || undefined}
                                    aria-describedby={loginError ? 'login-error' : undefined}
                                    className={cn(
                                        "w-full px-4 py-3 bg-background/50 border border-border/50 rounded-lg text-foreground font-medium pr-12 shadow-sm",
                                        "placeholder:text-muted-foreground/60 transition-colors duration-150",
                                        "focus:outline-none focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20",
                                        "hover:border-border tracking-[0.2em]",
                                        showPassword && "tracking-normal",
                                        loginError?.type === 'error' && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                    )}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    disabled={isLoading || rateLimitSeconds > 0}
                                />
                                {/* Was tabIndex={-1}, which put the only way to verify a typed
                                    password out of reach for keyboard and switch users. */}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    aria-pressed={showPassword}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-border/80 accent-primary"
                                    disabled={isLoading || rateLimitSeconds > 0}
                                />
                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors select-none">
                                    Keep session active
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !isOnline || rateLimitSeconds > 0}
                            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors animate-rise flex items-center justify-center gap-2"
                            style={{ animationDelay: '0.52s' }}
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                            {rateLimitSeconds > 0 ? `Wait (${rateLimitSeconds}s)` : 'Continue'}
                        </button>
                    </form>

                    {/* Card footer with kbd hints */}
                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-3 text-xs font-mono text-muted-foreground animate-rise" style={{ animationDelay: '0.66s' }}>
                        <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-foreground/5">↵</kbd> Enter to continue</span>
                        <span className="text-border-strong">·</span>
                        <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-foreground/5">Esc</kbd> Clear</span>
                    </div>
                </div>
            </main>

            <footer className="px-9 pb-6 animate-fade-up" style={{ animationDelay: '0.7s' }}>
                <hr className="border-border mb-4 animate-hairline" style={{ animationDelay: '0.85s' }} />
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
                    <span>v3.18.2</span>
                    <span className="text-border-strong">·</span>
                    <span>© 2026 iDesk</span>
                </div>
            </footer>

            {mustChange && (
                <MustChangePasswordDialog
                    currentPassword={mustChange.password}
                    onSuccess={() => {
                        const role = useAuth.getState().user?.role;
                        updateUser({ mustChangePassword: false });
                        setMustChange(null);
                        if (role) navigateByRole(role);
                    }}
                />
            )}
        </div>
    );
};
