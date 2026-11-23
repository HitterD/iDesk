import { REQUEST_KIND_META, type RequestKind } from './requestKind';

interface RequestTypeTagProps {
    kind: RequestKind;
    /** `lg` is the ticket page header: the long name. */
    size?: 'sm' | 'lg';
}

/** The coloured "Hardware" / "E-Form" tag beside a request ticket's number. */
export function RequestTypeTag({ kind, size = 'sm' }: RequestTypeTagProps) {
    const meta = REQUEST_KIND_META[kind];
    const Icon = meta.icon;
    return (
        <span data-request-kind={kind} className={`req-tag req-tag--${meta.tone} ${size === 'lg' ? 'req-tag--lg' : ''}`}>
            <Icon aria-hidden="true" />
            {size === 'lg' ? meta.longLabel : meta.label}
        </span>
    );
}
