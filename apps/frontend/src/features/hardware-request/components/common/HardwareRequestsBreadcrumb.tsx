import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';

interface Props {
  currentLabel: string;
}

export function HardwareRequestsBreadcrumb({ currentLabel }: Props) {
  const basePath = useHardwareBasePath();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500">
      <Link to={basePath} className="hover:text-slate-900">Hardware Requests</Link>
      <ChevronRight className="h-4 w-4" aria-hidden />
      <Link to={basePath} className="hover:text-slate-900">Permintaan</Link>
      <ChevronRight className="h-4 w-4" aria-hidden />
      <span className="font-medium text-slate-900">{currentLabel}</span>
    </nav>
  );
}
