import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Info, Clock, Download, Share2, FileText, Upload, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { useLostItemReport, useUpdateLostItemStatus, useUploadPoliceReport, LostItemStatus } from '../api/lost-item.api';
import { useFoundClaimsForReport, useMatchFoundClaim, useRejectFoundClaim, FoundClaimStatus } from '../api/found-claim.api';
import { StatusBadge } from '../components/StatusBadge';
import { StatusTimeline } from '../components/StatusTimeline';
import { PhotoGrid } from '../components/PhotoGrid';
import { ContextualActions } from '../components/ContextualActions';
import { FoundClaimCard } from '../components/FoundClaimCard';

function PoliceReportUpload({ itemId, onSuccess }: { itemId: string, onSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [reportNumber, setReportNumber] = useState('');
    const mutation = useUploadPoliceReport();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !reportNumber) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('reportNumber', reportNumber);
        mutation.mutate({ id: itemId, formData }, { 
            onSuccess: () => {
                toast.success('Laporan polisi berhasil diupload');
                onSuccess();
            },
            onError: () => toast.error('Gagal upload laporan polisi')
        });
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Laporan Polisi</label>
                <input
                    type="text"
                    required
                    value={reportNumber}
                    onChange={e => setReportNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                    placeholder="B/123/IV/2026/SPKT..."
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">File Laporan (PDF/JPG)</label>
                <input
                    type="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
            </div>
            <button
                type="submit"
                disabled={!file || !reportNumber || mutation.isPending}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"
            >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Laporan
            </button>
        </form>
    );
}

