import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { SectionCard } from '../common/SectionCard';
import type { CreateFormValues } from './CreateWizard';

export function InfoStep() {
    const { register, formState: { errors } } = useFormContext<CreateFormValues>();
    const { data: sites, isLoading: loadingSites } = useQuery({ 
        queryKey: ['sites', 'active'], 
        queryFn: async () => {
            const res = await api.get<{ id: string; name: string }[]>('/sites/active');
            return res.data;
        } 
    });

    return (
        <SectionCard title="Informasi Permintaan">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Site / Lokasi</label>
                        <select 
                            {...register('siteId')}
                            className={`w-full px-4 py-2.5 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none
                                ${errors.siteId ? 'border-rose-500 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-white'}`}
                        >
                            <option value="">{loadingSites ? 'Memuat...' : 'Pilih site…'}</option>
                            {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {errors.siteId && <p className="text-xs font-medium text-rose-600 mt-1">Site wajib dipilih</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Divisi Penerima</label>
                        <input 
                            type="text" 
                            {...register('division')}
                            placeholder="Misal: IT, Finance, HR..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all duration-200 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-slate-900 dark:focus:border-white outline-none" 
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Nama Penerima</label>
                    <input 
                        type="text" 
                        {...register('recipientName')}
                        placeholder="Misal: Budi, Iwan (Opsional, kosongkan jika untuk diri sendiri)"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all duration-200 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-slate-900 dark:focus:border-white outline-none" 
                    />
                    <p className="text-xs text-slate-400 italic">Gunakan koma untuk memisahkan beberapa nama.</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Justifikasi Kebutuhan</label>
                    <textarea 
                        {...register('justification')} 
                        rows={4}
                        placeholder="Jelaskan kebutuhan hardware, alasan permintaan, atau detail tambahan lainnya..."
                        className={`w-full px-4 py-2.5 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none
                            ${errors.justification ? 'border-rose-500 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-white'}`}
                    />
                    {errors.justification && <p className="text-xs font-medium text-rose-600 mt-1">{errors.justification.message}</p>}
                </div>
            </div>
        </SectionCard>
    );
}
