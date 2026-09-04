import { useFormContext } from 'react-hook-form';
import { useCatalog } from '../../hooks/useCatalog';
import { CatalogPicker } from './CatalogPicker';
import { ItemBasket } from './ItemBasket';
import type { CreateFormValues } from './CreateWizard';

export function ItemsStep() {
    const { data: catalog = [] } = useCatalog({ active: true });
    const { watch, setValue, formState: { errors } } = useFormContext<CreateFormValues>();
    const items = watch('items') ?? [];

    const add = (c: any) => {
        const existing = items.findIndex(i => i.catalogId === c.id);
        if (existing >= 0) {
            const copy = [...items]; copy[existing].quantity += 1;
            setValue('items', copy, { shouldValidate: true });
        } else {
            setValue('items', [...items, { catalogId: c.id, quantity: 1 }], { shouldValidate: true });
        }
    };

    return (
        <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-3"><CatalogPicker onAdd={add} /></div>
            <div className="md:col-span-2 space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Keranjang Item</div>
                <ItemBasket catalog={catalog} />
                {errors.items && items.length === 0 && (
                    <p className="text-xs font-medium text-rose-600 mt-2 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 rounded-lg border border-rose-100 dark:border-rose-900/50">
                        {typeof errors.items.message === 'string' ? errors.items.message : 'Pilih minimal 1 item dari katalog'}
                    </p>
                )}
            </div>
        </div>
    );
}