export const LostItemDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const { data: item, isLoading, refetch } = useLostItemReport(id!);
    const { data: foundClaims = [], refetch: refetchClaims } = useFoundClaimsForReport(id!);
    const updateStatus = useUpdateLostItemStatus();
    const matchClaim = useMatchFoundClaim();
    const rejectClaim = useRejectFoundClaim();
    
    const isOwnReport = item?.ticket?.user?.email === user?.email || item?.reporter?.id === user?.id;
    const isICT = ['ADMIN', 'AGENT', 'MANAGER'].includes(user?.role || '');

    const handleStatusChange = (status: LostItemStatus, notes?: string) => {
        updateStatus.mutate({ id: id!, status, notes }, {
            onSuccess: () => {
                toast.success('Status berhasil diperbarui');
                refetch();
            },
            onError: () => toast.error('Gagal memperbarui status')
        });
    };

    const handleClaimMatch = (claimId: string) => {
        matchClaim.mutate({ id: claimId, lostItemReportId: id }, {
            onSuccess: () => {
                toast.success('Laporan penemu telah di-match');
                refetch();
                refetchClaims();
            },
            onError: () => toast.error('Gagal match laporan')
        });
    };

    const handleClaimReject = (claimId: string) => {
        rejectClaim.mutate({ id: claimId, notes: '' }, {
            onSuccess: () => {
                toast.success('Laporan penemu ditolak');
                refetchClaims();
            },
            onError: () => toast.error('Gagal menolak laporan')
        });
    };

    const copyQrLink = () => {
        const link = `${window.location.origin}/found/${item?.qrCodeToken}`;
        navigator.clipboard.writeText(link);
        toast.success('Link disalin ke clipboard');
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-rose-500 animate-spin" /></div>;
    }

    if (!item) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl font-bold text-slate-800">Laporan tidak ditemukan</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-rose-600 font-medium hover:underline">← Kembali</button>
            </div>
        );
    }

    const reporterName = item.reporter?.fullName || item.ticket?.user?.fullName || 'Unknown';

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-extrabold text-slate-900">{item.itemName}</h1>
                        <StatusBadge status={item.status} />
                    </div>
                    <div className="text-sm text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-slate-400">#{item.id.slice(0, 8)}</span>
                        <span>•</span>
                        <span>{reporterName}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: localeId })}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Kolom Kiri - Info Barang */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4">Informasi Barang</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Tipe Barang</p>
                                <p className="font-semibold text-slate-900 capitalize">{item.itemType}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Serial Number / Asset Tag</p>
                                <p className="font-semibold text-slate-900 font-mono">
                                    {item.serialNumber || item.assetTag || '-'}
                                </p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1">
                                    <MapPin className="w-4 h-4" /> Terakhir Terlihat
                                </p>
                                <p className="font-semibold text-slate-900">{item.lastSeenLocation}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-slate-500 font-medium mb-1 flex items-center gap-1">
                                    <Calendar className="w-4 h-4" /> Waktu Terakhir Terlihat
                                </p>
                                <p className="font-semibold text-slate-900">
                                    {format(new Date(item.lastSeenDatetime), 'dd MMMM yyyy, HH:mm', { locale: localeId })}
                                </p>
                            </div>
                            <div className="md:col-span-2 mt-2">
                                <p className="text-slate-500 font-medium mb-2 flex items-center gap-1">
                                    <Info className="w-4 h-4" /> Kronologi Kejadian
                                </p>
                                <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {item.circumstances}
                                </p>
                            </div>
                        </div>
                    </div>

                    {item.photoUrls?.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6">
                            <h3 className="font-bold text-lg text-slate-900 mb-4">Foto Referensi</h3>
                            <PhotoGrid urls={item.photoUrls} />
                        </div>
                    )}

                    {/* Police Report */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4">Laporan Polisi</h3>
                        {/* {item.hasPoliceReport ? ( ... ) : ...} */}
                        {/* Since we don't have hasPoliceReport field directly, we can check a custom field or assumption. Let's assume we don't have it mapped perfectly in entity yet, so we will show it conditionally if policeReportNumber exists */}
                        {(item as any).policeReportNumber ? (
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <span className="text-sm font-semibold text-slate-700">No. {(item as any).policeReportNumber}</span>
                                {(item as any).policeReportFile && (
                                    <a href={(item as any).policeReportFile} target="_blank" rel="noreferrer" className="ml-auto text-sm text-blue-600 hover:underline">
                                        Lihat File
                                    </a>
                                )}
                            </div>
                        ) : (
                            <PoliceReportUpload itemId={item.id} onSuccess={() => refetch()} />
                        )}
                    </div>

                    {/* Found Claims */}
                    {foundClaims.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                Laporan Penemu
                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-xs">{foundClaims.length}</span>
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {foundClaims.map(claim => (
                                    <FoundClaimCard 
                                        key={claim.id} 
                                        claim={claim} 
                                        isICT={isICT} 
                                        onConfirm={handleClaimMatch}
                                        onReject={handleClaimReject}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Kolom Kanan - Timeline & QR */}
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-slate-400" /> Timeline
                        </h3>
                        <StatusTimeline logs={item.statusLogs || []} />
                    </div>

                    {item.qrCodeUrl && item.qrCodeToken && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                            <h3 className="font-bold text-lg text-slate-900 mb-4">QR Label</h3>
                            <img src={item.qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto mb-4 border border-slate-100 rounded-xl" />
                            <div className="flex gap-2">
                                <a 
                                    href={item.qrCodeUrl} 
                                    download={`QR-${item.id}.png`}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                                >
                                    <Download className="w-4 h-4" /> Unduh
                                </a>
                                <button 
                                    onClick={copyQrLink}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-4">Tempel QR ini di barang kamu untuk memudahkan penemu menghubungi kamu.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Contextual Actions Bottom Bar */}
            {(isICT || isOwnReport) && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-10">
                    <div className="max-w-5xl mx-auto flex items-center justify-end">
                        <ContextualActions
                            reportId={item.id}
                            status={item.status}
                            userRole={user?.role || 'USER'}
                            isOwnReport={isOwnReport}
                            isPending={updateStatus.isPending}
                            onStatusChange={handleStatusChange}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
