/** Thrown by a status handler when the user dismisses a confirmation, so the UI can roll back. */
export class StatusChangeCancelledError extends Error {
    constructor() {
        super('Perubahan status dibatalkan');
        this.name = 'StatusChangeCancelledError';
    }
}
