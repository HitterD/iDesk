/** The request flows a hardware request can come from (read back from its justification prefix). */
export enum HardwareRequestType {
    BUDGET_ANNUAL = 'BUDGET_ANNUAL',
    NON_BUDGET = 'NON_BUDGET',
    HARDWARE_INSTALLATION = 'HARDWARE_INSTALLATION',
}

/** Justification prefix that carries the flow (the wizard's convention; the backend reads the installation one). */
export const REQUEST_TYPE_PREFIX: Record<HardwareRequestType, string> = {
    [HardwareRequestType.BUDGET_ANNUAL]: '[BUDGET TAHUNAN]',
    [HardwareRequestType.NON_BUDGET]: '[NON-BUDGET]',
    [HardwareRequestType.HARDWARE_INSTALLATION]: '[PENJADWALAN PEMASANGAN]',
};
