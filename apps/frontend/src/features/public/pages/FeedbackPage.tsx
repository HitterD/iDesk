import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../../lib/api';

export const FeedbackPage: React.FC = () => {
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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
                >
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h2>
                    <p className="text-slate-600">
                        Your feedback helps us improve our support experience.
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full"
            >
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-navy-main rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-6 h-6 text-neon-green" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">How did we do?</h1>
                    <p className="text-slate-500 mt-2">
                        Please rate your experience with our support team.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoveredRating(star)}
                                onMouseLeave={() => setHoveredRating(0)}
                                className="focus:outline-none transition-transform hover:scale-110"
                            >
                                <Star
                                    className={`w-10 h-10 ${star <= (hoveredRating || rating)
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-slate-300'
                                        }`}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="text-center text-sm font-medium text-slate-600 h-5">
                        {hoveredRating === 1 && 'Poor'}
                        {hoveredRating === 2 && 'Fair'}
                        {hoveredRating === 3 && 'Good'}
                        {hoveredRating === 4 && 'Very Good'}
                        {hoveredRating === 5 && 'Excellent!'}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Additional Comments (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-navy-main focus:ring-1 focus:ring-navy-main outline-none transition-colors resize-none text-slate-700"
                            placeholder="Tell us what we can do better..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || rating === 0}
                        className="w-full bg-navy-main text-white py-3 rounded-lg font-medium hover:bg-navy-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            'Submitting...'
                        ) : (
                            <>
                                <Send className="w-4 h-4" /> Submit Feedback
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};
