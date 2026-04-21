import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertTriangle, WifiOff, Lock, Info, Terminal } from 'lucide-react';
import api from '../../../lib/api';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { Logo } from '../../../components/ui/Logo';

interface LoginError {
    type: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
    errorCode?: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const getErrorFromResponse = (err: unknown, currentAttempts: number): LoginError => {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        const message = data?.message;
        const errorCode = data?.errorCode;

        if (!err.response) {
            return {
                type: 'error',
                message: 'Unable to connect to server',
                details: 'Please check your internet connection and try again.',
            };
        }

        if (errorCode) {
            switch (errorCode) {
                case 'USER_NOT_FOUND':
                    return {
                        type: 'error',
                        message: 'Account not found',
                        details: 'No account exists with this email address.',
                        errorCode,
                    };
                case 'WRONG_PASSWORD':
                    const remainingAttempts = MAX_LOGIN_ATTEMPTS - currentAttempts - 1;
                    return {
                        type: 'error',
                        message: 'Incorrect password',
                        details: remainingAttempts > 0
                            ? `${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
                            : 'This is your last attempt!',
                        errorCode,
                    };
                case 'ACCOUNT_DISABLED':
                    return {
                        type: 'error',
                        message: 'Account suspended',
                        details: 'Please contact the system administrator.',
                        errorCode,
                    };
            }
        }

        switch (status) {
            case 400: return { type: 'error', message: 'Invalid request', details: Array.isArray(message) ? message.join(', ') : message };
            case 401: return { type: 'error', message: message || 'Authentication failed', details: 'Check your credentials.' };
            case 403: return { type: 'error', message: 'Access denied', details: 'Clearance required.' };
            case 423: return { type: 'warning', message: 'Security lock active', details: 'Too many attempts. Wait 15 minutes.' };
            case 429: return { type: 'warning', message: 'Rate limit exceeded', details: `Wait ${RATE_LIMIT_WINDOW_SECONDS} seconds.` };
            case 500: case 502: case 503: return { type: 'error', message: 'Server unavailable', details: 'System offline. Try again later.' };
            default: return { type: 'error', message: message || 'Login failed', details: 'An unexpected error occurred.' };
        }
    }
    return { type: 'error', message: 'Authentication Error', details: 'System malfunction. Please retry.' };
};

export const BentoLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<LoginError | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [rememberMe, setRememberMe] = useState(false);
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    }, []);

    const handleInputChange = useCallback((setter: React.Dispatch<React.SetStateAction<string>>) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            setLoginError({
                type: 'warning',
                message: 'Incomplete credentials',
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

            if (user.role === 'ADMIN' || user.role === 'AGENT') {
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
            case 'info': return <Info className="w-5 h-5 shrink-0" />;
            default: return <Lock className="w-5 h-5 shrink-0" />;
        }
    };

    // Design System implementation: High-End Glassmorphism Bento Grid
    // Uses strictly the existing design tokens (e.g. bg-background, border-border, text-primary, text-muted-foreground)
    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 md:p-8 relative overflow-hidden selection:bg-primary/30">
            
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[120px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[150px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] rounded-full bg-secondary/5 blur-[120px] pointer-events-none" />
            
            {/* Noise / Film Grain CSS Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay z-0" 
                 style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}>
            </div>

            {/* Bento Grid Layout Matrix */}
            <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_auto] gap-4 md:gap-6">
                
                {/* Panel 1: Hero Typography & Branding (Left Side - Spans 1 to 7) */}
                <div className="lg:col-span-7 bg-card/60 backdrop-blur-2xl border border-border/60 rounded-[var(--border-radius-card)] p-8 md:p-12 shadow-2xl flex flex-col justify-end min-h-[300px] lg:min-h-[450px] animate-in fade-in slide-in-from-left-8 duration-1000 ease-out">
                    <div className="flex items-center gap-4 mb-auto pb-8 relative z-20">
                        {/* We use the logo image gracefully, or an icon fallback */}
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                             <img src="/idesk-logo-cartoon.png" alt="iDesk Logo" className="w-8 h-8 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                        </div>
                        <span className="text-3xl font-black tracking-tighter text-foreground">iDesk</span>
                    </div>

                    <div className="relative z-20">
                        <h1 className="text-[3rem] md:text-[4rem] lg:text-[4.5rem] font-bold tracking-tighter leading-[1.05] mb-6 drop-shadow-sm">
                            Intelligent<br />
                            <span className="text-muted-foreground opacity-80 mix-blend-luminosity">Operations.</span>
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-md border-l-2 border-primary/50 pl-6">
                            The unified workspace for high-performance service teams.
                        </p>
                    </div>
                </div>

                {/* Panel 2: Main Authentication Form (Right Side - Spans 8 to 12, Row span matches height) */}
                <div className="lg:col-span-5 lg:row-span-2 bg-card/90 backdrop-blur-3xl border border-border/80 rounded-[var(--border-radius-card)] p-8 md:p-10 lg:p-12 shadow-2xl flex flex-col justify-center relative overflow-hidden animate-in fade-in slide-in-from-right-8 duration-1000 delay-100 ease-out fill-mode-both">
                    
                    {/* Subtle form panel background decoration */}
                    <div className="absolute top-0 right-0 w-[50%] h-[30%] bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none rounded-tr-[var(--border-radius-card)]" />

                    <div className="mb-10 relative z-10">
                        <h2 className="text-3xl font-bold text-foreground tracking-tight mb-2">Sign In</h2>
                        <p className="text-sm font-medium text-muted-foreground">Authenticate to access your workspace.</p>
                    </div>

                    {/* Alerts (Offline / Errors) */}
                    <div className="min-h-[3rem] mb-6 flex flex-col justify-end animate-in fade-in duration-500 relative z-10">
                        {!isOnline && (
                            <div className="flex items-start gap-3 p-3 bg-secondary/80 border border-border rounded-[var(--border-radius-panel)] text-muted-foreground shadow-sm mb-4">
                                <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">System Offline</p>
                                    <p className="text-xs mt-0.5">Check your network connection to authenticate.</p>
                                </div>
                            </div>
                        )}

                        {loginError && (
                            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-[var(--border-radius-panel)] text-red-600 dark:text-red-400">
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
                                {5 - failedAttempts > 0
                                    ? `WARNING: ${5 - failedAttempts} ATTEMPT(S) REMAINING`
                                    : 'CRITICAL: LOGIN SYSTEM LOCKOUT IMMINENT'}
                            </div>
                        )}
                    </div>

                    {/* Form Structure */}
                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10 w-full max-w-sm mx-auto">
                        
                        {/* Email Input */}
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 ease-out fill-mode-both">
                            <label className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={handleInputChange(setEmail)}
                                    onKeyDown={handleKeyDown}
                                    className={cn(
                                        "w-full px-4 py-3 bg-background/50 border border-border/50 rounded-[var(--border-radius-input)] text-foreground font-medium shadow-sm",
                                        "placeholder:text-muted-foreground/60 transition-colors duration-150",
                                        "focus:outline-none focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20",
                                        "hover:border-border",
                                        loginError?.type === 'error' && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                    )}
                                    placeholder="user@company.com"
                                    required
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 ease-out fill-mode-both">
                            <div className="flex justify-between items-end mb-1">
                                <label className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase ml-1">
                                    Password
                                </label>
                                {capsLockOn && (
                                    <span className="text-[10px] font-bold tracking-widest text-warning-500 uppercase flex items-center gap-1 animate-pulse">
                                        <AlertTriangle className="w-3 h-3" /> Caps Lock
                                    </span>
                                )}
                            </div>
                            <div className="relative group">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={handleInputChange(setPassword)}
                                    onKeyDown={handleKeyDown}
                                    className={cn(
                                        "w-full px-4 py-3 bg-background/50 border border-border/50 rounded-[var(--border-radius-input)] text-foreground font-medium pr-12 shadow-sm",
                                        "placeholder:text-muted-foreground/60 transition-colors duration-150",
                                        "focus:outline-none focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20",
                                        "hover:border-border tracking-[0.2em]",
                                        showPassword && "tracking-normal",
                                        loginError?.type === 'error' && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                    )}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forget Password */}
                        <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400 ease-out fill-mode-both pt-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center w-4 h-4 rounded border border-border/80 bg-background/50 group-hover:border-primary/50 transition-colors shadow-sm">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="absolute opacity-0 w-full h-full cursor-pointer peer"
                                        disabled={isLoading}
                                    />
                                    <svg className={cn("w-3 h-3 text-primary transition-transform scale-0 peer-checked:scale-100", rememberMe && "scale-100")} viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors select-none">
                                    Keep session active
                                </span>
                            </label>

                            <a href="#" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                                Forgot Password?
                            </a>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !isOnline}
                            className={cn(
                                "relative w-full overflow-hidden rounded-[var(--border-radius-button)] mt-8 h-12 flex items-center justify-center gap-2",
                                "bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase shadow-primary",
                                "hover:bg-primary/95 hover:shadow-lg active:scale-[0.98]",
                                "disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:cursor-not-allowed",
                                "transition-[opacity,transform,colors] duration-200 ease-out group",
                                "animate-in fade-in slide-in-from-bottom-4 delay-500 ease-out fill-mode-both"
                            )}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 transition-transform duration-300 group-hover:-translate-x-1">Authenticate</span>
                                    <ArrowRight className="w-4 h-4 relative z-10 transition-[color,transform] duration-150 opacity-80 group-hover:opacity-100 group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Panel 3: System Telemetry (Left Bottom, smaller - Spans 1 to 4) */}
                <div className="hidden lg:flex lg:col-span-4 bg-card/50 backdrop-blur-md border border-border/50 rounded-[var(--border-radius-panel)] p-6 shadow-lg flex-col justify-between overflow-hidden relative group animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 ease-out fill-mode-both">
                    {/* Decorative node link graph in background */}
                    <div className="absolute right-[-20%] bottom-[-20%] opacity-10 pointer-events-none transition-transform duration-700 group-hover:scale-110">
                        <Terminal className="w-40 h-40" strokeWidth={0.5} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-6 relative z-10">
                        <span>System Health</span>
                        <span className="flex items-center gap-2 text-success-500">
                            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span> Optimal
                        </span>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs text-muted-foreground font-medium">LTC-ZONE-4</span>
                                <span className="text-xs font-mono font-bold text-foreground">12ms</span>
                            </div>
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-1/4 rounded-full transition-[opacity,transform,colors] duration-200 ease-out"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1 pt-1">
                                <span className="text-xs text-muted-foreground font-medium">CORE UPTIME</span>
                                <span className="text-xs font-mono font-bold text-foreground">99.99%</span>
                            </div>
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-success-500 w-[99%] rounded-full transition-[opacity,transform,colors] duration-200 ease-out"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel 4: Security Protocol (Middle Bottom, smaller - Spans 5 to 7) */}
                <div className="hidden lg:flex lg:col-span-3 bg-card/50 backdrop-blur-md border border-border/50 rounded-[var(--border-radius-panel)] p-6 shadow-lg flex-col justify-between animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 ease-out fill-mode-both">
                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
                        <Lock className="w-3.5 h-3.5 text-primary" /> Security Protocol
                    </div>
                    
                    <div className="mt-auto space-y-4">
                        <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Connection</p>
                            <span className="inline-flex text-xs font-mono font-semibold text-foreground bg-secondary/50 px-2.5 py-1 rounded-md border border-border/50">
                                TLS 1.3 SECURE
                            </span>
                        </div>
                        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium mb-0.5 uppercase tracking-wider">Admin Desk</p>
                            </div>
                            <a href="tel:1604" className="text-xs font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-1.5 rounded-[var(--border-radius-button)] hover:bg-primary hover:text-primary-foreground font-bold transition-colors">
                                EXT. 1604
                            </a>
                        </div>
                    </div>
                </div>

            </div>

            {/* Micro Copyright Mark on Bottom Right */}
            <div className="absolute right-8 bottom-6 z-10 text-[10px] text-muted-foreground/50 font-medium tracking-wide animate-in fade-in delay-1000">
                &copy; {new Date().getFullYear()} iDesk Solutions.
            </div>
            
        </div>
    );
};
