========================================================================
           PT SANTOS JAYA ABADI - SJA NOTIFICATION APP
========================================================================

Aplikasi notifikasi taskbar tray & toast bergaya WhatsApp untuk:
- iDesk IT Helpdesk Portal (Pembaruan tiket, assignment, reply)
- Santos ERP Portal
- Web Kertas Kerja & Intranet Internal Santos

CARA INSTALASI MUDAH:
1. Ekstrak file zip ini jika masih terkompresi.
2. Klik ganda (double-click) file "install.cmd".
3. Aplikasi akan otomatis terpasang dan muncul di taskbar tray (dekat jam).
4. Selesai! Anda tidak perlu setup manual lagi. Aplikasi akan otomatis
   berjalan setiap kali komputer Windows dinyalakan.

PANDUAN INTEGRASI WEB DEVELOPER (INTERNAL SANTOS):
Bagi developer web internal Santos yang ingin memunculkan notifikasi native
Windows toast pada komputer user, cukup lakukan HTTP POST dari JavaScript / backend:

Endpoint: http://127.0.0.1:19876/notify
Method: POST
Headers: Content-Type: application/json
Body JSON:
{
  "app": "Santos ERP",
  "title": "Approval PO #8821",
  "message": "Dokumen PO membutuhkan persetujuan Anda.",
  "url": "https://erp.santos.co.id/po/8821",
  "priority": "high"
}

Ketika notifikasi diklik, browser otomatis membuka URL tersebut.
========================================================================
