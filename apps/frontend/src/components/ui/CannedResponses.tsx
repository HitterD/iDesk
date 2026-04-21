import React, { useState, useMemo } from 'react';
import { Zap, Search, Plus, Edit2, Trash2, ChevronRight, Folder, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut?: string;
  createdAt: string;
}

interface CannedResponsePickerProps {
  onSelect: (content: string) => void;
  className?: string;
}

// Quick picker popover for chat
export const CannedResponsePicker: React.FC<CannedResponsePickerProps> = ({
  onSelect,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Use default responses directly (API endpoint not implemented yet)
  const responses = defaultResponses;

  const filteredResponses = useMemo(() => {
    if (!search) return responses;
    const lowerSearch = search.toLowerCase();
    return responses.filter(r =>
      r.title.toLowerCase().includes(lowerSearch) ||
      r.content.toLowerCase().includes(lowerSearch) ||
      r.category.toLowerCase().includes(lowerSearch)
    );
  }, [responses, search]);

  const groupedResponses = useMemo(() => {
    const groups: Record<string, CannedResponse[]> = {};
    filteredResponses.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [filteredResponses]);

  const handleSelect = (content: string) => {
    onSelect(content);
    setIsOpen(false);
    setSearch('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open quick reply templates"
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400",
          "hover:text-primary hover:bg-primary/5 rounded-lg transition-colors",
          className
        )}
        title="Quick replies"
      >
        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
        Quick Reply
      </button>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in z-50">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-700">
        <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          aria-label="Search quick reply templates"
          className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
          autoFocus
        />
        <button
          onClick={() => { setIsOpen(false); setSearch(''); }}
          aria-label="Close quick replies"
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
        >
          <X className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto p-2">
        {Object.entries(groupedResponses).length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No templates found
          </div>
        ) : (
          Object.entries(groupedResponses).map(([category, items]) => (
            <div key={category} className="mb-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <Folder className="w-3 h-3" />
                {category}
              </div>
              {items.map((response) => (
                <button
                  key={response.id}
                  onClick={() => handleSelect(response.content)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                      {response.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {response.content.slice(0, 60)}...
                    </p>
                  </div>
                  {response.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 rounded font-mono">
                      {response.shortcut}
                    </kbd>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Default canned responses
const defaultResponses: CannedResponse[] = [
  {
    id: '1',
    title: 'Greeting',
    content: 'Halo, terima kasih telah menghubungi iDesk Support. Saya akan membantu menyelesaikan masalah Anda. Mohon jelaskan lebih detail mengenai kendala yang dihadapi.',
    category: 'General',
    shortcut: '/hi',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Request More Info',
    content: 'Untuk membantu menyelesaikan masalah ini, saya memerlukan informasi tambahan:\n1. Screenshot error yang muncul\n2. Langkah-langkah yang dilakukan sebelum error\n3. Waktu kejadian',
    category: 'General',
    shortcut: '/info',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Ticket Escalated',
    content: 'Tiket Anda telah di-eskalasi ke tim teknis untuk penanganan lebih lanjut. Kami akan menginformasikan update perkembangan dalam waktu 1x24 jam kerja.',
    category: 'Status Update',
    shortcut: '/esc',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Waiting for Vendor',
    content: 'Kami sedang menunggu respons dari vendor terkait untuk issue ini. Jadwal kunjungan vendor adalah setiap hari Kamis. Kami akan segera menginformasikan jika ada update.',
    category: 'Status Update',
    shortcut: '/vendor',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Issue Resolved',
    content: 'Masalah telah berhasil diselesaikan. Jika ada kendala lain atau pertanyaan, silakan hubungi kami kembali. Terima kasih telah menggunakan layanan iDesk.',
    category: 'Closing',
    shortcut: '/done',
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Password Reset',
    content: 'Untuk reset password, silakan ikuti langkah berikut:\n1. Klik "Lupa Password" di halaman login\n2. Masukkan email terdaftar\n3. Cek inbox email untuk link reset\n4. Buat password baru\n\nJika masih mengalami kendala, silakan informasikan.',
    category: 'How To',
    shortcut: '/pwd',
    createdAt: new Date().toISOString(),
  },
];

// Full canned responses manager (for settings page)
export const CannedResponsesManager: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    shortcut: '',
  });

  // Use default responses directly (API endpoint not implemented yet)
  const responses = defaultResponses;

  const saveMutation = {
    mutate: (_data: any) => {
      toast.info('Template management not available yet');
      resetForm();
    },
    isPending: false,
  };

  const deleteMutation = {
    mutate: (_id: any) => {
      toast.info('Template management not available yet');
    },
    isPending: false,
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', category: '', shortcut: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (response: CannedResponse) => {
    setFormData({
      title: response.title,
      content: response.content,
      category: response.category,
      shortcut: response.shortcut || '',
    });
    setEditingId(response.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Quick Reply Templates</h3>
          <p className="text-sm text-slate-500">Manage pre-saved response templates</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="e.g. Greeting"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                  placeholder="e.g. General"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Shortcut
                </label>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                  placeholder="e.g. /hi"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none resize-none"
              placeholder="Template content..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.title || !formData.content}
              className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {responses.map((response) => (
          <div
            key={response.id}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-slate-800 dark:text-white">{response.title}</h4>
                  {response.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 rounded font-mono">
                      {response.shortcut}
                    </kbd>
                  )}
                  <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                    {response.category}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                  {response.content}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(response)}
                  aria-label={`Edit ${response.title} template`}
                  className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(response.id)}
                  aria-label={`Delete ${response.title} template`}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CannedResponsePicker;
