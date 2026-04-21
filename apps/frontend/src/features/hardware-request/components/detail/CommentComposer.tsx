import { useState } from 'react';
import { Send } from 'lucide-react';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';

export function CommentComposer({ requestId }: { requestId: string }) {
    const [text, setText] = useState('');
    const { addCommentMut } = useHardwareMutations(requestId);

    const submit = () => {
        if (!text.trim()) return;
        addCommentMut.mutate(text.trim());
        setText('');
    };

    return (
        <div className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex flex-col gap-2.5 focus-within:border-slate-400 dark:focus-within:border-slate-600 transition-all duration-200 shadow-sm">
            <textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                rows={2}
                placeholder="Tulis pesan atau lampirkan informasi..."
                className="w-full resize-none px-2 py-1 text-sm bg-transparent dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600" 
            />
            <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-2">
                <button 
                    type="button" 
                    onClick={submit} 
                    disabled={!text.trim() || addCommentMut.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-30 transition-all duration-200"
                >
                    <Send className="size-3.5" /> 
                    {addCommentMut.isPending ? 'Mengirim...' : 'Kirim Komentar'}
                </button>
            </div>
        </div>
    );
}
