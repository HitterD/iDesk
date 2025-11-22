import React from 'react';
import { Link } from 'react-router-dom';

export const UnauthorizedPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-navy-main text-white">
            <h1 className="text-4xl font-bold mb-4">Unauthorized</h1>
            <p className="mb-8">You do not have permission to view this page.</p>
            <Link to="/" className="text-neon-blue hover:underline">
                Go back home
            </Link>
        </div>
    );
};
