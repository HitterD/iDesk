import { motion } from 'framer-motion';
import { useComments } from '../../hooks/useComments';
import { fmtRelative } from '../../utils/format.util';
import { SectionCard } from '../common/SectionCard';
import { CommentComposer } from './CommentComposer';

export function CommentThread({ requestId, canComment }: { requestId: string; canComment: boolean }) {
    const q = useComments(requestId);
    const rows = q.data?.pages.flatMap(p => p.rows) ?? [];

    return (
        <SectionCard title={`Komentar · ${rows.length}`}>
            {canComment && <CommentComposer requestId={requestId} />}
            {q.isError && (
                <div className="mt-3 text-xs text-rose-600 text-center py-4">
                    Gagal memuat komentar. Coba refresh halaman.
                </div>
            )}
            <ul className="mt-3 space-y-3">
                {rows.map(c => (
                    <motion.li key={c.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                        className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-900 dark:text-slate-200">{c.author?.fullName ?? 'Unknown'}</span>
                            {c.author?.role && <span className="text-xs rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5">{c.author.role}</span>}
                            <span>· {fmtRelative(c.createdAt)}</span>
                            {c.editedAt && <span className="italic text-slate-400 dark:text-slate-500">(edited)</span>}
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-300 whitespace-pre-wrap">{c.body}</p>
                    </motion.li>
                ))}
                {q.hasNextPage && (
                    <button onClick={() => q.fetchNextPage()} className="text-xs text-slate-600 dark:text-slate-400 hover:underline">
                        Load older…
                    </button>
                )}
                {rows.length === 0 && <div className="text-center text-xs text-slate-500 dark:text-slate-500 py-6">Belum ada komentar.</div>}
            </ul>
        </SectionCard>
    );
}
