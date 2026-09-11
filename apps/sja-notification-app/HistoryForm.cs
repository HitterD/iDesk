using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Modern Windows 11 Fluent 2 Notification History Window for SJA Notifier.
    /// Frameless custom card feed with interactive cards, relative timestamps, and adaptive light/dark theme.
    /// </summary>
    public class HistoryForm : Form
    {
        private readonly AppConfig _config;
        private Panel _pnlBody = null!;
        private Panel _pnlList = null!;
        private FluentScrollBar _scrollBar = null!;
        private Label _lblCount = null!;
        private GlassButton _btnClose = null!;
        private GlassButton _btnMin = null!;

        public HistoryForm(AppConfig config)
        {
            _config = config;
            InitializeComponent();
            FluentTheme.ApplyWindows11Styles(Handle);
            LoadNotifications();
        }

        private void InitializeComponent()
        {
            Text = "SJA Notifier • Riwayat Notifikasi Desktop";
            Size = new Size(640, 600);
            MinimumSize = new Size(540, 480);
            FormBorderStyle = FormBorderStyle.None;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            Font = FluentTheme.Body;
            BackColor = FluentTheme.ThemeCanvasTop;
            ForeColor = FluentTheme.ThemeTextPrimary;
            ShowInTaskbar = true;
            DoubleBuffered = true;

            try
            {
                string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "app.ico");
                if (File.Exists(icoPath)) Icon = new Icon(icoPath);
                else Icon = SystemIcons.Application;
            }
            catch { Icon = SystemIcons.Application; }

            var pnlRoot = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(1),
                BackColor = FluentTheme.ThemeCanvasTop
            };
            pnlRoot.Paint += (s, e) =>
            {
                using var borderPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawRectangle(borderPen, 0, 0, pnlRoot.Width - 1, pnlRoot.Height - 1);
            };
            Controls.Add(pnlRoot);

            // ================= 1. HEADER BAR =================
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 64,
                BackColor = FluentTheme.ThemeCardFill,
                Padding = new Padding(20, 12, 20, 12)
            };
            pnlHeader.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Paint += (s, e) =>
            {
                using var linePen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(linePen, 0, pnlHeader.Height - 1, pnlHeader.Width, pnlHeader.Height - 1);
            };

            var picLogo = new PictureBox
            {
                Size = new Size(36, 36),
                Location = new Point(18, 14),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent,
                Image = LoadSantosLogo()
            };
            picLogo.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(picLogo);

            var lblTitle = new Label
            {
                Text = "Riwayat Notifikasi Desktop",
                Font = FluentTheme.Title,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(62, 13),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblTitle.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(lblTitle);

            _lblCount = new Label
            {
                Text = "Memuat riwayat...",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(62, 35),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _lblCount.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(_lblCount);

            var btnOpenWeb = new GlassButton
            {
                Text = "Arsip Web ➔",
                Size = new Size(110, 32),
                Variant = GlassButtonVariant.Accent,
                Radius = 6,
                Font = FluentTheme.CaptionBold,
                Cursor = Cursors.Hand
            };
            btnOpenWeb.Click += (s, e) =>
            {
                ToastNotifier.OpenUrlInBrowser($"{_config.IdeskServerUrl}/notifications/history");
            };
            pnlHeader.Controls.Add(btnOpenWeb);

            _btnClose = new GlassButton
            {
                Size = new Size(32, 32),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "close",
                Radius = 6,
                Cursor = Cursors.Hand
            };
            _btnClose.Click += (s, e) => Close();
            pnlHeader.Controls.Add(_btnClose);

            _btnMin = new GlassButton
            {
                Size = new Size(32, 32),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "minimize",
                Radius = 6,
                Cursor = Cursors.Hand
            };
            _btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;
            pnlHeader.Controls.Add(_btnMin);

            pnlHeader.Resize += (s, e) =>
            {
                int r = pnlHeader.ClientSize.Width;
                _btnClose.Location = new Point(r - 42, 16);
                _btnMin.Location = new Point(r - 80, 16);
                btnOpenWeb.Location = new Point(r - 200, 16);
            };

            pnlRoot.Controls.Add(pnlHeader);

            // ================= 2. FOOTER ACTION BAR =================
            var pnlFooter = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 56,
                BackColor = FluentTheme.ThemeCardFillSoft,
                Padding = new Padding(20, 10, 20, 10)
            };
            pnlFooter.Paint += (s, e) =>
            {
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 0, 0, pnlFooter.Width, 0);
            };

            var btnClear = new GlassButton
            {
                Text = "Bersihkan Riwayat",
                Size = new Size(150, 34),
                Location = new Point(20, 11),
                Variant = GlassButtonVariant.Danger,
                Radius = 6,
                Font = FluentTheme.SubTextBold
            };
            btnClear.Click += (s, e) =>
            {
                if (MessageBox.Show("Bersihkan seluruh log notifikasi lokal di PC ini?", "Konfirmasi", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
                {
                    LocalNotificationHistory.Clear();
                    LoadNotifications();
                }
            };
            pnlFooter.Controls.Add(btnClear);

            var btnClose = new GlassButton
            {
                Text = "Tutup",
                Size = new Size(80, 34),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(pnlFooter.Width - 100, 11),
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.SubTextBold
            };
            btnClose.Click += (s, e) => Close();
            pnlFooter.Controls.Add(btnClose);

            pnlFooter.Resize += (s, e) =>
            {
                btnClose.Location = new Point(pnlFooter.ClientSize.Width - 100, 11);
            };

            pnlRoot.Controls.Add(pnlFooter);

            // ================= 3. BODY (FEED CONTAINER) =================
            _pnlBody = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = FluentTheme.ThemeCanvasTop
            };

            _pnlList = new Panel
            {
                Location = new Point(16, 12),
                Size = new Size(_pnlBody.ClientSize.Width - 36, 100),
                BackColor = Color.Transparent
            };

            _scrollBar = new FluentScrollBar
            {
                Dock = DockStyle.Right,
                Width = 8,
                Minimum = 0,
                Maximum = 100,
                LargeChange = 50
            };
            _scrollBar.ValueChanged += (s, e) =>
            {
                _pnlList.Top = 12 - _scrollBar.Value;
            };

            _pnlBody.Controls.Add(_pnlList);
            _pnlBody.Controls.Add(_scrollBar);
            pnlRoot.Controls.Add(_pnlBody);
            _pnlBody.BringToFront();

            _pnlBody.MouseWheel += (s, e) =>
            {
                int scrollStep = 30;
                if (e.Delta < 0) _scrollBar.Value += scrollStep;
                else _scrollBar.Value -= scrollStep;
            };

            _pnlBody.Resize += (s, e) => UpdateScrollBounds();
        }

        private void UpdateScrollBounds()
        {
            if (_pnlBody == null || _pnlList == null || _scrollBar == null) return;
            int w = _pnlBody.ClientSize.Width - 36;
            if (w <= 0) return;
            _pnlList.Width = w;

            int maxScroll = Math.Max(0, _pnlList.Height - _pnlBody.Height + 28);
            _scrollBar.Maximum = maxScroll;
            _scrollBar.Visible = maxScroll > 0;
        }

        private void LoadNotifications()
        {
            _pnlList.Controls.Clear();
            var items = LocalNotificationHistory.LoadAll();
            _lblCount.Text = $"{items.Count} notifikasi tersimpan lokal di perangkat ini";

            if (items.Count == 0)
            {
                var pnlEmpty = new Panel
                {
                    Dock = DockStyle.Fill,
                    BackColor = Color.Transparent
                };

                var lblEmpty = new Label
                {
                    Text = "Belum ada notifikasi yang diterima di komputer ini.\nNotifikasi baru dari sistem iDesk akan otomatis tersimpan di sini.",
                    Font = FluentTheme.BodyMedium,
                    ForeColor = FluentTheme.ThemeTextMuted,
                    Dock = DockStyle.Fill,
                    TextAlign = ContentAlignment.MiddleCenter
                };
                pnlEmpty.Controls.Add(lblEmpty);
                _pnlList.Controls.Add(pnlEmpty);
                return;
            }

            // Render modern feed cards from newest to oldest
            int totalHeight = 0;
            for (int i = items.Count - 1; i >= 0; i--)
            {
                var notif = items[i];
                var card = CreateNotificationRowCard(notif);
                _pnlList.Controls.Add(card);
                totalHeight += 84;

                var spacer = new Panel { Dock = DockStyle.Top, Height = 8, BackColor = Color.Transparent };
                _pnlList.Controls.Add(spacer);
                totalHeight += 8;
            }

            _pnlList.Height = totalHeight + 10;
            UpdateScrollBounds();
        }

        private Panel CreateNotificationRowCard(NotificationData notif)
        {
            var pnl = new Panel
            {
                Dock = DockStyle.Top,
                Height = 84,
                BackColor = Color.Transparent,
                Padding = new Padding(14, 10, 14, 10),
                Cursor = Cursors.Hand
            };

            bool isHovered = false;
            pnl.Paint += (s, e) =>
            {
                Color fill = isHovered ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                FluentTheme.PaintGlassCard(e.Graphics, pnl.ClientRectangle, 8, fill);
            };

            pnl.MouseEnter += (s, e) => { isHovered = true; pnl.Invalidate(); };
            pnl.MouseLeave += (s, e) => { isHovered = false; pnl.Invalidate(); };

            Action openTarget = () =>
            {
                if (notif.IsConversationNotification() && !string.IsNullOrWhiteSpace(notif.Url))
                {
                    ToastNotifier.OpenUrlInBrowser(notif.Url);
                }
                else
                {
                    TrayApplicationContext.ShowPopupWindow(notif);
                }
            };

            pnl.Click += (s, e) => openTarget();

            // Top Row: App / Ticket Tag + Priority + Time
            var pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 22,
                BackColor = Color.Transparent
            };
            pnlTop.Click += (s, e) => openTarget();
            pnlTop.MouseEnter += (s, e) => { isHovered = true; pnl.Invalidate(); };
            pnlTop.MouseLeave += (s, e) => { isHovered = false; pnl.Invalidate(); };
            pnl.Controls.Add(pnlTop);

            string ticketTag = !string.IsNullOrWhiteSpace(notif.TicketNumber)
                ? $"#{notif.TicketNumber}"
                : (!string.IsNullOrWhiteSpace(notif.Category) ? notif.Category : (notif.App ?? "iDesk").ToUpperInvariant());

            var lblBadge = new Label
            {
                Text = ticketTag,
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeAccentText,
                Dock = DockStyle.Left,
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblBadge.Click += (s, e) => openTarget();
            pnlTop.Controls.Add(lblBadge);

            if (!string.IsNullOrWhiteSpace(notif.Priority) && !notif.Priority.Equals("normal", StringComparison.OrdinalIgnoreCase))
            {
                var pTheme = FluentTheme.GetPriorityTheme(notif.Priority);
                var lblPrio = new Label
                {
                    Text = $" • {notif.Priority.ToUpperInvariant()}",
                    Font = FluentTheme.CaptionBold,
                    ForeColor = pTheme.Text,
                    Dock = DockStyle.Left,
                    AutoSize = true,
                    BackColor = Color.Transparent
                };
                lblPrio.Click += (s, e) => openTarget();
                pnlTop.Controls.Add(lblPrio);
            }

            var lblTime = new Label
            {
                Text = $"{notif.Timestamp:dd MMM, HH:mm}",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextMuted,
                Dock = DockStyle.Right,
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblTime.Click += (s, e) => openTarget();
            pnlTop.Controls.Add(lblTime);

            // Title
            string displayTitle = !string.IsNullOrWhiteSpace(notif.Title) ? notif.Title : "Notifikasi Sistem";
            var lblTitle = new Label
            {
                Text = displayTitle,
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Dock = DockStyle.Top,
                Height = 22,
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            lblTitle.Click += (s, e) => openTarget();
            lblTitle.MouseEnter += (s, e) => { isHovered = true; pnl.Invalidate(); };
            lblTitle.MouseLeave += (s, e) => { isHovered = false; pnl.Invalidate(); };
            pnl.Controls.Add(lblTitle);

            // Body preview
            var lblBody = new Label
            {
                Text = notif.Message ?? notif.Body ?? "",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Dock = DockStyle.Top,
                Height = 36,
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            lblBody.Click += (s, e) => openTarget();
            lblBody.MouseEnter += (s, e) => { isHovered = true; pnl.Invalidate(); };
            lblBody.MouseLeave += (s, e) => { isHovered = false; pnl.Invalidate(); };
            pnl.Controls.Add(lblBody);

            pnl.Controls.Add(lblTitle);
            pnl.Controls.Add(pnlTop);

            return pnl;
        }

        private Image LoadSantosLogo()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string santosLogoAsset = Path.Combine(baseDir, "assets", "santos-logo.png");
                string ideskLogoAsset = Path.Combine(baseDir, "assets", "idesk-logo.png");

                string logoToUse = File.Exists(santosLogoAsset) ? santosLogoAsset : ideskLogoAsset;
                if (File.Exists(logoToUse))
                {
                    return Image.FromFile(logoToUse);
                }
            }
            catch { }

            var bmp = new Bitmap(36, 36);
            using var g = Graphics.FromImage(bmp);
            using var b = new SolidBrush(FluentTheme.NavyBrand);
            g.FillEllipse(b, 2, 2, 32, 32);
            return bmp;
        }
    }
}
