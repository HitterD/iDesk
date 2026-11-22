import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { resolveSantosLogoPath } from '../../../shared/core/utils/brand-logo.util';
import type { HardwareSlot, SignedSlot } from '../domain/hardware-signatures';

export interface HardwarePdfItem { name: string; quantity: number; recipient: string; note: string }

export interface HardwarePdfData {
    ticketNumber: string;
    requestNumber: string;
    version: number;
    createdAt: Date;
    requesterName: string;
    division: string;
    justification: string;
    /** Printed beside "Sumber"; empty until IT has reviewed. */
    sourceLabel: string;
    routeLabel: string;
    items: HardwarePdfItem[];
    signatures: Partial<Record<HardwareSlot, SignedSlot>>;
}

const MARGIN = 36;
const WIDTH = 595 - MARGIN * 2;
const QR_SIZE = 52;
const QR_PIXELS = QR_SIZE * 4;
const FOOTER_Y = 760;
const SLOT_GAP = 10;
const SIGNATURE_HEIGHT = 50;
const ROW_HEIGHT = 20;
const SLOTS: ReadonlyArray<{ slot: HardwareSlot; title: string }> = [
    { slot: 'REQUESTER', title: 'Pemohon' },
    { slot: 'MANAGER', title: 'Atasan' },
    { slot: 'GM', title: 'GM' },
    { slot: 'ICT', title: 'ICT' },
];
const COLUMNS = [
    { title: 'No', width: 28 },
    { title: 'Barang', width: 190 },
    { title: 'Jml', width: 34 },
    { title: 'Penerima', width: 110 },
    { title: 'Catatan', width: WIDTH - 28 - 190 - 34 - 110 },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (date: Date): string => `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

/** The QR text of a document version: `<ticketNumber>/v<N>`. */
export const documentQrText = (ticketNumber: string, version: number): string => `${ticketNumber}/v${version}`;

function drawHeader(doc: PDFKit.PDFDocument, data: HardwarePdfData): number {
    const logo = resolveSantosLogoPath();
    if (logo) {
        try { doc.image(logo, MARGIN, MARGIN, { fit: [40, 34] }); } catch { /* the header stays valid without the logo */ }
    }
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text('PT SANTOS JAYA ABADI', MARGIN + 48, MARGIN + 6);
    doc.fontSize(14).text('FORM PERMINTAAN HARDWARE', MARGIN + 48, MARGIN + 18);
    doc.font('Helvetica').fontSize(8)
        .text(`No. Permintaan : ${data.requestNumber}`, MARGIN, MARGIN, { width: WIDTH, align: 'right' })
        .text(`No. Tiket : ${data.ticketNumber}`, { width: WIDTH, align: 'right' })
        .text(`Tanggal : ${formatDate(data.createdAt)}`, { width: WIDTH, align: 'right' });
    const lineY = MARGIN + 48;
    doc.moveTo(MARGIN, lineY).lineTo(MARGIN + WIDTH, lineY).lineWidth(1).stroke('#000000');
    return lineY + 12;
}

function drawFacts(doc: PDFKit.PDFDocument, data: HardwarePdfData, startY: number): number {
    const facts: Array<[string, string]> = [
        ['Pemohon', data.requesterName],
        ['Divisi', data.division || '-'],
        ['Sumber', data.sourceLabel || 'Menunggu peninjauan IT'],
        ['Persetujuan', data.routeLabel || 'Menunggu peninjauan IT'],
        ['Alasan', data.justification],
    ];
    let y = startY;
    doc.fontSize(9).fillColor('#000000');
    for (const [label, value] of facts) {
        doc.font('Helvetica-Bold').text(label, MARGIN, y, { width: 80, lineBreak: false });
        doc.font('Helvetica').text(`: ${value}`, MARGIN + 80, y, { width: WIDTH - 80 });
        y = Math.max(y + 14, doc.y + 3);
    }
    return y + 6;
}

function drawItems(doc: PDFKit.PDFDocument, items: HardwarePdfItem[], startY: number): number {
    let y = startY;
    const row = (cells: string[], bold: boolean) => {
        let x = MARGIN;
        COLUMNS.forEach((column, i) => {
            doc.rect(x, y, column.width, ROW_HEIGHT).lineWidth(0.6).stroke('#000000');
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#000000')
                .text(cells[i] ?? '', x + 4, y + 6, { width: column.width - 8, height: ROW_HEIGHT - 8, ellipsis: true, lineBreak: false });
            x += column.width;
        });
        y += ROW_HEIGHT;
    };
    row(COLUMNS.map((column) => column.title), true);
    items.forEach((item, i) => row([String(i + 1), item.name, String(item.quantity), item.recipient || '-', item.note || '-'], false));
    return y + 18;
}

function drawSignature(doc: PDFKit.PDFDocument, slot: SignedSlot | undefined, x: number, y: number, width: number): void {
    doc.rect(x, y, width, SIGNATURE_HEIGHT).lineWidth(0.6).stroke('#64748B');
    if (!slot) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94A3B8').text('Belum', x, y + 20, { width, align: 'center' });
        return;
    }
    if (slot.signature?.startsWith('data:image')) {
        try {
            const image = Buffer.from(slot.signature.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(image, x + 8, y + 4, { fit: [width - 16, SIGNATURE_HEIGHT - 8], align: 'center', valign: 'center' });
        } catch { /* an unreadable image leaves the box empty; the name below still records who signed */ }
    } else if (slot.how === 'paper') {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#334155')
            .text('Ditandatangani manual,\nscan terlampir', x, y + 17, { width, align: 'center' });
    }
}

function drawSignatures(doc: PDFKit.PDFDocument, data: HardwarePdfData, startY: number): void {
    const width = (WIDTH - (SLOTS.length - 1) * SLOT_GAP) / SLOTS.length;
    SLOTS.forEach(({ slot, title }, i) => {
        const x = MARGIN + i * (width + SLOT_GAP);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(title, x, startY, { width, align: 'center' });
        drawSignature(doc, data.signatures[slot], x, startY + 14, width);
        doc.font('Helvetica').fontSize(8).fillColor('#000000')
            .text(data.signatures[slot]?.name || '( ................ )', x, startY + 18 + SIGNATURE_HEIGHT, { width, align: 'center' });
    });
}

function drawFooter(doc: PDFKit.PDFDocument, data: HardwarePdfData, qr: Buffer): void {
    const text = documentQrText(data.ticketNumber, data.version);
    const qrX = MARGIN + WIDTH - QR_SIZE;
    doc.image(qr, qrX, FOOTER_Y, { width: QR_SIZE, height: QR_SIZE });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
        .text(`v${data.version}`, qrX - 64, FOOTER_Y + 10, { width: 58, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
        .text(text, qrX - 170, FOOTER_Y + 26, { width: 164, align: 'right', lineBreak: false });
    doc.text('Hanya versi terbaru yang diterima saat impor tanda tangan kertas.', MARGIN, FOOTER_Y + 10, { width: 300 });
}

/** Renders the hardware request document of one version: header, requester, source, items, four signatures and the QR. */
export async function renderHardwareRequestPdf(data: HardwarePdfData): Promise<Buffer> {
    // Rendered up front: pdfkit is synchronous, the QR encoder is not.
    const qr = await QRCode.toBuffer(documentQrText(data.ticketNumber, data.version), { margin: 0, width: QR_PIXELS });
    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 0,
            info: { Title: `Permintaan Hardware ${data.requestNumber} v${data.version}`, Author: 'PT Santos Jaya Abadi - iDesk ICT System' },
        });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        try {
            let y = drawHeader(doc, data);
            y = drawFacts(doc, data, y);
            y = drawItems(doc, data.items, y);
            drawSignatures(doc, data, y);
            drawFooter(doc, data, qr);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
