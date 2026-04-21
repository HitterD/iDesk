import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { EFormRequest } from './entities';

@Injectable()
export class EFormPdfService {
  async generatePdf(eformRequest: EFormRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        // Add Header
        const title = eformRequest.formType === 'VPN' ? 'FORM PERMINTAAN AKSES VPN' : 
                     eformRequest.formType === 'WEBSITE' ? 'FORM PERMINTAAN AKSES WEBSITE' : 
                     'FORM PERMINTAAN AKSES NETWORK/INTERNET';
        
        doc.fontSize(20).text(title, { align: 'center', characterSpacing: 2 });
        doc.fontSize(10).text('PT. SANTOS JAYA ABADI', { align: 'center', characterSpacing: 1 });
        doc.moveDown(2);

        // Transaction Info Box
        doc.rect(50, doc.y, 500, 60).stroke('#E2E8F0');
        const topY = doc.y + 10;
        doc.fontSize(10).fillColor('#64748B').text('ID TRANSAKSI', 60, topY);
        doc.fillColor('#000000').fontSize(12).text(eformRequest.id.toUpperCase(), 60, topY + 15);
        
        doc.fillColor('#64748B').fontSize(10).text('TANGGAL PENGAJUAN', 350, topY);
        doc.fillColor('#000000').fontSize(12).text(new Date(eformRequest.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 350, topY + 15);
        doc.moveDown(4);

        // Requester Section
        doc.fillColor('#2D4A8C').fontSize(12).text('DATA PEMOHON', { underline: true });
        doc.moveDown(0.5);
        doc.fillColor('#000000').fontSize(10);
        
        const dataStart = doc.y;
        doc.text('Nama Lengkap', 50, dataStart);
        doc.text(`: ${eformRequest.requesterName}`, 150, dataStart);
        
        doc.text('Jabatan', 50, dataStart + 20);
        doc.text(`: ${eformRequest.requesterJobTitle || '-'}`, 150, dataStart + 20);
        
        doc.text('Departemen', 50, dataStart + 40);
        doc.text(`: ${eformRequest.requesterDepartment || '-'}`, 150, dataStart + 40);
        doc.moveDown(4);

        // Request Detail
        doc.fillColor('#2D4A8C').fontSize(12).text('DETAIL PERMINTAAN AKSES', { underline: true });
        doc.moveDown(0.5);
        doc.fillColor('#000000').fontSize(10);
        
        let detailY = doc.y;
        doc.text('Jenis Form', 50, detailY);
        doc.text(`: ${eformRequest.formType}`, 150, detailY);
        detailY += 20;

        if (eformRequest.formData) {
          doc.text('Masa Berlaku', 50, detailY);
          doc.text(`: ${eformRequest.formData.dariTanggal} s/d ${eformRequest.formData.sampaiTanggal || 'Selamanya'}`, 150, detailY);
          detailY += 20;

          if (eformRequest.formType === 'VPN' && eformRequest.formData.kebutuhanAkses) {
            doc.text('Tujuan Akses VPN', 50, detailY);
            doc.text(`: ${eformRequest.formData.kebutuhanAkses}`, 150, detailY);
            detailY += 20;
          }
        }

        if (eformRequest.formType === 'WEBSITE' && eformRequest.requestedWebsites) {
          doc.text('Websites', 50, detailY);
          doc.text(`: ${eformRequest.requestedWebsites}`, 150, detailY, { width: 350 });
          detailY += 30;
        }

        if (eformRequest.formType === 'NETWORK' && eformRequest.networkPurpose) {
          doc.text('Tujuan Jaringan', 50, detailY);
          doc.text(`: ${eformRequest.networkPurpose}`, 150, detailY, { width: 350 });
          detailY += 30;
        }

        if (eformRequest.formData?.alasan) {
          doc.text('Alasan', 50, detailY);
          doc.text(`: ${eformRequest.formData.alasan}`, 150, detailY, { width: 350 });
        }
        
        doc.moveDown(8);

        // Signatures Section
        doc.fillColor('#2D4A8C').fontSize(12).text('OTORISASI DIGITAL', { underline: true });
        doc.moveDown(1);

        let currentX = 50;
        let currentY = doc.y;

        if (eformRequest.signatures) {
          eformRequest.signatures.forEach((sig, index) => {
            if (index > 0 && index % 3 === 0) {
              currentY += 150;
              currentX = 50;
            }

            doc.fillColor('#64748B').fontSize(8).text(sig.signerRole, currentX, currentY);
            
            if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
                try {
                    const base64Data = sig.signatureData.replace(/^data:image\/\w+;base64,/, '');
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    doc.image(imgBuffer, currentX, currentY + 15, { width: 100 });
                } catch (e) {
                    doc.fontSize(8).text('[Digital Signature]', currentX, currentY + 30);
                }
            }

            doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text(sig.signerName, currentX, currentY + 80);
            doc.font('Helvetica').fontSize(7).text(new Date(sig.signedAt).toLocaleString('id-ID'), currentX, currentY + 92);
            
            currentX += 180;
          });
        }

        // Footer
        doc.fontSize(8).fillColor('#94A3B8').text('Dokumen ini dihasilkan secara otomatis oleh sistem iDesk PT. Santos Jaya Abadi dan memiliki kekuatan hukum yang sama dengan tanda tangan basah sesuai UU ITE.', 50, 720, { align: 'center', width: 500 });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
