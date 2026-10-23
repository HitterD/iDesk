import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { useMyPermissions } from '@/hooks/usePermissions';
import { logger } from '@/lib/logger';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import {
    ATTACHMENT_TOTAL_ERROR,
    MAX_ATTACHMENTS_PER_TICKET,
    fitsAttachmentTotal,
    validateAttachmentFile,
} from '@/lib/file-validation';
import { RequesterSelector } from '../components/RequesterSelector';
import {
    BASE_CATEGORY_OPTIONS,
    REQUEST_CARDS,
    TICKETING_CARDS,
    TICKET_FORM_CONFIG,
    TICKET_TYPES,
    matchesCatalogQuery,
    type TicketCardConfig,
    type TicketTemplate,
    type TicketType,
} from '../components/create-ticket/createTicketConfig';
import { TicketCatalogSection, TicketTypeCard } from '../components/create-ticket/TicketTypeCard';
import {
    CriticalReasonField,
    DraftStatus,
    ErrorBanner,
    SubmitBar,
    TemplateChips,
    TicketFormHeader,
    TicketFormRow,
    TicketFormSection,
    TitleField,
    UrgencySegment,
} from '../components/create-ticket/TicketFormSection';
import { DescriptionComposer, type PreviewItem } from '../components/create-ticket/DescriptionComposer';
import { AddAttributeModal, ClassificationFields, LightboxModal, type AttributeKind } from '../components/create-ticket/ClassificationFields';

interface TicketDraft {
    title: string;
    description: string;
    priority: string;
    category: string;
    device: string;
    software: string;
    criticalReason?: string;
    savedAt: string;
}

/** Shape returned by GET /ticket-attributes (see backend ticket-attributes.service.ts). */
interface TicketAttribute {
    id: string;
    type: string;
    value: string;
}

interface TicketAttributes {
    categories: TicketAttribute[];
    priorities: TicketAttribute[];
    devices: TicketAttribute[];
    software: TicketAttribute[];
}

const DRAFT_AUTOSAVE_DELAY_MS = 2_000;

const getDraftStorageKey = (type: TicketType) => `ticket-draft-${type}`;

function getInitialTicketType(value: string | null): TicketType {
    return value && TICKET_TYPES.includes(value as TicketType) ? value as TicketType : 'none';
}

/** Option values stay the attribute's stored value (what the backend expects); IDs keep keys unique. */
const toPickerOptions = (attrs: TicketAttribute[]) => attrs.map(attr => ({ value: attr.value, label: attr.value }));

