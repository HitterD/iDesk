import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Send, CheckCircle2, Calendar, Globe, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SignaturePad } from '../components/eform/SignaturePad';
import { ManagerSelector } from '../components/eform/ManagerSelector';
import { TermsAndConditions } from '../components/eform/TermsAndConditions';
import { useCreateEformRequest, useVpnTerms } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

export const EformAccessCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formType, setFormType] = useState<'VPN' | 'WEBSITE' | 'NETWORK'>('VPN');
  const [formData, setFormData] = useState({
    kebutuhanAkses: 'Remote PC Kantor',
    alasan: '',
    dariTanggal: new Date().toISOString().split('T')[0],
    sampaiTanggal: '',
  });
  const [requestedWebsites, setRequestedWebsites] = useState('');
  const [networkPurpose, setNetworkPurpose] = useState('');
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [managerId, setManagerId] = useState('');

  const createMutation = useCreateEformRequest();
  const { data: termsData, isLoading: termsLoading } = useVpnTerms();

  // Validation logic for progressive disclosure
  const isSection1Valid = () => {
    if (!formData.alasan || !formData.dariTanggal) return false;
    if (formType === 'WEBSITE' && !requestedWebsites) return false;
    if (formType === 'NETWORK' && !networkPurpose) return false;
    return true;
  };

  const isSection2Valid = () => isSection1Valid() && termsAccepted;
  
  const handleSubmit = async () => {
    if (!managerId) {
      toast.error('Harap pilih atasan persetujuan');
      return;
    }

    try {
      await createMutation.mutateAsync({
        formType,
        formData,
        requestedWebsites: formType === 'WEBSITE' ? requestedWebsites : undefined,
        networkPurpose: formType === 'NETWORK' ? networkPurpose : undefined,
        termsAccepted,
        signatureData,
        managerId
      });
      toast.success('Permintaan berhasil dikirim');
      navigate(-1);
    } catch (error) {
      toast.error('Gagal mengirim permintaan');
    }
  };

  // Auto-scroll logic for progressive disclosure
  useEffect(() => {
    if (isSection1Valid()) {
      const section2 = document.getElementById('section-2');
      if (section2) {
        section2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [formData.alasan, formData.dariTanggal, requestedWebsites, networkPurpose, formType]);

  useEffect(() => {
    if (termsAccepted) {
      const section3 = document.getElementById('section-3');
      if (section3) {
        section3.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [termsAccepted]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
        <h1 className="text-2xl font-black tracking-tighter uppercase text-foreground">E-Form Access</h1>
      </div>

      {/* Form Type Selection */}
      <Card className="p-6 rounded-[2.5rem] border-2 border-primary/10">
        <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 mb-4 block">Pilih Jenis Form</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'VPN', label: 'VPN Access', icon: ShieldCheck },
            { id: 'WEBSITE', label: 'Website Access', icon: Globe },
            { id: 'NETWORK', label: 'Network Access', icon: Wifi }
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setFormType(type.id as any)}
              className={`p-6 rounded-2xl border-2 transition-[opacity,transform,colors] duration-200 ease-out flex flex-col items-center gap-3 ${
                formType === type.id 
                  ? 'border-primary bg-primary/5 text-primary shadow-md scale-105' 
                  : 'border-border/50 text-muted-foreground hover:border-primary/30'
              }`}
            >
              <type.icon size={24} />
              <span className="text-xs font-black uppercase tracking-widest">{type.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* SECTION 1: Detail Akses */}
      <Card className="p-8 rounded-[2.5rem] border-2 border-primary/10 space-y-6 relative overflow-hidden">
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tighter uppercase">Section 1: Detail Pengajuan</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Nama Pemohon</label>
            <Input value={user?.fullName || ''} disabled className="h-12 rounded-xl bg-muted font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Departemen</label>
            <Input value={user?.departmentId || ''} disabled className="h-12 rounded-xl bg-muted font-bold" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Dari Tanggal</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
              <Input 
                type="date" 
                value={formData.dariTanggal}
                onChange={e => setFormData({ ...formData, dariTanggal: e.target.value })}
                className="pl-11 h-12 rounded-xl border-border/50 font-bold" 
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Sampai Tanggal</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
              <Input 
                type="date" 
                value={formData.sampaiTanggal}
                onChange={e => setFormData({ ...formData, sampaiTanggal: e.target.value })}
                className="pl-11 h-12 rounded-xl border-border/50 font-bold" 
              />
            </div>
          </div>
        </div>

        {formType === 'VPN' && (
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Kebutuhan Akses VPN</label>
            <Input 
              value={formData.kebutuhanAkses}
              onChange={e => setFormData({ ...formData, kebutuhanAkses: e.target.value })}
              className="h-12 rounded-xl border-border/50 font-bold" 
            />
          </div>
        )}

        {formType === 'WEBSITE' && (
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Website yang Diminta (URL)</label>
            <Input 
              value={requestedWebsites}
              onChange={e => setRequestedWebsites(e.target.value)}
              placeholder="Contoh: github.com, stackoverflow.com"
              className="h-12 rounded-xl border-border/50 font-bold" 
            />
          </div>
        )}

        {formType === 'NETWORK' && (
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tujuan Akses Jaringan/Internet</label>
            <Input 
              value={networkPurpose}
              onChange={e => setNetworkPurpose(e.target.value)}
              placeholder="Contoh: Akses server client XYZ"
              className="h-12 rounded-xl border-border/50 font-bold" 
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Alasan Lengkap Pengajuan</label>
          <textarea 
            value={formData.alasan}
            onChange={e => setFormData({ ...formData, alasan: e.target.value })}
            placeholder="Tuliskan alasan lengkap mengapa akses ini dibutuhkan..."
            className="w-full min-h-[100px] p-4 rounded-2xl border-2 border-border/50 bg-background text-sm font-medium focus:border-primary/30 outline-none transition-colors duration-150 resize-none"
          />
        </div>
      </Card>

      {/* SECTION 2: Syarat & Ketentuan */}
      <div className={`transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out ${isSection1Valid() ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <Card className="p-8 rounded-[2.5rem] border-2 border-primary/10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tighter uppercase">Section 2: Syarat & Ketentuan</h2>
          </div>
          <TermsAndConditions 
            accepted={termsAccepted}
            onAccept={setTermsAccepted}
            content={termsData?.terms || 'Loading...'}
          />
        </Card>
      </div>

      {/* SECTION 3: Tanda Tangan & Submit */}
      <div className={`transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out ${isSection2Valid() ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <Card className="p-8 rounded-[2.5rem] border-2 border-primary/10 space-y-8">
          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tighter uppercase">Section 3: Persetujuan & Kirim</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Pilih Atasan Persetujuan (Manager/Admin)</label>
              <ManagerSelector 
                selectedId={managerId}
                onSelect={setManagerId}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan Pemohon</label>
              <SignaturePad 
                signerName={user?.fullName || ''}
                onSave={setSignatureData}
              />
              {signatureData && (
                <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 p-2 rounded-lg border border-green-100">
                  <CheckCircle2 size={14} /> Tanda tangan berhasil dikunci
                </div>
              )}
            </div>
            
            <div className="pt-4">
              <Button 
                onClick={handleSubmit}
                disabled={!signatureData || !managerId || createMutation.isPending || !isSection2Valid()}
                className="w-full rounded-2xl h-14 bg-primary shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-[10px]"
              >
                {createMutation.isPending ? 'Mengirim...' : 'Kirim Pengajuan'} <Send className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
