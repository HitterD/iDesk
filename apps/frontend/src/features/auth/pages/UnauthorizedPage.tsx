import React from 'react';
import { Link } from 'react-router-dom';

export const UnauthorizedPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <h1 className="text-4xl font-bold mb-4">Unauthorized</h1>
            <p className="mb-8 text-slate-600 dark:text-slate-400">You do not have permission to view this page.</p>
            <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Go back home
            </Link>
        </div>
    );
};
