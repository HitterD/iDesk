import * as PDFDocument from 'pdfkit';
import { MemoHeaderDto } from '../dto/memo.dto';
import { MARGIN, MemoSurvey } from './csi-memo-draw';
import { drawMemoPage } from './csi-memo-page';
import { drawSlaPages } from './csi-memo-sla';
import { drawAnswerPages } from './csi-memo-tables';

export type { MemoSurvey } from './csi-memo-draw';

/** Renders the Interoffice Memo: page 1, then per survey the answer table and the SLA appendix. */
export function renderMemoPdf(header: MemoHeaderDto, surveys: MemoSurvey[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: 'Interoffice Memo', Creator: 'iDesk CSI' } });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        try {
            drawMemoPage(doc, header, surveys);
            for (const survey of surveys) {
                drawAnswerPages(doc, survey);
                drawSlaPages(doc, survey);
            }
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
