import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/lib/api';

export const BentoFeedbackPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            setError('Invalid survey link.');
            return;
        }
        if (rating === 0) {
            setError('Please select a rating.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await api.post('/surveys/submit', {
                token,
                rating,
                comment,
            });
            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Failed to submit feedback:', err);
            setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full text-center"
                >
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shadow-inner">
                            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Thank You!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                        Your feedback helps us improve our support experience.
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 max-w-lg w-full"
            >
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-slate-900 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg">
                            <MessageSquare className="w-8 h-8 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">How did we do?</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                        Please rate your experience with our support team.
                    </p>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm text-center font-medium border border-red-100 dark:border-red-900/30">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="flex justify-center gap-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoveredRating(star)}
                                onMouseLeave={() => setHoveredRating(0)}
                                className="focus:outline-none transition-all hover:scale-110 active:scale-95"
                            >
                                <Star
                                    className={`w-12 h-12 transition-colors ${star <= (hoveredRating || rating)
                                        ? 'fill-yellow-400 text-yellow-400 drop-shadow-md'
                                        : 'text-slate-200 dark:text-slate-700'
                                        }`}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="text-center text-lg font-bold text-slate-600 dark:text-slate-300 h-6">
                        {hoveredRating === 1 && 'Poor'}
                        {hoveredRating === 2 && 'Fair'}
                        {hoveredRating === 3 && 'Good'}
                        {hoveredRating === 4 && 'Very Good'}
                        {hoveredRating === 5 && 'Excellent!'}
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                            Additional Comments (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={4}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl focus:ring-2 focus:ring-primary/50 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none text-slate-800 dark:text-white placeholder:text-slate-400 resize-none"
                            placeholder="Tell us what we can do better..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || rating === 0}
                        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            'Submitting...'
                        ) : (
                            <>
                                <Send className="w-5 h-5" /> Submit Feedback
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};
