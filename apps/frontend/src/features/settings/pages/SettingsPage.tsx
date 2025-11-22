import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { User, Lock, Palette, Save } from 'lucide-react';
import { useAuth } from '../../../stores/useAuth';
import { ProfileSettingsForm } from '../components/ProfileSettingsForm';

export const SettingsPage: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>

            <Tabs.Root defaultValue="profile" className="flex flex-col w-full">
                <Tabs.List className="flex border-b border-white/10 mb-6">
                    {[
                        { value: 'profile', icon: User, label: 'Profile' },
                        { value: 'security', icon: Lock, label: 'Security' },
                        { value: 'appearance', icon: Palette, label: 'Appearance' },
                    ].map((tab) => (
                        <Tabs.Trigger
                            key={tab.value}
                            value={tab.value}
                            className="group flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-400 hover:text-white border-b-2 border-transparent data-[state=active]:border-neon-green data-[state=active]:text-neon-green transition-all outline-none"
                        >
                            <tab.icon className="w-4 h-4 group-data-[state=active]:text-neon-green" />
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                <Tabs.Content value="profile" className="outline-none animate-in fade-in slide-in-from-bottom-2">
                    <ProfileSettingsForm user={user} />
                </Tabs.Content>

                <Tabs.Content value="security" className="outline-none animate-in fade-in slide-in-from-bottom-2">
                    <div className="max-w-2xl bg-navy-light border border-white/10 rounded-xl p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Current Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">New Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Confirm New Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                                />
                            </div>
                        </div>
                        <div className="pt-4">
                            <button className="flex items-center gap-2 px-6 py-2 bg-neon-green text-navy-main font-bold rounded-lg hover:bg-neon-green/90 transition-colors">
                                <Save className="w-4 h-4" />
                                Update Password
                            </button>
                        </div>
                    </div>
                </Tabs.Content>

                <Tabs.Content value="appearance" className="outline-none animate-in fade-in slide-in-from-bottom-2">
                    <div className="max-w-2xl bg-navy-light border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-medium text-white mb-4">Theme Preference</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button className="p-4 rounded-xl border-2 border-neon-green bg-navy-main text-left space-y-2">
                                <div className="w-full h-24 bg-navy-light rounded-lg border border-white/10" />
                                <p className="font-medium text-white">Dark Mode</p>
                                <p className="text-xs text-slate-400">Default high-contrast theme</p>
                            </button>
                            <button className="p-4 rounded-xl border border-white/10 bg-white/5 text-left space-y-2 hover:border-white/20 transition-colors">
                                <div className="w-full h-24 bg-slate-200 rounded-lg" />
                                <p className="font-medium text-white">Light Mode</p>
                                <p className="text-xs text-slate-400">Clean, bright interface</p>
                            </button>
                        </div>
                    </div>
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};
