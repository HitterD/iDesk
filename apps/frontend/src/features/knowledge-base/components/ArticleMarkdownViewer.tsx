import React, { useState } from 'react';
import {
    Copy,
    Check,
    Info,
    AlertTriangle,
    Terminal,
    AlertCircle,
    Circle,
    CheckCircle,
    ZoomIn,
    Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ArticleMarkdownViewerProps {
    content: string;
    className?: string;
    completedSteps?: Record<string, boolean>;
    onToggleStep?: (stepNumber: string) => void;
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export const getImageUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    if (url.startsWith('/kb/') || url.startsWith('/assets/') || url.startsWith('/sounds/') || url.startsWith('/images/')) {
        return url;
    }
    const apiUrl = import.meta.env.VITE_API_URL || '';
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const ArticleMarkdownViewer: React.FC<ArticleMarkdownViewerProps> = ({
    content,
    className,
    completedSteps = {},
    onToggleStep,
}) => {
    const [lightboxImage, setLightboxImage] = useState<{ url: string; alt?: string; caption?: string } | null>(null);

    if (!content) return null;

    const sections = parseContentSections(content);

    const handleImageClick = (url: string, alt?: string, caption?: string) => {
        setLightboxImage({
            url: getImageUrl(url),
            alt,
            caption,
        });
    };

    return (
        <div className={cn("space-y-6 text-foreground leading-relaxed text-sm md:text-[15px]", className)}>
            {sections.map((section, idx) => {
                if (section.type === 'code') {
                    return <CodeBlockViewer key={idx} code={section.raw} language={section.language} />;
                } else if (section.type === 'table') {
                    return <TableViewer key={idx} tableLines={section.lines} />;
                } else if (section.type === 'callout') {
                    return (
                        <CalloutViewer
                            key={idx}
                            title={section.title}
                            body={section.body}
                            variant={section.variant}
                            onImageClick={handleImageClick}
                        />
                    );
                } else if (section.type === 'step') {
                    return (
                        <StepCardViewer
                            key={idx}
                            stepNumber={section.stepNumber}
                            title={section.title}
                            content={section.body}
                            isCompleted={!!completedSteps[section.stepNumber]}
                            onToggle={onToggleStep ? () => onToggleStep(section.stepNumber) : undefined}
                            onImageClick={handleImageClick}
                        />
                    );
                } else if (section.type === 'image') {
                    return (
                        <ImageBlockViewer
                            key={idx}
                            src={section.src}
                            alt={section.alt}
                            caption={section.caption}
                            align={section.align}
                            size={section.size}
                            onImageClick={handleImageClick}
                        />
                    );
                } else {
                    return <TextSectionViewer key={idx} text={section.raw} onImageClick={handleImageClick} />;
                }
            })}

            {/* Lightbox Zoom Modal */}
            <ImageLightboxModal
                isOpen={!!lightboxImage}
                onClose={() => setLightboxImage(null)}
                imageUrl={lightboxImage?.url || ''}
                altText={lightboxImage?.alt}
                caption={lightboxImage?.caption}
            />
        </div>
    );
};

// Section types
type Section =
    | { type: 'text'; raw: string }
    | { type: 'code'; raw: string; language?: string }
    | { type: 'table'; lines: string[] }
    | { type: 'step'; stepNumber: string; title: string; body: string }
    | { type: 'callout'; title: string; body: string; variant: 'info' | 'warning' | 'diagnostic' }
    | { type: 'image'; src: string; alt?: string; caption?: string; align?: 'left' | 'center' | 'right' | 'full'; size?: '25' | '50' | '75' | '100' };

function parseContentSections(content: string): Section[] {
    const lines = content.split('\n');
    const sections: Section[] = [];
    let currentTextLines: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let currentCodeLines: string[] = [];
    let inTable = false;
    let currentTableLines: string[] = [];

    const flushText = () => {
        if (currentTextLines.length > 0) {
            const raw = currentTextLines.join('\n').trim();
            if (raw) {
                // Callout detection
                if (/^##\s*(Catatan|Note)/i.test(raw)) {
                    sections.push({
                        type: 'callout',
                        title: 'Catatan Penting',
                        body: raw.replace(/^##\s*(Catatan|Note)[^\n]*\n?/i, '').trim(),
                        variant: 'info',
                    });
                } else if (/^##\s*(Tips Keamanan|Peringatan|Warning)/i.test(raw)) {
                    sections.push({
                        type: 'callout',
                        title: 'Tips Keamanan & Peringatan',
                        body: raw.replace(/^##\s*(Tips Keamanan|Peringatan|Warning)[^\n]*\n?/i, '').trim(),
                        variant: 'warning',
                    });
                } else if (/^##\s*(Gejala|Symptoms|Kendala)/i.test(raw)) {
                    sections.push({
                        type: 'callout',
                        title: 'Gejala / Indikasi Masalah',
                        body: raw.replace(/^##\s*(Gejala|Symptoms|Kendala)[^\n]*\n?/i, '').trim(),
                        variant: 'diagnostic',
                    });
                } else {
                    // Check if entire block is a step (### Step X: ...)
                    const stepMatch = raw.match(/^###\s*(?:Step|Langkah)\s*(\d+)[:\s]*(.*)/i);
                    if (stepMatch && !raw.includes('### Step ' + (parseInt(stepMatch[1]) + 1))) {
                        const linesAfterTitle = raw.split('\n').slice(1).join('\n').trim();
                        sections.push({
                            type: 'step',
                            stepNumber: stepMatch[1],
                            title: stepMatch[2].trim() || `Langkah ${stepMatch[1]}`,
                            body: linesAfterTitle,
                        });
                    } else {
                        sections.push({ type: 'text', raw });
                    }
                }
            }
            currentTextLines = [];
        }
    };

    const flushTable = () => {
        if (currentTableLines.length > 0) {
            sections.push({ type: 'table', lines: [...currentTableLines] });
            currentTableLines = [];
            inTable = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code block toggle
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                flushText();
                flushTable();
                inCodeBlock = true;
                codeLanguage = line.trim().replace(/^```/, '').trim();
                currentCodeLines = [];
            } else {
                inCodeBlock = false;
                sections.push({
                    type: 'code',
                    raw: currentCodeLines.join('\n'),
                    language: codeLanguage || 'bash',
                });
                currentCodeLines = [];
            }
            continue;
        }

        if (inCodeBlock) {
            currentCodeLines.push(line);
            continue;
        }

        // Table row check
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            flushText();
            inTable = true;
            currentTableLines.push(line.trim());
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Split on Step headers to make each step its own block
        if (line.trim().match(/^###\s*(?:Step|Langkah)\s*\d+/i)) {
            flushText();
        }

        // Split on major H2 headers
        if (line.trim().startsWith('## ')) {
            flushText();
        }

        // Standalone image line detection: ![alt](url){options}
        const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?$/);
        if (imgMatch) {
            flushText();
            const rawAlt = imgMatch[1] || '';
            const src = imgMatch[2] || '';
            const optsString = imgMatch[3] || '';

            let align: 'left' | 'center' | 'right' | 'full' = 'center';
            let size: '25' | '50' | '75' | '100' = '100';
            let caption = '';

            // Check if alt contains pipe for caption (e.g. ![Alt text|Caption di bawah gambar](url))
            if (rawAlt.includes('|')) {
                const parts = rawAlt.split('|');
                caption = parts.slice(1).join('|').trim();
            } else {
                caption = rawAlt;
            }

            if (optsString) {
                const alignMatch = optsString.match(/align=(left|center|right|full)/i);
                if (alignMatch) align = alignMatch[1].toLowerCase() as any;

                const sizeMatch = optsString.match(/size=(25|50|75|100)/i);
                if (sizeMatch) size = sizeMatch[1] as any;
            }

            sections.push({
                type: 'image',
                src,
                alt: rawAlt.split('|')[0].trim() || 'Gambar Panduan',
                caption,
                align,
                size,
            });
            continue;
        }

        currentTextLines.push(line);
    }

    flushText();
    flushTable();

    return sections;
}

// Standalone Image Block Viewer
export const ImageBlockViewer: React.FC<{
    src: string;
    alt?: string;
    caption?: string;
    align?: 'left' | 'center' | 'right' | 'full';
    size?: '25' | '50' | '75' | '100';
    onImageClick?: (url: string, alt?: string, caption?: string) => void;
}> = ({ src, alt = 'Gambar Panduan', caption, align = 'center', size = '100', onImageClick }) => {
    const fullUrl = getImageUrl(src);

    const sizeClass = {
        '25': 'max-w-[25%] md:max-w-xs',
        '50': 'max-w-[50%] md:max-w-md',
        '75': 'max-w-[75%] md:max-w-2xl',
        '100': 'w-full',
    }[size] || 'w-full';

    const containerAlignClass = {
        left: 'flex justify-start my-4',
        center: 'flex justify-center my-4',
        right: 'flex justify-end my-4',
        full: 'w-full my-4',
    }[align] || 'flex justify-center my-4';

    return (
        <figure className={cn("clear-both transition-all group", containerAlignClass)}>
            <div className={cn("space-y-2", sizeClass)}>
                <div
                    onClick={() => onImageClick?.(fullUrl, alt, caption)}
                    className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted/20 shadow-2xs hover:shadow-md transition-all cursor-zoom-in group/img"
                >
                    <img
                        src={fullUrl}
                        alt={alt}
                        loading="lazy"
                        className="w-full h-auto object-contain max-h-[520px] rounded-2xl transition-transform duration-300 group-hover/img:scale-[1.01]"
                    />
                    <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-medium shadow-sm">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Perbesar</span>
                    </div>
                </div>
                {caption && (
                    <figcaption className="text-center text-xs text-muted-foreground italic font-medium px-2">
                        {caption}
                    </figcaption>
                )}
            </div>
        </figure>
    );
};

// Step Card Viewer
const StepCardViewer: React.FC<{
    stepNumber: string;
    title: string;
    content: string;
    isCompleted?: boolean;
    onToggle?: () => void;
    onImageClick?: (url: string, alt?: string, caption?: string) => void;
}> = ({
    stepNumber,
    title,
    content,
    isCompleted = false,
    onToggle,
    onImageClick,
}) => {
    const slug = slugify(`step-${stepNumber}-${title}`);
    return (
        <div
            id={slug}
            className={cn(
                "my-5 rounded-2xl border transition-all duration-200 p-5 md:p-6 shadow-2xs space-y-3.5 scroll-mt-24",
                isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/40 shadow-emerald-500/5"
                    : "bg-card border-border hover:border-border/90"
            )}
        >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "px-2.5 py-1 rounded-lg font-mono text-xs font-bold tracking-wider transition-colors",
                        isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-foreground text-background"
                    )}>
                        LANGKAH {stepNumber}
                    </span>
                    <h3 className={cn(
                        "font-bold text-base md:text-lg tracking-tight transition-colors",
                        isCompleted ? "text-emerald-700 dark:text-emerald-400 line-through opacity-85" : "text-foreground"
                    )}>
                        {title}
                    </h3>
                </div>

                {onToggle && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            isCompleted
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-muted/60 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                        )}
                        title={isCompleted ? 'Tandai belum selesai' : 'Tandai langkah ini sudah selesai'}
                    >
                        {isCompleted ? (
                            <>
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <span>Selesai</span>
                            </>
                        ) : (
                            <>
                                <Circle className="w-4 h-4" />
                                <span>Tandai Selesai</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className={cn("space-y-2.5 text-xs md:text-sm transition-opacity", isCompleted ? "opacity-75" : "text-foreground/90")}>
                <TextSectionViewer text={content} onImageClick={onImageClick} />
            </div>
        </div>
    );
};

// Code Block with Copy Action
const CodeBlockViewer: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // ignore
        }
    };

    return (
        <div className="my-4 rounded-xl overflow-hidden border border-border bg-slate-950 text-slate-100 shadow-xs">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-400 font-mono">
                    <Terminal className="w-3.5 h-3.5 text-slate-300" />
                    <span>{language || 'perintah / command'}</span>
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-medium cursor-pointer"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Tersalin!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Perintah</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs md:text-sm font-mono text-emerald-300 leading-relaxed custom-scrollbar selection:bg-emerald-900">
                <code>{code}</code>
            </pre>
        </div>
    );
};

// Markdown Table Viewer
const TableViewer: React.FC<{ tableLines: string[] }> = ({ tableLines }) => {
    if (tableLines.length === 0) return null;

    const rows = tableLines
        .filter(l => !l.includes('---'))
        .map(l =>
            l
                .split('|')
                .slice(1, -1)
                .map(c => c.trim())
        );

    if (rows.length === 0) return null;
    const header = rows[0];
    const dataRows = rows.slice(1);

    return (
        <div className="my-5 overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
            <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead>
                    <tr className="border-b border-border bg-muted/60 text-foreground font-semibold">
                        {header.map((col, idx) => (
                            <th key={idx} className="p-3">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-muted-foreground">
                    {dataRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-3 text-foreground/90 font-medium">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Callout Box Viewer (Diagnostic / Warning / Info)
const CalloutViewer: React.FC<{
    title: string;
    body: string;
    variant: 'info' | 'warning' | 'diagnostic';
    onImageClick?: (url: string, alt?: string, caption?: string) => void;
}> = ({
    title,
    body,
    variant,
    onImageClick,
}) => {
    const isWarning = variant === 'warning';
    const isDiagnostic = variant === 'diagnostic';
    const slug = slugify(title);

    return (
        <div
            id={slug}
            className={cn(
                "my-5 p-5 rounded-2xl border flex items-start gap-3.5 scroll-mt-24 shadow-2xs",
                isDiagnostic
                    ? "bg-card border-border text-foreground"
                    : isWarning
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
                    : "bg-muted/40 border-border text-foreground"
            )}
        >
            <div className="mt-0.5 shrink-0">
                {isDiagnostic ? (
                    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
                        <AlertCircle className="w-4 h-4" />
                    </div>
                ) : isWarning ? (
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
                        <Info className="w-4 h-4" />
                    </div>
                )}
            </div>

            <div className="space-y-2 flex-1 min-w-0">
                <h4 className="font-bold text-sm md:text-base text-foreground tracking-tight">
                    {title}
                </h4>
                <div className="text-xs md:text-sm text-foreground/90 space-y-1.5 leading-relaxed">
                    <TextSectionViewer text={body} onImageClick={onImageClick} />
                </div>
            </div>
        </div>
    );
};

// Formatted Text Section Renderer
const TextSectionViewer: React.FC<{
    text: string;
    onImageClick?: (url: string, alt?: string, caption?: string) => void;
}> = ({ text, onImageClick }) => {
    const lines = text.split('\n');

    return (
        <div className="space-y-2.5">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // Inline image in text line
                const inlineImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?$/);
                if (inlineImgMatch) {
                    const rawAlt = inlineImgMatch[1] || '';
                    const src = inlineImgMatch[2] || '';
                    const optsString = inlineImgMatch[3] || '';

                    let align: 'left' | 'center' | 'right' | 'full' = 'center';
                    let size: '25' | '50' | '75' | '100' = '100';
                    let caption = '';

                    if (rawAlt.includes('|')) {
                        const parts = rawAlt.split('|');
                        caption = parts.slice(1).join('|').trim();
                    } else {
                        caption = rawAlt;
                    }

                    if (optsString) {
                        const alignMatch = optsString.match(/align=(left|center|right|full)/i);
                        if (alignMatch) align = alignMatch[1].toLowerCase() as any;
                        const sizeMatch = optsString.match(/size=(25|50|75|100)/i);
                        if (sizeMatch) size = sizeMatch[1] as any;
                    }

                    return (
                        <ImageBlockViewer
                            key={idx}
                            src={src}
                            alt={rawAlt.split('|')[0].trim() || 'Gambar Panduan'}
                            caption={caption}
                            align={align}
                            size={size}
                            onImageClick={onImageClick}
                        />
                    );
                }

                // H1
                if (trimmed.startsWith('# ')) {
                    const title = trimmed.replace(/^#\s*/, '');
                    return (
                        <h1 key={idx} id={slugify(title)} className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight pt-4 pb-2 border-b border-border/80 scroll-mt-24">
                            {title}
                        </h1>
                    );
                }

                // H2
                if (trimmed.startsWith('## ')) {
                    const title = trimmed.replace(/^##\s*/, '');
                    return (
                        <h2 key={idx} id={slugify(title)} className="text-lg md:text-xl font-bold text-foreground tracking-tight pt-5 pb-2 border-b border-border/60 scroll-mt-24">
                            {title}
                        </h2>
                    );
                }

                // H3 (Non-step)
                if (trimmed.startsWith('### ')) {
                    const title = trimmed.replace(/^###\s*/, '');
                    return (
                        <h3 key={idx} id={slugify(title)} className="text-sm md:text-base font-bold text-foreground tracking-tight pt-3 scroll-mt-24">
                            {title}
                        </h3>
                    );
                }

                // H4
                if (trimmed.startsWith('#### ')) {
                    return (
                        <h4 key={idx} className="text-xs md:text-sm font-semibold text-foreground pt-1.5">
                            {trimmed.replace(/^####\s*/, '')}
                        </h4>
                    );
                }

                // Numbered list item (1. 2. 3.)
                const orderedMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
                if (orderedMatch) {
                    const num = orderedMatch[1];
                    const content = orderedMatch[2];
                    return (
                        <div key={idx} className="flex items-start gap-3 pl-1 my-1.5">
                            <span className="w-5 h-5 rounded-md bg-muted border border-border text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                {num}
                            </span>
                            <span className="text-foreground/90 text-xs md:text-sm leading-relaxed flex-1 pt-0.5">
                                {formatInlineStyles(content, onImageClick)}
                            </span>
                        </div>
                    );
                }

                // Unordered list item (- or *)
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const item = trimmed.replace(/^[-*]\s*/, '');
                    return (
                        <div key={idx} className="flex items-start gap-2.5 pl-2 my-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 shrink-0 mt-2" />
                            <span className="text-foreground/90 text-xs md:text-sm leading-relaxed flex-1">
                                {formatInlineStyles(item, onImageClick)}
                            </span>
                        </div>
                    );
                }

                // Regular Paragraph
                return (
                    <p key={idx} className="text-xs md:text-sm text-foreground/80 leading-relaxed">
                        {formatInlineStyles(trimmed, onImageClick)}
                    </p>
                );
            })}
        </div>
    );
};

// Inline Markdown Parser: **bold**, `code`, [link](url), and inline images
function formatInlineStyles(
    text: string,
    onImageClick?: (url: string, alt?: string, caption?: string) => void
): React.ReactNode {
    // Check for inline images inside sentence: ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(renderFormattedSubtext(text.substring(lastIndex, match.index)));
        }

        const alt = match[1] || 'Gambar';
        const src = match[2] || '';
        const fullUrl = getImageUrl(src);

        parts.push(
            <span
                key={`img-${match.index}`}
                onClick={() => onImageClick?.(fullUrl, alt)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-lg border border-border bg-muted/30 hover:bg-muted/70 cursor-zoom-in text-xs text-foreground font-medium transition-colors"
                title="Klik untuk melihat gambar"
            >
                <ZoomIn className="w-3 h-3 text-primary shrink-0" />
                <img src={fullUrl} alt={alt} className="w-4 h-4 object-cover rounded shrink-0" />
                <span className="truncate max-w-[120px]">{alt}</span>
            </span>
        );

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(renderFormattedSubtext(text.substring(lastIndex)));
    }

    return parts.length > 0 ? parts : renderFormattedSubtext(text);
}

function renderFormattedSubtext(subtext: string): React.ReactNode {
    const subParts = subtext.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    return subParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={i} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code key={i} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground font-medium border border-border/80">
                    {part.slice(1, -1)}
                </code>
            );
        }
        return part;
    });
}
