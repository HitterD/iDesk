import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Server, Trash2 } from 'lucide-react';
import FileRetentionSettings from './FileRetentionSettings';
import SynologyBackupSettings from './SynologyBackupSettings';
import { SetHead } from '../components/SettingsParts';

export const StorageSettingsPage = () => {
    const [activeTab, setActiveTab] = useState('retention');

    return (
        <div>
            <SetHead title="Storage" sub="Lokasi penyimpanan lampiran, retensi file, dan backup Synology." />
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                <Tabs.List className="portal-seg dash-seg set-tabs" aria-label="Kategori storage">
                    <Tabs.Trigger value="retention" className="portal-seg-btn set-tab">
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        File Retention
                    </Tabs.Trigger>
                    <Tabs.Trigger value="synology" className="portal-seg-btn set-tab">
                        <Server className="w-3.5 h-3.5" aria-hidden="true" />
                        Synology Backup
                    </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="retention" className="outline-none settings-tab-panel">
                    <FileRetentionSettings />
                </Tabs.Content>

                <Tabs.Content value="synology" className="outline-none settings-tab-panel">
                    <SynologyBackupSettings />
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};

export default StorageSettingsPage;
