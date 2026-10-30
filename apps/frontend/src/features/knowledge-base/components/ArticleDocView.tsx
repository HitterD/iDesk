import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Link2, Pencil, Printer, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashPanel, cssVars } from '@/features/dashboard/components/DashboardParts';
import { ResBub } from '@/components/resources/ResourceParts';
import { cn } from '@/lib/utils';
import { ArticleMarkdownViewer } from './ArticleMarkdownViewer';
import { ArticleViewersStack } from './ArticleViewersStack';
import type { ViewerItem } from './ArticleViewersModal';
import { topicMeta } from './kbTopics';
import '@/components/resources/resources.css';

export interface ArticleTocItem { id: string; title: string; level: number; stepNumber?: string }

interface ArticleDocViewProps {
    article: {
        id: string; title: string; content: string; category: string; tags?: string[]; status?: string;
        viewCount: number; helpfulCount: number; featuredImage?: string; createdAt: string; updatedAt?: string;
    };
    authorName: string;
    readingTime: string;
    updatedLabel: string;
    printedLabel: string;
    viewers?: { recentViewers?: ViewerItem[]; totalViewers?: number };
    tocItems: ArticleTocItem[];
    activeTocId: string;
    onScrollTo: (id: string) => void;
    tocContainerRef: React.RefObject<HTMLDivElement | null>;
    totalSteps: number;
    completedSteps: Record<string, boolean>;
    onToggleStep: (stepNumber: string) => void;
    helpfulVote: 'yes' | 'no' | null;
    onVote: (vote: 'yes' | 'no') => void;
    copiedShare: boolean;
    onShare: () => void;
    onPrint: () => void;
    kbPath: string;
    createTicketPath: string;
    editPath?: string;
    imageUrl?: (url: string) => string;
    scrollProgress: number;
    /** Requester-only callout above the article body (portal guidebook acknowledgement). */
    topSlot?: React.ReactNode;
}

const PERCENT = 100;

