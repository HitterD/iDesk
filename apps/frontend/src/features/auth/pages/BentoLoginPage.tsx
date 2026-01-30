import React, { useState, useEffect, useCallback } from 'react';
import { Logo } from '../../../components/ui/Logo';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertTriangle, WifiOff, Lock, Info } from 'lucide-react';
import api from '../../../lib/api';
import axios from 'axios';
import { cn } from '@/lib/utils';

interface LoginError {
    type: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
    errorCode?: string;
}

// Rate limit constants
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Error message mapping based on backend response
const getErrorFromResponse = (err: unknown, currentAttempts: number): LoginError => {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        const message = data?.message;
        const errorCode = data?.errorCode;

        // Network error
        if (!err.response) {
            return {
                type: 'error',
                message: 'Unable to connect to server',
                details: 'Please check your internet connection and try again.',
            };
        }

        // Handle specific error codes from backend
        if (errorCode) {
            switch (errorCode) {
                case 'USER_NOT_FOUND':
                    return {
                        type: 'error',
                        message: 'Account not found',
                        details: 'No account exists with this email address. Please check and try again.',
                        errorCode,
                    };
                case 'WRONG_PASSWORD':
                    const remainingAttempts = MAX_LOGIN_ATTEMPTS - currentAttempts - 1;
                    return {
                        type: 'error',
                        message: 'Incorrect password',
                        details: remainingAttempts > 0
                            ? `Password is incorrect. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
                            : 'Password is incorrect. This is your last attempt!',
                        errorCode,
                    };
                case 'ACCOUNT_DISABLED':
                    return {
                        type: 'error',
                        message: 'Account disabled',
                        details: 'Your account has been disabled. Please contact the administrator.',
                        errorCode,
                    };
            }
        }

        // Specific HTTP status handling
        switch (status) {
            case 400:
                return {
                    type: 'error',
                    message: 'Invalid request',
                    details: Array.isArray(message) ? message.join(', ') : message,
                };
            case 401:
                return {
                    type: 'error',
                    message: message || 'Invalid email or password',
                    details: 'Please check your credentials and try again.',
                };
            case 403:
                return {
                    type: 'error',
                    message: 'Account access denied',
                    details: 'Your account may be disabled. Contact administrator.',
                };
            case 423:
                return {
                    type: 'warning',
                    message: 'Account temporarily locked',
                    details: 'Too many failed attempts. Please try again in 15 minutes.',
                };
            case 429:
                return {
                    type: 'warning',
                    message: 'Rate limit exceeded',
                    details: `Too many login attempts. Please wait ${RATE_LIMIT_WINDOW_SECONDS} seconds before trying again.`,
                };
            case 500:
            case 502:
            case 503:
                return {
                    type: 'error',
                    message: 'Server error',
                    details: 'Service is temporarily unavailable. Please try again later.',
                };
            default:
                return {
                    type: 'error',
                    message: message || 'Login failed',
                    details: 'An unexpected error occurred.',
                };
        }
    }

    return {
        type: 'error',
        message: 'Login failed',
        details: 'An unexpected error occurred. Please try again.',
    };
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

    // Monitor online/offline status
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

    // Detect Caps Lock
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    }, []);

    // Handle input change - error persists until successful login
    const handleInputChange = useCallback((setter: React.Dispatch<React.SetStateAction<string>>) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            setter(e.target.value);
            // Error message stays visible until user successfully logs in
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation
        if (!email.trim()) {
            setLoginError({
                type: 'warning',
                message: 'Email is required',
                details: 'Please enter your email address.',
            });
            return;
        }

        if (!password) {
            setLoginError({
                type: 'warning',
                message: 'Password is required',
                details: 'Please enter your password.',
            });
            return;
        }

        // Check online status
        if (!isOnline) {
            setLoginError({
                type: 'error',
                message: 'No internet connection',
                details: 'Please check your network and try again.',
            });
            return;
        }

        setLoginError(null);
        setIsLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password });
            // Token is now set via HttpOnly cookie by backend
            // We only receive user data in response
            const { user } = res.data;

            // Reset failed attempts on success
            setFailedAttempts(0);

            // Store user in Zustand (token is in HttpOnly cookie)
            login(user);

            if (user.role === 'ADMIN' || user.role === 'AGENT') {
                navigate('/dashboard');
            } else if (user.role === 'MANAGER') {
                navigate('/manager/dashboard');
            } else {
                navigate('/client/my-tickets');
            }
        } catch (err: unknown) {
            // Pass current attempts to get remaining count in error message
            const newAttemptCount = failedAttempts + 1;
            const error = getErrorFromResponse(err, failedAttempts);
            setLoginError(error);

            // Track failed attempts (only for auth errors)
            if (error.type === 'error' && error.errorCode !== 'USER_NOT_FOUND') {
                setFailedAttempts(newAttemptCount);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Alert icon based on error type
    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'warning':
                return <AlertTriangle className="w-5 h-5 shrink-0" />;
            case 'info':
                return <Info className="w-5 h-5 shrink-0" />;
            default:
                return <Lock className="w-5 h-5 shrink-0" />;
        }
    };

    // Alert styles based on type
    const getAlertStyles = (type: string) => {
        switch (type) {
            case 'warning':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'info':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            default:
                return 'bg-red-50 text-red-600 border-red-200';
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Abstract Background Shapes */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/30 rounded-full blur-3xl animate-pulse delay-1000"></div>

            {/* Enhanced Glassmorphism Card */}
            <div className="w-full max-w-md bg-white/60 backdrop-blur-3xl p-8 rounded-[3rem] shadow-2xl border-2 border-white/80 relative z-10">
                <div className="text-center mb-8">
                    <Logo size="xl" variant="icon" className="mx-auto mb-4 ring-4 ring-white/50 rounded-2xl" animated />
                    <h2 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Welcome Back</h2>
                    <p className="text-slate-600 font-medium">Sign in to access your workspace</p>
                </div>

                {/* Offline Warning */}
                {!isOnline && (
                    <div className="flex items-center gap-3 bg-slate-100/80 backdrop-blur-sm text-slate-700 p-4 rounded-2xl mb-6 border border-slate-200">
                        <WifiOff className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-bold text-sm">You're offline</p>
                            <p className="text-xs text-slate-600">Check your internet connection</p>
                        </div>
                    </div>
                )}

                {/* Error/Warning Display */}
                {loginError && (
                    <div
                        className={cn(
                            "flex items-start gap-3 p-4 rounded-2xl mb-6 border-2 animate-in slide-in-from-top-2 duration-300 shadow-sm",
                            getAlertStyles(loginError.type)
                        )}
                        role="alert"
                    >
                        {getAlertIcon(loginError.type)}
                        <div>
                            <p className="font-bold text-sm">{loginError.message}</p>
                            {loginError.details && (
                                <p className="text-xs mt-1 font-medium opacity-90">{loginError.details}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Too many failed attempts warning */}
                {failedAttempts >= 3 && !loginError && (
                    <div className="flex items-start gap-3 bg-amber-50/90 text-amber-800 p-4 rounded-2xl mb-6 border-2 border-amber-200">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-bold text-sm">Multiple failed attempts</p>
                            <p className="text-xs mt-1 font-medium">
                                {5 - failedAttempts > 0
                                    ? `${5 - failedAttempts} attempts remaining before lockout`
                                    : 'Account may be locked soon'
                                }
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={handleInputChange(setEmail)}
                            onKeyDown={handleKeyDown}
                            className={cn(
                                "w-full px-6 py-4 bg-white/70 border-2 border-slate-200 rounded-2xl transition-all duration-300",
                                "focus:ring-4 focus:ring-primary/20 focus:border-primary focus:bg-white",
                                "hover:border-primary/50",
                                "outline-none text-slate-800 font-medium placeholder:text-slate-400",
                                loginError?.type === 'error' && "border-red-300 bg-red-50/50 focus:ring-red-200 focus:border-red-400"
                            )}
                            placeholder="name@company.com"
                            required
                            autoComplete="email"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={handleInputChange(setPassword)}
                                onKeyDown={handleKeyDown}
                                className={cn(
                                    "w-full px-6 py-4 bg-white/70 border-2 border-slate-200 rounded-2xl transition-all duration-300",
                                    "focus:ring-4 focus:ring-primary/20 focus:border-primary focus:bg-white",
                                    "hover:border-primary/50",
                                    "outline-none text-slate-800 font-medium placeholder:text-slate-400 pr-12",
                                    loginError?.type === 'error' && "border-red-300 bg-red-50/50 focus:ring-red-200 focus:border-red-400"
                                )}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Caps Lock Warning */}
                        {capsLockOn && (
                            <p className="text-xs text-amber-600 ml-2 flex items-center gap-1 animate-in fade-in duration-200">
                                <AlertTriangle className="w-3 h-3" />
                                Caps Lock is on
                            </p>
                        )}
                    </div>

                    {/* Remember Me Checkbox */}
                    <div className="flex items-center gap-3 px-2">
                        <input
                            type="checkbox"
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/50 cursor-pointer"
                            disabled={isLoading}
                        />
                        <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
                            Remember me
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !isOnline}
                        className={cn(
                            "w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg",
                            "hover:bg-slate-800 hover:shadow-lg hover:scale-[1.02]",
                            "active:scale-[0.98] transition-all duration-300",
                            "flex items-center justify-center gap-2",
                            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        )}
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Sign In <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                {/* Contact Admin Card */}
                <div className="mt-8 p-4 bg-slate-50/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-slate-600 text-xs font-medium">Butuh bantuan atau akun baru?</p>
                            <p className="text-slate-800 font-bold">Hubungi Admin</p>
                        </div>
                        <a
                            href="tel:1604"
                            className="px-4 py-2 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                        >
                            Ext. 1604
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
