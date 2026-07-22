import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, X } from 'lucide-react';
import { useDeliveryUpdate } from '../../hooks/useDeliveryUpdate';
import { canUpdateDelivery, canProposeSchedule } from '../../utils/permission.util';
import { SectionCard } from '../common/SectionCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HardwareRequest, HardwareRequestItem } from '../../types';

interface DeliveryBoardProps {
  request: HardwareRequest;
  user: { id: string; role: 'USER' | 'ICT_STAFF' };
  onSchedule: () => void;
}

export function DeliveryBoard({ request, user, onSchedule }: DeliveryBoardProps) {
  const { update, isUpdating } = useDeliveryUpdate(request.id);
  const editable = canUpdateDelivery(user, request);
  const canSchedule = canProposeSchedule(user, request);
  const arrivedCount = request.items.filter((i) => i.deliveryStatus === 'ARRIVED').length;

  return (
    <SectionCard title="Status Pengiriman Item">
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {request.items.map((item) => (
            <DeliveryRow
              key={item.id}
              item={item}
              editable={editable}
              isUpdating={isUpdating}
              onToggle={(status) => update({ itemId: item.id, input: { status } })}
            />
          ))}
        </AnimatePresence>
      </ul>

      {editable && (
        <div className="mt-6 flex justify-end">
          <Button onClick={onSchedule} disabled={!canSchedule}>
            Jadwalkan Instalasi {arrivedCount > 0 && `(${arrivedCount} item siap)`}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

interface DeliveryRowProps {
  item: HardwareRequestItem;
  editable: boolean;
  isUpdating: boolean;
  onToggle: (status: 'ARRIVED' | 'PENDING') => void;
}

function DeliveryRow({ item, editable, isUpdating, onToggle }: DeliveryRowProps) {
  const isArrived = item.deliveryStatus === 'ARRIVED';
  const isNotProcured = item.deliveryStatus === 'NOT_PROCURED';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'flex items-center justify-between rounded-2xl border bg-card/80 dark:bg-slate-800/50 dark:border-slate-700/50 px-4 py-3 backdrop-blur transition-colors',
        isArrived && 'border-success/40 bg-success/5 dark:bg-success/10',
        isNotProcured && 'border-destructive/30 opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        {isArrived ? <Check className="h-5 w-5 text-success" />
          : isNotProcured ? <X className="h-5 w-5 text-destructive" />
          : <Clock className="h-5 w-5 text-muted-foreground" />}
        <div>
          <p className="font-medium">{item.name || item.categorySnapshot?.name}</p>
          <p className="text-sm text-muted-foreground">
            qty: {item.quantity}
            {isArrived && item.arrivedAt && ` • Datang ${new Date(item.arrivedAt).toLocaleDateString('id-ID')}`}
            {isNotProcured && ' • Tidak diproses'}
          </p>
        </div>
      </div>

      {editable && !isNotProcured && (
        <Button
          size="sm"
          variant="outline"
          disabled={isUpdating}
          onClick={() => onToggle(isArrived ? 'PENDING' : 'ARRIVED')}
        >
          {isArrived ? 'Tandai Belum Datang' : 'Tandai Sudah Datang'}
        </Button>
      )}
    </motion.li>
  );
}
