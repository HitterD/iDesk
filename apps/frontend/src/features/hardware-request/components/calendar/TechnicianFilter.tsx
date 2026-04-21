import { useQuery } from '@tanstack/react-query';
import { fetchTechnicians } from '../../api/installation.api';

type Props = { selectedIds: string[]; onChange: (ids: string[]) => void };

export function TechnicianFilter({ selectedIds, onChange }: Props) {
  const { data: technicians = [] } = useQuery({
    queryKey: ['hardware-requests', 'technicians'],
    queryFn: fetchTechnicians,
    staleTime: 5 * 60_000,
  });

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-slate-500 flex-shrink-0">Filter teknisi:</span>
      {technicians.map((t: { id: string; fullName: string }) => {
        const active = selectedIds.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            aria-pressed={active}
            className={[
              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {t.fullName}
            {active && <span className="text-blue-400 leading-none ml-0.5">×</span>}
          </button>
        );
      })}
    </div>
  );
}