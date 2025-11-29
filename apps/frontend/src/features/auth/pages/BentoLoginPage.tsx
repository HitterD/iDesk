import React, { useState } from 'react';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import api from '../../../lib/api';

export const BentoLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const login = useAuth((state) => state.login);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            const { access_token, user } = res.data;

            login(access_token, user);

            if (user.role === 'ADMIN') {
                navigate('/dashboard');
            } else {
                navigate('/client/my-tickets');
            }
        } catch (err: any) {
            setError('Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Abstract Background Shapes */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/30 rounded-full blur-3xl animate-pulse delay-1000"></div>

            <div className="w-full max-w-md bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-soft border border-white/50 relative z-10">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                        <span className="text-white font-bold text-3xl">iD</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h2>
                    <p className="text-slate-500">Sign in to access your workspace</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-center text-sm font-medium border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all outline-none text-slate-800 placeholder:text-slate-400"
                            placeholder="name@company.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all outline-none text-slate-800 placeholder:text-slate-400 pr-12"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                <div className="mt-8 text-center">
                    <p className="text-slate-400 text-sm">
                        Don't have an account? <span className="text-primary font-bold cursor-pointer hover:underline">Contact Admin</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
