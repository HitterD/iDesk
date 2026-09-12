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
        private Action? _themeChangedHandler;
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

        // Header Controls
        private Label _lblBrand = null!;
        private Label _lblSuite = null!;

        // Dashboard View Controls
        private Panel _pnlProfileCard = null!;
        private PictureBox _picAvatar = null!;
        private Label _lblUserName = null!;
        private Label _lblUserDetail = null!;
        private Label _lblSiteBadge = null!;
        private Label _lblDashGatewayStatus = null!;
        private Panel _pnlDashDot = null!;
        private TableLayoutPanel _tblActions = null!;
        private Panel _pnlWebHeroCard = null!;
        private TableLayoutPanel _tblBentoCards = null!;
        private Panel _pnlTestBentoCard = null!;
        private Panel _pnlRemoteBentoCard = null!;
        private Panel _pnlRail = null!;
        private Panel _pnlViewsContainer = null!;
        private Panel _pnlHomeTab = null!;
        private HistoryControlPanel? _pnlHistoryTab;
        private SettingsControlPanel? _pnlSettingsTab;
        private GlassButton _btnGear = null!;
        private GlassButton _btnThemeToggle = null!;
        private Panel _pnlRailProfile = null!;
        private ContextMenuStrip? _profileContextMenu;
        private string _currentNavTab = "home"; // "home" | "history" | "settings"
        private readonly System.Collections.Generic.Dictionary<string, Panel> _navButtons = new();
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
            _themeChangedHandler = OnThemeChangedSafe;
            FluentTheme.ThemeChanged += _themeChangedHandler;
            RefreshDataState();
        }

        /// <summary>
        /// Handler tema yang aman: abaikan event bila form sudah dilepas agar tidak melempar ObjectDisposedException.
        /// </summary>
        private void OnThemeChangedSafe()
        {
            if (IsDisposed || Disposing || !IsHandleCreated) return;
            try
            {
                if (InvokeRequired) BeginInvoke(new Action(ApplyTheme));
                else ApplyTheme();
            }
            catch (ObjectDisposedException) { }
            catch (InvalidOperationException) { }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            if (_themeChangedHandler != null)
            {
                FluentTheme.ThemeChanged -= _themeChangedHandler;
                _themeChangedHandler = null;
            }
            base.OnFormClosed(e);
        }

        private void ApplyTheme()
        {
            _acrylicActive = FluentTheme.TryApplyDarkAcrylic(Handle);
            BackColor = FluentTheme.ThemeCanvasBottom;
            ForeColor = FluentTheme.ThemeTextPrimary;

            if (_lblBrand != null) _lblBrand.ForeColor = FluentTheme.ThemeTextSecondary;
            if (_lblSuite != null) _lblSuite.ForeColor = FluentTheme.ThemeTextPrimary;
            if (_lblUserName != null) _lblUserName.ForeColor = FluentTheme.ThemeTextPrimary;
            if (_lblUserDetail != null) _lblUserDetail.ForeColor = FluentTheme.ThemeTextSecondary;
            if (_lblSiteBadge != null)
            {
                _lblSiteBadge.ForeColor = FluentTheme.IsDarkTheme ? Color.FromArgb(147, 197, 253) : Color.FromArgb(71, 85, 105);
                _lblSiteBadge.BackColor = FluentTheme.IsDarkTheme ? Color.FromArgb(38, 38, 44) : Color.FromArgb(241, 245, 249);
            }

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

            ApplyThemeToControls(this);
            Invalidate(true);
        }

        private void ApplyThemeToControls(Control parent)
        {
            foreach (Control c in parent.Controls)
            {
                if (c is Label lbl && c != _lblSiteBadge && c != _lblDashGatewayStatus)
                {
                    if (lbl == _lblBrand) lbl.ForeColor = FluentTheme.ThemeTextSecondary;
                    else if (lbl == _lblUserDetail) lbl.ForeColor = FluentTheme.ThemeTextSecondary;
                    else if (lbl.ForeColor.A != 0 && (lbl.ForeColor == Color.White || lbl.ForeColor == Color.FromArgb(245, 245, 247) || lbl.ForeColor == Color.FromArgb(29, 29, 31) || lbl.ForeColor == Color.FromArgb(15, 23, 42)))
                    {
                        lbl.ForeColor = FluentTheme.ThemeTextPrimary;
                    }
                }
                else if (c is TextBox tb)
                {
                    tb.BackColor = FluentTheme.ThemeInputWell;
                    tb.ForeColor = FluentTheme.ThemeTextPrimary;
                }

                if (c.HasChildren)
                {
                    ApplyThemeToControls(c);
                }
            }
        }

        private void InitializeComponent()
        {
            Text = "SJA Notification Center • PT Santos Jaya Abadi";
            Size = new Size(860, 620);
            MinimumSize = new Size(800, 580);
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

            // Root Canvas Container with Apple frosted clean canvas and subtle hairline edge
            var pnlCanvas = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(16, 12, 16, 14),
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
                Height = 52,
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
                Size = new Size(34, 34),
                Location = new Point(2, 8),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = LoadSantosLogo()
            };
            picLogo.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(picLogo);

            _lblBrand = new Label
            {
                Text = "PT Santos Jaya Abadi",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(44, 7),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _lblBrand.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(_lblBrand);

            _lblSuite = new Label
            {
                Text = "SJA Notification Suite",
                Font = FluentTheme.GetFont(11.5F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(44, 22),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _lblSuite.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(_lblSuite);

            // Window Controls (Close, Min, Gear, Theme Toggle) - Clean Apple/Windows Hybrid Style
            _btnClose = new GlassButton
            {
                Size = new Size(30, 30),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "close",
                Radius = 8,
                Cursor = Cursors.Hand
            };
            _btnClose.Click += (s, e) => Close();
            _pnlHeader.Controls.Add(_btnClose);

            _btnMin = new GlassButton
            {
                Size = new Size(30, 30),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "minimize",
                Radius = 8,
                Cursor = Cursors.Hand
            };
            _btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;
            _pnlHeader.Controls.Add(_btnMin);

            _btnThemeToggle = new GlassButton
            {
                Size = new Size(30, 30),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = FluentTheme.IsDarkTheme ? "sun" : "moon",
                Radius = 8,
                Cursor = Cursors.Hand
            };
            var themeTip = new ToolTip();
            themeTip.SetToolTip(_btnThemeToggle, "Ganti Tema (Terang / Gelap)");
            _btnThemeToggle.Click += (s, e) =>
            {
                bool nextDark = !FluentTheme.IsDarkTheme;
                string newMode = nextDark ? "dark" : "light";
                _config.ThemeMode = newMode;
                _config.Save();
                FluentTheme.SetThemeMode(newMode);
                _btnThemeToggle.Glyph = nextDark ? "sun" : "moon";
                _btnThemeToggle.Invalidate();
            };
            _pnlHeader.Controls.Add(_btnThemeToggle);

            _btnGear = new GlassButton
            {
                Size = new Size(30, 30),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "settings",
                Radius = 8,
                Cursor = Cursors.Hand
            };
            var gearTip = new ToolTip();
            gearTip.SetToolTip(_btnGear, "Buka Pengaturan & Preferensi");
            _btnGear.Click += (s, e) =>
            {
                SwitchNavTab("settings");
            };
            _pnlHeader.Controls.Add(_btnGear);

            // Gateway Live Status Capsule (Top Right)
            _pnlGatewayPill = new Panel
            {
                Size = new Size(142, 26),
                BackColor = Color.Transparent
            };
            _pnlGatewayPill.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
                var rect = new Rectangle(0, 0, _pnlGatewayPill.Width - 1, _pnlGatewayPill.Height - 1);

                bool dark = FluentTheme.IsDarkTheme;
                Color bg = _isConnected
                    ? (dark ? Color.FromArgb(20, 52, 199, 89) : Color.FromArgb(236, 253, 245))
                    : (dark ? Color.FromArgb(24, 255, 59, 48) : Color.FromArgb(254, 242, 242));
                Color border = _isConnected
                    ? (dark ? Color.FromArgb(50, 52, 199, 89) : Color.FromArgb(187, 247, 208))
                    : (dark ? Color.FromArgb(60, 255, 59, 48) : Color.FromArgb(254, 202, 202));
                Color dotColor = _isConnected ? FluentTheme.StatusOnline : FluentTheme.StatusOffline;
                Color textColor = _isConnected
                    ? (dark ? Color.FromArgb(52, 211, 153) : Color.FromArgb(5, 150, 105))
                    : (dark ? Color.FromArgb(248, 113, 113) : Color.FromArgb(220, 38, 38));
                string text = _isConnected ? "Gateway Online" : "Gateway Offline";

                using (var brush = new SolidBrush(bg))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 13);
                }
                using (var pen = new Pen(border, 1f))
                {
                    FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 13);
                }

                using (var dotBrush = new SolidBrush(dotColor))
                {
                    e.Graphics.FillEllipse(dotBrush, 10, (_pnlGatewayPill.Height - 8) / 2, 8, 8);
                }
                using (var textBrush = new SolidBrush(textColor))
                using (var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap })
                {
                    e.Graphics.DrawString(text, FluentTheme.CaptionBold, textBrush, new RectangleF(24, 0, _pnlGatewayPill.Width - 26, _pnlGatewayPill.Height), sf);
                }
            };
            _pnlHeader.Controls.Add(_pnlGatewayPill);

            _pnlHeader.Resize += (s, e) =>
            {
                int r = _pnlHeader.ClientSize.Width;
                _btnClose.Location = new Point(r - _btnClose.Width, 11);
                _btnMin.Location = new Point(_btnClose.Left - _btnMin.Width - 4, 11);
                _btnThemeToggle.Location = new Point(_btnMin.Left - _btnThemeToggle.Width - 4, 11);
                _btnGear.Location = new Point(_btnThemeToggle.Left - _btnGear.Width - 4, 11);
                _pnlGatewayPill.Location = new Point(_btnGear.Left - _pnlGatewayPill.Width - 10, 13);
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

        #region Login View Builder (Centered Apple Account Card)
        private Panel BuildLoginView()
        {
            var pnl = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0)
            };

            // Centered Floating Card (Apple Account Style)
            var pnlLoginCard = new Panel
            {
                Size = new Size(460, 500),
                BackColor = Color.Transparent,
                Padding = new Padding(24, 20, 24, 18)
            };
            pnlLoginCard.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, pnlLoginCard.ClientRectangle, 16, drawShadow: true);
            };
            pnl.Controls.Add(pnlLoginCard);

            int y = 14;

            // 1. Header: Santos squircle icon badge & typography
            var picLogo = new PictureBox
            {
                Size = new Size(40, 40),
                Location = new Point((pnlLoginCard.Width - 40) / 2, y),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = LoadSantosLogo(),
                BackColor = Color.Transparent
            };
            pnlLoginCard.Controls.Add(picLogo);

            y += 46;
            var lblTitle = new Label
            {
                Text = "Masuk ke iDesk Suite",
                Font = FluentTheme.GetFont(13F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(412, 24),
                Location = new Point(24, y),
                BackColor = Color.Transparent
            };
            pnlLoginCard.Controls.Add(lblTitle);

            y += 24;
            var lblSub = new Label
            {
                Text = "Pemberitahuan & Layanan Mandiri Karyawan Santos",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(412, 18),
                Location = new Point(24, y),
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            pnlLoginCard.Controls.Add(lblSub);

            y += 28;

            // 2. Option 1: Instant Web Connect Hero Card
            _pnlWebQuickCard = new Panel
            {
                Location = new Point(24, y),
                Size = new Size(412, 68),
                BackColor = Color.Transparent,
                Padding = new Padding(12, 8, 12, 8)
            };
            _pnlWebQuickCard.Paint += (s, e) =>
            {
                bool dark = FluentTheme.IsDarkTheme;
                Color fill = dark ? Color.FromArgb(28, 38, 54) : Color.FromArgb(240, 246, 255);
                Color border = dark ? Color.FromArgb(50, 80, 130) : Color.FromArgb(205, 226, 255);
                FluentTheme.PaintGlassCard(e.Graphics, _pnlWebQuickCard.ClientRectangle, 10, fill, border);
            };

            var lblWebPrompt = new Label
            {
                Text = "Koneksi Cepat Sesi Web iDesk",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeAccentText,
                Location = new Point(12, 8),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlWebQuickCard.Controls.Add(lblWebPrompt);

            _btnQuickWebConnect = new GlassButton
            {
                Location = new Point(12, 28),
                Size = new Size(388, 32),
                Text = "Hubungkan Sesi dari Browser ➔",
                Variant = GlassButtonVariant.Accent,
                Glyph = "browser",
                Radius = 7,
                Font = FluentTheme.CaptionBold
            };
            _btnQuickWebConnect.Click += async (s, e) => await HandleQuickWebConnectAsync();
            _pnlWebQuickCard.Controls.Add(_btnQuickWebConnect);

            pnlLoginCard.Controls.Add(_pnlWebQuickCard);

            y += 76;

            // 3. Section Divider
            var pnlDivider = new Panel
            {
                Location = new Point(24, y),
                Size = new Size(412, 18),
                BackColor = Color.Transparent
            };
            pnlDivider.Paint += (s, e) =>
            {
                int midY = pnlDivider.Height / 2;
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 0, midY, pnlDivider.Width, midY);

                string text = "ATAU MASUK MANUAL DENGAN NIK";
                using var font = FluentTheme.CaptionBold;
                using var textBrush = new SolidBrush(FluentTheme.ThemeTextMuted);
                using var bgBrush = new SolidBrush(FluentTheme.ThemeCardFill);
                var size = e.Graphics.MeasureString(text, font);
                float tx = (pnlDivider.Width - size.Width) / 2;
                e.Graphics.FillRectangle(bgBrush, tx - 8, 0, size.Width + 16, pnlDivider.Height);
                e.Graphics.DrawString(text, font, textBrush, tx, (pnlDivider.Height - size.Height) / 2);
            };
            pnlLoginCard.Controls.Add(pnlDivider);

            y += 24;

            // 4. Manual NIK Field
            var lblNik = new Label
            {
                Text = "NIK atau Email Karyawan Santos:",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(24, y),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlLoginCard.Controls.Add(lblNik);

            y += 18;
            _pnlNikBox = new Panel
            {
                Location = new Point(24, y),
                Size = new Size(412, 34),
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
                Location = new Point(10, 8),
                Size = new Size(412 - 20, 18),
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.GetFont(9.5F, FontStyle.Regular),
                ForeColor = FluentTheme.ThemeTextPrimary,
                PlaceholderText = "Contoh: 00061058 atau user.spj@idesk.com"
            };
            _txtNik.Enter += (s, e) => { _nikFocused = true; _pnlNikBox.Invalidate(); };
            _txtNik.Leave += (s, e) => { _nikFocused = false; _pnlNikBox.Invalidate(); };
            _pnlNikBox.Click += (s, e) => _txtNik.Focus();
            _pnlNikBox.Controls.Add(_txtNik);
            pnlLoginCard.Controls.Add(_pnlNikBox);

            y += 40;

            // 5. Password Field
            var lblPass = new Label
            {
                Text = "Kata Sandi Akun (iDesk / HRIS):",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(24, y),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlLoginCard.Controls.Add(lblPass);

            y += 18;
            _pnlPassBox = new Panel
            {
                Location = new Point(24, y),
                Size = new Size(412, 34),
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
                Location = new Point(10, 8),
                Size = new Size(412 - 70, 18),
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.GetFont(10F, FontStyle.Regular),
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
                Location = new Point(412 - 54, 4),
                Size = new Size(50, 26),
                Text = "Lihat",
                Variant = GlassButtonVariant.Ghost,
                Font = FluentTheme.CaptionBold,
                Radius = 6
            };
            _btnTogglePass.Click += (s, e) => TogglePasswordVisibility();
            _pnlPassBox.Controls.Add(_btnTogglePass);
            pnlLoginCard.Controls.Add(_pnlPassBox);

            y += 40;

            // 6. Alert Banner & Progress Bar
            _pnlAlert = new Panel
            {
                Location = new Point(24, y),
                Size = new Size(412, 28),
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
                Font = FluentTheme.CaptionBold,
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlAlert.Controls.Add(_lblAlertText);
            pnlLoginCard.Controls.Add(_pnlAlert);

            _progressBar = new ProgressBar
            {
                Location = new Point(24, y + 2),
                Size = new Size(412, 3),
                Style = ProgressBarStyle.Marquee,
                Visible = false
            };
            pnlLoginCard.Controls.Add(_progressBar);

            y += 32;

            // 7. CTA Primary Button
            _btnLogin = new GlassButton
            {
                Location = new Point(24, y),
                Size = new Size(412, 38),
                Text = "Masuk & Hubungkan Perangkat ➔",
                Variant = GlassButtonVariant.Accent,
                Radius = 8,
                Font = FluentTheme.SubTextBold
            };
            _btnLogin.Click += async (s, e) => await DoLoginAsync();
            pnlLoginCard.Controls.Add(_btnLogin);

            y += 44;

            // 8. Security Note Card
            _pnlNote = new Panel
            {
                Location = new Point(24, y),
                Size = new Size(412, 26),
                BackColor = Color.Transparent
            };

            var lblNote = new Label
            {
                Dock = DockStyle.Fill,
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextMuted,
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.Transparent,
                Text = "🔒 Terenkripsi dengan Windows DPAPI di komputer ini.",
                UseMnemonic = false
            };
            _pnlNote.Controls.Add(lblNote);
            pnlLoginCard.Controls.Add(_pnlNote);

            // Responsive Layout: Centering Login Card on Canvas
            pnl.Resize += (s, e) =>
            {
                int cw = pnl.ClientSize.Width;
                int ch = pnl.ClientSize.Height;
                if (cw <= 0 || ch <= 0) return;

                int cardW = Math.Min(460, cw - 20);
                int cardH = Math.Min(504, ch - 12);
                pnlLoginCard.Size = new Size(cardW, cardH);
                pnlLoginCard.Location = new Point((cw - cardW) / 2, Math.Max(4, (ch - cardH) / 2));

                int innerW = cardW - 48;
                if (innerW <= 0) return;

                picLogo.Left = (cardW - picLogo.Width) / 2;
                lblTitle.Width = innerW;
                lblTitle.Left = 24;
                lblSub.Width = innerW;
                lblSub.Left = 24;

                _pnlWebQuickCard.Width = innerW;
                _btnQuickWebConnect.Width = innerW - 24;
                pnlDivider.Width = innerW;
                _pnlNikBox.Width = innerW;
                _txtNik.Width = innerW - 20;
                _pnlPassBox.Width = innerW;
                _txtPassword.Width = innerW - 70;
                _btnTogglePass.Left = innerW - 54;
                _pnlAlert.Width = innerW;
                _progressBar.Width = innerW;
                _btnLogin.Width = innerW;
                _pnlNote.Width = innerW;
            };

            return pnl;
        }
        #endregion

        #region Dashboard View Builder (macOS Two-Column Sidebar + Apple Bento Grid Hub)
        private Panel BuildDashboardView()
        {
            var pnl = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0)
            };

            // 1. LEFT NAVIGATION SIDEBAR (macOS Two-Column Style: 194px width)
            _pnlRail = new Panel
            {
                Dock = DockStyle.Left,
                Width = 194,
                BackColor = Color.Transparent,
                Padding = new Padding(6, 10, 6, 10)
            };
            _pnlRail.Paint += (s, e) =>
            {
                bool dark = FluentTheme.IsDarkTheme;
                Color sidebarBg = dark ? Color.FromArgb(24, 24, 26) : Color.FromArgb(242, 242, 245);
                using (var brush = new SolidBrush(sidebarBg))
                {
                    e.Graphics.FillRectangle(brush, 0, 0, _pnlRail.Width, _pnlRail.Height);
                }
                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(p, _pnlRail.Width - 1, 0, _pnlRail.Width - 1, _pnlRail.Height);
            };

            // Rail Profile Button at Bottom (Apple Inset Profile Card)
            _pnlRailProfile = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 52,
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand
            };
            bool profileHover = false;
            _pnlRailProfile.MouseEnter += (s, e) => { profileHover = true; _pnlRailProfile.Invalidate(); };
            _pnlRailProfile.MouseLeave += (s, e) => { profileHover = false; _pnlRailProfile.Invalidate(); };
            _pnlRailProfile.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                var bounds = new Rectangle(4, 2, _pnlRailProfile.Width - 9, _pnlRailProfile.Height - 5);
                if (profileHover)
                {
                    using var hoverBrush = new SolidBrush(FluentTheme.ThemeMenuHover);
                    FluentTheme.FillRoundedRectangle(e.Graphics, hoverBrush, bounds, 8);
                }

                var activeP = ProfileStore.Instance.GetActiveProfile();
                Color avatarColor = ColorTranslator.FromHtml(activeP.AvatarColorHex ?? "#0071E3");
                var rAvatar = new Rectangle(10, 10, 32, 32);
                using (var b = new SolidBrush(avatarColor))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, rAvatar, 10);
                }
                using (var p = new Pen(Color.FromArgb(40, 255, 255, 255), 1f))
                {
                    FluentTheme.DrawRoundedRectangle(e.Graphics, p, rAvatar, 10);
                }

                string initial = !string.IsNullOrWhiteSpace(activeP.Name) ? activeP.Name.Substring(0, 1).ToUpper() : "P";
                using var font = FluentTheme.GetFont(10F, FontStyle.Bold);
                using var textBrush = new SolidBrush(Color.White);
                using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(initial, font, textBrush, new RectangleF(10, 10, 32, 32), sf);

                string displayName = !string.IsNullOrWhiteSpace(activeP.Name) ? activeP.Name : "Profil Pengguna";
                using var nameFont = FluentTheme.GetFont(8.5F, FontStyle.Bold);
                using var nameBrush = new SolidBrush(FluentTheme.ThemeTextPrimary);
                using var sfLeft = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString(displayName, nameFont, nameBrush, new RectangleF(48, 9, _pnlRailProfile.Width - 54, 16), sfLeft);

                using var subFont = FluentTheme.Caption;
                using var subBrush = new SolidBrush(FluentTheme.ThemeTextMuted);
                e.Graphics.DrawString("Ganti Profil ▾", subFont, subBrush, new RectangleF(48, 25, _pnlRailProfile.Width - 54, 14), sfLeft);
            };
            _pnlRailProfile.Click += (s, e) => ShowProfileSwitcherFlyout(_pnlRailProfile);
            _pnlRail.Controls.Add(_pnlRailProfile);

            // Rail Navigation Buttons (Horizontal macOS Rows)
            int railY = 8;
            AddRailNavButton("home", "Beranda", "home", ref railY, () => SwitchNavTab("home"));
            AddRailNavButton("history", "Riwayat", "history", ref railY, () => SwitchNavTab("history"));
            AddRailNavButton("remote", "Remote", "remote", ref railY, () =>
            {
                var curSession = DeviceSecurityStorage.LoadSession();
                if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
                {
                    ShowAlert("Fitur Remote Desktop hanya dapat diakses akun berhak akses Admin / Agent.", isError: true);
                    return;
                }
                OpenRemoteDeviceBrowser();
            });
            AddRailNavButton("settings", "Setelan", "settings", ref railY, () => SwitchNavTab("settings"));
            AddRailNavButton("portal", "iDesk", "idesk", ref railY, async () => await HandleOpenWebWithSsoAsync());

            pnl.Controls.Add(_pnlRail);

            // 2. MAIN VIEWS CONTAINER (Apple Content Canvas)
            _pnlViewsContainer = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(18, 6, 18, 12)
            };

            // Build Page 1: Home Tab
            _pnlHomeTab = BuildHomeTab();
            _pnlViewsContainer.Controls.Add(_pnlHomeTab);

            pnl.Controls.Add(_pnlViewsContainer);
            _pnlViewsContainer.BringToFront();

            return pnl;
        }

        private void AddRailNavButton(string key, string label, string icon, ref int y, Action onClick)
        {
            var btnPnl = new Panel
            {
                Location = new Point(6, y),
                Size = new Size(182, 36),
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand
            };

            bool isHover = false;
            btnPnl.MouseEnter += (s, e) => { isHover = true; btnPnl.Invalidate(); };
            btnPnl.MouseLeave += (s, e) => { isHover = false; btnPnl.Invalidate(); };

            btnPnl.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
                bool isSelected = _currentNavTab == key;
                var r = new Rectangle(0, 0, btnPnl.Width - 1, btnPnl.Height - 1);

                if (isSelected)
                {
                    using var b = new SolidBrush(FluentTheme.ThemeAccentSoft);
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, r, 8);
                }
                else if (isHover)
                {
                    using var b = new SolidBrush(FluentTheme.ThemeMenuHover);
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, r, 8);
                }

                Color itemColor = isSelected ? FluentTheme.ThemeAccentText : (isHover ? FluentTheme.ThemeTextPrimary : FluentTheme.ThemeTextSecondary);
                using (var ico = FluentTheme.GetMenuIcon(icon, itemColor, 18))
                {
                    e.Graphics.DrawImage(ico, 12, (btnPnl.Height - 18) / 2);
                }

                using var font = FluentTheme.GetFont(9F, isSelected ? FontStyle.Bold : FontStyle.Regular);
                using var textBrush = new SolidBrush(itemColor);
                using var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString(label, font, textBrush, new RectangleF(38, 0, btnPnl.Width - 42, btnPnl.Height), sf);
            };

            btnPnl.Click += (s, e) => onClick();
            _navButtons[key] = btnPnl;
            _pnlRail.Controls.Add(btnPnl);
            y += 40;
        }

        private Panel BuildHomeTab()
        {
            var pnl = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0)
            };

            int y = 4;

            // ================= 1. EMPLOYEE IDENTITY CARD (APPLE BENTO CARD) =================
            _pnlProfileCard = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(pnl.ClientSize.Width > 0 ? pnl.ClientSize.Width : 620, 102),
                BackColor = Color.Transparent,
                Padding = new Padding(16, 12, 16, 12)
            };
            _pnlProfileCard.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, _pnlProfileCard.ClientRectangle, 14, drawShadow: true);
                using var divPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(divPen, 16, 66, _pnlProfileCard.Width - 16, 66);
            };

            _picAvatar = new PictureBox
            {
                Size = new Size(40, 40),
                Location = new Point(16, 14),
                BackColor = Color.Transparent
            };
            _picAvatar.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, _picAvatar.Width - 1, _picAvatar.Height - 1);
                using var b = new SolidBrush(FluentTheme.ThemeAccentSoft);
                FluentTheme.FillRoundedRectangle(e.Graphics, b, r, 12);

                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 12);

                string initial = !string.IsNullOrWhiteSpace(_session?.FullName)
                    ? _session.FullName.Substring(0, 1).ToUpper()
                    : "S";
                using var font = FluentTheme.GetFont(11.5F, FontStyle.Bold);
                using var textBrush = new SolidBrush(FluentTheme.ThemeAccentText);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(initial, font, textBrush, new RectangleF(0, 0, 40, 40), sf);
            };
            _pnlProfileCard.Controls.Add(_picAvatar);

            _lblUserName = new Label
            {
                Text = "Karyawan Santos",
                Font = FluentTheme.GetFont(12F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(66, 11),
                Size = new Size(360, 26),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlProfileCard.Controls.Add(_lblUserName);

            _lblUserDetail = new Label
            {
                Text = "00000000 • PC-NAME",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(66, 38),
                Size = new Size(360, 20),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlProfileCard.Controls.Add(_lblUserDetail);

            _lblSiteBadge = new Label
            {
                Text = "SPJ",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.IsDarkTheme ? Color.FromArgb(147, 197, 253) : Color.FromArgb(71, 85, 105),
                BackColor = FluentTheme.IsDarkTheme ? Color.FromArgb(38, 38, 44) : Color.FromArgb(241, 245, 249),
                Location = new Point(_pnlProfileCard.Width - 58, 14),
                Size = new Size(44, 22),
                TextAlign = ContentAlignment.MiddleCenter
            };
            _lblSiteBadge.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, _lblSiteBadge.Width - 1, _lblSiteBadge.Height - 1);
                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 11);
            };
            _pnlProfileCard.Controls.Add(_lblSiteBadge);

            _pnlDashDot = new Panel
            {
                Size = new Size(14, 14),
                Location = new Point(16, 75),
                BackColor = Color.Transparent
            };
            _pnlDashDot.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Color dotColor = _isConnected ? FluentTheme.StatusOnline : FluentTheme.StatusOffline;
                using var b = new SolidBrush(dotColor);
                e.Graphics.FillEllipse(b, 3, 3, 8, 8);
            };
            _pnlProfileCard.Controls.Add(_pnlDashDot);

            _lblDashGatewayStatus = new Label
            {
                Text = "Memeriksa status gateway...",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(34, 74),
                Size = new Size(480, 18),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            _pnlProfileCard.Controls.Add(_lblDashGatewayStatus);

            pnl.Controls.Add(_pnlProfileCard);

            y += 114;

            // ================= 2. HERO BENTO TILE: WEB PORTAL IDESK =================
            _pnlWebHeroCard = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(pnl.ClientSize.Width > 0 ? pnl.ClientSize.Width : 620, 84),
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand
            };
            bool heroHover = false;
            bool heroPressed = false;
            _pnlWebHeroCard.MouseEnter += (s, e) => { heroHover = true; _pnlWebHeroCard.Invalidate(); };
            _pnlWebHeroCard.MouseLeave += (s, e) => { heroHover = false; heroPressed = false; _pnlWebHeroCard.Invalidate(); };
            _pnlWebHeroCard.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { heroPressed = true; _pnlWebHeroCard.Invalidate(); } };
            _pnlWebHeroCard.MouseUp += (s, e) => { if (heroPressed) { heroPressed = false; _pnlWebHeroCard.Invalidate(); } };

            _pnlWebHeroCard.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                var cardBounds = _pnlWebHeroCard.ClientRectangle;
                if (heroPressed)
                {
                    cardBounds.Inflate(-1, -1);
                }

                Color cardBorder = heroHover ? FluentTheme.ThemeAccent : FluentTheme.ThemeCardHairline;
                Color cardFill = heroHover ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                FluentTheme.PaintGlassCard(e.Graphics, cardBounds, 14, fill: cardFill, hairline: cardBorder, drawShadow: true);

                // Cupertino Blue squircle icon badge
                var badgeRect = new Rectangle(cardBounds.X + 16, cardBounds.Y + 22, 40, 40);
                using (var brush = new SolidBrush(FluentTheme.ThemeAccent))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, badgeRect, 11);
                }
                using (var ico = FluentTheme.GetMenuIcon("portal", Color.White, 20))
                {
                    e.Graphics.DrawImage(ico, badgeRect.X + (40 - 20) / 2, badgeRect.Y + (40 - 20) / 2);
                }

                // Title & Subtitle
                using var titleFont = FluentTheme.GetFont(11F, FontStyle.Bold);
                using var titleBrush = new SolidBrush(FluentTheme.ThemeTextPrimary);
                e.Graphics.DrawString("Portal Web iDesk", titleFont, titleBrush, new PointF(cardBounds.X + 68, cardBounds.Y + 20));

                using var subFont = FluentTheme.SubText;
                using var subBrush = new SolidBrush(FluentTheme.ThemeTextSecondary);
                int maxSubW = _btnOpenWeb != null ? _btnOpenWeb.Left - 78 : _pnlWebHeroCard.Width - 190;
                using var sfSub = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString("Akses tiket, e-form, dan layanan iDesk lengkap di browser.", subFont, subBrush, new RectangleF(cardBounds.X + 68, cardBounds.Y + 44, maxSubW > 100 ? maxSubW : 300, 20), sfSub);
            };
            _pnlWebHeroCard.Click += async (s, e) => await HandleOpenWebWithSsoAsync();

            _btnOpenWeb = new GlassButton
            {
                Size = new Size(106, 32),
                Location = new Point(_pnlWebHeroCard.Width - 122, 26),
                Text = "Buka ➔",
                Variant = GlassButtonVariant.Ghost,
                Radius = 16,
                Font = FluentTheme.CaptionBold
            };
            _btnOpenWeb.Click += async (s, e) => await HandleOpenWebWithSsoAsync();
            _pnlWebHeroCard.Controls.Add(_btnOpenWeb);

            pnl.Controls.Add(_pnlWebHeroCard);

            y += 94;

            // ================= 3. TWO BENTO ACTION TILES (ROW 2) =================
            _tblBentoCards = new TableLayoutPanel
            {
                Location = new Point(0, y),
                Size = new Size(pnl.ClientSize.Width > 0 ? pnl.ClientSize.Width : 620, 88),
                ColumnCount = 2,
                RowCount = 1,
                BackColor = Color.Transparent,
                Margin = new Padding(0),
                Padding = new Padding(0)
            };
            _tblBentoCards.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            _tblBentoCards.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));

            // 3a. Uji Notifikasi Bento Tile
            _pnlTestBentoCard = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Margin = new Padding(0, 0, 6, 0),
                Cursor = Cursors.Hand
            };
            bool testHover = false;
            bool testPressed = false;
            _pnlTestBentoCard.MouseEnter += (s, e) => { testHover = true; _pnlTestBentoCard.Invalidate(); };
            _pnlTestBentoCard.MouseLeave += (s, e) => { testHover = false; testPressed = false; _pnlTestBentoCard.Invalidate(); };
            _pnlTestBentoCard.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { testPressed = true; _pnlTestBentoCard.Invalidate(); } };
            _pnlTestBentoCard.MouseUp += (s, e) => { if (testPressed) { testPressed = false; _pnlTestBentoCard.Invalidate(); } };

            _pnlTestBentoCard.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                var bounds = _pnlTestBentoCard.ClientRectangle;
                if (testPressed) bounds.Inflate(-1, -1);

                Color border = testHover ? FluentTheme.ThemeAccent : FluentTheme.ThemeCardHairline;
                Color fill = testHover ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                FluentTheme.PaintGlassCard(e.Graphics, bounds, 14, fill: fill, hairline: border, drawShadow: true);

                // Badge icon
                bool dark = FluentTheme.IsDarkTheme;
                Color badgeBg = dark ? Color.FromArgb(36, 45, 62) : Color.FromArgb(235, 244, 255);
                Color iconColor = dark ? Color.FromArgb(96, 165, 250) : Color.FromArgb(0, 113, 227);
                var rBadge = new Rectangle(bounds.X + 14, bounds.Y + 18, 36, 36);
                using (var b = new SolidBrush(badgeBg))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, rBadge, 10);
                }
                using (var ico = FluentTheme.GetMenuIcon("bell", iconColor, 18))
                {
                    e.Graphics.DrawImage(ico, rBadge.X + (36 - 18) / 2, rBadge.Y + (36 - 18) / 2);
                }

                // Texts
                using var fontTitle = FluentTheme.GetFont(10F, FontStyle.Bold);
                using var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary);
                e.Graphics.DrawString("Uji Notifikasi", fontTitle, brushTitle, new PointF(bounds.X + 58, bounds.Y + 17));

                using var fontSub = FluentTheme.Caption;
                using var brushSub = new SolidBrush(FluentTheme.ThemeTextMuted);
                using var sf = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString("Tes banner pop-up & suara", fontSub, brushSub, new RectangleF(bounds.X + 58, bounds.Y + 39, _pnlTestBentoCard.Width - 68, 18), sf);
            };
            _pnlTestBentoCard.Click += (s, e) => ToastNotifier.ShowTestNotification(_config.DefaultDisplayMode);
            _tblBentoCards.Controls.Add(_pnlTestBentoCard, 0, 0);

            // 3b. Remote Desktop Bento Tile
            _pnlRemoteBentoCard = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Margin = new Padding(6, 0, 0, 0),
                Cursor = Cursors.Hand
            };
            bool remoteHover = false;
            bool remotePressed = false;
            _pnlRemoteBentoCard.MouseEnter += (s, e) => { remoteHover = true; _pnlRemoteBentoCard.Invalidate(); };
            _pnlRemoteBentoCard.MouseLeave += (s, e) => { remoteHover = false; remotePressed = false; _pnlRemoteBentoCard.Invalidate(); };
            _pnlRemoteBentoCard.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { remotePressed = true; _pnlRemoteBentoCard.Invalidate(); } };
            _pnlRemoteBentoCard.MouseUp += (s, e) => { if (remotePressed) { remotePressed = false; _pnlRemoteBentoCard.Invalidate(); } };

            _pnlRemoteBentoCard.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                var bounds = _pnlRemoteBentoCard.ClientRectangle;
                if (remotePressed) bounds.Inflate(-1, -1);

                Color border = remoteHover ? FluentTheme.ThemeAccent : FluentTheme.ThemeCardHairline;
                Color fill = remoteHover ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                FluentTheme.PaintGlassCard(e.Graphics, bounds, 14, fill: fill, hairline: border, drawShadow: true);

                // Badge icon (Cupertino Blue & Santos Navy, strictly no purple)
                bool dark = FluentTheme.IsDarkTheme;
                Color badgeBg = dark ? Color.FromArgb(24, 44, 76) : Color.FromArgb(235, 244, 255);
                Color iconColor = dark ? Color.FromArgb(10, 132, 255) : Color.FromArgb(0, 113, 227);
                var rBadge = new Rectangle(bounds.X + 14, bounds.Y + 18, 36, 36);
                using (var b = new SolidBrush(badgeBg))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, rBadge, 10);
                }
                using (var ico = FluentTheme.GetMenuIcon("remote", iconColor, 18))
                {
                    e.Graphics.DrawImage(ico, rBadge.X + (36 - 18) / 2, rBadge.Y + (36 - 18) / 2);
                }

                // Texts
                using var fontTitle = FluentTheme.GetFont(10F, FontStyle.Bold);
                using var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary);
                e.Graphics.DrawString("Remote Desktop", fontTitle, brushTitle, new PointF(bounds.X + 58, bounds.Y + 17));

                using var fontSub = FluentTheme.Caption;
                using var brushSub = new SolidBrush(FluentTheme.ThemeTextSecondary);
                using var sf = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString("Akses perangkat jarak jauh Santos", fontSub, brushSub, new RectangleF(bounds.X + 58, bounds.Y + 39, _pnlRemoteBentoCard.Width - 68, 18), sf);
            };
            _pnlRemoteBentoCard.Click += (s, e) =>
            {
                var curSession = DeviceSecurityStorage.LoadSession();
                if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
                {
                    ShowAlert("Fitur Remote Desktop hanya dapat diakses akun berhak akses Admin / Agent.", isError: true);
                    return;
                }
                OpenRemoteDeviceBrowser();
            };
            _tblBentoCards.Controls.Add(_pnlRemoteBentoCard, 1, 0);

            // Dummy controls assigned so existing references don't break
            _btnTestNotif = new GlassButton { Visible = false, Size = new Size(0, 0) };
            _btnRemote = new GlassButton { Visible = false, Size = new Size(0, 0) };
            _tblActions = new TableLayoutPanel { Visible = false, Size = new Size(0, 0) };

            pnl.Controls.Add(_tblBentoCards);

            y += 100;

            // ================= 4. LOGOUT ACTION (ELEGANT APPLE MINIMAL ROW) =================
            _btnLogout = new GlassButton
            {
                Location = new Point(pnl.ClientSize.Width > 170 ? pnl.ClientSize.Width - 140 : 0, y),
                Size = new Size(140, 32),
                Text = "Keluar Akun",
                Glyph = "exit",
                Variant = GlassButtonVariant.Danger,
                Radius = 8,
                Font = FluentTheme.CaptionBold
            };
            _btnLogout.Click += (s, e) => HandleLogoutAction();
            pnl.Controls.Add(_btnLogout);

            _pnlProfileCard.Resize += (s, e) =>
            {
                _lblSiteBadge.Location = new Point(_pnlProfileCard.ClientSize.Width - _lblSiteBadge.Width - 16, 14);
                int textW = _lblSiteBadge.Left - 76;
                if (textW > 100)
                {
                    _lblUserName.Width = textW;
                    _lblUserDetail.Width = textW;
                }
                _lblDashGatewayStatus.Width = _pnlProfileCard.ClientSize.Width - 44;
            };

            pnl.Resize += (s, e) =>
            {
                int w = pnl.ClientSize.Width;
                if (w <= 0) return;
                _pnlProfileCard.Width = w;
                _pnlWebHeroCard.Width = w;
                _btnOpenWeb.Location = new Point(_pnlWebHeroCard.Width - _btnOpenWeb.Width - 16, (_pnlWebHeroCard.Height - _btnOpenWeb.Height) / 2);
                _tblBentoCards.Width = w;
                _btnLogout.Location = new Point(w - _btnLogout.Width, _btnLogout.Top);
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
            var curSession = DeviceSecurityStorage.LoadSession();
            if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
            {
                ShowAlert("Fitur Remote Desktop hanya tersedia untuk akun ADMIN atau AGENT.", isError: true);
                return;
            }
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
            var curSession = DeviceSecurityStorage.LoadSession();
            if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
            {
                ShowAlert("Fitur Remote Desktop hanya tersedia untuk akun ADMIN atau AGENT.", isError: true);
                return;
            }
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
                _lblUserName.ForeColor = FluentTheme.ThemeTextPrimary;
                string n = !string.IsNullOrWhiteSpace(_session.EmployeeId) ? _session.EmployeeId : _session.Email;
                _lblUserDetail.Text = $"{n} • {Environment.MachineName}";
                _lblUserDetail.ForeColor = FluentTheme.ThemeTextSecondary;
                _lblSiteBadge.Text = !string.IsNullOrWhiteSpace(_session.SiteCode) ? _session.SiteCode : "SPJ";

                // Fail-closed: tombol Remote hanya untuk ADMIN / AGENT*.
                bool isOperator = RemoteAccessPolicy.IsRemoteOperator(_session.Role, _session.EmployeeId, _session.FullName);
                _btnRemote.Visible = isOperator;
                if (_pnlRemoteBentoCard != null && _tblBentoCards != null)
                {
                    _pnlRemoteBentoCard.Visible = isOperator;
                    if (!isOperator)
                    {
                        _tblBentoCards.ColumnStyles[0].Width = 100F;
                        _tblBentoCards.ColumnStyles[1].Width = 0F;
                    }
                    else
                    {
                        _tblBentoCards.ColumnStyles[0].Width = 50F;
                        _tblBentoCards.ColumnStyles[1].Width = 50F;
                    }
                }

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
                _pnlRailProfile?.Invalidate();
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
            bool signedIn = string.Equals(mode, "dashboard", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(mode, "history", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(mode, "settings", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(mode, "empty", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(mode, "disconnected", StringComparison.OrdinalIgnoreCase);

            if (signedIn)
            {
                _session = new UserProfileSession
                {
                    EmployeeId = "00061058",
                    FullName = "RM BAGASTYO ANGGORO INDRASTOTO",
                    Email = "bagastyo.indrastoto@kapalapi.co.id",
                    Role = "ADMIN",
                    SiteCode = "SPJ",
                    Token = "preview_valid_session_token_2026"
                };
                _isConnected = !string.Equals(mode, "disconnected", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                _session = null;
                _isConnected = false;
            }

            RefreshDataState();

            if (string.Equals(mode, "history", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(mode, "empty", StringComparison.OrdinalIgnoreCase))
            {
                SwitchNavTab("history");
            }
            else if (string.Equals(mode, "settings", StringComparison.OrdinalIgnoreCase))
            {
                SwitchNavTab("settings");
            }
        }

        // ================= WINDOW RESIZING (WM_NCHITTEST) =================
        private const int WM_NCHITTEST = 0x84;
        private const int HTCLIENT = 1;
        private const int HTLEFT = 10;
        private const int HTRIGHT = 11;
        private const int HTTOP = 12;
        private const int HTTOPLEFT = 13;
        private const int HTTOPRIGHT = 14;
        private const int HTBOTTOM = 15;
        private const int HTBOTTOMLEFT = 16;
        private const int HTBOTTOMRIGHT = 17;

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST)
            {
                base.WndProc(ref m);
                if (m.Result.ToInt32() == HTCLIENT)
                {
                    Point pt = PointToClient(new Point(m.LParam.ToInt32() & 0xFFFF, m.LParam.ToInt32() >> 16));
                    int border = 6;
                    bool left = pt.X <= border;
                    bool right = pt.X >= ClientSize.Width - border;
                    bool top = pt.Y <= border;
                    bool bottom = pt.Y >= ClientSize.Height - border;

                    if (top && left) m.Result = (IntPtr)HTTOPLEFT;
                    else if (top && right) m.Result = (IntPtr)HTTOPRIGHT;
                    else if (bottom && left) m.Result = (IntPtr)HTBOTTOMLEFT;
                    else if (bottom && right) m.Result = (IntPtr)HTBOTTOMRIGHT;
                    else if (left) m.Result = (IntPtr)HTLEFT;
                    else if (right) m.Result = (IntPtr)HTRIGHT;
                    else if (top) m.Result = (IntPtr)HTTOP;
                    else if (bottom) m.Result = (IntPtr)HTBOTTOM;
                }
                return;
            }
            base.WndProc(ref m);
        }

        public void SwitchNavTab(string tabKey)
        {
            _currentNavTab = tabKey.ToLowerInvariant();
            if (_pnlViewsContainer == null) return;

            _pnlHomeTab?.Hide();
            _pnlHistoryTab?.Hide();
            _pnlSettingsTab?.Hide();

            switch (_currentNavTab)
            {
                case "home":
                    _pnlHomeTab?.Show();
                    _pnlHomeTab?.BringToFront();
                    break;
                case "history":
                    if (_pnlHistoryTab == null)
                    {
                        _pnlHistoryTab = new HistoryControlPanel(_config);
                        _pnlViewsContainer.Controls.Add(_pnlHistoryTab);
                    }
                    _pnlHistoryTab.LoadNotifications();
                    _pnlHistoryTab.Show();
                    _pnlHistoryTab.BringToFront();
                    break;
                case "settings":
                    if (_pnlSettingsTab == null)
                    {
                        _pnlSettingsTab = new SettingsControlPanel(_config);
                        _pnlViewsContainer.Controls.Add(_pnlSettingsTab);
                    }
                    _pnlSettingsTab.Show();
                    _pnlSettingsTab.BringToFront();
                    break;
            }

            foreach (var kvp in _navButtons)
            {
                kvp.Value.Invalidate();
            }
        }

        private void ShowProfileSwitcherFlyout(Control anchor)
        {
            _profileContextMenu?.Dispose();
            _profileContextMenu = new ContextMenuStrip
            {
                Renderer = new FluentMenuRenderer(),
                ShowImageMargin = false
            };

            var profiles = ProfileStore.Instance.GetAllProfiles();
            var active = ProfileStore.Instance.GetActiveProfile();

            var lblHeader = new ToolStripLabel("PROFIL PENGGUNA PC")
            {
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextMuted
            };
            _profileContextMenu.Items.Add(lblHeader);

            foreach (var p in profiles)
            {
                bool isActive = p.Id == active.Id;
                string check = isActive ? " ✓" : "";
                string lockStr = p.HasPin ? " 🔒" : "";
                var item = new ToolStripMenuItem($"{p.Name}{lockStr}{check}")
                {
                    Font = isActive ? FluentTheme.SubTextBold : FluentTheme.SubText,
                    ForeColor = isActive ? FluentTheme.ThemeAccentText : FluentTheme.ThemeTextPrimary
                };
                item.Click += (s, e) => SwitchToProfileInteractive(p);
                _profileContextMenu.Items.Add(item);
            }

            _profileContextMenu.Items.Add(new ToolStripSeparator());

            var itemAdd = new ToolStripMenuItem("➕ Tambah Profil Baru...")
            {
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeAccentText
            };
            itemAdd.Click += (s, e) => ShowAddProfileModal();
            _profileContextMenu.Items.Add(itemAdd);

            var itemPin = new ToolStripMenuItem(active.HasPin ? "🔒 Ubah / Hapus PIN Profil Ini" : "🔒 Pasang PIN Pengaman Profil")
            {
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary
            };
            itemPin.Click += (s, e) => ShowSetPinModal(active);
            _profileContextMenu.Items.Add(itemPin);

            if (profiles.Count > 1)
            {
                var itemDelete = new ToolStripMenuItem("🗑 Hapus Profil Ini...")
                {
                    Font = FluentTheme.SubText,
                    ForeColor = Color.FromArgb(239, 68, 68)
                };
                itemDelete.Click += (s, e) =>
                {
                    var confirm = MessageBox.Show(
                        $"Apakah Anda yakin ingin menghapus profil '{active.Name}'?\nData token sesi profil ini akan dihapus dari komputer.",
                        "Hapus Profil",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Warning
                    );
                    if (confirm == DialogResult.Yes)
                    {
                        if (ProfileStore.Instance.RemoveProfile(active.Id, out string? err))
                        {
                            RefreshDataState();
                            OnSessionChanged?.Invoke();
                            TrayApplicationContext.Instance?.SyncActiveProfileSession();
                        }
                        else
                        {
                            MessageBox.Show(err ?? "Gagal menghapus profil.", "Perhatian", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                    }
                };
                _profileContextMenu.Items.Add(itemDelete);
            }

            _profileContextMenu.Show(anchor, new Point(0, -_profileContextMenu.PreferredSize.Height - 4));
        }

        private void SwitchToProfileInteractive(ProfileItem target)
        {
            var active = ProfileStore.Instance.GetActiveProfile();
            if (target.Id == active.Id) return;

            string? pin = null;
            if (target.HasPin)
            {
                pin = PromptForPinDialog($"Masukkan PIN untuk profil '{target.Name}':");
                if (pin == null) return;
            }

            if (ProfileStore.Instance.SwitchProfile(target.Id, pin, out string? error))
            {
                RefreshDataState();
                OnSessionChanged?.Invoke();
                TrayApplicationContext.Instance?.SyncActiveProfileSession();
            }
            else
            {
                MessageBox.Show(error ?? "Gagal beralih profil.", "Akses Ditolak", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void ShowAddProfileModal()
        {
            using var dlg = new Form
            {
                Text = "Tambah Profil Baru • SJA Notifier",
                Size = new Size(380, 240),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = FluentTheme.ThemeCanvasTop,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Font = FluentTheme.Body
            };
            FluentTheme.ApplyWindows11Styles(dlg.Handle);

            var lblName = new Label { Text = "Nama Profil:", Location = new Point(20, 18), AutoSize = true, Font = FluentTheme.SubTextBold };
            dlg.Controls.Add(lblName);

            var txtName = new TextBox
            {
                Text = $"Profil {ProfileStore.Instance.GetAllProfiles().Count + 1}",
                Location = new Point(20, 42),
                Size = new Size(324, 26),
                BackColor = FluentTheme.ThemeInputWell,
                ForeColor = FluentTheme.ThemeTextPrimary
            };
            dlg.Controls.Add(txtName);

            var lblPin = new Label { Text = "PIN Pengaman 6 Digit (Opsional):", Location = new Point(20, 80), AutoSize = true, Font = FluentTheme.SubTextBold };
            dlg.Controls.Add(lblPin);

            var txtPin = new TextBox
            {
                Location = new Point(20, 104),
                Size = new Size(324, 26),
                MaxLength = 6,
                UseSystemPasswordChar = true,
                BackColor = FluentTheme.ThemeInputWell,
                ForeColor = FluentTheme.ThemeTextPrimary
            };
            dlg.Controls.Add(txtPin);

            var btnCreate = new GlassButton
            {
                Text = "Buat Profil ➔",
                Location = new Point(194, 150),
                Size = new Size(150, 36),
                Variant = GlassButtonVariant.Accent,
                Radius = 6,
                Font = FluentTheme.SubTextBold
            };
            btnCreate.Click += (s, e) =>
            {
                string name = txtName.Text.Trim();
                if (string.IsNullOrWhiteSpace(name)) name = "Profil Baru";
                string pin = txtPin.Text.Trim();
                ProfileStore.Instance.AddProfile(name, string.IsNullOrWhiteSpace(pin) ? null : pin);
                dlg.DialogResult = DialogResult.OK;
                dlg.Close();
                RefreshDataState();
                OnSessionChanged?.Invoke();
                TrayApplicationContext.Instance?.SyncActiveProfileSession();
            };
            dlg.Controls.Add(btnCreate);

            var btnBatal = new GlassButton
            {
                Text = "Batal",
                Location = new Point(80, 150),
                Size = new Size(100, 36),
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.SubTextBold
            };
            btnBatal.Click += (s, e) => dlg.Close();
            dlg.Controls.Add(btnBatal);

            dlg.ShowDialog(this);
        }

        private void ShowSetPinModal(ProfileItem profile)
        {
            string? pin = PromptForPinDialog(profile.HasPin ? "Masukkan PIN Baru (atau kosongkan untuk hapus PIN):" : "Masukkan PIN 6-digit untuk mengunci profil ini:");
            if (pin != null)
            {
                ProfileStore.Instance.SetPin(profile.Id, string.IsNullOrWhiteSpace(pin) ? null : pin);
                MessageBox.Show(string.IsNullOrWhiteSpace(pin) ? "PIN profil berhasil dihapus." : "PIN profil berhasil disimpan.", "PIN Profil", MessageBoxButtons.OK, MessageBoxIcon.Information);
                RefreshDataState();
            }
        }

        private string? PromptForPinDialog(string promptText)
        {
            using var dlg = new Form
            {
                Text = "PIN Keamanan Profil",
                Size = new Size(360, 180),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = FluentTheme.ThemeCanvasTop,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Font = FluentTheme.Body
            };
            FluentTheme.ApplyWindows11Styles(dlg.Handle);

            var lbl = new Label { Text = promptText, Location = new Point(20, 18), Size = new Size(304, 36), Font = FluentTheme.SubTextBold };
            dlg.Controls.Add(lbl);

            var txt = new TextBox { Location = new Point(20, 60), Size = new Size(304, 26), MaxLength = 6, UseSystemPasswordChar = true, BackColor = FluentTheme.ThemeInputWell, ForeColor = FluentTheme.ThemeTextPrimary };
            dlg.Controls.Add(txt);

            string? result = null;
            var btnOk = new GlassButton { Text = "OK", Location = new Point(224, 100), Size = new Size(100, 32), Variant = GlassButtonVariant.Accent, Radius = 6 };
            btnOk.Click += (s, e) => { result = txt.Text; dlg.Close(); };
            dlg.Controls.Add(btnOk);

            var btnCancel = new GlassButton { Text = "Batal", Location = new Point(114, 100), Size = new Size(100, 32), Variant = GlassButtonVariant.Ghost, Radius = 6 };
            btnCancel.Click += (s, e) => dlg.Close();
            dlg.Controls.Add(btnCancel);

            dlg.AcceptButton = btnOk;
            dlg.CancelButton = btnCancel;
            dlg.ShowDialog(this);
            return result;
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
