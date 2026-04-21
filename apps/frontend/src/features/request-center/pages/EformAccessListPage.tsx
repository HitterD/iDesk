import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Plus, 
    Search, 
    ShieldCheck, 
    Clock, 
    CheckCircle2, 
    ChevronRight,
    FileText,
    Loader2,
    Filter,
    ShieldAlert
} from 'lucide-react';
import { useEformRequests } from '../api/eform-request.api';
import { EFormStatus } from '../components/eform/EformStatusPipeline';
import { format } from 'date-fns';
import { useAuth } from '@/stores/useAuth';

export const EformAccessListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');

    const isIct = user?.role === 'AGENT' || user?.role === 'ADMIN';
    const { data: requestsData, isLoading } = useEformRequests(isIct);
    const requests = Array.isArray(requestsData) ? requestsData : [];

    const filteredRequests = requests.filter(req => {
        const matchesSearch = (req.requesterName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
        const matchesType = typeFilter === 'ALL' || req.formType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    const getStatusStyles = (status: string) => {
        switch (status) {
            case EFormStatus.PENDING_MANAGER_1:
            case EFormStatus.PENDING_MANAGER_2:
                return 'bg-amber-100 text-amber-700 border-amber-200';
            case EFormStatus.PENDING_ICT:
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case EFormStatus.CONFIRMED:
                return 'bg-green-100 text-green-700 border-green-200';
            case EFormStatus.REJECTED:
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-muted text-muted-foreground border-border';
        }
    };

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'VPN':
                return 'bg-primary/10 text-primary border-primary/20';
            case 'WEBSITE':
                return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'NETWORK':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleCreateNew = () => {
        const basePath = location.pathname.startsWith('/client') ? '/client' : 
                         location.pathname.startsWith('/manager') ? '/manager' : '';
        navigate(`${basePath}/eform-access/new`);
    };

    const handleViewDetail = (id: string) => {
        const basePath = location.pathname.startsWith('/client') ? '/client' : 
                         location.pathname.startsWith('/manager') ? '/manager' : '';
        navigate(`${basePath}/eform-access/${id}`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest mb-2 shadow-sm">
                        <ShieldCheck className="w-3 h-3" />
                        Digital Security Portal
                    </div>
                    <h1 className="text-4xl font-extrabold text-foreground tracking-tighter flex items-center gap-4 uppercase">
                        E-Form Access
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium opacity-70">Digitalized access request workflow (VPN, Website, Network) with automated sequential approvals.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-extrabold rounded-2xl hover:brightness-110 hover:shadow-xl hover:shadow-primary/20 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-xs uppercase tracking-widest active:scale-95 group shadow-lg"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    New Access Request
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                <StatCard label="Total Requests" value={requests.length.toString()} icon={<FileText className="w-5 h-5" />} variant="default" />
                <StatCard label="Pending Approval" value={requests.filter(r => r.status.includes('PENDING_MANAGER')).length.toString()} icon={<Clock className="w-5 h-5" />} variant="warning" />
                <StatCard label="In Provisioning" value={requests.filter(r => r.status === EFormStatus.PENDING_ICT).length.toString()} icon={<Filter className="w-5 h-5" />} variant="info" />
                <StatCard label="Ready / Confirmed" value={requests.filter(r => r.status === EFormStatus.CONFIRMED).length.toString()} icon={<CheckCircle2 className="w-5 h-5" />} variant="success" />
                <StatCard label="Rejected" value={requests.filter(r => r.status === EFormStatus.REJECTED).length.toString()} icon={<ShieldAlert className="w-5 h-5" />} variant="error" />
            </div>

            {/* Filters & Search */}
            <div className="bg-card border border-border rounded-3xl p-6 flex flex-col md:flex-row gap-5 shadow-sm">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                        type="text"
                        placeholder="Cari nama pemohon..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-muted/50 border border-border rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary/30 outline-none transition-colors duration-150"
                    />
                </div>
                <div className="flex gap-3 flex-col sm:flex-row">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-6 py-4 bg-muted/50 border border-border rounded-2xl text-xs font-extrabold uppercase tracking-widest text-muted-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-colors duration-150 min-w-[150px] cursor-pointer appearance-none"
                    >
                        <option value="ALL">All Types</option>
                        <option value="VPN">VPN Access</option>
                        <option value="WEBSITE">Website Access</option>
                        <option value="NETWORK">Network Access</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-6 py-4 bg-muted/50 border border-border rounded-2xl text-xs font-extrabold uppercase tracking-widest text-muted-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-colors duration-150 min-w-[150px] cursor-pointer appearance-none"
                    >
                        <option value="ALL">All Status</option>
                        {Object.values(EFormStatus).map(status => (
                            <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List Section */}
            {isLoading ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Synchronizing forms...</p>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center space-y-6 bg-muted/20 border border-dashed border-border rounded-[3rem]">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground opacity-40">
                        <FileText size={40} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold uppercase tracking-tight">Belum ada pengajuan</h3>
                        <p className="text-xs font-medium text-muted-foreground max-w-sm mx-auto leading-relaxed opacity-60 uppercase tracking-widest px-8">Submit a new access request to see it appear here in your portal.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredRequests.map((req) => (
                        <div 
                            key={req.id} 
                            onClick={() => handleViewDetail(req.id)}
                            className="bg-card border border-border rounded-[2rem] p-7 cursor-pointer group hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out flex flex-col relative overflow-hidden active:scale-[0.98]"
                        >
                            {/* Left Accent Bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-2 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group-hover:w-3 ${
                                req.status.includes('PENDING_MANAGER') ? 'bg-amber-500' :
                                req.status === EFormStatus.REJECTED ? 'bg-red-500' :
                                req.status === EFormStatus.CONFIRMED ? 'bg-green-500' :
                                'bg-primary'
                            }`} />

                            <div className="flex justify-between items-start mb-5 pl-2">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest opacity-60">FORM ID #{req.id.slice(0, 8)}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${getTypeStyles(req.formType)}`}>
                                            {req.formType}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors leading-tight uppercase tracking-tight">
                                        {req.formType} Access Request
                                    </h3>
                                </div>
                                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest border shadow-sm ${getStatusStyles(req.status)}`}>
                                    {req.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="space-y-4 pl-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                        <ShieldCheck size={18} className="text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 leading-none mb-1">Pemohon</p>
                                        <p className="text-sm font-bold text-foreground truncate">{req.requesterName}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 rounded-2xl bg-muted/30">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Dibuat</p>
                                        <p className="text-[11px] font-bold">{format(new Date(req.createdAt), 'dd MMM yyyy')}</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-muted/30">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Masa Berlaku</p>
                                        <p className="text-[11px] font-bold truncate">{req.formData?.dariTanggal || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-border flex items-center justify-between pl-2">
                                <div className="flex items-center -space-x-2 overflow-hidden">
                                    {/* Tiny avatar placeholders for approvers? Or just status trail */}
                                    <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-black uppercase">
                                        {req.requesterName?.charAt(0)}
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[8px] font-black ${req.status === EFormStatus.CONFIRMED ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                        <ShieldCheck size={10} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    View Details <ChevronRight size={14} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface StatCardProps {
    label: string;
    value: string;
    icon: React.ReactNode;
    variant: 'default' | 'warning' | 'info' | 'success' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, variant }) => {
    const variants = {
        default: 'border-border group-hover:border-primary/30',
        warning: 'border-amber-500/20 group-hover:border-amber-500/40',
        info: 'border-blue-500/20 group-hover:border-blue-500/40',
        success: 'border-green-500/20 group-hover:border-green-500/40',
        error: 'border-red-500/20 group-hover:border-red-500/40',
    };

    return (
        <div className={`bg-card border rounded-3xl p-5 group transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:shadow-lg relative overflow-hidden ${variants[variant]}`}>
            <div className="relative z-10 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                    {icon}
                </div>
                <div className="space-y-1">
                    <h4 className="text-2xl font-black tracking-tighter">{value}</h4>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-tight">{label}</p>
                </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-muted opacity-20 rounded-full group-hover:scale-150 transition-transform duration-700" />
        </div>
    );
};
