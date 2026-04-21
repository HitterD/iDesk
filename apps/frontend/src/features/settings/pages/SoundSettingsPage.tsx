import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Volume2, VolumeX, Upload, Play, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSoundNotification } from '@/hooks/useSoundNotification';

interface NotificationSound {
    id: string;
    eventType: string;
    soundName: string;
    soundUrl: string;
    isDefault: boolean;
    isActive: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    'new_ticket': 'Tiket Baru',
    'message': 'Pesan Baru',
    'assigned': 'Tiket Ditugaskan',
    'resolved': 'Tiket Selesai',
    'critical': 'Alert Critical',
    'sla_warning': 'SLA Warning',
    'sla_breach': 'SLA Breach',
};

export const SoundSettingsPage = () => {
    const [sounds, setSounds] = useState<NotificationSound[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const { enabled, volume, setEnabled, setVolume, testSound, clearCache } = useSoundNotification();

    useEffect(() => {
        fetchSounds();
    }, []);

    const fetchSounds = async () => {
        try {
            const response = await fetch('/api/sounds', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setSounds(data);
            }
        } catch (error) {
            toast.error('Failed to load sounds');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (eventType: string, file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('eventType', eventType);
            formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

            const response = await fetch('/api/sounds/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: formData,
            });

            if (response.ok) {
                toast.success('Sound uploaded successfully');
                clearCache();
                fetchSounds();
            } else {
                toast.error('Failed to upload sound');
            }
        } catch (error) {
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSetActive = async (eventType: string, soundId: string) => {
        try {
            const response = await fetch(`/api/sounds/set-active/${eventType}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ soundId }),
            });

            if (response.ok) {
                toast.success('Active sound updated');
                clearCache();
                fetchSounds();
            }
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const handleDelete = async (soundId: string) => {
        try {
            const response = await fetch(`/api/sounds/${soundId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.ok) {
                toast.success('Sound deleted');
                clearCache();
                fetchSounds();
            }
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const handleTestSound = async (eventType: string) => {
        await testSound(eventType as any);
    };

    // Group sounds by event type
    const groupedSounds = sounds.reduce((acc, sound) => {
        if (!acc[sound.eventType]) {
            acc[sound.eventType] = [];
        }
        acc[sound.eventType].push(sound);
        return acc;
    }, {} as Record<string, NotificationSound[]>);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Sound Settings</h1>
                <p className="text-muted-foreground">Manage notification sounds for different events</p>
            </div>

            {/* Global Sound Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                        Sound Preferences
                    </CardTitle>
                    <CardDescription>
                        Configure global sound notification settings
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-base">Enable Sound Notifications</Label>
                            <p className="text-sm text-muted-foreground">Play sounds for new tickets and updates</p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Volume: {Math.round(volume * 100)}%</Label>
                            <Button variant="outline" size="sm" onClick={() => testSound('NEW_TICKET')}>
                                <Play className="h-4 w-4 mr-1" />
                                Test
                            </Button>
                        </div>
                        <Slider
                            value={[volume * 100]}
                            onValueChange={([val]) => setVolume(val / 100)}
                            max={100}
                            step={5}
                            disabled={!enabled}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Sound List by Event Type */}
            <Card>
                <CardHeader>
                    <CardTitle>Notification Sounds</CardTitle>
                    <CardDescription>
                        Customize sounds for each notification type
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event Type</TableHead>
                                    <TableHead>Sound Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(groupedSounds).map(([eventType, typeSounds]) => (
                                    typeSounds.map((sound, idx) => (
                                        <TableRow key={sound.id}>
                                            {idx === 0 && (
                                                <TableCell rowSpan={typeSounds.length} className="font-medium">
                                                    {EVENT_TYPE_LABELS[eventType] || eventType}
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {sound.soundName}
                                                    {sound.isDefault && (
                                                        <Badge variant="secondary">Default</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {sound.isActive ? (
                                                    <Badge className="bg-green-500">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleTestSound(eventType)}
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </Button>
                                                    {!sound.isActive && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleSetActive(eventType, sound.id)}
                                                        >
                                                            Set Active
                                                        </Button>
                                                    )}
                                                    {!sound.isDefault && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(sound.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Upload Custom Sound */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Upload Custom Sound
                    </CardTitle>
                    <CardDescription>
                        Upload your own sound files (MP3, max 5MB)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Input
                            type="file"
                            accept="audio/*"
                            disabled={uploading}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    // For demo, upload to NEW_TICKET. In real app, show event type selector
                                    handleUpload('new_ticket', file);
                                }
                            }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Supported formats: MP3, WAV, OGG. Maximum file size: 5MB.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default SoundSettingsPage;
