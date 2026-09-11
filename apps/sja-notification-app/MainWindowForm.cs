using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Vanguard Architecture: Fluent WinUI 3 Enterprise Modal Dashboard & Login Hub.
    /// Employs strict "Double-Bezel" (Doppelrand) enclosure technique, island button-in-button CTAs,
    /// and clean dual-connect options (Instant Web 1-Click + Manual NIK/Password fallback).
    /// </summary>
    public class MainWindowForm : Form
    {
        private readonly AppConfig _config;
        private UserProfileSession? _session;
        private bool _isConnected;
        private bool _isAuthenticating;
        private bool _isPasswordVisible;
        private bool _acrylicActive;
        private bool _isPreviewMode;

        // Shared Header & Window Controls
        private Panel _pnlHeader = null!;
        private Panel _pnlGatewayPill = null!;
        private GlassButton _btnClose = null!;
        private GlassButton _btnMin = null!;

        // Content Area & View Containers
        private Panel _pnlContent = null!;
        private Panel _pnlLoginView = null!;
        private Panel _pnlDashboardView = null!;

        // Login View Controls
        private Panel _pnlWebQuickCard = null!;
        private GlassButton _btnQuickWebConnect = null!;
        private Panel _pnlNikBox = null!;
        private TextBox _txtNik = null!;
        private Panel _pnlPassBox = null!;
        private TextBox _txtPassword = null!;
        private GlassButton _btnTogglePass = null!;
        private Panel _pnlAlert = null!;
        private Label _lblAlertText = null!;
        private ProgressBar _progressBar = null!;
        private GlassButton _btnLogin = null!;
        private Panel _pnlNote = null!;
        private Color _alertBorderColor = Color.Transparent;
        private bool _nikFocused;
        private bool _passFocused;

        // Dashboard View Controls
        private Panel _pnlProfileCard = null!;
        private PictureBox _picAvatar = null!;
        private Label _lblUserName = null!;
        private Label _lblUserDetail = null!;
        private Label _lblSiteBadge = null!;
        private Label _lblDashGatewayStatus = null!;
        private Panel _pnlDashDot = null!;
        private Panel _pnlPrefCard = null!;
        private GlassDropdown _cmbDisplay = null!;
        private TableLayoutPanel _tblActions = null!;
        private GlassButton _btnRemote = null!;
        private GlassButton _btnTestNotif = null!;
        private GlassButton _btnOpenWeb = null!;
        private GlassButton _btnLogout = null!;

        public event Action? OnSessionChanged;

        public MainWindowForm(AppConfig config, bool isConnected)
        {
            _config = config;
            _isConnected = isConnected;
            _session = DeviceSecurityStorage.LoadSession();

            InitializeComponent();
            _acrylicActive = FluentTheme.TryApplyDarkAcrylic(Handle);
            FluentTheme.ThemeChanged += () =>
            {
                if (InvokeRequired) Invoke(new Action(ApplyTheme));
                else ApplyTheme();
            };
            RefreshDataState();
        }

        private void ApplyTheme()
        {
            _acrylicActive = FluentTheme.TryApplyDarkAcrylic(Handle);
            BackColor = FluentTheme.ThemeCanvasBottom;
            ForeColor = FluentTheme.ThemeTextPrimary;
            if (_txtNik != null)
            {
                _txtNik.BackColor = FluentTheme.ThemeInputWell;
                _txtNik.ForeColor = FluentTheme.ThemeTextPrimary;
            }
            if (_txtPassword != null)
            {
                _txtPassword.BackColor = FluentTheme.ThemeInputWell;
                _txtPassword.ForeColor = FluentTheme.ThemeTextPrimary;
            }
            Invalidate(true);
        }

        private void InitializeComponent()
        {
            Text = "SJA Notification Center • PT Santos Jaya Abadi";
            Size = new Size(520, 560);
            MinimumSize = new Size(500, 540);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            MaximizeBox = false;
            MinimizeBox = false;
            BackColor = FluentTheme.ThemeCanvasBottom;
            Font = FluentTheme.Body;
            ForeColor = FluentTheme.ThemeTextPrimary;
            ShowInTaskbar = true;
            DoubleBuffered = true;
            try
            {
                string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "app.ico");
                if (File.Exists(icoPath))
                {
                    Icon = new Icon(icoPath);
                }
                else
                {
                    Icon = SystemIcons.Application;
                }
            }
            catch
            {
                Icon = SystemIcons.Application;
            }

            // Root Canvas Container with frosted glass background and subtle hairline edge
            var pnlCanvas = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(20, 14, 20, 16),
                BackColor = Color.Transparent
            };
            pnlCanvas.Paint += (s, e) =>
            {
                FluentTheme.PaintFrostedCanvas(e.Graphics, pnlCanvas.ClientRectangle, _acrylicActive);
                using var borderPen = new Pen(FluentTheme.ThemeCardHairlineStrong, 1f);
                e.Graphics.DrawRectangle(borderPen, 0, 0, pnlCanvas.Width - 1, pnlCanvas.Height - 1);
            };
            Controls.Add(pnlCanvas);

            // ================= 1. TOP HEADER (BRAND, GATEWAY STATUS & WINDOW CONTROLS) =================
            _pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 56,
                BackColor = Color.Transparent
            };
            _pnlHeader.Paint += (s, e) =>
            {
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 0, _pnlHeader.Height - 1, _pnlHeader.Width, _pnlHeader.Height - 1);
            };
            _pnlHeader.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);

            var picLogo = new PictureBox
            {
                Size = new Size(36, 36),
                Location = new Point(0, 9),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = LoadSantosLogo()
            };
            picLogo.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(picLogo);

            var lblBrand = new Label
            {
                Text = "PT Santos Jaya Abadi",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextMuted,
                Location = new Point(44, 7),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblBrand.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(lblBrand);

            var lblSuite = new Label
            {
                Text = "SJA Notification Suite",
                Font = FluentTheme.GetFont(12F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(44, 23),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblSuite.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(lblSuite);

            // Window Controls (Subtle Glass Close & Minimize)
            _btnClose = new GlassButton
            {
                Size = new Size(28, 28),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "close",
                Radius = 6,
                Cursor = Cursors.Hand
            };
            _btnClose.Click += (s, e) => Close();
            _pnlHeader.Controls.Add(_btnClose);

            _btnMin = new GlassButton
            {
                Size = new Size(28, 28),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "minimize",
                Radius = 6,
                Cursor = Cursors.Hand
            };
            _btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;
            _pnlHeader.Controls.Add(_btnMin);

            // Gateway Live Status Pill (Top Right)
            _pnlGatewayPill = new Panel
            {
                Size = new Size(134, 26),
                BackColor = Color.Transparent
            };
            _pnlGatewayPill.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
                var rect = new Rectangle(0, 0, _pnlGatewayPill.Width - 1, _pnlGatewayPill.Height - 1);

                bool dark = FluentTheme.IsDarkTheme;
                Color bg = _isConnected
                    ? (dark ? Color.FromArgb(24, 16, 185, 129) : Color.FromArgb(236, 253, 245))
                    : (dark ? Color.FromArgb(28, 239, 68, 68) : Color.FromArgb(254, 242, 242));
                Color border = _isConnected
                    ? (dark ? Color.FromArgb(45, 16, 185, 129) : Color.FromArgb(167, 243, 208))
                    : (dark ? Color.FromArgb(55, 239, 68, 68) : Color.FromArgb(254, 202, 202));
                Color dotColor = _isConnected ? FluentTheme.StatusOnline : FluentTheme.StatusOffline;
                Color textColor = _isConnected
                    ? (dark ? Color.FromArgb(52, 211, 153) : Color.FromArgb(5, 150, 105))
                    : (dark ? Color.FromArgb(248, 113, 113) : Color.FromArgb(220, 38, 38));
                string text = _isConnected ? "Gateway Online" : "Gateway Offline";

                using (var brush = new SolidBrush(bg))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 12);
                }
                using (var pen = new Pen(border, 1f))
                {
                    FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 12);
                }

                using (var dotBrush = new SolidBrush(dotColor))
                {
                    e.Graphics.FillEllipse(dotBrush, 8, (_pnlGatewayPill.Height - 8) / 2, 8, 8);
                }
                using (var textBrush = new SolidBrush(textColor))
                using (var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap })
                {
                    e.Graphics.DrawString(text, FluentTheme.CaptionBold, textBrush, new RectangleF(22, 0, _pnlGatewayPill.Width - 24, _pnlGatewayPill.Height), sf);
                }
            };
            _pnlHeader.Controls.Add(_pnlGatewayPill);

            _pnlHeader.Resize += (s, e) =>
            {
                int r = _pnlHeader.ClientSize.Width;
                _btnClose.Location = new Point(r - _btnClose.Width, 14);
                _btnMin.Location = new Point(r - _btnClose.Width - _btnMin.Width - 4, 14);
                _pnlGatewayPill.Location = new Point(_btnMin.Left - _pnlGatewayPill.Width - 8, 15);
            };

            pnlCanvas.Controls.Add(_pnlHeader);

            // ================= 2. CONTENT CONTAINER =================
            _pnlContent = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0, 14, 0, 0)
            };
            pnlCanvas.Controls.Add(_pnlContent);
            _pnlContent.BringToFront();

            // Build Both Views
            _pnlLoginView = BuildLoginView();
            _pnlDashboardView = BuildDashboardView();

            _pnlContent.Controls.Add(_pnlLoginView);
            _pnlContent.Controls.Add(_pnlDashboardView);
        }

        #region Login View Builder (Frosted Glass Dark Theme)
        private Panel BuildLoginView()
        {
            var pnl = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0)
            };

            int y = 4;

            // ================= OPTION 1: INSTANT WEB CONNECT CARD =================
            _pnlWebQuickCard = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 96),
                BackColor = Color.Transparent,
                Padding = new Padding(14, 12, 14, 12)
            };
            _pnlWebQuickCard.Paint += (s, e) =>
            {
                bool dark = FluentTheme.IsDarkTheme;
                Color fill = dark ? Color.FromArgb(28, 34, 46) : Color.FromArgb(240, 245, 255);
                Color border = dark ? Color.FromArgb(45, 58, 85) : Color.FromArgb(219, 234, 254);
                FluentTheme.PaintGlassCard(e.Graphics, _pnlWebQuickCard.ClientRectangle, 10, fill, border);
            };

            var lblWebPrompt = new Label
            {
                Text = "Koneksi Cepat Akun iDesk Web",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeAccentText,
                Location = new Point(14, 10),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlWebQuickCard.Controls.Add(lblWebPrompt);

            var lblWebSub = new Label
            {
                Text = "Hubungkan perangkat ini secara otomatis dari sesi aktif browser iDesk.",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(14, 28),
                Size = new Size(410, 18),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlWebQuickCard.Controls.Add(lblWebSub);

            _btnQuickWebConnect = new GlassButton
            {
                Location = new Point(14, 48),
                Size = new Size(412, 36),
                Text = "Hubungkan Sesi dari Browser Web ➔",
                Variant = GlassButtonVariant.Accent,
                Glyph = "browser",
                Radius = 8
            };
            _btnQuickWebConnect.Click += async (s, e) => await HandleQuickWebConnectAsync();
            _pnlWebQuickCard.Controls.Add(_btnQuickWebConnect);

            pnl.Controls.Add(_pnlWebQuickCard);

            y += 108;

            // ================= SECTION DIVIDER =================
            var pnlDivider = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 22),
                BackColor = Color.Transparent
            };
            pnlDivider.Paint += (s, e) =>
            {
                int midY = pnlDivider.Height / 2;
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 0, midY, pnlDivider.Width, midY);

                // Centered badge text
                string text = "ATAU MASUK MANUAL DENGAN NIK";
                using var font = FluentTheme.CaptionBold;
                using var textBrush = new SolidBrush(FluentTheme.ThemeTextMuted);
                using var bgBrush = new SolidBrush(FluentTheme.ThemeCanvasBottom);
                var size = e.Graphics.MeasureString(text, font);
                float tx = (pnlDivider.Width - size.Width) / 2;
                e.Graphics.FillRectangle(bgBrush, tx - 8, 0, size.Width + 16, pnlDivider.Height);
                e.Graphics.DrawString(text, font, textBrush, tx, (pnlDivider.Height - size.Height) / 2);
            };
            pnl.Controls.Add(pnlDivider);

            y += 30;

            // ================= OPTION 2: MANUAL NIK & PASSWORD =================
            var lblNik = new Label
            {
                Text = "NIK atau Email Karyawan Santos:",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(0, y),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnl.Controls.Add(lblNik);

            y += 22;
            _pnlNikBox = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 40),
                BackColor = Color.Transparent
            };
            _pnlNikBox.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, _pnlNikBox.Width - 1, _pnlNikBox.Height - 1);
                using (var brush = new SolidBrush(FluentTheme.ThemeInputWell))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 8);
                }
                Color border = _nikFocused ? FluentTheme.ThemeAccent : FluentTheme.ThemeInputBorder;
                float w = _nikFocused ? 1.5f : 1f;
                using var pen = new Pen(border, w);
                FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 8);
            };

            _txtNik = new TextBox
            {
                Location = new Point(12, 11),
                Size = new Size(440 - 24, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.GetFont(10F, FontStyle.Regular),
                ForeColor = FluentTheme.ThemeTextPrimary,
                PlaceholderText = "Contoh: 00061058 atau user.spj@idesk.com"
            };
            _txtNik.Enter += (s, e) => { _nikFocused = true; _pnlNikBox.Invalidate(); };
            _txtNik.Leave += (s, e) => { _nikFocused = false; _pnlNikBox.Invalidate(); };
            _pnlNikBox.Click += (s, e) => _txtNik.Focus();
            _pnlNikBox.Controls.Add(_txtNik);
            pnl.Controls.Add(_pnlNikBox);

            y += 48;
            var lblPass = new Label
            {
                Text = "Kata Sandi Akun (iDesk / HRIS):",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(0, y),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnl.Controls.Add(lblPass);

            y += 22;
            _pnlPassBox = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 40),
                BackColor = Color.Transparent
            };
            _pnlPassBox.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, _pnlPassBox.Width - 1, _pnlPassBox.Height - 1);
                using (var brush = new SolidBrush(FluentTheme.ThemeInputWell))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 8);
                }
                Color border = _passFocused ? FluentTheme.ThemeAccent : FluentTheme.ThemeInputBorder;
                float w = _passFocused ? 1.5f : 1f;
                using var pen = new Pen(border, w);
                FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 8);
            };

            _txtPassword = new TextBox
            {
                Location = new Point(12, 11),
                Size = new Size(440 - 76, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.GetFont(10.5F, FontStyle.Regular),
                ForeColor = FluentTheme.ThemeTextPrimary,
                UseSystemPasswordChar = true,
                PlaceholderText = "••••••••"
            };
            _txtPassword.Enter += (s, e) => { _passFocused = true; _pnlPassBox.Invalidate(); };
            _txtPassword.Leave += (s, e) => { _passFocused = false; _pnlPassBox.Invalidate(); };
            _pnlPassBox.Click += (s, e) => _txtPassword.Focus();
            _pnlPassBox.Controls.Add(_txtPassword);

            _btnTogglePass = new GlassButton
            {
                Location = new Point(440 - 58, 6),
                Size = new Size(52, 28),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Text = "Lihat",
                Variant = GlassButtonVariant.Ghost,
                Font = FluentTheme.CaptionBold,
                Radius = 6
            };
            _btnTogglePass.Click += (s, e) => TogglePasswordVisibility();
            _pnlPassBox.Controls.Add(_btnTogglePass);
            pnl.Controls.Add(_pnlPassBox);
            _txtPassword.Enter += (s, e) => { _passFocused = true; _pnlPassBox.Invalidate(); };
            _txtPassword.Leave += (s, e) => { _passFocused = false; _pnlPassBox.Invalidate(); };
            _pnlPassBox.Click += (s, e) => _txtPassword.Focus();
            _pnlPassBox.Controls.Add(_txtPassword);
            pnl.Controls.Add(_pnlPassBox);

            y += 48;
            // Status Alert Banner
            _pnlAlert = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 32),
                BackColor = Color.Transparent,
                Visible = false
            };
            _pnlAlert.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, _pnlAlert.Width - 1, _pnlAlert.Height - 1);
                using var b = new SolidBrush(_pnlAlert.BackColor);
                FluentTheme.FillRoundedRectangle(e.Graphics, b, rect, 6);
                using var p = new Pen(_alertBorderColor, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, rect, 6);
            };

            _lblAlertText = new Label
            {
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(8, 0, 8, 0),
                Font = FluentTheme.SubTextBold,
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlAlert.Controls.Add(_lblAlertText);
            pnl.Controls.Add(_pnlAlert);

            y += 38;
            _progressBar = new ProgressBar
            {
                Location = new Point(0, y),
                Size = new Size(440, 3),
                Style = ProgressBarStyle.Marquee,
                Visible = false
            };
            pnl.Controls.Add(_progressBar);

            y += 8;
            // Glass Accent CTA Button
            _btnLogin = new GlassButton
            {
                Location = new Point(0, y),
                Size = new Size(440, 44),
                Text = "Masuk & Hubungkan Perangkat ➔",
                Variant = GlassButtonVariant.Accent,
                Radius = 9
            };
            _btnLogin.Click += async (s, e) => await DoLoginAsync();
            pnl.Controls.Add(_btnLogin);

            y += 54;
            _pnlNote = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 60),
                BackColor = Color.Transparent,
                Padding = new Padding(12, 8, 12, 8)
            };
            _pnlNote.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, _pnlNote.ClientRectangle, 8, fill: FluentTheme.GlassCardFillSoft);
            };

            var lblNote = new Label
            {
                Dock = DockStyle.Fill,
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextMuted,
                TextAlign = ContentAlignment.MiddleLeft,
                BackColor = Color.Transparent,
                Text = "Kredensial disimpan terenkripsi dengan Windows DPAPI di komputer ini. Notifikasi tiket akan langsung muncul di taskbar secara otomatis."
            };
            _pnlNote.Controls.Add(lblNote);
            pnl.Controls.Add(_pnlNote);

            // Responsive Width Synchronizer
            pnl.Resize += (s, e) =>
            {
                int w = pnl.ClientSize.Width;
                if (w <= 0) return;
                _pnlWebQuickCard.Width = w;
                _btnQuickWebConnect.Width = w - 28;
                pnlDivider.Width = w;
                _pnlNikBox.Width = w;
                _pnlPassBox.Width = w;
                _pnlAlert.Width = w;
                _progressBar.Width = w;
                _btnLogin.Width = w;
                _pnlNote.Width = w;
            };

            return pnl;
        }
        #endregion

        #region Dashboard View Builder
        private Panel BuildDashboardView()
        {
            var pnl = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0)
            };

            int y = 6;

            // ================= 1. EMPLOYEE IDENTITY DOUBLE-BEZEL CARD =================
            _pnlProfileCard = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 120),
                BackColor = Color.Transparent,
                Padding = new Padding(16, 14, 16, 12)
            };
            _pnlProfileCard.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, _pnlProfileCard.ClientRectangle, 12);

                // Divider line above connection status
                using var divPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(divPen, 16, 78, _pnlProfileCard.Width - 16, 78);
            };

            // Avatar circle
            _picAvatar = new PictureBox
            {
                Size = new Size(48, 48),
                Location = new Point(16, 16),
                BackColor = Color.Transparent
            };
            _picAvatar.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, _picAvatar.Width - 1, _picAvatar.Height - 1);
                using var b = new SolidBrush(FluentTheme.ThemeAccentSoft);
                FluentTheme.FillRoundedRectangle(e.Graphics, b, r, 24);

                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 24);

                string initial = !string.IsNullOrWhiteSpace(_session?.FullName)
                    ? _session.FullName.Substring(0, 1).ToUpper()
                    : "S";
                using var font = FluentTheme.GetFont(12F, FontStyle.Bold);
                using var textBrush = new SolidBrush(FluentTheme.ThemeAccentText);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(initial, font, textBrush, new RectangleF(0, 0, 48, 48), sf);
            };
            _pnlProfileCard.Controls.Add(_picAvatar);

            _lblUserName = new Label
            {
                Text = "Karyawan Santos",
                Font = FluentTheme.GetFont(11F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(74, 16),
                Size = new Size(290, 24),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlProfileCard.Controls.Add(_lblUserName);

            _lblUserDetail = new Label
            {
                Text = "00000000 • PC-NAME",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(74, 42),
                Size = new Size(290, 20),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlProfileCard.Controls.Add(_lblUserDetail);

            _lblSiteBadge = new Label
            {
                Text = "SPJ",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.IsDarkTheme ? Color.FromArgb(147, 197, 253) : Color.FromArgb(30, 41, 59),
                BackColor = FluentTheme.IsDarkTheme ? FluentTheme.DarkBadgeBg : Color.FromArgb(241, 245, 249),
                Location = new Point(_pnlProfileCard.Width - 62, 16),
                Size = new Size(46, 22),
                TextAlign = ContentAlignment.MiddleCenter
            };
            _lblSiteBadge.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, _lblSiteBadge.Width - 1, _lblSiteBadge.Height - 1);
                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 5);
            };
            _pnlProfileCard.Controls.Add(_lblSiteBadge);

            // Row connection status inside card
            _pnlDashDot = new Panel
            {
                Size = new Size(16, 16),
                Location = new Point(14, 89),
                BackColor = Color.Transparent
            };
            _pnlDashDot.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Color dotColor = _isConnected ? FluentTheme.StatusOnline : FluentTheme.StatusOffline;
                using var b = new SolidBrush(dotColor);
                e.Graphics.FillEllipse(b, 4, 4, 8, 8);
            };
            _pnlProfileCard.Controls.Add(_pnlDashDot);

            _lblDashGatewayStatus = new Label
            {
                Text = "Memeriksa status gateway...",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(34, 88),
                Size = new Size(390, 18),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlProfileCard.Controls.Add(_lblDashGatewayStatus);

            _pnlProfileCard.Resize += (s, e) =>
            {
                _lblSiteBadge.Location = new Point(_pnlProfileCard.ClientSize.Width - _lblSiteBadge.Width - 14, 16);
                int textW = _lblSiteBadge.Left - 80;
                if (textW > 100)
                {
                    _lblUserName.Width = textW;
                    _lblUserDetail.Width = textW;
                }
                _lblDashGatewayStatus.Width = _pnlProfileCard.ClientSize.Width - 40;
            };

            pnl.Controls.Add(_pnlProfileCard);

            y += 134;

            // ================= 2. NOTIFICATION PREFERENCES CARD =================
            _pnlPrefCard = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(440, 102),
                BackColor = Color.Transparent,
                Padding = new Padding(14, 12, 14, 12)
            };
            _pnlPrefCard.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, _pnlPrefCard.ClientRectangle, 12);
            };

            var lblPrefTitle = new Label
            {
                Text = "PREFERENSI TAMPILAN NOTIFIKASI DI PC INI",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextMuted,
                Location = new Point(14, 10),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlPrefCard.Controls.Add(lblPrefTitle);

            var lblPrefSub = new Label
            {
                Text = "Pilih bagaimana tiket dan reminder dimunculkan di layar:",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(14, 28),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlPrefCard.Controls.Add(lblPrefSub);

            _cmbDisplay = new GlassDropdown
            {
                Location = new Point(14, 52),
                Size = new Size(412, 38)
            };
            _cmbDisplay.Items.Add("Keduanya: Toast & Popup Modal (Rekomendasi)");
            _cmbDisplay.Items.Add("Hanya Windows Toast Saja (Pojok Kanan Bawah)");
            _cmbDisplay.Items.Add("Hanya Jendela Popup Modal Saja");
            _cmbDisplay.SelectedIndex = _config.DefaultDisplayMode switch
            {
                "toast" => 1,
                "popup" => 2,
                _ => 0
            };
            _cmbDisplay.SelectedIndexChanged += (s, e) =>
            {
                _config.DefaultDisplayMode = _cmbDisplay.SelectedIndex switch
                {
                    1 => "toast",
                    2 => "popup",
                    _ => "both"
                };
                _config.Save();
            };
            _pnlPrefCard.Controls.Add(_cmbDisplay);

            _pnlPrefCard.Resize += (s, e) =>
            {
                _cmbDisplay.Width = _pnlPrefCard.ClientSize.Width - 28;
            };

            pnl.Controls.Add(_pnlPrefCard);

            y += 116;

            // ================= 3. QUICK ACTIONS (TableLayoutPanel: Remote, Test, Open Web) =================
            _tblActions = new TableLayoutPanel
            {
                Location = new Point(0, y),
                Size = new Size(440, 42),
                ColumnCount = 3,
                RowCount = 1,
                BackColor = Color.Transparent,
                Margin = new Padding(0),
                Padding = new Padding(0)
            };
            _tblActions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 46F));
            _tblActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42F));
            _tblActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58F));

            _btnRemote = new GlassButton
            {
                Dock = DockStyle.Fill,
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "remote",
                Radius = 8,
                Margin = new Padding(0, 0, 6, 0)
            };
            var remoteTip = new ToolTip();
            remoteTip.SetToolTip(_btnRemote, "Buka Direktori Remote Desktop Santos");
            _btnRemote.Click += (s, e) =>
            {
                OpenRemoteDeviceBrowser();
            };
            _tblActions.Controls.Add(_btnRemote, 0, 0);

            _btnTestNotif = new GlassButton
            {
                Dock = DockStyle.Fill,
                Text = "Uji Notifikasi",
                Glyph = "test",
                Variant = GlassButtonVariant.Ghost,
                Radius = 8,
                Margin = new Padding(0, 0, 6, 0)
            };
            _btnTestNotif.Click += (s, e) =>
            {
                ToastNotifier.ShowTestNotification(_config.DefaultDisplayMode);
            };
            _tblActions.Controls.Add(_btnTestNotif, 1, 0);

            _btnOpenWeb = new GlassButton
            {
                Dock = DockStyle.Fill,
                Text = "Buka Portal Web iDesk ➔",
                Variant = GlassButtonVariant.Accent,
                Radius = 8,
                Margin = new Padding(0)
            };
            _btnOpenWeb.Click += async (s, e) => await HandleOpenWebWithSsoAsync();
            _tblActions.Controls.Add(_btnOpenWeb, 2, 0);

            pnl.Controls.Add(_tblActions);

            y += 56;

            // ================= 4. LOGOUT ACTION =================
            _btnLogout = new GlassButton
            {
                Location = new Point(0, y),
                Size = new Size(440, 40),
                Text = "Keluar Akun",
                Glyph = "exit",
                Variant = GlassButtonVariant.Danger,
                Radius = 8
            };
            _btnLogout.Click += (s, e) => HandleLogoutAction();
            pnl.Controls.Add(_btnLogout);

            // Responsive Width Synchronizer
            pnl.Resize += (s, e) =>
            {
                int w = pnl.ClientSize.Width;
                if (w <= 0) return;
                _pnlProfileCard.Width = w;
                _pnlPrefCard.Width = w;
                _tblActions.Width = w;
                _btnLogout.Width = w;
            };

            return pnl;
        }
        #endregion

        #region Actions & Business Logic
        private void TogglePasswordVisibility()
        {
            _isPasswordVisible = !_isPasswordVisible;
            _txtPassword.UseSystemPasswordChar = !_isPasswordVisible;
            _btnTogglePass.Text = _isPasswordVisible ? "Tutup" : "Lihat";
        }

        private async Task HandleQuickWebConnectAsync()
        {
            _btnQuickWebConnect.Enabled = false;
            _btnQuickWebConnect.Text = "Memulai Sesi Pairing Browser...";

            try
            {
                // Background probe & set active server
                await _config.ProbeAndSetBestServerAsync();

                var manager = new DeviceActivationManager(_config.SjaServerUrl);
                using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));

                var sessionInfo = await manager.RequestPairingSessionAsync(cts.Token);
                if (sessionInfo == null)
                {
                    ShowAlert("Gagal memulai sesi aktivasi. Periksa koneksi ke server SJA.", isError: true);
                    return;
                }

                // Tampilkan dialog panduan & opsi copy link agar aman dari multi-profil browser
                bool browserOpened = false;
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = sessionInfo.ActivationUrl,
                        UseShellExecute = true,
                    });
                    browserOpened = true;
                }
                catch { }

                ShowAlert($"Kode: {sessionInfo.Code} • Buka tab iDesk aktif & klik 'Izinkan' (atau salin link)", isError: false);

                // Buat dialog interaktif non-blocking atau modal kecil konfirmasi link
                using var dlg = new Form
                {
                    Text = "Aktivasi Perangkat • SJA Notifier",
                    Size = new Size(460, 240),
                    StartPosition = FormStartPosition.CenterParent,
                    FormBorderStyle = FormBorderStyle.FixedDialog,
                    MaximizeBox = false,
                    MinimizeBox = false,
                    BackColor = FluentTheme.ThemeCanvasTop,
                    ForeColor = FluentTheme.ThemeTextPrimary,
                    Font = FluentTheme.Body
                };
                FluentTheme.ApplyWindows11Styles(dlg.Handle);

                var lblInfo = new Label
                {
                    Text = $"Kode Pairing Perangkat: {sessionInfo.Code}\n\nJika browser Anda membuka profil yang salah, silakan salin tautan aktivasi di bawah dan tempelkan (paste) di profil browser yang sedang login di iDesk:",
                    Font = FluentTheme.SubText,
                    ForeColor = FluentTheme.ThemeTextSecondary,
                    Location = new Point(18, 16),
                    Size = new Size(410, 64)
                };
                dlg.Controls.Add(lblInfo);

                var txtLink = new TextBox
                {
                    Text = sessionInfo.ActivationUrl,
                    Location = new Point(18, 86),
                    Size = new Size(410, 26),
                    ReadOnly = true,
                    BackColor = FluentTheme.ThemeInputWell,
                    ForeColor = FluentTheme.ThemeTextPrimary
                };
                dlg.Controls.Add(txtLink);

                var btnCopy = new GlassButton
                {
                    Text = "📋 Salin Tautan",
                    Location = new Point(18, 126),
                    Size = new Size(130, 36),
                    Variant = GlassButtonVariant.Ghost,
                    Radius = 6,
                    Font = FluentTheme.SubTextBold
                };
                btnCopy.Click += (s, e) =>
                {
                    Clipboard.SetText(sessionInfo.ActivationUrl);
                    btnCopy.Text = "✓ Tersalin!";
                };
                dlg.Controls.Add(btnCopy);

                var btnOpenAgain = new GlassButton
                {
                    Text = "Buka di Browser ➔",
                    Location = new Point(156, 126),
                    Size = new Size(150, 36),
                    Variant = GlassButtonVariant.Accent,
                    Radius = 6,
                    Font = FluentTheme.SubTextBold
                };
                btnOpenAgain.Click += (s, e) =>
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo { FileName = sessionInfo.ActivationUrl, UseShellExecute = true });
                    }
                    catch { }
                };
                dlg.Controls.Add(btnOpenAgain);

                var btnBatal = new GlassButton
                {
                    Text = "Batal",
                    Location = new Point(314, 126),
                    Size = new Size(114, 36),
                    Variant = GlassButtonVariant.Ghost,
                    Radius = 6,
                    Font = FluentTheme.SubTextBold
                };
                btnBatal.Click += (s, e) =>
                {
                    cts.Cancel();
                    dlg.Close();
                };
                dlg.Controls.Add(btnBatal);

                // Polling di background sambil modal dialog tampil
                var pollTask = manager.PollPairingSessionAsync(sessionInfo.SessionId, cts.Token);
                _ = pollTask.ContinueWith(t =>
                {
                    if (dlg.IsHandleCreated && !dlg.IsDisposed)
                    {
                        dlg.Invoke(new Action(() => dlg.Close()));
                    }
                });

                dlg.ShowDialog(this);

                string? token = await pollTask;
                if (!string.IsNullOrEmpty(token))
                {
                    ShowAlert("Perangkat berhasil terhubung via Web iDesk!", isError: false);
                    await Task.Delay(500);

                    RefreshDataState();
                    OnSessionChanged?.Invoke();
                }
                else
                {
                    ShowAlert("Aktivasi browser dibatalkan atau waktu telah kedaluwarsa.", isError: true);
                }
            }
            catch (Exception ex)
            {
                ShowAlert($"Gagal aktivasi via web: {ex.Message}", isError: true);
            }
            finally
            {
                _btnQuickWebConnect.Enabled = true;
                _btnQuickWebConnect.Text = "Hubungkan Sesi dari Browser Web ➔";
            }
        }

        private async Task HandleOpenWebWithSsoAsync()
        {
            _btnOpenWeb.Enabled = false;
            try
            {
                string id = _session?.EmployeeId ?? _session?.Email ?? "";
                if (!string.IsNullOrWhiteSpace(id))
                {
                    // Request One-Time Magic SSO Ticket to auto-login browser without asking credentials
                    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
                    // Desktop clients must never embed the server-to-server secret. The browser
                    // opens the regular iDesk login until a user-bound SSO exchange is available.
                    string finalUrl = _config.IdeskServerUrl;

                    try
                    {
                        AppLogger.Info("[SSO] Membuka iDesk tanpa embedded S2S credential");
                        var resp = new HttpResponseMessage(System.Net.HttpStatusCode.Unauthorized);
                        if (resp.IsSuccessStatusCode)
                        {
                            var resJson = await resp.Content.ReadAsStringAsync();
                            using var doc = JsonDocument.Parse(resJson);
                            if (doc.RootElement.TryGetProperty("ticket", out var tProp))
                            {
                                string ticket = tProp.GetString()!;
                                finalUrl = $"{_config.IdeskServerUrl}/v1/auth/autologin?ticket={ticket}&redirect=%2F";
                            }
                        }
                    }
                    catch { }

                    ToastNotifier.OpenUrlInBrowser(finalUrl);
                    return;
                }

                ToastNotifier.OpenUrlInBrowser(_config.IdeskServerUrl);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal membuka web with SSO", ex);
                ToastNotifier.OpenUrlInBrowser(_config.IdeskServerUrl);
            }
            finally
            {
                _btnOpenWeb.Enabled = true;
            }
        }

        private void OpenRemoteDeviceBrowser()
        {
            try
            {
                var browser = new RemoteDeviceBrowserForm(_config);
                browser.OnConnectRequested = (targetDev) =>
                {
                    // Initiating remote desktop session
                    browser.Close();
                    StartRemoteSession(targetDev);
                };
                browser.Show(this);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal membuka Remote Device Browser", ex);
                ShowAlert($"Gagal membuka browser perangkat: {ex.Message}", isError: true);
            }
        }

        private void StartRemoteSession(DeviceDirectoryItem targetDev)
        {
            try
            {
                ShowAlert($"Memulai koneksi Remote Desktop ke {targetDev.deviceName} ({targetDev.ipAddress})...", isError: false);
                // Engine viewer window will be instantiated in Phase 3
                var viewer = new RemoteViewerForm(_config, targetDev, TrayApplicationContext.Instance?.GetWebSocketClient());
                viewer.Show();
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal meluncurkan remote viewer", ex);
                ShowAlert($"Gagal memulai remote session: {ex.Message}", isError: true);
            }
        }

        private async Task DoLoginAsync()
        {
            if (_isAuthenticating) return;

            string nik = _txtNik.Text.Trim();
            string pass = _txtPassword.Text;

            if (string.IsNullOrWhiteSpace(nik) || string.IsNullOrWhiteSpace(pass))
            {
                ShowAlert("Harap masukkan NIK/Email dan Password.", isError: true);
                return;
            }

            SetLoginLoading(true, "Memvalidasi kredensial ke server Santos...");

            try
            {
                // Ensure best server is selected
                await _config.ProbeAndSetBestServerAsync();

                var manager = new DeviceActivationManager(_config.SjaServerUrl);
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));

                // Primary Attempt: Keycloak OAuth 2.0 / OIDC Identity Provider Token Exchange
                string? token = await manager.LoginKeycloakOidcAsync(_config.KeycloakServerUrl, nik, pass, cts.Token);

                // Fallback Attempt: Direct S2S login via iDesk IdP
                if (string.IsNullOrEmpty(token))
                {
                    token = await manager.LoginDirectAsync(nik, pass, cts.Token);
                }

                if (!string.IsNullOrEmpty(token))
                {
                    ShowAlert("Autentikasi OAuth 2.0 berhasil! Menghubungkan sesi...", isError: false);
                    await Task.Delay(500);

                    _txtPassword.Clear();
                    _pnlAlert.Visible = false;

                    RefreshDataState();
                    OnSessionChanged?.Invoke();
                }
                else
                {
                    ShowAlert("NIK atau Password tidak valid. Silakan periksa kembali.", isError: true);
                    _txtPassword.SelectAll();
                    _txtPassword.Focus();
                }
            }
            catch (Exception ex)
            {
                ShowAlert($"Gagal menghubungi server: {ex.Message}", isError: true);
            }
            finally
            {
                SetLoginLoading(false);
            }
        }

        private void SetLoginLoading(bool loading, string? message = null)
        {
            _isAuthenticating = loading;
            _btnLogin.Enabled = !loading;
            _txtNik.Enabled = !loading;
            _txtPassword.Enabled = !loading;
            _progressBar.Visible = loading;

            if (loading && message != null)
            {
                ShowAlert(message, isError: false);
            }
        }

        private void ShowAlert(string message, bool isError)
        {
            if (isError)
            {
                _pnlAlert.BackColor = Color.FromArgb(254, 242, 242);
                _alertBorderColor = Color.FromArgb(254, 202, 202);
                _lblAlertText.ForeColor = Color.FromArgb(220, 38, 38);
                _lblAlertText.Text = "⚠ " + message;
            }
            else
            {
                _pnlAlert.BackColor = Color.FromArgb(239, 246, 255);
                _alertBorderColor = Color.FromArgb(191, 219, 254);
                _lblAlertText.ForeColor = Color.FromArgb(30, 64, 175);
                _lblAlertText.Text = "⏳ " + message;
            }
            _pnlAlert.Visible = true;
            _pnlAlert.Invalidate();
        }

        private void HandleLogoutAction()
        {
            var confirm = MessageBox.Show(
                "Apakah Anda yakin ingin keluar dari akun ini di SJA Notifier?\n\nAplikasi akan tetap standby di latar belakang dan dapat login kembali kapan saja.",
                "Konfirmasi Logout",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );

            if (confirm == DialogResult.Yes)
            {
                TrayApplicationContext.Instance?.LogoutCurrentSession();
                RefreshDataState();
                OnSessionChanged?.Invoke();
            }
        }

        public void UpdateConnectionState(bool connected)
        {
            _isConnected = connected;
            if (InvokeRequired)
            {
                Invoke(new Action(RefreshDataState));
            }
            else
            {
                RefreshDataState();
            }
        }

        public void RefreshDataState()
        {
            if (InvokeRequired)
            {
                Invoke(new Action(RefreshDataState));
                return;
            }

            if (!_isPreviewMode)
            {
                _session = DeviceSecurityStorage.LoadSession();
            }
            bool hasSession = _session != null && !string.IsNullOrWhiteSpace(_session.Token);

            // 1. Redraw Header Gateway Pill
            _pnlGatewayPill.Invalidate();

            // 2. Switch Views
            if (hasSession)
            {
                _pnlLoginView.Visible = false;
                _pnlDashboardView.Visible = true;
                _pnlDashboardView.BringToFront();
                AcceptButton = _btnOpenWeb;

                _lblUserName.Text = !string.IsNullOrWhiteSpace(_session!.FullName) ? _session.FullName : "Karyawan Santos";
                string n = !string.IsNullOrWhiteSpace(_session.EmployeeId) ? _session.EmployeeId : _session.Email;
                _lblUserDetail.Text = $"{n} • {Environment.MachineName}";
                _lblSiteBadge.Text = !string.IsNullOrWhiteSpace(_session.SiteCode) ? _session.SiteCode : "SPJ";

                if (_isConnected)
                {
                    _lblDashGatewayStatus.Text = "Gateway SJA: Terhubung (Real-Time WSS Aktif)";
                    _lblDashGatewayStatus.ForeColor = FluentTheme.IsDarkTheme ? Color.FromArgb(52, 211, 153) : Color.FromArgb(5, 150, 105);
                }
                else
                {
                    _lblDashGatewayStatus.Text = "Gateway SJA: Terputus (Menghubungkan...)";
                    _lblDashGatewayStatus.ForeColor = FluentTheme.IsDarkTheme ? Color.FromArgb(248, 113, 113) : Color.FromArgb(220, 38, 38);
                }

                _picAvatar.Invalidate();
                _pnlDashDot.Invalidate();
            }
            else
            {
                _pnlDashboardView.Visible = false;
                _pnlLoginView.Visible = true;
                _pnlLoginView.BringToFront();
                AcceptButton = _btnLogin;

                _txtPassword.Clear();
                if (!_isPreviewMode)
                {
                    _txtNik.Focus();
                }
            }
        }

        public void PreviewState(string mode)
        {
            if (InvokeRequired)
            {
                Invoke(new Action(() => PreviewState(mode)));
                return;
            }

            _isPreviewMode = true;
            if (string.Equals(mode, "dashboard", StringComparison.OrdinalIgnoreCase))
            {
                _session = new UserProfileSession
                {
                    EmployeeId = "00061058",
                    FullName = "RM BAGASTYO ANGGORO INDRASTOTO",
                    Email = "bagastyo.indrastoto@kapalapi.co.id",
                    SiteCode = "SPJ",
                    Token = "preview_valid_session_token_2026"
                };
                _isConnected = true;
            }
            else
            {
                _session = null;
                _isConnected = false;
            }

            RefreshDataState();
        }

        private Image LoadSantosLogo()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string path = Path.Combine(baseDir, "assets", "santos-logo.png");
                if (File.Exists(path))
                {
                    return Image.FromFile(path);
                }
            }
            catch { }

            var bmp = new Bitmap(40, 40);
            using var g = Graphics.FromImage(bmp);
            using var b = new SolidBrush(FluentTheme.NavyBrand);
            g.FillEllipse(b, 0, 0, 39, 39);
            return bmp;
        }
        #endregion
    }
}
