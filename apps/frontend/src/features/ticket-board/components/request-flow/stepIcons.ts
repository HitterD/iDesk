import {
    Bell, Calendar, Check, CircleAlert, CircleCheck, CircleX, Eye, FileCheck, Hourglass, KeyRound, Package, Pen, RefreshCw,
    ScanBarcode, ShieldCheck, Truck, Upload, Wrench, type LucideIcon,
} from 'lucide-react';

/** Icon names used by `nextStep` (the mockup's names) mapped to lucide icons. */
const ICONS: Record<string, LucideIcon> = {
    alert: CircleAlert, barcode: ScanBarcode, bell: Bell, cal: Calendar, check: Check, checkC: CircleCheck, eye: Eye,
    fileCheck: FileCheck, hourglass: Hourglass, key: KeyRound, package: Package, pen: Pen, refresh: RefreshCw,
    shield: ShieldCheck, truck: Truck, upload: Upload, wrench: Wrench, xC: CircleX,
};

export const stepIcon = (name: string | undefined): LucideIcon | null => (name ? ICONS[name] ?? null : null);