/** Mockup kb-article.html: one `.doc` surface + sticky aside (Progres Solusi, Daftar Isi, Butuh Bantuan). */
export function ArticleDocView(props: ArticleDocViewProps) {
    const { article, tocItems, totalSteps, completedSteps } = props;
    const meta = topicMeta(article.category);
    const CatIcon = meta.icon;
    const completed = Object.values(completedSteps).filter(Boolean).length;
    const steps = tocItems.filter((t) => t.stepNumber);
    const viewers = props.viewers?.recentViewers ?? [];

    return (
        <div className="kb-page pb-20 relative">
            <div className="fixed top-0 left-0 h-[2.5px] bg-[hsl(var(--idesk-sapphire))] z-50 print:hidden" style={{ width: `${props.scrollProgress}%` }} aria-hidden="true" />
            <div className="kb-article">
                <article className="kb-doc">
                    <div className="hidden print:flex items-center justify-between pb-4 mb-6 border-b-2 border-slate-900">
                        <div className="text-base font-bold text-slate-900">iDesk · Standard Operating Procedure</div>
                        <div className="text-right text-[11px] text-slate-600">
                            <div>ID Dokumen: <span className="font-mono font-semibold">{article.id.slice(0, 8)}</span></div>
                            <div>Kategori: {article.category}</div>
                            <div>Tanggal Cetak: {props.printedLabel}</div>
                        </div>
                    </div>
                    <nav className="kb-crumb print:hidden" aria-label="Breadcrumb">
                        <Link to={props.kbPath}>Knowledge Base</Link><ChevronRight aria-hidden="true" /><b>{article.category}</b>
                    </nav>
                    <div className="kb-title-row">
                        <h1>{article.title}</h1>
                        <div className="kb-title-acts print:hidden">
                            <Button variant="soft" size="icon" onClick={props.onShare} aria-label={props.copiedShare ? 'Tautan tersalin' : 'Salin tautan artikel'} title="Salin tautan artikel">
                                {props.copiedShare ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                            </Button>
                            <Button variant="soft" onClick={props.onPrint} title="Cetak panduan ini atau simpan sebagai PDF"><Printer aria-hidden="true" />Cetak</Button>
                            {props.editPath && <Link to={props.editPath} className="idesk-btn is-soft"><Pencil aria-hidden="true" />Edit</Link>}
                        </div>
                    </div>
                    <div className="kb-by">
                        <ResBub color={meta.color} icon={CatIcon}>{article.category}</ResBub>
                        {article.status && article.status !== 'published' && <ResBub color="var(--dash-orange)" ink="var(--dash-ink-orange)">{article.status}</ResBub>}
                        <span>Ditulis oleh <b>{props.authorName}</b></span><span aria-hidden="true">·</span>
                        <span>Diperbarui {props.updatedLabel}</span><span aria-hidden="true">·</span>
                        <span>{props.readingTime}</span><span aria-hidden="true">·</span>
                        <span>{(article.viewCount ?? 0).toLocaleString('id-ID')} views</span>
                        {viewers.length > 0 && (
                            <span className="kb-by-right">
                                <ArticleViewersStack viewers={viewers} totalCount={props.viewers?.totalViewers || article.viewCount} articleTitle={article.title} />
                            </span>
                        )}
                    </div>
                    {props.topSlot && <div className="mt-4">{props.topSlot}</div>}
                    {article.featuredImage && props.imageUrl && (
                        <img src={props.imageUrl(article.featuredImage)} alt={article.title} className="mt-5 w-full h-64 md:h-80 object-cover rounded-2xl"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="kb-body">
                        <ArticleMarkdownViewer content={article.content} completedSteps={completedSteps} onToggleStep={props.onToggleStep} />
                    </div>
                    {article.tags && article.tags.length > 0 && (
                        <div className="kb-tags print:hidden">Topik Terkait:{article.tags.map((t) => <span key={t}>{t}</span>)}</div>
                    )}
                    <section className="kb-feedback print:hidden" aria-label="Umpan balik">
                        <div>
                            <b>Apakah panduan ini membantu?</b>
                            <small>{(article.helpfulCount ?? 0) > 0 ? `${article.helpfulCount} rekan kerja merasa terbantu dengan panduan ini.` : 'Beri tahu kami apakah solusi ini berhasil menyelesaikan kendala Anda.'}</small>
                        </div>
                        <Button variant="soft" className={cn(props.helpfulVote === 'yes' && 'is-on')} onClick={() => props.onVote('yes')} disabled={props.helpfulVote !== null} aria-pressed={props.helpfulVote === 'yes'}>
                            <ThumbsUp aria-hidden="true" />Ya, Membantu
                        </Button>
                        <Button variant="soft" className={cn(props.helpfulVote === 'no' && 'is-on')} onClick={() => props.onVote('no')} disabled={props.helpfulVote !== null} aria-pressed={props.helpfulVote === 'no'}>
                            <ThumbsDown aria-hidden="true" />Belum
                        </Button>
                    </section>
                </article>

                <aside className="res-stack kb-aside print:hidden">
                    {totalSteps > 0 && (
                        <DashPanel title={<>Progres Solusi <small>{completed}/{totalSteps} Selesai</small></>} label="Progres Solusi">
                            <span className="res-meter" style={cssVars({ '--c': 'var(--dash-green)', '--p': `${(completed / totalSteps) * PERCENT}%` })}><i /></span>
                            <div className="kb-steps">
                                {steps.map((s) => (
                                    <label key={s.id}>
                                        <input type="checkbox" checked={!!completedSteps[s.stepNumber!]} onChange={() => props.onToggleStep(s.stepNumber!)} />
                                        {s.title}
                                    </label>
                                ))}
                            </div>
                        </DashPanel>
                    )}
                    {tocItems.length > 0 && (
                        <DashPanel title="Daftar Isi">
                            <nav className="kb-toc" ref={props.tocContainerRef} aria-label="Daftar isi">
                                {tocItems.map((item, idx) => {
                                    const done = item.stepNumber ? !!completedSteps[item.stepNumber] : false;
                                    return (
                                        <button key={`${item.id}-${idx}`} type="button" data-toc-id={item.id} title={item.title}
                                            className={cn(item.level === 3 && 'is-sub', props.activeTocId === item.id && 'is-active', done && 'is-done')}
                                            aria-current={props.activeTocId === item.id ? 'location' : undefined}
                                            onClick={() => props.onScrollTo(item.id)}>
                                            <span>{item.title}</span>{done && <Check aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </nav>
                        </DashPanel>
                    )}
                    <DashPanel title="Butuh Bantuan Langsung?">
                        <p className="dash-panel-sub" style={{ margin: '0 0 8px' }}>Jika langkah di atas belum berhasil, tim IT siap membantu.</p>
                        <Link to={props.createTicketPath} className="idesk-text-link">Buat Tiket Bantuan<ArrowRight aria-hidden="true" /></Link>
                    </DashPanel>
                </aside>
            </div>
        </div>
    );
}