export const BentoCreateTicketPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { data: myPermissions } = useMyPermissions();
    const [isLoading, setIsLoading] = useState(false);
    const isStaff = Boolean(user?.role && user.role !== 'USER');
    // null = the ticket is for the staff member themself.
    const [requesterId, setRequesterId] = useState<string | null>(null);

    const initialType = getInitialTicketType(searchParams.get('type'));
    const [ticketType, setTicketType] = useState<TicketType>(initialType);

    const [attributes, setAttributes] = useState<TicketAttributes>({ categories: [], priorities: [], devices: [], software: [] });
    const [attributesError, setAttributesError] = useState(false);
    const [showAddModal, setShowAddModal] = useState<{ type: string; show: boolean }>({ type: '', show: false });
    const [newAttributeValue, setNewAttributeValue] = useState('');
    const [isAddingAttribute, setIsAddingAttribute] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        category: '',
        device: '',
        software: '',
        criticalReason: '',
    });

    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [catalogQuery, setCatalogQuery] = useState('');
    const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
    // Setters store `undefined` for valid fields, so check for an actual message.
    const hasFieldErrors = Boolean(errors.title || errors.description);
    const titleRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);

    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lightboxItem, setLightboxItem] = useState<PreviewItem | null>(null);

    // Object URL Map for image previews (cleaned up on file removal / unmount)
    const filePreviewMap = useMemo(() => {
        const map = new Map<File, string>();
        files.forEach((file) => {
            if (file.type.startsWith('image/')) {
                map.set(file, URL.createObjectURL(file));
            }
        });
        return map;
    }, [files]);

    useEffect(() => {
        return () => {
            filePreviewMap.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [filePreviewMap]);

    const validateTitle = (val: string) => {
        const trimmed = val.trim();
        if (trimmed.length > 0 && trimmed.length < 5) {
            return 'Judul tiket minimal 5 karakter';
        }
        return undefined;
    };

    const validateDescription = (val: string) => {
        const trimmed = val.trim();
        if (trimmed.length > 0 && trimmed.length < 10) {
            return 'Deskripsi tiket minimal 10 karakter';
        }
        return undefined;
    };

    const [hasDraft, setHasDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync ticketType with URL searchParams if it changes
    useEffect(() => {
        const typeFromUrl = getInitialTicketType(searchParams.get('type'));
        if (typeFromUrl !== ticketType) {
            setTicketType(typeFromUrl);
        }
    }, [searchParams]);

    // Load type-scoped draft whenever ticketType changes
    useEffect(() => {
        if (ticketType === 'none') {
            setHasDraft(false);
            setLastSaved(null);
            setSelectedTemplate(null);
            return;
        }

        const draftKey = getDraftStorageKey(ticketType);
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const draft: TicketDraft = JSON.parse(savedDraft);
                setFormData({
                    title: draft.title || '',
                    description: draft.description || '',
                    priority: draft.priority || 'MEDIUM',
                    category: draft.category || '',
                    device: draft.device || '',
                    software: draft.software || '',
                    criticalReason: draft.criticalReason || '',
                });
                setLastSaved(new Date(draft.savedAt));
                setHasDraft(true);
            } else {
                setFormData({
                    title: '',
                    description: '',
                    priority: 'MEDIUM',
                    category: '',
                    device: '',
                    software: '',
                    criticalReason: '',
                });
                setHasDraft(false);
                setLastSaved(null);
            }
        } catch (error) {
            logger.error('Failed to load scoped draft:', error);
        }
        setErrors({});
        setSelectedTemplate(null);
    }, [ticketType]);

    // Auto-save draft per ticket type (debounced)
    const saveDraft = useCallback(() => {
        if (ticketType === 'none') return;
        if (!formData.title.trim() && !formData.description.trim()) {
            return;
        }

        const draftKey = getDraftStorageKey(ticketType);
        try {
            const draft: TicketDraft = {
                ...formData,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem(draftKey, JSON.stringify(draft));
            setLastSaved(new Date());
            setHasDraft(true);
        } catch (error) {
            logger.error('Failed to save scoped draft:', error);
        }
    }, [formData, ticketType]);

    useEffect(() => {
        if (ticketType === 'none') return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            saveDraft();
        }, DRAFT_AUTOSAVE_DELAY_MS);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [formData, saveDraft, ticketType]);

    const clearDraft = useCallback(() => {
        if (ticketType === 'none') return;
        const draftKey = getDraftStorageKey(ticketType);
        let snapshot: TicketDraft | null = null;
        try {
            const raw = localStorage.getItem(draftKey);
            if (raw) snapshot = JSON.parse(raw) as TicketDraft;
        } catch { /* ignore */ }

        try {
            localStorage.removeItem(draftKey);
            setHasDraft(false);
            setLastSaved(null);
            setSelectedTemplate(null);
            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                category: '',
                device: '',
                software: '',
                criticalReason: '',
            });
            setErrors({});
            toast.success('Draft dibersihkan', snapshot ? {
                description: 'Draft formulir berhasil dihapus.',
                action: {
                    label: 'Undo',
                    onClick: () => {
                        if (!snapshot) return;
                        try {
                            localStorage.setItem(draftKey, JSON.stringify(snapshot));
                            setFormData({
                                title: snapshot.title || '',
                                description: snapshot.description || '',
                                priority: snapshot.priority || 'MEDIUM',
                                category: snapshot.category || '',
                                device: snapshot.device || '',
                                software: snapshot.software || '',
                                criticalReason: snapshot.criticalReason || '',
                            });
                            setLastSaved(snapshot.savedAt ? new Date(snapshot.savedAt) : new Date());
                            setHasDraft(true);
                            toast.success('Draft dipulihkan');
                        } catch (e) { logger.error('Failed to restore draft:', e); }
                    },
                },
            } : undefined);
        } catch (error) {
            logger.error('Failed to clear draft:', error);
        }
    }, [ticketType]);

    const fetchAttributes = async () => {
        try {
            const res = await api.get('/ticket-attributes');
            setAttributes({
                categories: res.data?.categories ?? [],
                priorities: res.data?.priorities ?? [],
                devices: res.data?.devices ?? [],
                software: res.data?.software ?? [],
            });
            setAttributesError(false);
        } catch (error) {
            logger.error('Failed to fetch attributes:', error);
            setAttributesError(true);
        }
    };

    useEffect(() => {
        fetchAttributes();
    }, []);

    const handleCloseAddModal = useCallback(() => {
        setShowAddModal({ type: '', show: false });
        setNewAttributeValue('');
    }, []);


    useEffect(() => {
        if (!showAddModal.show && !lightboxItem) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [showAddModal.show, lightboxItem]);

    const handleAddAttribute = async () => {
        if (!newAttributeValue.trim() || isAddingAttribute) return;
        setIsAddingAttribute(true);
        try {
            await api.post('/ticket-attributes', { type: showAddModal.type, value: newAttributeValue.trim() });
            toast.success('Attribute added successfully');
            setNewAttributeValue('');
            setShowAddModal({ type: '', show: false });
            fetchAttributes();
        } catch (error: any) {
            logger.error('Failed to add attribute:', error);
            toast.error(error.response?.data?.message || 'Failed to add attribute');
        } finally {
            setIsAddingAttribute(false);
        }
    };

    // Robust file addition helper (shared by input, paste, and drag-and-drop)
    const addFiles = useCallback((picked: File[]) => {
        if (!picked || picked.length === 0) return;

        const accepted: File[] = [];
        for (const file of picked) {
            if (files.length + accepted.length >= MAX_ATTACHMENTS_PER_TICKET) {
                toast.error(`Maksimal ${MAX_ATTACHMENTS_PER_TICKET} lampiran`);
                break;
            }
            const isDuplicate = [...files, ...accepted].some(
                (f) => f.name === file.name && f.size === file.size,
            );
            if (isDuplicate) continue;

            const result = validateAttachmentFile(file);
            if (!result.valid) {
                toast.error(`${file.name}: ${result.error}`);
                continue;
            }
            if (!fitsAttachmentTotal([...files, ...accepted, file])) {
                toast.error(`${file.name}: ${ATTACHMENT_TOTAL_ERROR}`);
                continue;
            }
            accepted.push(file);
        }

        if (accepted.length > 0) {
            setFiles((prev) => [...prev, ...accepted]);
        }
    }, [files]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = '';
        addFiles(picked);
    };

    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        if (lightboxItem && lightboxItem.index === index) {
            setLightboxItem(null);
        }
    };

    // Paste handler for clipboard screenshot / images
    const handlePaste = (e: React.ClipboardEvent) => {
        const clipboardFiles = Array.from(e.clipboardData?.files || []);
        if (clipboardFiles.length > 0) {
            addFiles(clipboardFiles);
            toast.success(`${clipboardFiles.length} file gambar ditempel dari clipboard`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (ticketType === 'service' || ticketType === 'oracle-request' || ticketType === 'web-dev-request' || ticketType === 'mobile-dev-request') {
            const titleErr = validateTitle(formData.title) || (formData.title.trim().length === 0 ? 'Judul tiket wajib diisi (minimal 5 karakter)' : undefined);
            const descErr = validateDescription(formData.description) || (formData.description.trim().length === 0 ? 'Deskripsi tiket wajib diisi (minimal 10 karakter)' : undefined);

            if (titleErr || descErr) {
                setErrors({ title: titleErr, description: descErr });
                toast.error(titleErr || descErr || 'Mohon lengkapi formulir sesuai ketentuan minimal karakter.');
                (titleErr ? titleRef : descriptionRef).current?.focus();
                return;
            }
        }

        setIsLoading(true);
        try {
            const formDataToSend = new FormData();

            if (ticketType === 'oracle-request') {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority || 'MEDIUM');
                formDataToSend.append('category', 'ORACLE_REQUEST');
                formDataToSend.append('ticketType', 'ORACLE_REQUEST');
            } else if (ticketType === 'web-dev-request') {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority || 'MEDIUM');
                formDataToSend.append('category', 'WEB_DEV_REQUEST');
                formDataToSend.append('ticketType', 'WEB_DEV_REQUEST');
            } else if (ticketType === 'mobile-dev-request') {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority || 'MEDIUM');
                formDataToSend.append('category', 'MOBILE_DEV_REQUEST');
                formDataToSend.append('ticketType', 'MOBILE_DEV_REQUEST');
            } else {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority);
                formDataToSend.append('category', formData.category);
                if (formData.device) formDataToSend.append('device', formData.device);
                if (formData.software) formDataToSend.append('software', formData.software);
            }

            if (formData.priority === 'CRITICAL' && formData.criticalReason) {
                formDataToSend.append('criticalReason', formData.criticalReason);
            }

            if (isStaff && requesterId) {
                formDataToSend.append('requesterId', requesterId);
            }

            files.forEach((file) => {
                formDataToSend.append('files', file);
            });

            const createRes = await api.post('/tickets', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            const createdTicketId = createRes?.data?.id;

            // Clear draft for this specific ticket type
            if (ticketType !== 'none') {
                localStorage.removeItem(getDraftStorageKey(ticketType));
                setHasDraft(false);
                setLastSaved(null);
            }

            toast.success('Tiket berhasil dibuat!');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile-dev'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

            // Staff land on the agent detail page (they keep requester-level
            // access even when the ticket belongs to another team); /client/*
            // is USER-only.
            if (isStaff) {
                navigate(createdTicketId ? `/tickets/${createdTicketId}` : '/tickets/list?filter=created_by_me');
            } else {
                navigate(createdTicketId ? `/client/tickets/${createdTicketId}` : '/client/my-tickets');
            }
        } catch (error: any) {
            logger.error('Failed to create ticket:', error);
            const serverMsg = error.response?.data?.message;
            if (Array.isArray(serverMsg)) {
                toast.error(`Gagal membuat tiket: ${serverMsg.join(', ')}`);
            } else if (typeof serverMsg === 'string') {
                toast.error(`Gagal membuat tiket: ${serverMsg}`);
            } else {
                toast.error('Gagal membuat tiket. Silakan periksa kembali formulir Anda.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const canAccessPage = useCallback((pageKey?: string): boolean => {
        if (!pageKey) return true;
        if (user?.role === 'ADMIN') return true;

        if (myPermissions?.pageAccess) {
            return myPermissions.pageAccess[pageKey] === true;
        }

        const roleDefaults: Record<string, string[]> = {
            USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT: ['my_dashboard', 'dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_OPERATIONAL_SUPPORT: ['my_dashboard', 'dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_ADMIN: ['my_dashboard', 'dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_ORACLE: ['my_dashboard', 'oracle_k2_tickets', 'web_dev_tickets', 'notifications'],
            AGENT_WEB_DEV: ['my_dashboard', 'web_dev_tickets', 'oracle_k2_tickets', 'mobile_dev_tickets', 'notifications'],
            AGENT_MOBILE_DEV: ['my_dashboard', 'mobile_dev_tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'notifications'],
            MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads'],
            ADMIN: ['dashboard', 'tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads', 'agents', 'automation', 'audit_logs', 'system_health', 'data_wipe', 'settings'],
        };

        const userRole = (user?.role || 'USER') as string;
        return (roleDefaults[userRole] || roleDefaults['USER']).includes(pageKey);
    }, [user?.role, myPermissions?.pageAccess]);

    const handleBack = useCallback(() => {
        const hasDirtyForm = Boolean(formData.title.trim() || formData.description.trim() || formData.category || formData.device || formData.software || formData.criticalReason || files.length > 0);
        if (ticketType !== 'none' && hasDirtyForm) {
            const ok = window.confirm('Perubahan belum disimpan. Yakin ingin kembali? Draft akan tetap tersimpan.');
            if (!ok) return;
        }
        if (ticketType !== 'none') {
            setTicketType('none');
        } else {
            navigate(-1);
        }
    }, [ticketType, formData.title, formData.description, formData.category, formData.device, formData.software, formData.criticalReason, files.length, navigate]);

    // Template selection helper
    const handleTemplateClick = (template: TicketTemplate) => {
        if (selectedTemplate === template.label) {
            setSelectedTemplate(null);
        } else {
            setSelectedTemplate(template.label);
            setFormData(prev => ({
                ...prev,
                title: template.subject,
                description: template.description,
                priority: template.priority,
                ...(template.category ? { category: template.category } : {}),
            }));
            setErrors({});
        }
    };

    const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
        setFormData(prev => ({ ...prev, [key]: value }));

    // ==========================================
    // 1. TICKET TYPE SELECTION SCREEN (none)
    // ==========================================
    if (ticketType === 'none') {
        const getBasePath = () => location.pathname.startsWith('/client') ? '/client' : location.pathname.startsWith('/manager') ? '/manager' : '';
        const isVisible = (card: TicketCardConfig) => canAccessPage(card.pageKey) && matchesCatalogQuery(card, catalogQuery);
        const visibleTicketingCards = TICKETING_CARDS.filter(isVisible);
        const visibleRequestCards = REQUEST_CARDS.filter(isVisible);
        const renderCard = (card: TicketCardConfig) => (
            <TicketTypeCard key={card.key} title={card.title} description={card.description} mascotImg={card.mascotImg}
                mascotAlt={card.mascotAlt} ctaLabel={card.ctaLabel}
                onSelect={() => card.action({ setTicketType, navigate, getBasePath })} />
        );

        return (
            <div className="ct-page ct-page-catalog">
                <div className="ct-catalog-top">
                    <header className="ct-catalog-head">
                        <button type="button" onClick={() => navigate(-1)} aria-label="Kembali" className="ct-back">
                            <ArrowLeft aria-hidden="true" />
                        </button>
                        <div className="min-w-0">
                            <h1>Buat Tiket Baru</h1>
                            <p>Pilih jenis bantuan atau pengajuan yang Anda butuhkan</p>
                        </div>
                    </header>

                    <div className="portal-search ct-search">
                        <Search aria-hidden="true" />
                        <input type="search" aria-label="Cari jenis bantuan" value={catalogQuery}
                            onChange={e => setCatalogQuery(e.target.value)} placeholder="Cari jenis bantuan, misal: printer, VPN, Oracle" />
                    </div>
                </div>

                {visibleTicketingCards.length > 0 && (
                    <TicketCatalogSection id="section-ticketing" title="Bantuan & kendala teknis"
                        description="Masalah harian, bug aplikasi, atau kendala perangkat kerja">
                        {visibleTicketingCards.map(renderCard)}
                    </TicketCatalogSection>
                )}

                {visibleRequestCards.length > 0 && (
                    <TicketCatalogSection id="section-requests" title="Pengajuan layanan & akses"
                        description="Pengadaan perangkat baru atau persetujuan hak akses">
                        {visibleRequestCards.map(renderCard)}
                    </TicketCatalogSection>
                )}

                {visibleTicketingCards.length + visibleRequestCards.length === 0 && (
                    <p className="ct-empty" role="status">
                        Tidak ada jenis bantuan yang cocok dengan "{catalogQuery.trim()}". Coba kata lain atau pilih <b>Service Ticket</b> untuk bantuan IT umum.
                    </p>
                )}
            </div>
        );
    }

    // ==========================================
    // 2. TICKET FORMS (service / oracle / web dev / mobile dev)
    // ==========================================
    const config = TICKET_FORM_CONFIG[ticketType];
    const canAddAttribute = user?.role === 'ADMIN' || user?.role === 'AGENT';
    const submitDisabled = isLoading || !formData.title.trim() || !formData.description.trim() || (formData.priority === 'CRITICAL' && !formData.criticalReason?.trim());
    const draftStatus = hasDraft ? <DraftStatus savedAt={lastSaved} onClear={clearDraft} /> : undefined;

    return (
        <div className="ct-page ct-page-form">
            <TicketFormHeader title={config.title} subtitle={config.subtitle} icon={config.icon} tone={config.tone} onBack={handleBack} />
            <TemplateChips templates={config.templates} selected={selectedTemplate} onPick={handleTemplateClick} />

            <form
                onSubmit={handleSubmit}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}
                className="ct-form"
            >
                {hasFieldErrors && <ErrorBanner message={errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'} />}

                <TicketFormSection>
                    {isStaff && (
                        <div className="ct-row">
                            <RequesterSelector requesterId={requesterId} onChange={setRequesterId} currentUserId={user?.id} />
                        </div>
                    )}
                    <TitleField id={config.titleId} inputRef={titleRef} value={formData.title} error={errors.title}
                        placeholder={config.titlePlaceholder}
                        onChange={(val) => {
                            updateField('title', val);
                            setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                        }} />
                    <DescriptionComposer id={config.descriptionId} textareaRef={descriptionRef} fileInputRef={fileInputRef}
                        value={formData.description} error={errors.description} placeholder={config.descriptionPlaceholder}
                        files={files} previews={filePreviewMap}
                        onChange={(val) => {
                            updateField('description', val);
                            setErrors(prev => ({ ...prev, description: validateDescription(val) }));
                        }}
                        onPaste={handlePaste} onDropFiles={addFiles} onFileInput={handleFileChange}
                        onRemoveFile={handleRemoveFile} onPreview={setLightboxItem} />
                </TicketFormSection>

                <TicketFormSection>
                    {config.hasClassification && (
                        <ClassificationFields
                            values={{ category: formData.category, device: formData.device, software: formData.software }}
                            options={{
                                category: [...BASE_CATEGORY_OPTIONS, ...toPickerOptions(attributes.categories ?? [])],
                                device: toPickerOptions(attributes.devices ?? []),
                                software: toPickerOptions(attributes.software ?? []),
                            }}
                            loadFailed={attributesError} canAddAttribute={canAddAttribute}
                            onChange={(key, value) => updateField(key, value)}
                            onRetry={fetchAttributes}
                            onAdd={(kind: AttributeKind) => setShowAddModal({ type: kind, show: true })} />
                    )}
                    <UrgencySegment legendId={`${ticketType}-urgency-label`} value={formData.priority} onChange={(p) => updateField('priority', p)} />
                    {formData.priority === 'CRITICAL' && (
                        <CriticalReasonField id={config.criticalReasonId} label={config.criticalReasonLabel} placeholder={config.criticalReasonPlaceholder} value={formData.criticalReason} onChange={(v) => updateField('criticalReason', v)} />
                    )}
                </TicketFormSection>

                <SubmitBar draftStatus={draftStatus} disabled={submitDisabled} loading={isLoading}
                    label={config.submitLabel} loadingLabel={config.loadingLabel} />
            </form>

            {lightboxItem && (
                <LightboxModal item={lightboxItem} onClose={() => setLightboxItem(null)} onDelete={() => handleRemoveFile(lightboxItem.index)} />
            )}

            {config.hasClassification && showAddModal.show && (
                <AddAttributeModal type={showAddModal.type} value={newAttributeValue} busy={isAddingAttribute}
                    onChange={setNewAttributeValue} onConfirm={handleAddAttribute} onClose={handleCloseAddModal} />
            )}
        </div>
    );
};
