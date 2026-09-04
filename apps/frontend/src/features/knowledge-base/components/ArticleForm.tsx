import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Save,
    Eye,
    Send,
    X,
    ImagePlus,
    Trash2,
    Loader2,
    Bold,
    Italic,
    Heading2,
    ListOrdered,
    List,
    Terminal,
    AlertCircle,
    Table,
    Copy,
    Check,
    Columns,
    FileText,
    Upload,
    ImageIcon,
    ArrowUpRight,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Maximize,
    Sliders,
    Sparkles,
    HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArticleMarkdownViewer, getImageUrl } from './ArticleMarkdownViewer';

export interface ArticleFormData {
    title: string;
    content: string;
    category: string;
    tags: string[];
    status: 'draft' | 'published' | 'archived';
    visibility: 'public' | 'internal' | 'private';
    featuredImage?: string;
    images?: string[];
}

interface ArticleFormProps {
    initialData?: Partial<ArticleFormData>;
    onSubmit: (data: ArticleFormData) => Promise<void>;
    onCancel?: () => void;
    isLoading?: boolean;
    mode?: 'create' | 'edit';
    /** Admins publish PUBLIC directly; other roles submit it for review. */
    isAdmin?: boolean;
}

const CATEGORIES = [
    'Network',
    'Security',
    'Hardware',
    'Software',
    'General',
];

interface ImageConfigModalState {
    isOpen: boolean;
    imageUrl: string;
    altText: string;
    caption: string;
    align: 'left' | 'center' | 'right' | 'full';
    size: '25' | '50' | '75' | '100';
}

