import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle, WifiOff, Lock, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorFromResponse, type LoginError, MAX_LOGIN_ATTEMPTS } from '../utils/loginErrorMapping';
import { useTheme } from '@/hooks/useTheme';
import api from '../../../lib/api';

const DASHBOARD_ROLES = new Set(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE']);

export const BentoLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<LoginError | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [rememberMe, setRememberMe] = useState(false);
    const { theme, toggle: toggleTheme } = useTheme();
    const login = useAuth((state) => state.login);
    const navigate = useNavigate();

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

    useEffect(() => {
        const update = () => {
            const el = document.getElementById('utc-clock');
            if (!el) return;
            const d = new Date();
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            const ss = String(d.getUTCSeconds()).padStart(2, '0');
            el.textContent = `${hh}:${mm}:${ss} UTC`;
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            setLoginError({
                type: 'warning',
                message: !email.trim() ? 'Email is required.' : 'Password is required.',
                details: 'Both email and password are required.',
            });
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

        setLoginError(null);
        setIsLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password });
            const { user } = res.data;
            setFailedAttempts(0);
            login(user);

            if (DASHBOARD_ROLES.has(user.role)) {
                navigate('/dashboard');
            } else if (user.role === 'MANAGER') {
                navigate('/manager/dashboard');
            } else {
                navigate('/client/my-tickets');
            }
        } catch (err: unknown) {
            const newAttemptCount = failedAttempts + 1;
            const error = getErrorFromResponse(err, failedAttempts);
            setLoginError(error);
            if (error.type === 'error' && error.errorCode !== 'USER_NOT_FOUND') {
                setFailedAttempts(newAttemptCount);
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

    return (
        <div className="min-h-screen flex flex-col">
            <header className="flex items-center justify-between px-9 py-5 animate-fade-down">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-purple-500 shadow-sm" />
                    <span className="font-semibold tracking-tight text-foreground">iDesk</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span className="tabular-nums" id="utc-clock">--:--:-- UTC</span>
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

                    {/* Card header */}
                    <div className="flex items-center gap-2 mb-6 text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-widest animate-rise" style={{ animationDelay: '0.08s' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
                        <span>iDesk · Operations</span>
                    </div>

                    <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2 animate-rise" style={{ animationDelay: '0.16s' }}>Sign in</h1>
                    <p className="text-sm text-muted-foreground mb-6 animate-rise" style={{ animationDelay: '0.22s' }}>Enter your credentials to continue.</p>
                    <hr className="border-border mb-6 animate-hairline" style={{ animationDelay: '0.28s' }} />

                    {!isOnline && (
                        <div className="flex items-start gap-3 p-3 mb-4 bg-secondary/80 border border-border rounded-lg text-muted-foreground">
                            <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">System Offline</p>
                                <p className="text-xs mt-0.5">Check your network connection to authenticate.</p>
                            </div>
                        </div>
                    )}

                    {loginError && (
                        <div
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

                    {failedAttempts >= 3 && !loginError && (
                        <div className="flex items-center gap-2 text-warning-500 text-xs font-mono mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {MAX_LOGIN_ATTEMPTS - failedAttempts > 0
                                ? `WARNING: ${MAX_LOGIN_ATTEMPTS - failedAttempts} ATTEMPT(S) REMAINING`
                                : 'CRITICAL: LOGIN SYSTEM LOCKOUT IMMINENT'}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className={cn("space-y-4 animate-rise", loginError && "animate-shake")} style={{ animationDelay: '0.34s' }}>
                        <div className="space-y-2">
                            <label htmlFor="login-email" className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                                Email Address
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className={cn(
                                    "w-full px-4 py-3 bg-background/50 border border-border/50 rounded-lg text-foreground font-medium shadow-sm",
                                    "placeholder:text-muted-foreground/60 transition-colors duration-150",
                                    "focus:outline-none focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20",
                                    "hover:border-border",
                                    loginError?.type === 'error' && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                )}
                                placeholder="user@company.com"
                                autoComplete="email"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label htmlFor="login-password" className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Password
                                </label>
                                {capsLockOn && (
                                    <span className="text-[10px] font-bold tracking-widest text-warning-500 uppercase flex items-center gap-1 animate-pulse">
                                        <AlertTriangle className="w-3 h-3" /> Caps Lock
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
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
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                                    disabled={isLoading}
                                />
                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors select-none">
                                    Keep session active
                                </span>
                            </label>

                            <a href="#" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                                Forgot Password?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !isOnline}
                            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors animate-rise"
                            style={{ animationDelay: '0.52s' }}
                        >
                            Continue
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-muted-foreground animate-rise" style={{ animationDelay: '0.58s' }}>
                        <a href="#" className="border-b border-dashed border-border hover:text-foreground hover:border-foreground pb-0.5">Use single sign-on (SSO)</a>
                    </div>

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
                    <span>All systems normal</span>
                    <span className="text-border-strong">·</span>
                    <span>© 2026 iDesk</span>
                </div>
            </footer>
        </div>
    );
};
