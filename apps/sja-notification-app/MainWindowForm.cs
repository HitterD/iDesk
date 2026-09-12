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
        private Panel _pnlRail = null!;
        private Panel _pnlViewsContainer = null!;
        private HomeControlPanel? _pnlHomeTab;
        private HistoryControlPanel? _pnlHistoryTab;
        private SettingsControlPanel? _pnlSettingsTab;
        private Panel _pnlRailProfile = null!;
        private Panel _pnlRailGatewayStatus = null!;
        private ContextMenuStrip? _profileContextMenu;
        private string _currentNavTab = "home"; // "home" | "history" | "settings"
        private readonly System.Collections.Generic.Dictionary<string, Panel> _navButtons = new();

        private const string RemoteAccessDeniedMessage =
            "Remote Desktop is available to Admin and Agent accounts only.";

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
                if (c is Label lbl)
                {
                    if (lbl == _lblBrand) lbl.ForeColor = FluentTheme.ThemeTextSecondary;
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

            _pnlHeader.Resize += (s, e) =>
            {
                int r = _pnlHeader.ClientSize.Width;
                _btnClose.Location = new Point(r - _btnClose.Width, 11);
                _btnMin.Location = new Point(_btnClose.Left - _btnMin.Width - 4, 11);
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
                Color fill = FluentTheme.ThemeAccentSoft;
                Color border = FluentTheme.ThemeCardHairline;
                FluentTheme.PaintGlassCard(e.Graphics, _pnlWebQuickCard.ClientRectangle, 10, fill, border);
            };

            var lblWebPrompt = new Label
            {
                Text = "Fast Connect via Browser",
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
                Text = "Connect session from browser",
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

                string text = "OR SIGN IN WITH EMPLOYEE ID";
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
                Text = "Employee ID or Santos Email:",
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
                PlaceholderText = "e.g. 00061058 or user.spj@idesk.com"
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
                Text = "Password:",
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
                Text = "Show",
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
                Text = "Sign in and pair device",
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
                Text = "Protected with Windows DPAPI on this device.",
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
                using (var brush = new SolidBrush(FluentTheme.ThemeSidebar))
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
                using (var p = new Pen(FluentTheme.ThemeCardHairline, 1f))
                {
                    FluentTheme.DrawRoundedRectangle(e.Graphics, p, rAvatar, 10);
                }

                string initial = !string.IsNullOrWhiteSpace(activeP.Name) ? activeP.Name.Substring(0, 1).ToUpper() : "P";
                using var font = FluentTheme.GetFont(10F, FontStyle.Bold);
                using var textBrush = new SolidBrush(Color.White);
                using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(initial, font, textBrush, new RectangleF(10, 10, 32, 32), sf);

                string displayName = !string.IsNullOrWhiteSpace(activeP.Name) ? activeP.Name : "User Profile";
                using var nameFont = FluentTheme.GetFont(8.5F, FontStyle.Bold);
                using var nameBrush = new SolidBrush(FluentTheme.ThemeTextPrimary);
                using var sfLeft = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString(displayName, nameFont, nameBrush, new RectangleF(48, 9, _pnlRailProfile.Width - 54, 16), sfLeft);

                using var subFont = FluentTheme.Caption;
                using var subBrush = new SolidBrush(FluentTheme.ThemeTextMuted);
                e.Graphics.DrawString("Switch profile", subFont, subBrush, new RectangleF(48, 25, _pnlRailProfile.Width - 74, 14), sfLeft);

                using var chev = FluentTheme.GetMenuIcon("chevron-down", FluentTheme.ThemeTextMuted, 12);
                e.Graphics.DrawImage(chev, _pnlRailProfile.Width - 24, 26);
            };
            _pnlRailProfile.Click += (s, e) => ShowProfileSwitcherFlyout(_pnlRailProfile);
            _pnlRail.Controls.Add(_pnlRailProfile);

            // Bottom Sidebar: Gateway Connection Status
            _pnlRailGatewayStatus = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 30,
                BackColor = Color.Transparent,
                Padding = new Padding(12, 4, 12, 4)
            };
            _pnlRailGatewayStatus.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                Color dotColor = _isConnected ? FluentTheme.ThemeStatusOnline : FluentTheme.ThemeStatusCritical;
                using (var dotBrush = new SolidBrush(dotColor))
                {
                    e.Graphics.FillEllipse(dotBrush, 12, (_pnlRailGatewayStatus.Height - 8) / 2, 8, 8);
                }

                string statusText = _isConnected ? "Connected" : "Disconnected";
                Color textColor = _isConnected ? FluentTheme.ThemeStatusOnline : FluentTheme.ThemeStatusCritical;
                using var font = FluentTheme.CaptionBold;
                using var textBrush = new SolidBrush(textColor);
                using var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString(statusText, font, textBrush, new RectangleF(26, 0, _pnlRailGatewayStatus.Width - 30, _pnlRailGatewayStatus.Height), sf);
            };
            _pnlRail.Controls.Add(_pnlRailGatewayStatus);

            // Rail Navigation Buttons
            int railY = 8;
            AddRailNavButton("home", "Home", "home", ref railY, () => SwitchNavTab("home"));
            AddRailNavButton("history", "History", "history", ref railY, () => SwitchNavTab("history"));
            AddRailNavButton("settings", "Settings", "settings", ref railY, () => SwitchNavTab("settings"));

            AddRailGroupLabel("Opens in another window", ref railY);

            AddRailNavButton("remote", "Remote Desktop", "remote", ref railY, () =>
            {
                var curSession = DeviceSecurityStorage.LoadSession();
                if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
                {
                    ShowAlert(RemoteAccessDeniedMessage, isError: true);
                    return;
                }
                OpenRemoteDeviceBrowser();
            }, isExternal: true);
            AddRailNavButton("portal", "iDesk Portal", "idesk", ref railY, async () => await HandleOpenWebWithSsoAsync(), isExternal: true);

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

        private void AddRailGroupLabel(string text, ref int y)
        {
            var lbl = new Label
            {
                Text = text,
                Font = FluentTheme.GetFont(7.5F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextMuted,
                Location = new Point(14, y + 8),
                Size = new Size(166, 18),
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleLeft,
                UseMnemonic = false
            };
            _pnlRail.Controls.Add(lbl);
            y += 28;
        }

        private void AddRailNavButton(string key, string label, string icon, ref int y, Action onClick, bool isExternal = false)
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

                if (isExternal)
                {
                    using var extIco = FluentTheme.GetMenuIcon("external", isHover ? FluentTheme.ThemeTextSecondary : FluentTheme.ThemeTextMuted, 14);
                    e.Graphics.DrawImage(extIco, btnPnl.Width - 24, (btnPnl.Height - 14) / 2);
                }

                using var font = FluentTheme.GetFont(9F, isSelected ? FontStyle.Bold : FontStyle.Regular);
                using var textBrush = new SolidBrush(itemColor);
                using var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap };
                e.Graphics.DrawString(label, font, textBrush, new RectangleF(38, 0, btnPnl.Width - 66, btnPnl.Height), sf);
            };

            btnPnl.Click += (s, e) => onClick();
            _navButtons[key] = btnPnl;
            _pnlRail.Controls.Add(btnPnl);
            y += 40;
        }

        private HomeControlPanel BuildHomeTab()
        {
            var home = new HomeControlPanel(_config, () => SwitchNavTab("history"));
            return home;
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
        }

        private void OpenRemoteDeviceBrowser()
        {
            var curSession = DeviceSecurityStorage.LoadSession();
            if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
            {
                ShowAlert(RemoteAccessDeniedMessage, isError: true);
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
            catch (UnauthorizedAccessException)
            {
                ShowAlert(RemoteAccessDeniedMessage, isError: true);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal membuka Remote Device Browser", ex);
                ShowAlert($"Could not open the device browser: {ex.Message}", isError: true);
            }
        }

        private void StartRemoteSession(DeviceDirectoryItem targetDev)
        {
            var curSession = DeviceSecurityStorage.LoadSession();
            if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
            {
                ShowAlert(RemoteAccessDeniedMessage, isError: true);
                return;
            }
            try
            {
                ShowAlert($"Connecting to {targetDev.deviceName} ({targetDev.ipAddress})…", isError: false);
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
                _pnlAlert.BackColor = Color.FromArgb(24, FluentTheme.ThemeStatusCritical);
                _alertBorderColor = Color.FromArgb(64, FluentTheme.ThemeStatusCritical);
                _lblAlertText.ForeColor = FluentTheme.ThemeStatusCritical;
                _lblAlertText.Text = "• " + message;
            }
            else
            {
                _pnlAlert.BackColor = FluentTheme.ThemeAccentSoft;
                _alertBorderColor = Color.FromArgb(64, FluentTheme.ThemeAccent);
                _lblAlertText.ForeColor = FluentTheme.ThemeAccentText;
                _lblAlertText.Text = "• " + message;
            }
            _pnlAlert.Visible = true;
            _pnlAlert.Invalidate();
        }

        private void HandleLogoutAction()
        {
            if (AppDialogs.Confirm(
                this,
                "Sign out?",
                "You will need to sign in again to receive notifications on this device.",
                "Sign out",
                isDestructive: true))
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

            // 1. Redraw Sidebar Gateway Status
            _pnlRailGatewayStatus?.Invalidate();

            // 2. Switch Views
            if (hasSession)
            {
                _pnlLoginView.Visible = false;
                _pnlDashboardView.Visible = true;
                _pnlDashboardView.BringToFront();

                _pnlRailProfile?.Invalidate();
                _pnlRailGatewayStatus?.Invalidate();
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
                    _pnlHomeTab?.RefreshData();
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

            var lblHeader = new ToolStripLabel("PC USER PROFILES")
            {
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextMuted
            };
            _profileContextMenu.Items.Add(lblHeader);

            foreach (var p in profiles)
            {
                bool isActive = p.Id == active.Id;
                string lockStr = p.HasPin ? " (PIN)" : "";
                var item = new ToolStripMenuItem($"{p.Name}{lockStr}")
                {
                    Font = isActive ? FluentTheme.SubTextBold : FluentTheme.SubText,
                    ForeColor = isActive ? FluentTheme.ThemeAccentText : FluentTheme.ThemeTextPrimary
                };
                if (isActive)
                {
                    item.Image = FluentTheme.GetMenuIcon("check", FluentTheme.ThemeAccent, 14);
                }
                item.Click += (s, e) => SwitchToProfileInteractive(p);
                _profileContextMenu.Items.Add(item);
            }

            _profileContextMenu.Items.Add(new ToolStripSeparator());

            var itemAdd = new ToolStripMenuItem("Add new profile...", FluentTheme.GetMenuIcon("plus", FluentTheme.ThemeAccentText, 14))
            {
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.ThemeAccentText
            };
            itemAdd.Click += (s, e) => ShowAddProfileModal();
            _profileContextMenu.Items.Add(itemAdd);

            var itemPin = new ToolStripMenuItem(active.HasPin ? "Change or remove PIN" : "Set profile PIN protection", FluentTheme.GetMenuIcon("lock", FluentTheme.ThemeTextSecondary, 14))
            {
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary
            };
            itemPin.Click += (s, e) => ShowSetPinModal(active);
            _profileContextMenu.Items.Add(itemPin);

            if (profiles.Count > 1)
            {
                var itemDelete = new ToolStripMenuItem("Delete this profile...", FluentTheme.GetMenuIcon("trash", FluentTheme.ThemeStatusCritical, 14))
                {
                    Font = FluentTheme.SubText,
                    ForeColor = FluentTheme.ThemeStatusCritical
                };
                itemDelete.Click += (s, e) =>
                {
                    if (AppDialogs.Confirm(
                        this,
                        "Delete profile?",
                        $"Session token data for profile '{active.Name}' will be removed from this PC.",
                        "Delete",
                        isDestructive: true))
                    {
                        if (ProfileStore.Instance.RemoveProfile(active.Id, out string? err))
                        {
                            RefreshDataState();
                            OnSessionChanged?.Invoke();
                            TrayApplicationContext.Instance?.SyncActiveProfileSession();
                        }
                        else
                        {
                            MessageBox.Show(err ?? "Could not delete profile.", "Notice", MessageBoxButtons.OK, MessageBoxIcon.Information);
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
