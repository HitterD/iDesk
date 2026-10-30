import { useMemo } from 'react';
import { statusSentence, useHardwareHold } from '../ticket-hardware';
import { eformStatusSentence, useEFormHold } from '../ticket-eform';

/** What a WAITING_VENDOR ticket actually waits on when it is a request raised from it rather than a vendor. */
export interface TicketHold {
    /** Replaces "Waiting Vendor" wherever the ticket status is shown, e.g. "Menunggu hardware". */
    label: string;
    /** Request number (hardware) or short code (e-form). */
    code: string;
    detail: string;
}

/** One answer for every place that shows the status, so the header, inspector and sidebar never disagree. */
export function useTicketHold(ticket: { id: string; status: string }): TicketHold | null {
    const hardware = useHardwareHold(ticket);
    const eform = useEFormHold(ticket);
    return useMemo(() => {
        const hardwareHold = hardware && { label: 'Menunggu hardware', code: hardware.requestNumber, detail: statusSentence(hardware) };
        const eformHold = eform && { label: 'Menunggu E-Form', code: eform.code, detail: eformStatusSentence(eform) };
        // One ticket can wait on both (a laptop and a VPN, say): say so instead of naming only one.
        if (hardwareHold && eformHold) {
            return {
                label: 'Menunggu hardware & E-Form',
                code: `${hardwareHold.code} · ${eformHold.code}`,
                detail: `${hardwareHold.code}: ${hardwareHold.detail}. ${eformHold.code}: ${eformHold.detail}`,
            };
        }
        return hardwareHold || eformHold || null;
    }, [hardware, eform]);
}
