import React, { useState } from 'react';
import {
    Copy,
    Check,
    Info,
    AlertTriangle,
    Terminal,
    AlertCircle,
    CheckCircle2,
    Circle,
    ZoomIn,
    Maximize2,
    Lightbulb,
    ShieldAlert,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ArticleMarkdownViewerProps {
    content: string;
    className?: string;
    completedSteps?: Record<string, boolean>;
    onToggleStep?: (stepNumber: string) => void;
}

export function stripEmojis(str: string): string {
    if (!str) return '';
    return str
        .replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{200D}\u{FE0E}\u{FE0F}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

export function slugify(text: string): string {
    return stripEmojis(text)
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
        <div className={cn("article-prose space-y-6 text-foreground/90 leading-relaxed text-[15px] max-w-none", className)}>
            {sections.map((section, idx) => {
                if (section.type === 'hr') {
                    return <hr key={idx} className="my-8 border-t border-border/70" />;
                } else if (section.type === 'code') {
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
                } else if (section.type === 'quote') {
                    return (
                        <blockquote
                            key={idx}
                            className="my-5 pl-4 border-l-3 border-primary/60 bg-muted/20 py-3 pr-4 rounded-r-xl text-foreground/80 italic text-[14px] leading-relaxed"
                        >
                            <TextSectionViewer text={section.raw} onImageClick={handleImageClick} />
                        </blockquote>
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
type CalloutVariant = 'info' | 'warning' | 'diagnostic' | 'tip' | 'important' | 'caution';

type Section =
    | { type: 'text'; raw: string }
    | { type: 'hr' }
    | { type: 'quote'; raw: string }
    | { type: 'code'; raw: string; language?: string }
    | { type: 'table'; lines: string[] }
    | { type: 'step'; stepNumber: string; title: string; body: string }
    | { type: 'callout'; title: string; body: string; variant: CalloutVariant }
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
                // Conventional Callout detection
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
                            title: stripEmojis(stepMatch[2].trim() || `Langkah ${stepMatch[1]}`),
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
        const trimmed = line.trim();

        // Code block toggle
        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                flushText();
                flushTable();
                inCodeBlock = true;
                codeLanguage = trimmed.replace(/^```/, '').trim();
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

        // Horizontal rule: ---, ***, ___
        if (/^(?:---|[*]{3,}|_{3,})$/.test(trimmed)) {
            flushText();
            flushTable();
            sections.push({ type: 'hr' });
            continue;
        }

        // GitHub Alert syntax: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
        const ghAlertMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (ghAlertMatch) {
            flushText();
            flushTable();
            const alertType = ghAlertMatch[1].toUpperCase();
            const variantMap: Record<string, { variant: CalloutVariant; defaultTitle: string }> = {
                NOTE: { variant: 'info', defaultTitle: 'Catatan' },
                TIP: { variant: 'tip', defaultTitle: 'Tips & Saran' },
                IMPORTANT: { variant: 'important', defaultTitle: 'Penting' },
                WARNING: { variant: 'warning', defaultTitle: 'Peringatan' },
                CAUTION: { variant: 'caution', defaultTitle: 'Perhatian' },
            };
            const meta = variantMap[alertType] || { variant: 'info', defaultTitle: 'Informasi' };

            // Gather all subsequent lines starting with >
            const alertLines: string[] = [];
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
                i++;
                alertLines.push(lines[i].trim().replace(/^>\s?/, ''));
            }

            sections.push({
                type: 'callout',
                title: meta.defaultTitle,
                body: alertLines.join('\n').trim(),
                variant: meta.variant,
            });
            continue;
        }

        // Blockquote: > line
        if (trimmed.startsWith('> ')) {
            flushText();
            flushTable();
            const quoteLines = [trimmed.replace(/^>\s?/, '')];
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
                i++;
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
            }
            sections.push({
                type: 'quote',
                raw: quoteLines.join('\n'),
            });
            continue;
        }

        // Table row check
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            flushText();
            inTable = true;
            currentTableLines.push(trimmed);
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Split on Step headers to make each step its own block
        if (trimmed.match(/^###\s*(?:Step|Langkah)\s*\d+/i)) {
            flushText();
        }

        // Split on major H2 headers
        if (trimmed.startsWith('## ')) {
            flushText();
        }

        // Standalone image line detection: ![alt](url){options}
        const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?$/);
        if (imgMatch) {
            flushText();
            const rawAlt = imgMatch[1] || '';
            const src = imgMatch[2] || '';
            const optsString = imgMatch[3] || '';

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
        left: 'flex justify-start my-6',
        center: 'flex justify-center my-6',
        right: 'flex justify-end my-6',
        full: 'w-full my-6',
    }[align] || 'flex justify-center my-6';

    return (
        <figure className={cn("clear-both transition-all group", containerAlignClass)}>
            <div className={cn("space-y-2.5", sizeClass)}>
                <div
                    onClick={() => onImageClick?.(fullUrl, alt, caption)}
                    className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted/10 shadow-2xs hover:shadow-md transition-all cursor-zoom-in group/img"
                >
                    <img
                        src={fullUrl}
                        alt={alt}
                        loading="lazy"
                        className="w-full h-auto object-contain max-h-[540px] rounded-2xl transition-transform duration-300 group-hover/img:scale-[1.005]"
                    />
                    <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1.5 text-[11px] font-medium shadow-sm">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Perbesar</span>
                    </div>
                </div>
                {caption && (
                    <figcaption className="text-center text-xs text-muted-foreground font-medium px-2">
                        {caption}
                    </figcaption>
                )}
            </div>
        </figure>
    );
};

// Step Card Viewer (Clean, Non-Bulky Enterprise Step)
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
    const cleanTitle = stripEmojis(title);
    const slug = slugify(`step-${stepNumber}-${cleanTitle}`);
    return (
        <div
            id={slug}
            className={cn(
                "my-6 rounded-2xl border transition-all duration-200 p-5 md:p-6 scroll-mt-24 space-y-4 shadow-2xs",
                isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-card/70 border-border/80 hover:border-border hover:bg-card"
            )}
        >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                    <span className={cn(
                        "px-2.5 py-0.5 rounded-md font-mono text-xs font-bold tracking-wide transition-colors",
                        isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-foreground border border-border"
                    )}>
                        LANGKAH {stepNumber}
                    </span>
                    <h3 className={cn(
                        "font-bold text-base md:text-lg tracking-tight transition-colors",
                        isCompleted ? "text-emerald-700 dark:text-emerald-400 line-through opacity-85" : "text-foreground"
                    )}>
                        {cleanTitle}
                    </h3>
                </div>

                {onToggle && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-2xs",
                            isCompleted
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                        )}
                        title={isCompleted ? 'Tandai belum selesai' : 'Tandai langkah ini sudah selesai'}
                    >
                        {isCompleted ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span>Selesai</span>
                            </>
                        ) : (
                            <>
                                <Circle className="w-4 h-4 text-muted-foreground" />
                                <span>Tandai Selesai</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className={cn("space-y-3 text-[14px] md:text-[15px] transition-opacity", isCompleted ? "opacity-75" : "text-foreground/90")}>
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
        <div className="my-5 rounded-2xl overflow-hidden border border-border/80 bg-slate-950 text-slate-100 shadow-xs">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
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
        <div className="my-6 overflow-x-auto rounded-xl border border-border/80 bg-card shadow-2xs">
            <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead>
                    <tr className="border-b border-border bg-muted/60 text-foreground font-semibold">
                        {header.map((col, idx) => (
                            <th key={idx} className="p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                    {dataRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-3.5 text-foreground/90 font-normal leading-relaxed">
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

// Callout Box Viewer (GitHub Alerts & Documentation Notes)
const CalloutViewer: React.FC<{
    title: string;
    body: string;
    variant: CalloutVariant;
    onImageClick?: (url: string, alt?: string, caption?: string) => void;
}> = ({
    title,
    body,
    variant,
    onImageClick,
}) => {
    const cleanTitle = stripEmojis(title);
    const slug = slugify(cleanTitle);

    const configMap: Record<CalloutVariant, {
        containerClass: string;
        iconClass: string;
        icon: React.ReactNode;
    }> = {
        info: {
            containerClass: "bg-blue-500/5 border-blue-500/25 text-foreground",
            iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
            icon: <Info className="w-4 h-4" />,
        },
        tip: {
            containerClass: "bg-emerald-500/5 border-emerald-500/25 text-foreground",
            iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
            icon: <Lightbulb className="w-4 h-4" />,
        },
        important: {
            containerClass: "bg-purple-500/5 border-purple-500/25 text-foreground",
            iconClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
            icon: <AlertCircle className="w-4 h-4" />,
        },
        warning: {
            containerClass: "bg-amber-500/5 border-amber-500/25 text-foreground",
            iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
            icon: <AlertTriangle className="w-4 h-4" />,
        },
        caution: {
            containerClass: "bg-rose-500/5 border-rose-500/25 text-foreground",
            iconClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
            icon: <ShieldAlert className="w-4 h-4" />,
        },
        diagnostic: {
            containerClass: "bg-muted/40 border-border/80 text-foreground",
            iconClass: "bg-muted border-border text-foreground",
            icon: <AlertCircle className="w-4 h-4" />,
        },
    };

    const config = configMap[variant] || configMap.info;

    return (
        <div
            id={slug}
            className={cn(
                "my-6 p-4 md:p-5 rounded-2xl border flex items-start gap-3.5 scroll-mt-24 shadow-2xs",
                config.containerClass
            )}
        >
            <div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5", config.iconClass)}>
                {config.icon}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
                <h4 className="font-bold text-sm md:text-base text-foreground tracking-tight">
                    {cleanTitle}
                </h4>
                <div className="text-xs md:text-sm text-foreground/85 space-y-1.5 leading-relaxed">
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
        <div className="space-y-3">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1.5" />;

                // Horizontal rule check within text block
                if (/^(?:---|[*]{3,}|_{3,})$/.test(trimmed)) {
                    return <hr key={idx} className="my-8 border-t border-border/70" />;
                }

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
                    const title = stripEmojis(trimmed.replace(/^#\s*/, ''));
                    return (
                        <h1 key={idx} id={slugify(title)} className="text-2xl md:text-3xl font-bold text-foreground tracking-tight pt-6 pb-2 border-b border-border/70 scroll-mt-24">
                            {title}
                        </h1>
                    );
                }

                // H2
                if (trimmed.startsWith('## ')) {
                    const title = stripEmojis(trimmed.replace(/^##\s*/, ''));
                    return (
                        <h2 key={idx} id={slugify(title)} className="text-xl md:text-2xl font-semibold text-foreground tracking-tight pt-6 pb-2 border-b border-border/50 scroll-mt-24">
                            {title}
                        </h2>
                    );
                }

                // H3 (Non-step)
                if (trimmed.startsWith('### ')) {
                    const title = stripEmojis(trimmed.replace(/^###\s*/, ''));
                    return (
                        <h3 key={idx} id={slugify(title)} className="text-base md:text-lg font-semibold text-foreground tracking-tight pt-4 scroll-mt-24">
                            {title}
                        </h3>
                    );
                }

                // H4
                if (trimmed.startsWith('#### ')) {
                    return (
                        <h4 key={idx} className="text-sm font-semibold text-foreground pt-2">
                            {stripEmojis(trimmed.replace(/^####\s*/, ''))}
                        </h4>
                    );
                }

                // Numbered list item (1. 2. 3.)
                const orderedMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
                if (orderedMatch) {
                    const num = orderedMatch[1];
                    const content = stripEmojis(orderedMatch[2]);
                    return (
                        <div key={idx} className="flex items-start gap-3 pl-1 my-2">
                            <span className="w-5 h-5 rounded-md bg-muted border border-border text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                {num}
                            </span>
                            <div className="text-foreground/90 text-sm md:text-[15px] leading-relaxed flex-1 pt-0.5">
                                {formatInlineStyles(content, onImageClick)}
                            </div>
                        </div>
                    );
                }

                // Unordered list item (- or *)
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const item = stripEmojis(trimmed.replace(/^[-*]\s*/, ''));
                    return (
                        <div key={idx} className="flex items-start gap-3 pl-2 my-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground/70 shrink-0 mt-2.5" />
                            <div className="text-foreground/90 text-sm md:text-[15px] leading-relaxed flex-1">
                                {formatInlineStyles(item, onImageClick)}
                            </div>
                        </div>
                    );
                }

                // Regular Paragraph
                return (
                    <p key={idx} className="text-sm md:text-[15px] text-foreground/85 leading-relaxed">
                        {formatInlineStyles(stripEmojis(trimmed), onImageClick)}
                    </p>
                );
            })}
        </div>
    );
};

// Inline Markdown Parser: **bold**, `code`, [link](url), raw URLs, <kbd>, and inline images
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
                className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 rounded-lg border border-border bg-muted/40 hover:bg-muted cursor-zoom-in text-xs text-foreground font-medium transition-colors"
                title="Klik untuk melihat gambar"
            >
                <ZoomIn className="w-3.5 h-3.5 text-primary shrink-0" />
                <img src={fullUrl} alt={alt} className="w-4 h-4 object-cover rounded shrink-0" />
                <span className="truncate max-w-[140px]">{alt}</span>
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
    // Tokenizer matching markdown links [text](url), bold **bold**, code `code`, keyboard <kbd>text</kbd>, and raw urls https?://
    const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|<kbd>[^<]+<\/kbd>|https?:\/\/[^\s<)]+)/g;
    const tokens = subtext.split(tokenRegex);

    return tokens.map((token, i) => {
        if (!token) return null;

        // Markdown link [text](url)
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            const label = linkMatch[1];
            const href = linkMatch[2];
            const isExternal = href.startsWith('http://') || href.startsWith('https://');
            return (
                <a
                    key={i}
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    className="text-primary font-medium underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors inline-flex items-center gap-0.5"
                >
                    <span>{label}</span>
                    {isExternal && <ExternalLink className="w-3 h-3 text-primary/70 shrink-0 inline" />}
                </a>
            );
        }

        // Bold **text**
        if (token.startsWith('**') && token.endsWith('**')) {
            return (
                <strong key={i} className="font-semibold text-foreground">
                    {stripEmojis(token.slice(2, -2))}
                </strong>
            );
        }

        // Inline Code `code`
        if (token.startsWith('`') && token.endsWith('`')) {
            return (
                <code key={i} className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-xs text-foreground font-semibold border border-border/80">
                    {token.slice(1, -1)}
                </code>
            );
        }

        // Keyboard tag <kbd>text</kbd>
        if (token.startsWith('<kbd>') && token.endsWith('</kbd>')) {
            return (
                <kbd key={i} className="px-1.5 py-0.5 rounded-md bg-muted border border-border text-foreground font-mono text-[11px] font-semibold shadow-2xs">
                    {token.slice(5, -6)}
                </kbd>
            );
        }

        // Standalone URL https://...
        if (/^https?:\/\/[^\s<)]+$/.test(token)) {
            return (
                <a
                    key={i}
                    href={token}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-mono text-xs underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors inline-flex items-center gap-0.5 break-all"
                >
                    <span>{token}</span>
                    <ExternalLink className="w-3 h-3 text-primary/70 shrink-0 inline" />
                </a>
            );
        }

        return stripEmojis(token);
    });
}
