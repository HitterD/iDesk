using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Media;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SJANotificationApp
{
    /// <summary>
    /// Modern Windows 11 Fluent 2 Settings Window for SJA Notifier.
    /// Frameless custom card layout with card-row toggles, elegant inputs, and adaptive light/dark theme.
    /// </summary>
    public class SettingsForm : Form
    {
        private readonly AppConfig _config;
        private TextBox _txtWsUrl = null!;
        private TextBox _txtServerUrl = null!;
        private GlassDropdown _cmbDisplayMode = null!;
        private GlassDropdown _cmbAutoDismiss = null!;
        private FluentToggleSwitch _swSound = null!;
        private FluentToggleSwitch _swAutoStart = null!;
        private GlassButton _btnClose = null!;
        private GlassButton _btnMin = null!;

        private const string RegistryRunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppRegistryName = "SJANotifier";

        public SettingsForm(AppConfig config)
        {
            _config = config;
            InitializeComponent();
            FluentTheme.ApplyWindows11Styles(Handle);
        }

        private void InitializeComponent()
        {
            Text = "SJA Notifier • Pengaturan & Preferensi";
            Size = new Size(580, 710);
            MinimumSize = new Size(520, 620);
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
                Text = "Pengaturan SJA Notifier",
                Font = FluentTheme.Title,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(62, 13),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblTitle.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(lblTitle);

            var lblSub = new Label
            {
                Text = "Preferensi tampilan notifikasi, audio dering, dan koneksi gateway",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(62, 35),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblSub.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(lblSub);

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
            };

            pnlRoot.Controls.Add(pnlHeader);

            // ================= 2. FOOTER ACTION BAR =================
            var pnlFooter = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 60,
                BackColor = FluentTheme.ThemeCardFillSoft,
                Padding = new Padding(20, 12, 20, 12)
            };
            pnlFooter.Paint += (s, e) =>
            {
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 0, 0, pnlFooter.Width, 0);
            };

            var btnSave = new GlassButton
            {
                Text = "Simpan Pengaturan ➔",
                Size = new Size(164, 36),
                Anchor = AnchorStyles.Bottom | AnchorStyles.Right,
                Location = new Point(pnlFooter.Width - 184, 12),
                Variant = GlassButtonVariant.Accent,
                Radius = 8,
                Font = FluentTheme.SubTextBold
            };
            btnSave.Click += (s, e) => SaveAndClose();
            pnlFooter.Controls.Add(btnSave);

            var btnCancel = new GlassButton
            {
                Text = "Batal",
                Size = new Size(84, 36),
                Anchor = AnchorStyles.Bottom | AnchorStyles.Right,
                Location = new Point(pnlFooter.Width - 276, 12),
                Variant = GlassButtonVariant.Ghost,
                Radius = 8,
                Font = FluentTheme.SubTextBold
            };
            btnCancel.Click += (s, e) => Close();
            pnlFooter.Controls.Add(btnCancel);

            pnlFooter.Resize += (s, e) =>
            {
                int r = pnlFooter.ClientSize.Width;
                btnSave.Location = new Point(r - 184, 12);
                btnCancel.Location = new Point(r - 276, 12);
            };

            pnlRoot.Controls.Add(pnlFooter);

            // ================= 3. BODY (WINDOWS 11 SETTINGS CARDS) =================
            var pnlBody = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = FluentTheme.ThemeCanvasTop
            };

            var pnlScrollContent = new Panel
            {
                Location = new Point(16, 12),
                Size = new Size(pnlBody.ClientSize.Width - 36, 680),
                BackColor = Color.Transparent
            };

            var modernScrollBar = new FluentScrollBar
            {
                Dock = DockStyle.Right,
                Width = 8,
                Minimum = 0,
                Maximum = 680 - pnlBody.Height,
                LargeChange = 50
            };
            modernScrollBar.ValueChanged += (s, e) =>
            {
                pnlScrollContent.Top = 12 - modernScrollBar.Value;
            };

            pnlBody.Controls.Add(pnlScrollContent);
            pnlBody.Controls.Add(modernScrollBar);
            pnlRoot.Controls.Add(pnlBody);
            pnlBody.BringToFront();

            int y = 4;

            // Card 1: Mode Tampilan
            var cardDisplay = CreateSettingCard("Mode Tampilan Notifikasi di PC", "Pilih bagaimana tiket dan reminder dimunculkan di layar:", ref y, pnlScrollContent, 106);
            _cmbDisplayMode = new GlassDropdown
            {
                Location = new Point(16, 56),
                Size = new Size(cardDisplay.Width - 32, 36),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };
            _cmbDisplayMode.Items.Add("Keduanya: Toast Ringkas & Popup Detail (Rekomendasi)");
            _cmbDisplayMode.Items.Add("Hanya Windows Toast Saja (Pojok Kanan Bawah)");
            _cmbDisplayMode.Items.Add("Hanya Jendela Popup Saja (Pojok Kanan Bawah)");
            _cmbDisplayMode.SelectedIndex = _config.DefaultDisplayMode switch
            {
                "toast" => 1,
                "popup" => 2,
                _ => 0
            };
            cardDisplay.Controls.Add(_cmbDisplayMode);

            // Card 2: Audio Suara
            var cardAudio = CreateSettingCard("Audio & Nada Dering Notifikasi", "Bunyikan nada halus saat tiket atau pesan baru diterima", ref y, pnlScrollContent, 64);
            var btnTestAudio = new GlassButton
            {
                Text = "Tes Nada",
                Location = new Point(cardAudio.Width - 146, 16),
                Size = new Size(84, 30),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.CaptionBold
            };
            btnTestAudio.Click += (s, e) => SystemSounds.Asterisk.Play();
            cardAudio.Controls.Add(btnTestAudio);

            _swSound = new FluentToggleSwitch
            {
                Location = new Point(cardAudio.Width - 54, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Checked = _config.PlaySound
            };
            cardAudio.Controls.Add(_swSound);

            // Card 3: Auto Dismiss Popup
            var cardDismiss = CreateSettingCard("Durasi Tampil Popup Notifikasi", "Jendela popup menutup otomatis saat kursor tidak berada di atasnya", ref y, pnlScrollContent, 106);
            _cmbAutoDismiss = new GlassDropdown
            {
                Location = new Point(16, 56),
                Size = new Size(cardDismiss.Width - 32, 36),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };
            _cmbAutoDismiss.Items.Add("12 Detik (Rekomendasi standar)");
            _cmbAutoDismiss.Items.Add("30 Detik (Lebih santai)");
            _cmbAutoDismiss.Items.Add("Tetap Tampil (Tutup manual saja)");
            _cmbAutoDismiss.SelectedIndex = _config.AutoDismissSeconds switch
            {
                30 => 1,
                0 => 2,
                _ => 0
            };
            cardDismiss.Controls.Add(_cmbAutoDismiss);

            // Card 4: Auto Start with Windows
            var cardStartup = CreateSettingCard("Mulai Otomatis Bersama Windows", "Jalankan otomatis di tray taskbar saat PC pertama kali dinyalakan", ref y, pnlScrollContent, 64);
            _swAutoStart = new FluentToggleSwitch
            {
                Location = new Point(cardStartup.Width - 54, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Checked = CheckAutoStartEnabled()
            };
            cardStartup.Controls.Add(_swAutoStart);

            // Card 5: Server URLs
            var cardServer = CreateSettingCard("Koneksi SJA Gateway & iDesk Server", "Alamat endpoint jaringan untuk integrasi dan pengiriman notifikasi", ref y, pnlScrollContent, 192);

            var lblServer = new Label
            {
                Text = "URL Server Web iDesk:",
                Location = new Point(16, 54),
                AutoSize = true,
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeTextSecondary
            };
            cardServer.Controls.Add(lblServer);

            var pnlServerBox = CreateInputBox(16, 74, cardServer.Width - 32, out _txtServerUrl);
            _txtServerUrl.Text = _config.IdeskServerUrl;
            cardServer.Controls.Add(pnlServerBox);

            var lblWs = new Label
            {
                Text = "SJA Gateway WebSocket Endpoint (WSS):",
                Location = new Point(16, 118),
                AutoSize = true,
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeTextSecondary
            };
            cardServer.Controls.Add(lblWs);

            var pnlWsBox = CreateInputBox(16, 138, cardServer.Width - 32, out _txtWsUrl);
            _txtWsUrl.Text = _config.SjaWsUrl;
            cardServer.Controls.Add(pnlWsBox);

            int totalContentHeight = y + 20;
            pnlScrollContent.Height = totalContentHeight;

            // Mouse wheel scroll support
            pnlBody.MouseWheel += (s, e) =>
            {
                int scrollStep = 30;
                if (e.Delta < 0) modernScrollBar.Value += scrollStep;
                else modernScrollBar.Value -= scrollStep;
            };

            // Responsive synchronizer for settings cards
            pnlBody.Resize += (s, e) =>
            {
                int w = pnlBody.ClientSize.Width - 28;
                if (w <= 0) return;
                pnlScrollContent.Width = w;
                cardDisplay.Width = w;
                _cmbDisplayMode.Width = w - 32;
                cardAudio.Width = w;
                btnTestAudio.Location = new Point(w - 146, 16);
                _swSound.Location = new Point(w - 54, 20);
                cardDismiss.Width = w;
                _cmbAutoDismiss.Width = w - 32;
                cardStartup.Width = w;
                _swAutoStart.Location = new Point(w - 54, 20);
                cardServer.Width = w;
                pnlServerBox.Width = w - 32;
                _txtServerUrl.Width = pnlServerBox.Width - 20;
                pnlWsBox.Width = w - 32;
                _txtWsUrl.Width = pnlWsBox.Width - 20;

                int maxScroll = Math.Max(0, totalContentHeight - pnlBody.Height + 10);
                modernScrollBar.Maximum = maxScroll;
                modernScrollBar.Visible = maxScroll > 0;
            };
        }

        private Panel CreateSettingCard(string title, string subtitle, ref int y, Panel container, int height)
        {
            var pnl = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(container.Width, height),
                BackColor = Color.Transparent,
                Padding = new Padding(16, 12, 16, 12)
            };
            pnl.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, pnl.ClientRectangle, 10);
            };

            var lblTitle = new Label
            {
                Text = title,
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 12),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnl.Controls.Add(lblTitle);

            var lblSub = new Label
            {
                Text = subtitle,
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(16, 31),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnl.Controls.Add(lblSub);

            container.Controls.Add(pnl);
            y += height + 10;
            return pnl;
        }

        private Panel CreateInputBox(int x, int y, int width, out TextBox textBox)
        {
            var pnlBox = new Panel
            {
                Location = new Point(x, y),
                Size = new Size(width, 32),
                BackColor = Color.Transparent
            };

            bool focused = false;
            pnlBox.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, pnlBox.Width - 1, pnlBox.Height - 1);
                using (var brush = new SolidBrush(FluentTheme.ThemeInputWell))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 6);
                }
                Color border = focused ? FluentTheme.ThemeAccent : FluentTheme.ThemeInputBorder;
                float stroke = focused ? 1.5f : 1f;
                using var pen = new Pen(border, stroke);
                FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 6);
            };

            var tb = new TextBox
            {
                Location = new Point(10, 7),
                Size = new Size(width - 20, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.Body,
                ForeColor = FluentTheme.ThemeTextPrimary
            };
            tb.Enter += (s, e) => { focused = true; pnlBox.Invalidate(); };
            tb.Leave += (s, e) => { focused = false; pnlBox.Invalidate(); };
            pnlBox.Click += (s, e) => tb.Focus();
            pnlBox.Controls.Add(tb);

            textBox = tb;
            return pnlBox;
        }

        private string GetSelectedDisplayMode()
        {
            return _cmbDisplayMode.SelectedIndex switch
            {
                1 => "toast",
                2 => "popup",
                _ => "both"
            };
        }

        private int GetSelectedAutoDismissSeconds()
        {
            return _cmbAutoDismiss.SelectedIndex switch
            {
                1 => 30,
                2 => 0,
                _ => 12
            };
        }

        private void SaveAndClose()
        {
            string wsUrl = _txtWsUrl.Text.Trim();
            _config.SjaWsUrl = wsUrl;
            _config.DefaultDisplayMode = GetSelectedDisplayMode();
            _config.AutoDismissSeconds = GetSelectedAutoDismissSeconds();
            _config.PlaySound = _swSound.Checked;
            _config.IdeskServerUrl = _txtServerUrl.Text.Trim();

            try
            {
                var uri = new Uri(wsUrl);
                _config.SjaServerUrl = $"http://{uri.Host}:18302";
            }
            catch { }

            _config.Save();

            SetAutoStart(_swAutoStart.Checked);

            MessageBox.Show("Pengaturan SJA Notifier berhasil disimpan.", "SJA Notifier", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
        }

        private bool CheckAutoStartEnabled()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RegistryRunPath, false);
                return key?.GetValue(AppRegistryName) != null;
            }
            catch { return false; }
        }

        private void SetAutoStart(bool enable)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RegistryRunPath, true);
                if (key == null) return;

                if (enable)
                {
                    key.SetValue(AppRegistryName, $"\"{Application.ExecutablePath}\"");
                }
                else
                {
                    key.DeleteValue(AppRegistryName, false);
                }
            }
            catch { }
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
