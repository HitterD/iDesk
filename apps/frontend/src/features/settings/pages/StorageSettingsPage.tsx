import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { HardDrive, Server, Trash2 } from 'lucide-react';
import FileRetentionSettings from './FileRetentionSettings';
import SynologyBackupSettings from './SynologyBackupSettings';

export const StorageSettingsPage = () => {
    const [activeTab, setActiveTab] = useState('retention');

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <HardDrive className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Storage Settings</h1>
                    <p className="text-sm text-slate-500">Manage file retention and backup configurations</p>
                </div>
            </div>

            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <Tabs.List className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                    <Tabs.Trigger
                        value="retention"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-primary data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    >
                        <Trash2 className="w-4 h-4" />
                        File Retention
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="synology"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-primary data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    >
                        <Server className="w-4 h-4" />
                        Synology Backup
                    </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="retention" className="outline-none animate-in fade-in duration-300">
                    <FileRetentionSettings />
                </Tabs.Content>

                <Tabs.Content value="synology" className="outline-none animate-in fade-in duration-300">
                    <SynologyBackupSettings />
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};

export default StorageSettingsPage;
