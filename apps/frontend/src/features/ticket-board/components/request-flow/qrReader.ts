/** Reads the QR of a scanned paper signature: from an image directly, or from the first page of a PDF. */
export interface QrDeps {
    decodeImage: (file: File) => Promise<string>;
    renderPdfPage: (file: File, page: number) => Promise<HTMLCanvasElement>;
    decodeCanvas: (canvas: HTMLCanvasElement) => Promise<string>;
}

const PDF_TYPE = 'application/pdf';
const IMAGE_PREFIX = 'image/';
const FIRST_PAGE = 1;
const PDF_SCALE = 2.5;

/** The QR text, or null when the scan has none; a file that is neither PDF nor image is refused. */
export async function readQrFromFile(file: File, deps: QrDeps): Promise<string | null> {
    const isPdf = file.type === PDF_TYPE;
    if (!isPdf && !file.type.startsWith(IMAGE_PREFIX)) throw new Error('Berkas harus PDF atau gambar (PNG/JPG).');
    try {
        return isPdf ? await deps.decodeCanvas(await deps.renderPdfPage(file, FIRST_PAGE)) : await deps.decodeImage(file);
    } catch {
        // zxing throws when it finds no code; the dialog words that for the user.
        return null;
    }
}

/** The browser implementation: zxing for the code, pdf.js to draw a PDF page first. Loaded only when a scan is chosen. */
export async function browserQrDeps(): Promise<QrDeps> {
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const reader = new BrowserQRCodeReader();
    return {
        decodeImage: async (file) => {
            const url = URL.createObjectURL(file);
            try { return (await reader.decodeFromImageUrl(url)).getText(); } finally { URL.revokeObjectURL(url); }
        },
        decodeCanvas: async (canvas) => reader.decodeFromCanvas(canvas).getText(),
        renderPdfPage: async (file, pageNumber) => {
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
            const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
            const page = await doc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: PDF_SCALE });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
            return canvas;
        },
    };
}

/** What `PaperSignDialog` takes as `readQr`. */
export async function readQrInBrowser(file: File): Promise<string | null> {
    return readQrFromFile(file, await browserQrDeps());
}
