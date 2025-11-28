import { useState, useEffect, useRef } from 'react';
import { Save, Eye, Send, X, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

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
}

const CATEGORIES = [
    'General',
    'Hardware',
    'Software',
    'Network',
    'Security',
    'Email',
    'Printer',
    'VPN',
    'Account',
    'Other',
];

export const ArticleForm = ({
    initialData,
    onSubmit,
    onCancel,
    isLoading = false,
    mode = 'create',
}: ArticleFormProps) => {
    const [formData, setFormData] = useState<ArticleFormData>({
        title: '',
        content: '',
        category: 'General',
        tags: [],
        status: 'draft',
        visibility: 'public',
        featuredImage: '',
        images: [],
    });
    const [tagInput, setTagInput] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentImageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialData) {
            setFormData((prev) => ({
                ...prev,
                ...initialData,
            }));
        }
    }, [initialData]);

    const handleImageUpload = async (file: File, type: 'featured' | 'content') => {
        setIsUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            // Don't set Content-Type header - let axios auto-detect for FormData
            const response = await api.post('/kb/upload', formDataUpload);
            const imageUrl = response.data.url;

            if (type === 'featured') {
                setFormData((prev) => ({ ...prev, featuredImage: imageUrl }));
            } else {
                // Insert image markdown at cursor position or end of content
                const imageMarkdown = `\n![${file.name}](${imageUrl})\n`;
                setFormData((prev) => ({
                    ...prev,
                    content: prev.content + imageMarkdown,
                    images: [...(prev.images || []), imageUrl],
                }));
            }
            toast.success('Image uploaded successfully!');
        } catch (error) {
            console.error('Failed to upload image:', error);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFeaturedImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file, 'featured');
        }
    };

    const handleContentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file, 'content');
        }
    };

    const removeFeaturedImage = () => {
        setFormData((prev) => ({ ...prev, featuredImage: '' }));
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!formData.tags.includes(tagInput.trim())) {
                setFormData((prev) => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()],
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

    const handleSubmit = async (e: React.FormEvent, status?: 'draft' | 'published') => {
        e.preventDefault();
        const submitData = status ? { ...formData, status } : formData;
        await onSubmit(submitData);
    };

    return (
        <div className="space-y-6">
            {/* Form Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {mode === 'create' ? 'Create New Article' : 'Edit Article'}
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                        {showPreview ? 'Edit' : 'Preview'}
                    </button>
                </div>
            </div>

            {showPreview ? (
                /* Preview Mode */
                <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                            {formData.category}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium">
                            {formData.status}
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">
                        {formData.title || 'Untitled Article'}
                    </h1>
                    {formData.featuredImage && (
                        <div className="mb-6">
                            <img
                                src={formData.featuredImage}
                                alt="Featured"
                                className="w-full h-48 object-cover rounded-xl"
                            />
                        </div>
                    )}
                    <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap">
                        {formData.content.split(/!\[([^\]]*)\]\(([^)]+)\)/).map((part, index) => {
                            if (index % 3 === 2) {
                                const altText = formData.content.split(/!\[([^\]]*)\]\(([^)]+)\)/)[index - 1];
                                return (
                                    <img
                                        key={index}
                                        src={part}
                                        alt={altText || 'Image'}
                                        className="my-4 rounded-xl max-w-full"
                                    />
                                );
                            }
                            if (index % 3 === 1) return null;
                            return part;
                        }) || 'No content yet...'}
                    </div>
                    {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                            {formData.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Edit Mode */
                <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
                    {/* Title */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Title *
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Enter article title..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            required
                        />
                    </div>

                    {/* Featured Image */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Featured Image
                        </label>
                        {formData.featuredImage ? (
                            <div className="relative">
                                <img
                                    src={formData.featuredImage}
                                    alt="Featured"
                                    className="w-full h-48 object-cover rounded-xl"
                                />
                                <button
                                    type="button"
                                    onClick={removeFeaturedImage}
                                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                            >
                                {isUploading ? (
                                    <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                                ) : (
                                    <>
                                        <ImagePlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Click to upload featured image
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF up to 5MB</p>
                                    </>
                                )}
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFeaturedImageSelect}
                            className="hidden"
                        />
                    </div>

                    {/* Category & Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Category
                            </label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Status
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Visibility
                            </label>
                            <select
                                name="visibility"
                                value={formData.visibility}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="public">Public</option>
                                <option value="internal">Internal (IT Staff Only)</option>
                                <option value="private">Private</option>
                            </select>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                Content *
                            </label>
                            <button
                                type="button"
                                onClick={() => contentImageInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ImagePlus className="w-4 h-4" />
                                )}
                                Insert Image
                            </button>
                            <input
                                ref={contentImageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleContentImageSelect}
                                className="hidden"
                            />
                        </div>
                        <textarea
                            name="content"
                            value={formData.content}
                            onChange={handleChange}
                            placeholder="Write your article content here...

You can include:
- Step-by-step instructions
- Troubleshooting tips
- Screenshots (use Insert Image button above)
- Code snippets

Images will be inserted as markdown: ![name](url)"
                            rows={15}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y font-mono text-sm"
                            required
                        />
                    </div>

                    {/* Tags */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Tags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {formData.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="hover:text-red-500 transition-colors"
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
                            placeholder="Type a tag and press Enter..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e, 'draft')}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Save Draft
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e, 'published')}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                            {isLoading ? 'Publishing...' : 'Publish'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};
