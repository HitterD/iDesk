import type { SignatureHow } from './approval-phase';

/** A signature slot of the hardware document: who signed, how, and the drawn image when it was digital. */
export interface SignedSlot { name: string; how: SignatureHow; signature?: string }
export type HardwareSlot = 'REQUESTER' | 'MANAGER' | 'GM' | 'ICT';
type StepSlot = Exclude<HardwareSlot, 'REQUESTER'>;

/** The part of a hardware activity row that carries a signature (the request has no signature table of its own). */
export interface SignatureActivity { action: string; metadata: Record<string, unknown> | null }

/** Activity action carrying a step signature, and the metadata `step` marking which slot it fills. */
export const STEP_SIGNATURE_ACTION = 'UPDATED';
const STEP_SLOTS: readonly StepSlot[] = ['MANAGER', 'GM', 'ICT'];

/** Metadata of the activity row written when a step signs (digitally or from a scanned paper). */
export function stepSignatureMetadata(
    step: StepSlot, signerId: string, signerName: string, how: SignatureHow, signature?: string,
): Record<string, unknown> {
    return { step, signerId, signerName, how, ...(signature ? { signature } : {}) };
}

/** Reads the signed slots from a request's activity rows, oldest first; a later signature of a slot replaces an earlier one. */
export function signedSlots(activities: SignatureActivity[], requesterName: string): Partial<Record<HardwareSlot, SignedSlot>> {
    const slots: Partial<Record<HardwareSlot, SignedSlot>> = {};
    for (const { action, metadata } of activities) {
        if (!metadata) continue;
        if (action === 'CREATED' && typeof metadata.signature === 'string') {
            slots.REQUESTER = { name: requesterName, how: 'digital', signature: metadata.signature };
            continue;
        }
        const step = metadata.step as StepSlot | undefined;
        if (action !== STEP_SIGNATURE_ACTION || !step || !STEP_SLOTS.includes(step)) continue;
        slots[step] = {
            name: String(metadata.signerName ?? ''),
            how: metadata.how === 'paper' ? 'paper' : 'digital',
            ...(typeof metadata.signature === 'string' ? { signature: metadata.signature } : {}),
        };
    }
    return slots;
}
