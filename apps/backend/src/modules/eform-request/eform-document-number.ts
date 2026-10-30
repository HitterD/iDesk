import { EntityManager } from 'typeorm';
import { EFormType } from './entities/eform-request.entity';

/** Controlled-form code printed on each access form; the running number follows it: `F/ICT/04-W/0007`. */
export const EFORM_DOCUMENT_CODE: Record<EFormType, string> = {
  [EFormType.VPN]: 'F/ICT/04',
  [EFormType.WEBSITE]: 'F/ICT/04-W',
  [EFormType.NETWORK]: 'F/ICT/04-N',
  [EFormType.FLASHDISK]: 'F/ICT/04-FD',
  [EFormType.EMAIL]: 'F/ICT/04-E',
  [EFormType.SYNOLOGY_NAS]: 'F/ICT/04-NAS',
};

export const DOCUMENT_SEQUENCE_WIDTH = 4;
/** What IT may type as a number: letters, digits and the separators the codes use. */
export const DOCUMENT_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;
export const DOCUMENT_NUMBER_MAX = 50;

/** Namespace for pg_advisory_xact_lock so e-form numbering never collides with other locks. */
const NUMBERING_LOCK_KEY = 'eform-document-number';

export const formatDocumentNumber = (formType: EFormType, sequence: number): string =>
  `${EFORM_DOCUMENT_CODE[formType]}/${sequence.toString().padStart(DOCUMENT_SEQUENCE_WIDTH, '0')}`;

/**
 * Next number for a form type, race-safe. MUST run inside a transaction: the advisory lock is transaction-scoped, so
 * concurrent submissions serialize. The sequence continues from the highest number of that form in the table,
 * including numbers IT edited by hand, so an edit to `.../0050` makes the next one `.../0051` and nothing repeats.
 */
export async function nextDocumentNumber(manager: EntityManager, formType: EFormType): Promise<string> {
  const prefix = `${EFORM_DOCUMENT_CODE[formType]}/`;
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${NUMBERING_LOCK_KEY}:${prefix}`]);
  // Only `<prefix><digits>` counts: a VPN prefix must not pick up `F/ICT/04-W/...`, nor a free-form edit.
  // The casts matter: an untyped `SUBSTRING(x FROM $2)` resolves to the regex form and never matches.
  const rows: { maxSeq: string | null }[] = await manager.query(
    `SELECT MAX(CAST(SUBSTRING("documentNumber" FROM $2::int) AS BIGINT)) AS "maxSeq"
       FROM eform_requests
      WHERE LEFT("documentNumber", $3::int) = $1::text AND SUBSTRING("documentNumber" FROM $2::int) ~ '^[0-9]{1,9}$'`,
    [prefix, prefix.length + 1, prefix.length],
  );
  return formatDocumentNumber(formType, Number(rows[0]?.maxSeq ?? 0) + 1);
}
