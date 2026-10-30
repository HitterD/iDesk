import { EFormType } from '../entities/eform-request.entity';

/** E-form requests have no number; tickets show the short id the e-form pages already use ("#3F2A9C1B"). */
export const eformCode = (id: string): string => `#${id.slice(0, 8).toUpperCase()}`;

/** What the access is, in a sentence: "akses VPN #3F2A9C1B". */
export const EFORM_ACCESS_LABEL: Record<EFormType, string> = {
    [EFormType.VPN]: 'akses VPN',
    [EFormType.WEBSITE]: 'akses website',
    [EFormType.NETWORK]: 'akses jaringan',
    [EFormType.FLASHDISK]: 'akses flashdisk',
    [EFormType.EMAIL]: 'akun email',
    [EFormType.SYNOLOGY_NAS]: 'akses folder Synology NAS',
};

export const accessName = (formType: EFormType | string, id: string): string =>
    `${EFORM_ACCESS_LABEL[formType as EFormType] ?? 'akses'} ${eformCode(id)}`;
