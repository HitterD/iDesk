import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { Lock, Mail, Loader2 } from 'lucide-react';
import api from '../../../lib/api';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const login = useAuth((state) => state.login);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormValues) => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await api.post('/auth/login', data);
            const { access_token, user } = res.data;

            login(access_token, user);

            if (user.role === 'ADMIN') {
                navigate('/dashboard');
            } else {
                navigate('/client/my-tickets');
            }
        } catch (err: any) {
            console.error('Login failed:', err);
            setError(err.response?.data?.message || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-navy-main flex items-center justify-center relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-neon-green/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-neon-orange/20 rounded-full blur-[100px] animate-pulse delay-1000" />

            {/* Glassmorphism Card */}
            <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-slate-400">Sign in to access your dashboard</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                {...register('email')}
                                type="email"
                                className="block w-full pl-10 pr-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-colors"
                                placeholder="you@example.com"
                            />
                        </div>
                        {errors.email && (
                            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                {...register('password')}
                                type="password"
                                className="block w-full pl-10 pr-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        {errors.password && (
                            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-navy-main bg-neon-green hover:bg-neon-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-green disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