export const ArticleForm: React.FC<ArticleFormProps> = ({
    initialData,
    onSubmit,
    onCancel,
    isLoading = false,
    isAdmin = false,
    mode = 'create',
}) => {
    const [formData, setFormData] = useState<ArticleFormData>({
        title: '',
        content: '',
        category: 'Network',
        tags: [],
        status: 'published',
        visibility: 'public',
        featuredImage: '',
        images: [],
    });

    const [tagInput, setTagInput] = useState('');
    const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split');
    const [isUploading, setIsUploading] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    // Image Configuration Modal State
    const [imageModal, setImageModal] = useState<ImageConfigModalState>({
        isOpen: false,
        imageUrl: '',
        altText: '',
        caption: '',
        align: 'center',
        size: '100',
    });

    // PUBLIC articles need admin review before they become live, unless the author is an admin.
    const needsReview = !isAdmin && formData.visibility === 'public' && formData.status === 'published';

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const featuredInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const quickImageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialData) {
            setFormData((prev) => ({
                ...prev,
                ...initialData,
                tags: initialData.tags || [],
                images: initialData.images || [],
            }));
        }
    }, [initialData]);

    // Insert text at current cursor position in textarea
    const insertAtCursor = useCallback((textToInsert: string, cursorOffset: number = 0) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setFormData((prev) => ({ ...prev, content: prev.content + textToInsert }));
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentContent = textarea.value;

        const newContent =
            currentContent.substring(0, start) +
            textToInsert +
            currentContent.substring(end);

        setFormData((prev) => ({ ...prev, content: newContent }));

        // Restore focus and cursor
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + textToInsert.length + cursorOffset;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 10);
    }, []);

    // Core upload function (handles API upload & state update)
    const uploadFile = async (file: File): Promise<string | null> => {
        setIsUploading(true);
        try {
            const uploadPayload = new FormData();
            uploadPayload.append('file', file);
            const response = await api.post('/kb/upload', uploadPayload);
            const rawUrl = response.data?.url || response.data?.fileUrl;
            if (!rawUrl) throw new Error('No URL returned from server');
            return rawUrl;
        } catch (error) {
            console.error('Failed to upload image:', error);
            toast.error('Gagal mengunggah gambar. Pastikan format JPG/PNG/WebP maks 5MB.');
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    // Open image placement configuration modal
    const openImageConfigModal = (url: string, defaultAlt: string = 'Screenshot') => {
        setImageModal({
            isOpen: true,
            imageUrl: url,
            altText: defaultAlt,
            caption: '',
            align: 'center',
            size: '100',
        });
    };

    // Apply & insert image from config modal
    const handleConfirmImageInsert = () => {
        const { imageUrl, altText, caption, align, size } = imageModal;
        const formattedAlt = caption.trim() ? `${altText.trim() || 'Gambar'}|${caption.trim()}` : (altText.trim() || 'Gambar');
        const opts = `{align=${align} size=${size}}`;
        const markdown = `\n![${formattedAlt}](${imageUrl})${opts}\n`;

        insertAtCursor(markdown);
        setImageModal((prev) => ({ ...prev, isOpen: false }));
        toast.success('Gambar berhasil ditempatkan ke posisi kursor!');
    };

    // Paste handler for screenshots (Ctrl+V)
    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (!blob) continue;

                toast.info('Mengunggah screenshot dari clipboard...');
                const rawUrl = await uploadFile(blob);
                if (rawUrl) {
                    const fullUrl = getImageUrl(rawUrl);
                    setFormData((prev) => ({
                        ...prev,
                        images: [...(prev.images || []).filter(img => img !== fullUrl), fullUrl],
                    }));
                    // Open image modal so user can immediately choose alignment & size
                    openImageConfigModal(fullUrl, 'Screenshot');
                    toast.success('Screenshot diunggah! Atur posisi atau klik Sisipkan.');
                }
                return;
            }
        }
    };

    // Drag & Drop image handler
    const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.type.startsWith('image/')) {
            toast.info('Mengunggah gambar...');
            const rawUrl = await uploadFile(file);
            if (rawUrl) {
                const fullUrl = getImageUrl(rawUrl);
                setFormData((prev) => ({
                    ...prev,
                    images: [...(prev.images || []).filter(img => img !== fullUrl), fullUrl],
                }));
                const alt = file.name.replace(/\.[^/.]+$/, "");
                openImageConfigModal(fullUrl, alt);
                toast.success('Gambar berhasil diunggah! Tentukan posisi penempatan.');
            }
        }
    };

    // Quick Image Toolbar upload
    const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const rawUrl = await uploadFile(file);
        if (rawUrl) {
            const fullUrl = getImageUrl(rawUrl);
            setFormData((prev) => ({
                ...prev,
                images: [...(prev.images || []).filter(img => img !== fullUrl), fullUrl],
            }));
            const alt = file.name.replace(/\.[^/.]+$/, "");
            openImageConfigModal(fullUrl, alt);
        }
        e.target.value = '';
    };

    // Gallery file input handler
    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const rawUrl = await uploadFile(file);
            if (rawUrl) {
                const fullUrl = getImageUrl(rawUrl);
                setFormData((prev) => ({
                    ...prev,
                    images: [...(prev.images || []).filter(img => img !== fullUrl), fullUrl],
                }));
                toast.success(`Gambar "${file.name}" ditambahkan ke galeri!`);
            }
        }
        e.target.value = '';
    };

    // Featured Image input handler
    const handleFeaturedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const rawUrl = await uploadFile(file);
        if (rawUrl) {
            const fullUrl = getImageUrl(rawUrl);
            setFormData((prev) => ({ ...prev, featuredImage: fullUrl }));
            toast.success('Banner artikel berhasil diperbarui!');
        }
        e.target.value = '';
    };

    const handleQuickInsertImage = (imgUrl: string) => {
        const imageMarkdown = `\n![Gambar](${imgUrl}){align=center size=100}\n`;
        insertAtCursor(imageMarkdown);
        toast.success('Gambar disisipkan ke posisi kursor!');
    };

    const handleCopyImageUrl = async (imgUrl: string) => {
        try {
            await navigator.clipboard.writeText(imgUrl);
            setCopiedUrl(imgUrl);
            toast.success('Link gambar disalin!');
            setTimeout(() => setCopiedUrl(null), 2000);
        } catch {
            toast.error('Gagal menyalin link');
        }
    };

    const handleRemoveGalleryImage = (imgUrl: string) => {
        setFormData((prev) => ({
            ...prev,
            images: (prev.images || []).filter((img) => img !== imgUrl),
        }));
    };

    // Tag Handlers
    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            const cleanTag = tagInput.trim().toLowerCase().replace(/^#/, '');
            if (!formData.tags.includes(cleanTag)) {
                setFormData((prev) => ({
                    ...prev,
                    tags: [...prev.tags, cleanTag],
                }));
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFormData((prev) => ({
            ...prev,
            tags: prev.tags.filter((tag) => tag !== tagToRemove),
        }));
    };

    const handleFormSubmit = async (e: React.FormEvent, statusOverride?: 'draft' | 'published') => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error('Judul artikel wajib diisi');
            return;
        }
        if (!formData.content.trim()) {
            toast.error('Konten panduan wajib diisi');
            return;
        }

        const payload: ArticleFormData = {
            ...formData,
            status: statusOverride || formData.status,
        };
        await onSubmit(payload);
    };

    return (
        <form onSubmit={(e) => handleFormSubmit(e)} className="space-y-6 pb-12">
            {/* Top Toolbar & Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
                        Tampilan Editor:
                    </span>
                    <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border">
                        <button
                            type="button"
                            onClick={() => setViewMode('edit')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                                viewMode === 'edit'
                                    ? "bg-card text-foreground shadow-2xs font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Editor</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                                viewMode === 'split'
                                    ? "bg-card text-foreground shadow-2xs font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Columns className="w-3.5 h-3.5" />
                            <span>Split Preview</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('preview')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                                viewMode === 'preview'
                                    ? "bg-card text-foreground shadow-2xs font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Penuh</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-3.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => handleFormSubmit(e, 'draft')}
                        disabled={isLoading || isUploading}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground border border-border/80 hover:bg-muted text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Draft</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => handleFormSubmit(e, 'published')}
                        disabled={isLoading || isUploading}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{needsReview ? 'Ajukan Review' : mode === 'create' ? 'Publikasikan' : 'Simpan Perubahan'}</span>
                    </button>
                </div>
            </div>

            {/* Main Editor Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Area: Title, Markdown Toolbar & Content (8 Columns) */}
                <div className={cn("space-y-4", viewMode === 'preview' ? "lg:col-span-8" : "lg:col-span-8")}>
                    {/* Article Title */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Judul Panduan / Artikel *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Contoh: Cara Mengatasi Outlook Error Not Responding..."
                            className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-sm md:text-base font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 shadow-2xs"
                            required
                        />
                    </div>

                    {/* Markdown Editor + Toolbar */}
                    {viewMode !== 'preview' && (
                        <div className="space-y-2">
                            {/* Formatting Toolbar */}
                            <div className="flex items-center justify-between flex-wrap gap-1.5 p-2 rounded-xl bg-card border border-border text-xs">
                                <div className="flex items-center flex-wrap gap-1">
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('**Teks Tebal**', -2)}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Tebal (Bold)"
                                    >
                                        <Bold className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('*Teks Miring*', -1)}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Miring (Italic)"
                                    >
                                        <Italic className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n## Judul Bagian\n')}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Heading 2"
                                    >
                                        <Heading2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n### Step 1: Langkah Pertama\n1. Buka aplikasi Settings...\n2. Pilih menu terkait...\n')}
                                        className="px-2.5 py-1 rounded bg-muted/60 hover:bg-muted text-foreground font-semibold text-xs cursor-pointer border border-border/80 flex items-center gap-1"
                                        title="Sisipkan Blok Langkah Panduan"
                                    >
                                        <Sparkles className="w-3 h-3 text-primary" />
                                        <span>+ Langkah</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n1. Langkah pertama\n2. Langkah kedua\n3. Langkah ketiga\n')}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="List Angka (Numbered List)"
                                    >
                                        <ListOrdered className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n- Poin pertama\n- Poin kedua\n- Poin ketiga\n')}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="List Poin (Bullet List)"
                                    >
                                        <List className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n```bash\n# Masukkan perintah command di sini\nipconfig /flushdns\n```\n')}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Kotak Perintah / Code Box"
                                    >
                                        <Terminal className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n## Catatan\nPastikan koneksi internet aktif sebelum melanjutkan.\n')}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Kotak Catatan / Warning"
                                    >
                                        <AlertCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertAtCursor('\n| Parameter | Nilai / Solusi |\n|---|---|\n| Gateway IP | 192.168.1.1 |\n| DNS Server | 8.8.8.8 |\n')}
                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Tabel Solusi"
                                    >
                                        <Table className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Image / Screenshot Upload Trigger */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
                                        💡 Paste (<kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Ctrl+V</kbd>) screenshot langsung ke teks
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => quickImageInputRef.current?.click()}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-2xs"
                                        title="Pilih gambar dari komputer dan atur posisi"
                                    >
                                        <ImagePlus className="w-3.5 h-3.5" />
                                        <span>Sisipkan Gambar</span>
                                    </button>
                                    <input
                                        ref={quickImageInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleQuickImageUpload}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* Content Textarea & Live Split View */}
                            <div className={cn("grid gap-4", viewMode === 'split' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                                <div className="relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={formData.content}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                                        onPaste={handlePaste}
                                        onDrop={handleDrop}
                                        placeholder="Tulis panduan langkah demi langkah di sini...

Gunakan format:
## Gejala
Penjelasan masalah yang dialami.

### Step 1: Langkah Pertama
1. Buka menu Settings
2. Pilih Network & Internet

💡 Anda bisa paste screenshot (Ctrl+V) atau drag-and-drop gambar langsung ke posisi baris mana saja!"
                                        rows={22}
                                        className="w-full p-4 bg-card border border-border rounded-xl text-xs md:text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 shadow-2xs leading-relaxed resize-y custom-scrollbar"
                                        required
                                    />

                                    {/* Uploading Indicator Overlay */}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-semibold text-foreground rounded-xl">
                                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                            <span>Mengunggah gambar...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Live Split Preview Pane */}
                                {viewMode === 'split' && (
                                    <div className="p-5 rounded-xl border border-border bg-card/40 overflow-y-auto max-h-[560px] custom-scrollbar space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                            <span>Live Preview</span>
                                            <span>Format Tampil</span>
                                        </div>
                                        {formData.content ? (
                                            <ArticleMarkdownViewer content={formData.content} />
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic py-12 text-center">
                                                Ketik konten di sebelah kiri untuk melihat live preview di sini...
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Full Preview Mode */}
                    {viewMode === 'preview' && (
                        <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-xs space-y-6">
                            <div className="space-y-2">
                                <span className="px-2.5 py-1 rounded bg-muted text-foreground text-xs font-bold uppercase tracking-wider border border-border">
                                    {formData.category}
                                </span>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                                    {formData.title || 'Judul Artikel'}
                                </h1>
                            </div>

                            {formData.featuredImage && (
                                <img
                                    src={getImageUrl(formData.featuredImage)}
                                    alt="Banner"
                                    className="w-full h-64 object-cover rounded-xl border border-border"
                                />
                            )}

                            <ArticleMarkdownViewer content={formData.content} />
                        </div>
                    )}
                </div>

                {/* Right Area: Attachments Gallery & Metadata (4 Columns) */}
                <div className="lg:col-span-4 space-y-4">
                    {/* 1. Media & Attachments Gallery */}
                    <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <ImageIcon className="w-4 h-4 text-foreground" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Lampiran & Gambar
                                </h3>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                                {(formData.images || []).length} item
                            </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Gambar yang di-upload atau di-paste akan terkumpul di sini. Anda bisa mengatur posisi (kiri, tengah, kanan) dan ukuran sebelum menempelkannya.
                        </p>

                        {/* Upload Button */}
                        <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-border hover:border-foreground/40 hover:bg-muted/30 text-xs font-semibold text-foreground transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            <span>Upload Gambar Baru</span>
                        </button>
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleGalleryUpload}
                            className="hidden"
                        />

                        {/* Thumbnails List */}
                        {(formData.images || []).length > 0 ? (
                            <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                                {(formData.images || []).map((imgUrl, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2.5 p-2 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/40 transition-colors group text-xs"
                                    >
                                        <img
                                            src={getImageUrl(imgUrl)}
                                            alt={`Lampiran ${idx + 1}`}
                                            className="w-12 h-12 object-cover rounded-lg border border-border shrink-0 cursor-pointer"
                                            onClick={() => openImageConfigModal(imgUrl, `Gambar ${idx + 1}`)}
                                            title="Klik untuk mengatur posisi & sisipkan"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[11px] font-mono truncate block text-foreground">
                                                Gambar #{idx + 1}
                                            </span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openImageConfigModal(imgUrl, `Gambar ${idx + 1}`)}
                                                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                                                    title="Atur posisi (kiri/tengah/kanan), ukuran & caption"
                                                >
                                                    <Sliders className="w-2.5 h-2.5" />
                                                    <span>Atur & Sisipkan</span>
                                                </button>
                                                <span>•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyImageUrl(imgUrl)}
                                                    className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-0.5"
                                                >
                                                    {copiedUrl === imgUrl ? (
                                                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="w-2.5 h-2.5" />
                                                    )}
                                                    <span>{copiedUrl === imgUrl ? 'Tersalin' : 'Salin'}</span>
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGalleryImage(imgUrl)}
                                            className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors cursor-pointer"
                                            title="Hapus dari lampiran"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-center text-xs text-muted-foreground italic">
                                Belum ada lampiran gambar.
                            </div>
                        )}
                    </div>

                    {/* 2. Featured Image / Banner */}
                    <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5 shadow-2xs">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Banner Header (Opsional)
                        </h3>
                        {formData.featuredImage ? (
                            <div className="relative rounded-xl overflow-hidden border border-border">
                                <img
                                    src={getImageUrl(formData.featuredImage)}
                                    alt="Featured"
                                    className="w-full h-28 object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, featuredImage: '' }))}
                                    className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                                    title="Hapus banner"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => featuredInputRef.current?.click()}
                                className="w-full p-4 rounded-xl border border-dashed border-border hover:border-foreground/40 hover:bg-muted/30 text-center text-xs text-muted-foreground transition-all cursor-pointer flex flex-col items-center gap-1"
                            >
                                <ImagePlus className="w-5 h-5 text-muted-foreground/70" />
                                <span>Pilih Gambar Banner</span>
                            </button>
                        )}
                        <input
                            ref={featuredInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFeaturedUpload}
                            className="hidden"
                        />
                    </div>

                    {/* 3. Category & Accessibility Settings */}
                    <div className="p-4 rounded-2xl border border-border bg-card space-y-3.5 shadow-2xs">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Pengaturan Artikel
                        </h3>

                        {/* Category */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-muted-foreground">
                                Kategori
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:border-foreground/40"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-muted-foreground">
                                Status Publikasi
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:border-foreground/40"
                            >
                                <option value="published">Published (Terbit)</option>
                                <option value="draft">Draft (Konsep)</option>
                                <option value="archived">Archived (Diarsipkan)</option>
                            </select>
                        </div>

                        {/* Visibility */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-muted-foreground">
                                Akses Pembaca
                            </label>
                            <select
                                value={formData.visibility}
                                onChange={(e) => setFormData((prev) => ({ ...prev, visibility: e.target.value as any }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:border-foreground/40"
                            >
                                <option value="public">Public (Semua Karyawan)</option>
                                <option value="internal">Internal (Tim IT Saja)</option>
                            </select>
                        </div>
                    </div>

                    {/* 4. Tags / Keywords */}
                    <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-2xs">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Kata Kunci Pencarian (Tags)
                        </h3>

                        <div className="flex flex-wrap gap-1.5">
                            {formData.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground rounded-md text-xs font-mono border border-border"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                            placeholder="Ketik tag lalu tekan Enter..."
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                        />
                    </div>
                </div>
            </div>

            {/* Modal Pengaturan Posisi & Ukuran Gambar */}
            {imageModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-bold text-foreground">
                                    Atur Penempatan Gambar di Teks
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setImageModal((prev) => ({ ...prev, isOpen: false }))}
                                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Preview Thumbnail */}
                        <div className="flex items-center justify-center p-3 bg-muted/30 rounded-xl border border-border max-h-48 overflow-hidden">
                            <img
                                src={imageModal.imageUrl}
                                alt={imageModal.altText || 'Pratinjau'}
                                className="max-h-40 object-contain rounded-lg shadow-sm"
                            />
                        </div>

                        {/* Alignment Selector */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                                Posisi / Alignment Gambar:
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { key: 'center', label: 'Tengah', icon: AlignCenter },
                                    { key: 'left', label: 'Rata Kiri', icon: AlignLeft },
                                    { key: 'right', label: 'Rata Kanan', icon: AlignRight },
                                    { key: 'full', label: 'Lebar Penuh', icon: Maximize },
                                ].map((item) => {
                                    const Icon = item.icon;
                                    const isSelected = imageModal.align === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setImageModal((prev) => ({ ...prev, align: item.key as any }))}
                                            className={cn(
                                                "flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                                                    : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Size Selector */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                                Ukuran Gambar:
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { key: '25', label: '25% (Kecil)' },
                                    { key: '50', label: '50% (Sedang)' },
                                    { key: '75', label: '75% (Besar)' },
                                    { key: '100', label: '100% (Penuh)' },
                                ].map((sz) => {
                                    const isSelected = imageModal.size === sz.key;
                                    return (
                                        <button
                                            key={sz.key}
                                            type="button"
                                            onClick={() => setImageModal((prev) => ({ ...prev, size: sz.key as any }))}
                                            className={cn(
                                                "py-1.5 px-2 rounded-xl border text-xs font-mono text-center transition-all cursor-pointer",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                                                    : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {sz.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Caption Input */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-foreground">
                                Keterangan / Caption (Opsional):
                            </label>
                            <input
                                type="text"
                                value={imageModal.caption}
                                onChange={(e) => setImageModal((prev) => ({ ...prev, caption: e.target.value }))}
                                placeholder="Contoh: Gambar 1: Pilih menu Network & Internet..."
                                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setImageModal((prev) => ({ ...prev, isOpen: false }))}
                                className="px-3.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImageInsert}
                                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Sisipkan ke Teks</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default ArticleForm;
