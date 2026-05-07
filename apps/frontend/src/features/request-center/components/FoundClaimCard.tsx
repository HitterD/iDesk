import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Check, X, MapPin } from 'lucide-react';
import { FoundItemClaim, FoundClaimStatus } from '../api/found-claim.api';
import { PhotoGrid } from './PhotoGrid';
import { StatusBadge } from './StatusBadge';

interface FoundClaimCardProps {
    claim: FoundItemClaim;
    isICT: boolean;
    onConfirm?: (id: string) => void;
    onReject?: (id: string) => void;
}

export function FoundClaimCard({ claim, isICT, onConfirm, onReject }: FoundClaimCardProps) {
    const isPending = claim.status === FoundClaimStatus.PENDING;

    return (
        <div className={`p-4 rounded-xl border ${isPending ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                        {claim.finder?.fullName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <p className="font-bold text-sm text-slate-900">{claim.finder?.fullName || 'Penemu'}</p>
                        <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(claim.createdAt), { addSuffix: true, locale: idLocale })}</p>
                    </div>
                </div>
                <StatusBadge status={claim.status} />
            </div>

            <div className="mb-3 space-y-1">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" /> {claim.locationFound}
                </p>
                <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
                    "{claim.description}"
                </p>
            </div>

            {claim.photoUrls && claim.photoUrls.length > 0 && (
                <div className="mb-4">
                    <PhotoGrid urls={claim.photoUrls} />
                </div>
            )}

            {isICT && isPending && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-emerald-100">
                    <button 
                        onClick={() => onConfirm?.(claim.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
                    >
                        <Check className="w-4 h-4" /> Match
                    </button>
                    <button 
                        onClick={() => onReject?.(claim.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200"
                    >
                        <X className="w-4 h-4" /> Tolak
                    </button>
                </div>
            )}
        </div>
    );
}
