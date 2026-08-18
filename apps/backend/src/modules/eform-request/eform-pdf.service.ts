import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { EFormRequest, EFormStatus, EFormType } from './entities';

export interface DecryptedCredentialData {
  username?: string;
  password?: string;
  vpnServer?: string;
  notes?: string;
  provisionedAt?: Date;
  accessCreatedAt?: Date;
  accessExpiresAt?: Date;
  provisionedByName?: string;
}

const formatDateId = (dateObj?: Date | string | null): string => {
  if (!dateObj) return '-';
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

@Injectable()
export class EFormPdfService {
  async generatePdf(eformRequest: EFormRequest, credential?: DecryptedCredentialData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 0,
          info: {
            Title: `F-ICT-04 Permintaan Akses VPN - ${eformRequest.requesterName}`,
            Author: 'PT Santos Jaya Abadi - iDesk ICT System',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Coordinates & Geometry
        const startX = 35;
        const pageWidth = 525; // usable width (595 - 70)
        const isConfirmed = eformRequest.status === EFormStatus.CONFIRMED;

        // Title and Document No.
        let formTitle = 'Permintaan Akses VPN';
        let docNo = 'F/ICT/04';
        if (eformRequest.formType === EFormType.WEBSITE) {
          formTitle = 'Permintaan Akses Website';
          docNo = 'F/ICT/04-W';
        } else if (eformRequest.formType === EFormType.NETWORK) {
          formTitle = 'Permintaan Akses Jaringan';
          docNo = 'F/ICT/04-N';
        }

        const formattedCreatedDate = formatDateId(eformRequest.createdAt);

        // ==========================================
        // 1. TOP HEADER TABLE
        // ==========================================
        const headerY = 32;
        const headerH = 48;
        const col1W = 85;
        const col3W = 145;
        const col2W = pageWidth - col1W - col3W; // 295

        // Outer header box
        doc.rect(startX, headerY, pageWidth, headerH).lineWidth(1).stroke('#000000');
        // Vertical dividers
        doc.moveTo(startX + col1W, headerY).lineTo(startX + col1W, headerY + headerH).stroke('#000000');
        doc.moveTo(startX + col1W + col2W, headerY).lineTo(startX + col1W + col2W, headerY + headerH).stroke('#000000');

        // Column 1: Logo & Company Name
        const logoPathCandidates = [
          path.join(__dirname, '../../assets/santos-logo.png'),
          path.join(process.cwd(), 'src/assets/santos-logo.png'),
          path.join(process.cwd(), 'dist/assets/santos-logo.png'),
          path.resolve(__dirname, '../../../../../login picture/gb-putih.png'),
          'f:/Program Bagas/SynologyDrive/iDesk-main/login picture/gb-putih.png',
        ];

        let logoLoaded = false;
        for (const p of logoPathCandidates) {
          if (fs.existsSync(p)) {
            try {
              doc.image(p, startX + (col1W - 32) / 2, headerY + 3.5, { fit: [32, 27], align: 'center', valign: 'center' });
              logoLoaded = true;
              break;
            } catch {
              // fallback if corrupt
            }
          }
        }


        if (!logoLoaded) {
          const logoCenterX = startX + col1W / 2;
          doc.save();
          doc.fillColor('#DC2626').polygon([logoCenterX - 8, headerY + 8], [logoCenterX, headerY + 16], [logoCenterX - 8, headerY + 24]).fill();
          doc.fillColor('#16A34A').polygon([logoCenterX + 8, headerY + 8], [logoCenterX, headerY + 16], [logoCenterX + 8, headerY + 24]).fill();
          doc.restore();
        }

        doc.font('Helvetica-Bold').fontSize(5.2).fillColor('#000000')
          .text('PT SANTOS JAYA ABADI', startX, headerY + 34, { width: col1W, align: 'center' });

        // Column 2: Form Title
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
          .text('FORM', startX + col1W, headerY + 10, { width: col2W, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
          .text(formTitle, startX + col1W, headerY + 25, { width: col2W, align: 'center' });

        // Column 3: Document Meta (4 rows)
        const rowH = headerH / 4;
        for (let i = 1; i < 4; i++) {
          doc.moveTo(startX + col1W + col2W, headerY + i * rowH).lineTo(startX + pageWidth, headerY + i * rowH).stroke('#000000');
        }

        const metaX = startX + col1W + col2W + 6;
        const valX = startX + col1W + col2W + 72;
        doc.font('Helvetica').fontSize(7.5).fillColor('#000000');

        doc.text('Dokumen No.', metaX, headerY + 2.5);
        doc.text(`: ${docNo}`, valX, headerY + 2.5);

        doc.text('Revisi No.', metaX, headerY + rowH + 2.5);
        doc.text(': 00', valX, headerY + rowH + 2.5);

        doc.text('Halaman', metaX, headerY + rowH * 2 + 2.5);
        doc.text(': 1/1', valX, headerY + rowH * 2 + 2.5);

        doc.text('Berlaku Tgl.', metaX, headerY + rowH * 3 + 2.5);
        doc.text(`: ${formattedCreatedDate}`, valX, headerY + rowH * 3 + 2.5);

        // ==========================================
        // 2. PEMOHON SECTION
        // ==========================================
        let curY = headerY + headerH + 16;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text('PEMOHON', startX, curY);

        curY += 14;
        const pemohonH = 56;
        const pemohonRowH = pemohonH / 4;
        const midX = startX + pageWidth / 2;

        // Outer box & rows for Pemohon
        doc.rect(startX, curY, pageWidth, pemohonH).lineWidth(0.75).stroke('#000000');
        for (let i = 1; i < 4; i++) {
          doc.moveTo(startX, curY + i * pemohonRowH).lineTo(startX + pageWidth, curY + i * pemohonRowH).stroke('#000000');
        }
        doc.moveTo(midX, curY).lineTo(midX, curY + pemohonH).stroke('#000000');

        // Field labels & values
        const colLeftLabel = startX + 6;
        const colLeftVal = startX + 65;
        const colRightLabel = midX + 6;
        const colRightVal = midX + 65;

        // Row 1
        doc.font('Helvetica').fontSize(8).fillColor('#000000');
        doc.text('Nama:', colLeftLabel, curY + 3);
        doc.font('Helvetica-Bold').text(eformRequest.requesterName || '-', colLeftVal, curY + 3);
        doc.font('Helvetica').text('Nomor HP:', colRightLabel, curY + 3);
        doc.text('-', colRightVal, curY + 3);

        // Row 2
        const r2Y = curY + pemohonRowH;
        doc.text('E-mail:', colLeftLabel, r2Y + 3);
        doc.text(eformRequest.requesterEmail || `${eformRequest.requesterName.toLowerCase().replace(/\s+/g, '.')}@kapalapi.co.id`, colLeftVal, r2Y + 3);
        doc.text('IP Server:', colRightLabel, r2Y + 3);
        doc.font(credential?.vpnServer ? 'Helvetica-Bold' : 'Helvetica-Oblique')
          .fillColor(credential?.vpnServer ? '#000000' : '#64748B')
          .text(credential?.vpnServer || 'Diisi oleh ICT', colRightVal, r2Y + 3);

        // Row 3
        const r3Y = curY + pemohonRowH * 2;
        doc.fillColor('#000000').font('Helvetica').text('Jabatan:', colLeftLabel, r3Y + 3);
        doc.text(eformRequest.requesterJobTitle || 'Staff', colLeftVal, r3Y + 3);
        doc.text('Username:', colRightLabel, r3Y + 3);
        doc.font(credential?.username ? 'Helvetica-Bold' : 'Helvetica-Oblique')
          .fillColor(credential?.username ? '#000000' : '#64748B')
          .text(credential?.username || 'Diisi oleh ICT', colRightVal, r3Y + 3);

        // Row 4
        const r4Y = curY + pemohonRowH * 3;
        doc.fillColor('#000000').font('Helvetica').text('Departemen:', colLeftLabel, r4Y + 3);
        doc.text(eformRequest.requesterDepartment || '-', colLeftVal, r4Y + 3);
        doc.text('Password:', colRightLabel, r4Y + 3);
        doc.font(credential?.password ? 'Helvetica-Bold' : 'Helvetica-Oblique')
          .fillColor(credential?.password ? '#000000' : '#64748B')
          .text(credential?.password || (isConfirmed ? '-' : 'Diisi oleh ICT'), colRightVal, r4Y + 3);


        // ==========================================
        // 3. DETAIL AKSES SECTION
        // ==========================================
        curY += pemohonH + 16;
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9.5).text('DETAIL AKSES', startX, curY);

        curY += 13;

        let nextDetailY = curY;
        if (eformRequest.formType === EFormType.VPN) {
          doc.font('Helvetica').fontSize(8).text('Kebutuhan Akses:', startX, curY);

          const vpnReqType = eformRequest.formData?.kebutuhanAkses || 'Remote PC Kantor';
          const isRemotePC = vpnReqType === 'Remote PC Kantor';
          const isJaringan = vpnReqType === 'Akses Jaringan Kantor' || vpnReqType === 'Jaringan Kantor';

          // Checkbox 1: Remote PC Kantor
          const cb1Y = curY;
          const cbX = startX + 90;
          doc.rect(cbX, cb1Y + 1, 8.5, 8.5).lineWidth(0.75).stroke('#000000');
          if (isRemotePC) {
            doc.font('Helvetica-Bold').fontSize(7.5).text('v', cbX + 2, cb1Y + 1);
          }
          doc.font('Helvetica-Bold').fontSize(8).text('Remote PC Kantor', cbX + 13, cb1Y + 1);
          doc.font('Helvetica').fontSize(6.5).fillColor('#334155')
            .text('(Perangkat yang terkoneksi menggunakan VPN digunakan untuk melakukan remote ke PC anda di kantor. Aplikasi kantor diakses melalui PC kantor.)', cbX + 95, cb1Y + 1, { width: 340 });

          // Checkbox 2: Jaringan Kantor
          const cb2Y = curY + 16;
          doc.fillColor('#000000').rect(cbX, cb2Y + 1, 8.5, 8.5).lineWidth(0.75).stroke('#000000');
          if (isJaringan) {
            doc.font('Helvetica-Bold').fontSize(7.5).text('v', cbX + 2, cb2Y + 1);
          }
          doc.font('Helvetica-Bold').fontSize(8).text('Jaringan Kantor', cbX + 13, cb2Y + 1);
          doc.font('Helvetica').fontSize(6.5).fillColor('#334155')
            .text('(Perangkat yang terkoneksi menggunakan VPN digunakan untuk akses jaringan kantor. Aplikasi kantor diakses menggunakan perangkat yang terkoneksi menggunakan VPN.)', cbX + 95, cb2Y + 1, { width: 340 });

          nextDetailY = cb2Y + 18;
        } else if (eformRequest.formType === EFormType.WEBSITE) {
          doc.font('Helvetica').fontSize(8).text('Website / URL:', startX, curY);
          doc.rect(startX + 65, curY - 2, 260, 24).lineWidth(0.6).stroke('#000000');
          doc.font('Helvetica').fontSize(7.5).fillColor('#000000')
            .text(eformRequest.requestedWebsites || '-', startX + 70, curY + 1, { width: 250 });
          nextDetailY = curY + 28;
        } else {
          doc.font('Helvetica').fontSize(8).text('Target Jaringan:', startX, curY);
          doc.rect(startX + 65, curY - 2, 260, 24).lineWidth(0.6).stroke('#000000');
          doc.font('Helvetica').fontSize(7.5).fillColor('#000000')
            .text(eformRequest.networkPurpose || '-', startX + 70, curY + 1, { width: 250 });
          nextDetailY = curY + 28;
        }

        // Dari, Sampai, Alasan boxes
        const dateBoxX = startX + 65;
        const dateBoxW = 260;

        // Dari
        const dariY = nextDetailY;
        doc.fillColor('#000000').font('Helvetica').fontSize(8).text('Dari:', startX, dariY + 2);
        doc.rect(dateBoxX, dariY, dateBoxW, 14).lineWidth(0.6).stroke('#000000');
        doc.font('Helvetica').fontSize(8).text(formatDateId(eformRequest.formData?.dariTanggal), dateBoxX + 6, dariY + 3);

        // Sampai
        const sampaiY = dariY + 17;
        doc.text('Sampai:', startX, sampaiY + 2);
        doc.rect(dateBoxX, sampaiY, dateBoxW, 14).lineWidth(0.6).stroke('#000000');
        const sampaiVal = eformRequest.formData?.sampaiTanggal ? formatDateId(eformRequest.formData?.sampaiTanggal) : 'Permanen';
        doc.font('Helvetica').fontSize(8).text(sampaiVal, dateBoxX + 6, sampaiY + 3);

        // Alasan
        const alasanY = sampaiY + 17;
        doc.text('Alasan:', startX, alasanY + 2);
        doc.rect(dateBoxX, alasanY, dateBoxW, 26).lineWidth(0.6).stroke('#000000');
        doc.font('Helvetica').fontSize(7.5).text(eformRequest.formData?.alasan || '-', dateBoxX + 6, alasanY + 3, { width: dateBoxW - 12 });

        // ==========================================
        // 4. SYARAT & KETENTUAN SECTION
        // ==========================================
        curY = alasanY + 35;
        let termsTitle = 'Syarat & Ketentuan Akses VPN PT.SANTOS JAYA ABADI';
        let termsAgreement = 'Saya mengerti dan menyetujui Syarat & Ketentuan Akses VPN PT.SANTOS JAYA ABADI';
        let termsPoints = [
          '1. Divisi ICT tidak bertanggung jawab terhadap pelanggaran keamanan maupun upaya perusakan komputer dan/atau perangkat lain yang anda gunakan selama terhubung dengan menggunakan VPN. Semua masalah lisensi yang mungkin akan menimbulkan biaya karena penggunaan aplikasi ilegal saat terhubung ke VPN merupakan tanggung jawab pemohon sepenuhnya. Akses ke VPN PT.SANTOS JAYA ABADI hanya boleh digunakan untuk hal-hal yang berkaitan dengan pekerjaan. Software VPN beserta kredensialnya tidak boleh dibagikan oleh pemohon kepada pihak lain dalam kondisi apapun. Pemohon tidak diperkenankan menggunakan aplikasi remote service pihak ketiga (Misal: TeamViewer, LogMeIn, GoToMyPC, peer-to-peer networking, dll) saat terhubung ke VPN PT.SANTOS JAYA ABADI.',
          '2. Semua akses ke jaringan VPN PT.SANTOS JAYA ABADI tercatat dan diawasi.',
          '3. Komputer yang digunakan untuk terhubung ke VPN wajib terpasang antivirus dan memiliki database up to date.',
          '4. Pemohon yang diberi akses VPN berkewajiban untuk menjaga kerahasiaan data dan/atau informasi milik perusahaan, apabila terbukti dengan sengaja dan/atau karena kelalaian menyebabkan kerugian dan/atau potensi kerugian bagi perusahaan,maka dengan ini pemohon menyatakan bersedia diberi sangsi sesuai peraturan perusahaan yang berlaku.',
          '5. Semua insiden terkait keamanan informasi yang terjadi selama menggunakan dan atau memiliki akses VPN wajib dilaporkan kepada pihak ICT. Contoh: kehilangan laptop yang terpasang akses VPN, laptop yang digunakan terkena malware, dsb.',
        ];

        if (eformRequest.formType === EFormType.WEBSITE) {
          termsTitle = 'Syarat & Ketentuan Akses Website PT.SANTOS JAYA ABADI';
          termsAgreement = 'Saya mengerti dan menyetujui Syarat & Ketentuan Akses Website PT.SANTOS JAYA ABADI';
          termsPoints = [
            '1. Pembukaan akses website/domain hanya diperkenankan untuk keperluan pekerjaan resmi dan operasional perusahaan. Penggunaan untuk konten terlarang, aktivitas ilegal, atau kepentingan pribadi di luar pekerjaan merupakan tanggung jawab pemohon sepenuhnya.',
            '2. Semua aktivitas lalu lintas data dan penjelajahan situs melalui jaringan perusahaan tercatat dan diawasi sesuai kebijakan keamanan ICT.',
            '3. Perangkat yang digunakan untuk mengakses website wajib mematuhi standar keamanan informasi, bebas malware/adware, dan dilarang mengunduh berkas berbahaya ke jaringan kantor.',
            '4. Pemohon berkewajiban menjaga kerahasiaan informasi internal perusahaan dan dilarang mengunggah (upload) data rahasia/sensitif ke website publik atau pihak ketiga yang tidak diotorisasi.',
            '5. Semua indikasi kebocoran data atau insiden keamanan siber yang bersumber dari akses website wajib segera dilaporkan kepada Divisi ICT.',
          ];
        } else if (eformRequest.formType === EFormType.NETWORK) {
          termsTitle = 'Syarat & Ketentuan Akses Jaringan PT.SANTOS JAYA ABADI';
          termsAgreement = 'Saya mengerti dan menyetujui Syarat & Ketentuan Akses Jaringan PT.SANTOS JAYA ABADI';
          termsPoints = [
            '1. Hak akses ke subnet, IP target, atau resource jaringan internal PT. SANTOS JAYA ABADI hanya digunakan secara sah sesuai lingkup pekerjaan yang diajukan.',
            '2. Seluruh aktivitas koneksi, port session, dan transfer data dalam jaringan diawasi serta tercatat dalam log audit keamanan sistem ICT.',
            '3. Pemohon dilarang keras melakukan aktivitas pemindaian (port scanning), penyadapan data (sniffing), atau memodifikasi konfigurasi jaringan tanpa izin tertulis dari Tim ICT.',
            '4. Pemohon bertanggung jawab penuh menjaga integritas data dan stabilitas perangkat jaringan, serta bersedia menerima sanksi sesuai ketentuan perusahaan apabila terjadi pelanggaran.',
            '5. Segala anomali jaringan, konflik alamat IP, atau indikasi serangan keamanan wajib dilaporkan sesegera mungkin kepada pihak ICT.',
          ];
        }

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
          .text(termsTitle, startX, curY);

        curY += 10;
        doc.font('Helvetica').fontSize(6.2).fillColor('#000000');

        termsPoints.forEach((t) => {
          doc.text(t, startX, curY, { width: pageWidth, lineGap: 0.8 });
          curY = doc.y + 2;
        });

        curY += 4;
        doc.font('Helvetica-Bold').fontSize(7).text(termsAgreement, startX, curY);


        // Signatures of Requester
        curY += 14;
        const sigColW = pageWidth / 3;

        doc.font('Helvetica').fontSize(7.5);
        doc.text('Tanggal Permohonan', startX, curY, { width: sigColW, align: 'center' });
        doc.text('Nama Pemohon', startX + sigColW, curY, { width: sigColW, align: 'center' });
        doc.text('Tanda Tangan Pemohon', startX + sigColW * 2, curY, { width: sigColW, align: 'center' });

        // Signature image / lines
        const requesterSig = eformRequest.signatures?.find(s => s.signerRole === 'REQUESTER');
        if (requesterSig?.signatureData && requesterSig.signatureData.startsWith('data:image')) {
          try {
            const base64Data = requesterSig.signatureData.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, startX + sigColW * 2 + (sigColW - 60) / 2, curY + 12, { width: 60, height: 28 });
          } catch {
            // fallback
          }
        }

        const sigLineY = curY + 44;
        doc.moveTo(startX + 15, sigLineY).lineTo(startX + sigColW - 15, sigLineY).dash(2, { space: 2 }).stroke('#64748B').undash();
        doc.moveTo(startX + sigColW + 15, sigLineY).lineTo(startX + sigColW * 2 - 15, sigLineY).dash(2, { space: 2 }).stroke('#64748B').undash();
        doc.moveTo(startX + sigColW * 2 + 15, sigLineY).lineTo(startX + pageWidth - 15, sigLineY).dash(2, { space: 2 }).stroke('#64748B').undash();

        doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
        doc.text(formattedCreatedDate, startX, sigLineY - 12, { width: sigColW, align: 'center' });
        doc.text(eformRequest.requesterName, startX + sigColW, sigLineY - 12, { width: sigColW, align: 'center' });

        // ==========================================
        // 5. DISETUJUI KADEP & KADIV SECTION
        // ==========================================
        curY = sigLineY + 12;
        doc.font('Helvetica-Bold').fontSize(7.5).text('DISETUJUI KADEP & KADIV, MENGETAHUI (GM/DIRECTOR LEVEL)', startX, curY);

        curY += 10;
        doc.font('Helvetica').fontSize(7.5);
        doc.text('Menyetujui,', startX, curY, { width: sigColW, align: 'center' });
        doc.text('Menyetujui,', startX + sigColW, curY, { width: sigColW, align: 'center' });
        doc.text('Mengetahui,', startX + sigColW * 2, curY, { width: sigColW, align: 'center' });

        // Manager Approval Signature
        const managerSig = eformRequest.signatures?.find(s => s.signerRole === 'MANAGER' || s.signerRole === 'MANAGER_1');
        if (managerSig?.signatureData && managerSig.signatureData.startsWith('data:image')) {
          try {
            const base64Data = managerSig.signatureData.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, startX + (sigColW - 60) / 2, curY + 10, { width: 60, height: 26 });
          } catch {
            // fallback
          }
        }

        const approverName = managerSig?.signerName || eformRequest.currentApprover?.fullName || '-';
        const approvalLineY = curY + 40;
        doc.text(`Nama    : ${managerSig ? approverName : ''}`, startX + 10, approvalLineY);
        doc.text(`Jabatan : ${managerSig ? 'Kepala Departemen' : ''}`, startX + 10, approvalLineY + 10);

        doc.text('Nama    :', startX + sigColW + 10, approvalLineY);
        doc.text('Jabatan :', startX + sigColW + 10, approvalLineY + 10);

        doc.text('Nama    :', startX + sigColW * 2 + 10, approvalLineY);
        doc.text('Jabatan :', startX + sigColW * 2 + 10, approvalLineY + 10);

        // ==========================================
        // 6. DIISI OLEH ICT SECTION
        // ==========================================
        curY = approvalLineY + 24;
        doc.font('Helvetica-Bold').fontSize(8).text('DIISI OLEH ICT', startX, curY);

        curY += 10;
        const ictBoxH = 58;
        const ictColW = pageWidth / 2;

        // Left box (Akses Dibuat Pada)
        const boxLeftX = startX + 80;
        const boxLeftW = 160;
        doc.font('Helvetica').fontSize(7.5).text('Akses Dibuat Pada:', startX, curY + 2);
        doc.rect(boxLeftX, curY, boxLeftW, 13).lineWidth(0.6).stroke('#000000');
        if (isConfirmed) {
          doc.text(formatDateId(credential?.accessCreatedAt || eformRequest.resolvedAt), boxLeftX + 5, curY + 3);
        }

        doc.text('Nama:', startX, curY + 18);
        doc.rect(boxLeftX, curY + 16, boxLeftW, 13).lineWidth(0.6).stroke('#000000');
        if (isConfirmed) {
          doc.text(credential?.provisionedByName || 'Admin ICT', boxLeftX + 5, curY + 19);
        }

        doc.text('Tanda Tangan:', startX, curY + 34);
        doc.rect(boxLeftX, curY + 32, boxLeftW, 26).lineWidth(0.6).stroke('#000000');
        if (isConfirmed) {
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#15803D')
            .text('[TERVERIFIKASI SISTEM ICT]', boxLeftX + 15, curY + 41);
          doc.font('Helvetica').fontSize(6).fillColor('#64748B')
            .text(formatDateId(eformRequest.resolvedAt), boxLeftX + 40, curY + 49);
        }

        // Right box (Akses Dihapus Pada)
        const rightStartX = startX + ictColW + 10;
        const boxRightX = rightStartX + 80;
        const boxRightW = 160;

        doc.fillColor('#000000').font('Helvetica').fontSize(7.5).text('Akses Dihapus Pada:', rightStartX, curY + 2);
        doc.rect(boxRightX, curY, boxRightW, 13).lineWidth(0.6).stroke('#000000');
        if (eformRequest.formData?.sampaiTanggal) {
          doc.text(formatDateId(eformRequest.formData?.sampaiTanggal), boxRightX + 5, curY + 3);
        }

        doc.text('Nama:', rightStartX, curY + 18);
        doc.rect(boxRightX, curY + 16, boxRightW, 13).lineWidth(0.6).stroke('#000000');

        doc.text('Tanda Tangan:', rightStartX, curY + 34);
        doc.rect(boxRightX, curY + 32, boxRightW, 26).lineWidth(0.6).stroke('#000000');

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
