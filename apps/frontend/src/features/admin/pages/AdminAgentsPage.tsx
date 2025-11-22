import React, { useState } from 'react';
import { Users, Upload } from 'lucide-react';
import { ImportUsersDialog } from '../components/ImportUsersDialog';
import { AddUserDialog } from '../components/AddUserDialog';

export const AdminAgentsPage: React.FC = () => {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Agent Management</h1>
                    <p className="text-slate-400">Manage your support agents and users.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAddUserModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-neon-green text-navy-dark font-bold rounded-lg hover:bg-neon-green/90 transition-colors"
                    >
                        <Users className="w-4 h-4" />
                        Add User
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-navy-light border border-neon-green/30 text-neon-green rounded-lg hover:bg-neon-green/10 transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        Import Users
                    </button>
                </div>
            </div>

            {/* Placeholder for Agent Table - To be implemented fully later or reused */}
            <div className="bg-navy-light border border-white/10 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Agent List</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                    Agent list and role management will be displayed here.
                    For now, use the "Import Users" button to bulk onboard users.
                </p>
            </div>

            <ImportUsersDialog
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
            <AddUserDialog
                isOpen={isAddUserModalOpen}
                onClose={() => setIsAddUserModalOpen(false)}
            />
        </div>
    );
};
