import { Package } from 'lucide-react';
import type { FlowItem } from './flowTypes';

interface RequestItemsCardProps {
    items: FlowItem[];
    assets: Array<{ code: string; itemId: string }>;
}

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

/** Where one item stands, in the requester's words. */
function itemState(item: FlowItem): string | null {
    if (item.procurementDecision === 'REJECTED') return 'Dibatalkan';
    if (item.deliveryStatus === 'ARRIVED') return 'Sudah tiba';
    if (item.procurementDecision === 'APPROVED') return 'Dibeli, menunggu tiba';
    return null;
}

/** The items of a hardware request. Vendor and cost appear only when the API sent them (IT). */
export function RequestItemsCard({ items, assets }: RequestItemsCardProps) {
    return (
        <section className="req-card" aria-label="Barang">
            <h3><Package aria-hidden="true" />Barang <span className="r">{items.length} unit</span></h3>
            <ul className="req-items">
                {items.map((item) => {
                    const codes = assets.filter((asset) => asset.itemId === item.id);
                    const state = itemState(item);
                    return (
                        <li key={item.id}>
                            <div className="req-items__main">
                                <b>{item.name}</b>
                                {item.quantity > 1 && <span>× {item.quantity}</span>}
                                {item.recipient && <small>untuk {item.recipient}</small>}
                            </div>
                            {state && <span className={`req-items__state ${item.procurementDecision === 'REJECTED' ? 'is-off' : ''}`}>{state}</span>}
                            {item.vendor && <small className="req-items__cost">{item.vendor}{item.actualCost ? ` · ${money.format(Number(item.actualCost))}` : ''}</small>}
                            {item.note && <small>{item.note}</small>}
                            {codes.map((asset) => <code key={asset.code} className="req-items__asset">{asset.code}</code>)}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
