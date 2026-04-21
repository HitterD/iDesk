import { Link } from 'react-router-dom';
import type { RequestStatus } from '../../types';

type Row = {
  bucket: '0-3' | '3-7' | '>7';
  count: number;
  requests: { id: string; requestNumber: string; ageDays: number; status: RequestStatus }[];
};

const labels: Record<Row['bucket'], string> = {
  '0-3': '0-3 hari',
  '3-7': '3-7 hari',
  '>7': '> 7 hari',
};
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';

export function AgingTable({ data, loading }: { data?: Row[]; loading?: boolean }) {
  const basePath = useHardwareBasePath();
  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Aging</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b">
            <th className="py-2">Bucket</th>
            <th>Count</th>
            <th>Top</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.bucket} className={row.bucket === '>7' ? 'bg-rose-50' : 'hover:bg-slate-50'}>
              <td className="py-2 font-medium">{labels[row.bucket]}</td>
              <td>{row.count}</td>
              <td className="text-xs">
                {row.requests.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    to={`${basePath}/${r.id}`}
                    className="mr-2 text-indigo-600 hover:underline"
                  >
                    {r.requestNumber} ({r.ageDays}d)
                  </Link>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
