using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SJANotificationApp
{
    public class DeviceDirectoryItem
    {
        public string id { get; set; } = string.Empty;
        public string employeeId { get; set; } = string.Empty;
        public string employeeName { get; set; } = string.Empty;
        public string deviceName { get; set; } = string.Empty;
        public string windowsUsername { get; set; } = string.Empty;
        public string status { get; set; } = "ACTIVE";
        public string clientVersion { get; set; } = string.Empty;
        public string lastHeartbeat { get; set; } = string.Empty;
        public string lastHeartbeatAt { get; set; } = string.Empty;
        public string ipAddress { get; set; } = string.Empty;
        public string siteCode { get; set; } = "SPJ";
        public bool isOnline { get; set; } = false;
    }

    /// <summary>
    /// Jendela Modern Windows 11 Fluent 2 untuk Direktori Perangkat Santos.
    /// Mengadopsi Double-Bezel frosted canvas, glass search well, glass dropdown,
    /// pill stats counter, serta visual card yang selaras dengan dashboard utama.
    /// </summary>
    public class RemoteDeviceBrowserForm : Form
    {
        private readonly AppConfig _config;
        private readonly HttpClient _httpClient;
        private bool _loadFailed;
        private List<DeviceDirectoryItem> _allDevices = new();
        private List<DeviceDirectoryItem> _filteredDevices = new();
        private bool _acrylicActive;
        private Action? _themeChangedHandler;
        private bool _searchFocused;

        private Panel _pnlHeader = null!;
        private Panel _pnlCountPill = null!;
        private GlassButton _btnClose = null!;
        private GlassButton _btnMin = null!;

        private Panel _pnlFilter = null!;
        private Panel _pnlSearchBox = null!;
        private TextBox _txtSearch = null!;
        private GlassDropdown _cbSite = null!;
        private GlassButton _btnRefresh = null!;

        private Panel _pnlContent = null!;
        private Panel _pnlCards = null!;
        private FluentScrollBar _scrollBar = null!;

        public Action<DeviceDirectoryItem>? OnConnectRequested;

        public void SeedMockDevices()
        {
            _allDevices = new List<DeviceDirectoryItem>
            {
                new DeviceDirectoryItem
                {
                    id = "DEV-001",
                    deviceName = "SPJ-IT-NB-BAGAS",
                    employeeName = "Bagas IT Infrastructure",
                    employeeId = "SJA-09124",
                    windowsUsername = "bagas.it",
                    ipAddress = "192.168.10.45",
                    siteCode = "SPJ",
                    clientVersion = "v2.1.4",
                    isOnline = true,
                    status = "ACTIVE",
                    lastHeartbeat = "1 minute ago"
                },
                new DeviceDirectoryItem
                {
                    id = "DEV-002",
                    deviceName = "KRW-PROD-PC-01",
                    employeeName = "Siti Rahmawati",
                    employeeId = "SJA-04812",
                    windowsUsername = "siti.r",
                    ipAddress = "10.20.4.112",
                    siteCode = "KRW",
                    clientVersion = "v2.1.4",
                    isOnline = true,
                    status = "ACTIVE",
                    lastHeartbeat = "Just now"
                },
                new DeviceDirectoryItem
                {
                    id = "DEV-003",
                    deviceName = "JTB-QC-LAB-03",
                    employeeName = "Ahmad Wahyudi",
                    employeeId = "SJA-07331",
                    windowsUsername = "ahmad.w",
                    ipAddress = "10.30.1.88",
                    siteCode = "JTB",
                    clientVersion = "v2.1.3",
                    isOnline = false,
                    status = "ACTIVE",
                    lastHeartbeat = "2 hours ago"
                }
            };
            ApplyFilter();
        }

        public RemoteDeviceBrowserForm(AppConfig config)
        {
            var curSession = DeviceSecurityStorage.LoadSession();
            if (!RemoteAccessPolicy.IsRemoteOperator(curSession?.Role, curSession?.EmployeeId, curSession?.FullName))
            {
                throw new UnauthorizedAccessException("Fitur Remote Desktop hanya tersedia untuk akun ADMIN atau AGENT.");
            }
            _config = config;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

            InitializeComponent();
            _acrylicActive = FluentTheme.TryApplyDarkAcrylic(Handle);
            _themeChangedHandler = OnThemeChangedSafe;
            FluentTheme.ThemeChanged += _themeChangedHandler;

            _ = LoadDevicesAsync();
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
            if (_txtSearch != null)
            {
                _txtSearch.BackColor = FluentTheme.ThemeInputWell;
                _txtSearch.ForeColor = FluentTheme.ThemeTextPrimary;
            }
            Invalidate(true);
        }

        private void InitializeComponent()
        {
            Text = "SJA Remote Desktop";
            Size = new Size(1100, 720);
            MinimumSize = new Size(760, 540);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            Font = FluentTheme.Body;
            BackColor = FluentTheme.ThemeCanvasBottom;
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

            // Root Canvas Enclosure with frosted glass background & double-bezel hairline edge
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

            // ================= 1. HEADER (BRAND LOGO, TITLE, PILL STATS & CONTROLS) =================
            _pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 54,
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
                Size = new Size(32, 32),
                Location = new Point(0, 10),
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
                Location = new Point(42, 6),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            lblBrand.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(lblBrand);

            var lblSuite = new Label
            {
                Text = "Remote Desktop",
                Font = FluentTheme.Title,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(42, 24),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            lblSuite.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            _pnlHeader.Controls.Add(lblSuite);

            // Close & Minimize Window Controls
            _btnClose = new GlassButton
            {
                Size = new Size(28, 28),
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "close",
                Radius = 6,
                Cursor = Cursors.Hand
            };
            var tipClose = new ToolTip();
            tipClose.SetToolTip(_btnClose, "Close (Esc)");
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
            var tipMin = new ToolTip();
            tipMin.SetToolTip(_btnMin, "Minimize");
            _btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;
            _pnlHeader.Controls.Add(_btnMin);

            // Header Status Pill (matches Gateway Online Pill style from MainWindowForm)
            _pnlCountPill = new Panel
            {
                Size = new Size(180, 26),
                BackColor = Color.Transparent
            };
            _pnlCountPill.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
                var rect = new Rectangle(0, 0, _pnlCountPill.Width - 1, _pnlCountPill.Height - 1);

                int onlineCount = _allDevices.Count(d => d.isOnline);
                bool anyOnline = onlineCount > 0;

                Color bg = anyOnline ? FluentTheme.ThemeStatusOnlineBg : FluentTheme.ThemeSurfaceSoft;
                Color border = anyOnline ? Color.FromArgb(64, FluentTheme.ThemeStatusOnline) : FluentTheme.ThemeCardHairline;
                Color dotColor = anyOnline ? FluentTheme.ThemeStatusOnline : FluentTheme.ThemeTextMuted;
                Color textColor = anyOnline ? FluentTheme.ThemeStatusOnline : FluentTheme.ThemeTextSecondary;
                string text = $"{onlineCount} online • {_filteredDevices.Count} devices";

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
                    e.Graphics.FillEllipse(dotBrush, 8, (_pnlCountPill.Height - 8) / 2, 8, 8);
                }
                using (var textBrush = new SolidBrush(textColor))
                using (var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap })
                {
                    e.Graphics.DrawString(text, FluentTheme.CaptionBold, textBrush, new RectangleF(22, 0, _pnlCountPill.Width - 24, _pnlCountPill.Height), sf);
                }
            };
            _pnlHeader.Controls.Add(_pnlCountPill);

            _pnlHeader.Resize += (s, e) =>
            {
                int r = _pnlHeader.ClientSize.Width;
                _btnClose.Location = new Point(r - _btnClose.Width, 14);
                _btnMin.Location = new Point(r - _btnClose.Width - _btnMin.Width - 4, 14);
                _pnlCountPill.Location = new Point(_btnMin.Left - _pnlCountPill.Width - 10, 15);
            };

            pnlCanvas.Controls.Add(_pnlHeader);

            // ================= 2. FILTER & TOOLBAR =================
            _pnlFilter = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.Transparent,
                Padding = new Padding(0, 8, 0, 8)
            };

            // Custom Glass Search Well with focused hairline accent
            _pnlSearchBox = new Panel
            {
                Location = new Point(0, 8),
                Size = new Size(380, 36),
                BackColor = Color.Transparent
            };
            _pnlSearchBox.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, _pnlSearchBox.Width - 1, _pnlSearchBox.Height - 1);
                using (var brush = new SolidBrush(FluentTheme.ThemeInputWell))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 8);
                }
                Color border = _searchFocused ? FluentTheme.ThemeAccent : FluentTheme.ThemeInputBorder;
                float w = _searchFocused ? 1.5f : 1f;
                using var pen = new Pen(border, w);
                FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 8);
            };

            _txtSearch = new TextBox
            {
                Location = new Point(12, 9),
                Size = new Size(380 - 24, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.GetFont(9.5F, FontStyle.Regular),
                ForeColor = FluentTheme.ThemeTextPrimary,
                PlaceholderText = "Search by PC name, employee ID, name, or IP address"
            };
            _txtSearch.Enter += (s, e) => { _searchFocused = true; _pnlSearchBox.Invalidate(); };
            _txtSearch.Leave += (s, e) => { _searchFocused = false; _pnlSearchBox.Invalidate(); };
            _txtSearch.TextChanged += (s, e) => ApplyFilter();
            _pnlSearchBox.Click += (s, e) => _txtSearch.Focus();
            _pnlSearchBox.Controls.Add(_txtSearch);

            // Custom GlassDropdown replacing standard Win32 ComboBox
            _cbSite = new GlassDropdown
            {
                Location = new Point(392, 8),
                Size = new Size(180, 36)
            };
            _cbSite.Items.Add("All sites");
            _cbSite.Items.Add("SPJ — Sepanjang");
            _cbSite.Items.Add("KRW — Karawang");
            _cbSite.Items.Add("JTB — Jatake");
            _cbSite.Items.Add("SMG — Semarang");
            _cbSite.SelectedIndex = 0;
            _cbSite.SelectedIndexChanged += (s, e) => ApplyFilter();

            _btnRefresh = new GlassButton
            {
                Text = "Refresh",
                Glyph = "refresh",
                Size = new Size(110, 36),
                Location = new Point(582, 8),
                Variant = GlassButtonVariant.Ghost,
                Radius = 8
            };
            _btnRefresh.Click += async (s, e) => await LoadDevicesAsync();

            _pnlFilter.Controls.AddRange(new Control[] { _pnlSearchBox, _cbSite, _btnRefresh });
            pnlCanvas.Controls.Add(_pnlFilter);
            _pnlFilter.BringToFront();

            // ================= 3. CONTENT AREA & CARD FEED =================
            _pnlContent = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(0, 6, 0, 0)
            };

            _pnlCards = new Panel
            {
                Location = new Point(0, 0),
                AutoScroll = false,
                BackColor = Color.Transparent
            };

            _scrollBar = new FluentScrollBar
            {
                Dock = DockStyle.Right,
                Width = 10,
                Visible = false
            };
            _scrollBar.ValueChanged += (s, e) =>
            {
                _pnlCards.Top = -_scrollBar.Value;
            };

            _pnlContent.Controls.Add(_pnlCards);
            _pnlContent.Controls.Add(_scrollBar);
            pnlCanvas.Controls.Add(_pnlContent);
            _pnlContent.BringToFront();

            _pnlCards.MouseWheel += (s, e) =>
            {
                _scrollBar.DoMouseWheel(e.Delta);
            };
            _pnlContent.MouseWheel += (s, e) =>
            {
                _scrollBar.DoMouseWheel(e.Delta);
            };

            _pnlContent.Resize += (s, e) =>
            {
                RenderCards();
            };
        }

        private async Task LoadDevicesAsync()
        {
            _btnRefresh.Enabled = false;

            try
            {
                string apiUrl = $"{_config.SjaServerUrl.TrimEnd('/')}/v1/devices";
                var res = await _httpClient.GetAsync(apiUrl);
                if (res.IsSuccessStatusCode)
                {
                    string json = await res.Content.ReadAsStringAsync();
                    var list = JsonSerializer.Deserialize<List<DeviceDirectoryItem>>(json, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                    _allDevices = list ?? new List<DeviceDirectoryItem>();
                    ApplyFilter();
                }
                else
                {
                    _pnlCountPill.Invalidate();
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal mengambil data perangkat dari server", ex);
                _loadFailed = true;
                _pnlCountPill.Invalidate();
            }
            finally
            {
                _btnRefresh.Enabled = true;
            }
        }

        private void ApplyFilter()
        {
            string q = _txtSearch.Text.Trim().ToLowerInvariant();
            string selSite = _cbSite.SelectedIndex switch
            {
                1 => "SPJ",
                2 => "KRW",
                3 => "JTB",
                4 => "SMG",
                _ => "ALL"
            };

            _filteredDevices = _allDevices
                .Where(d => selSite == "ALL" || (d.siteCode ?? "SPJ").Equals(selSite, StringComparison.OrdinalIgnoreCase))
                .Where(d => string.IsNullOrEmpty(q) ||
                            d.deviceName.ToLowerInvariant().Contains(q) ||
                            d.employeeName.ToLowerInvariant().Contains(q) ||
                            d.employeeId.ToLowerInvariant().Contains(q) ||
                            d.ipAddress.ToLowerInvariant().Contains(q))
                .OrderByDescending(d => d.isOnline)
                .ThenBy(d => d.deviceName)
                .ToList();

            _pnlCountPill.Invalidate();
            RenderCards();
        }

        private void RenderCards()
        {
            _pnlCards.SuspendLayout();
            _pnlCards.Controls.Clear();

            int availWidth = Math.Max(200, _pnlContent.ClientSize.Width - 14);
            _pnlCards.Width = availWidth;

            if (_loadFailed)
            {
                RenderStatePanel("warning", "Could not load devices", "Check your connection to the SJA server, then try again.", "Try again", async () => await LoadDevicesAsync());
                _pnlCards.Height = 220;
                _pnlCards.ResumeLayout();
                _scrollBar.Visible = false;
                return;
            }

            if (_filteredDevices.Count == 0)
            {
                RenderStatePanel("search", "No devices found", "No devices match your search. Try a different keyword or site filter.", null, null);
                _pnlCards.Height = 220;
                _pnlCards.ResumeLayout();
                _scrollBar.Visible = false;
                return;
            }

            int cardHeight = 88;
            int gap = 10;
            int y = 4;
            int cardWidth = availWidth - 8;
            if (cardWidth < 200) cardWidth = 600;

            foreach (var dev in _filteredDevices)
            {
                var card = CreateDeviceCard(dev, cardWidth, cardHeight);
                card.Location = new Point(2, y);
                _pnlCards.Controls.Add(card);
                y += cardHeight + gap;
            }

            int contentHeight = y + 10;
            _pnlCards.Height = Math.Max(_pnlContent.ClientSize.Height, contentHeight);
            int maxScroll = Math.Max(0, contentHeight - _pnlContent.ClientSize.Height);
            _scrollBar.Maximum = maxScroll;
            _scrollBar.Visible = maxScroll > 0;
            _pnlCards.Top = -Math.Min(_scrollBar.Value, maxScroll);

            _pnlCards.ResumeLayout();
        }

        private void RenderStatePanel(string iconKey, string title, string body, string? actionLabel, Action? onAction)
        {
            int availWidth = _pnlCards.Width;
            var pnlEmpty = new Panel
            {
                Location = new Point(2, 20),
                Size = new Size(availWidth - 4, 180),
                BackColor = Color.Transparent
            };
            pnlEmpty.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, pnlEmpty.ClientRectangle, 12, FluentTheme.ThemeCardFillSoft, FluentTheme.ThemeCardHairline, false);

                using var ico = FluentTheme.GetMenuIcon(iconKey, iconKey == "warning" ? FluentTheme.ThemeStatusWarn : FluentTheme.ThemeTextMuted, 24);
                e.Graphics.DrawImage(ico, (pnlEmpty.Width - 24) / 2, 28);

                using var fontTitle = FluentTheme.GetFont(11F, FontStyle.Bold);
                using var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary);
                using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(title, fontTitle, brushTitle, new RectangleF(20, 58, pnlEmpty.Width - 40, 24), sf);

                using var fontBody = FluentTheme.Caption;
                using var brushBody = new SolidBrush(FluentTheme.ThemeTextMuted);
                e.Graphics.DrawString(body, fontBody, brushBody, new RectangleF(30, 84, pnlEmpty.Width - 60, 36), sf);
            };

            if (!string.IsNullOrEmpty(actionLabel) && onAction != null)
            {
                var btnAction = new GlassButton
                {
                    Text = actionLabel,
                    Variant = GlassButtonVariant.Accent,
                    Font = FluentTheme.CaptionBold,
                    Radius = 8,
                    Size = new Size(110, 32),
                    Location = new Point((pnlEmpty.Width - 110) / 2, 128)
                };
                btnAction.Click += (s, e) => onAction();
                pnlEmpty.Controls.Add(btnAction);
            }

            _pnlCards.Controls.Add(pnlEmpty);
        }

        private Panel CreateDeviceCard(DeviceDirectoryItem dev, int width, int height)
        {
            var pnl = new Panel
            {
                Size = new Size(width, height),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BackColor = Color.Transparent,
                Padding = new Padding(16, 12, 16, 12)
            };

            // 1. Squircle Device Status Avatar (42x42)
            Color statusColor = dev.isOnline ? FluentTheme.StatusOnline : FluentTheme.StatusOffline;
            var picCategory = new PictureBox
            {
                Size = new Size(44, 44),
                Location = new Point(16, (height - 44) / 2),
                BackColor = Color.Transparent
            };
            picCategory.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, picCategory.Width - 1, picCategory.Height - 1);

                Color bg = dev.isOnline ? FluentTheme.ThemeStatusOnlineBg : FluentTheme.ThemeSurfaceSoft;
                Color border = dev.isOnline ? Color.FromArgb(48, FluentTheme.ThemeStatusOnline) : FluentTheme.ThemeCardHairline;

                using (var b = new SolidBrush(bg))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, r, 10);
                }
                using (var p = new Pen(border, 1f))
                {
                    FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 10);
                }

                using var ico = FluentTheme.GetMenuIcon("remote", dev.isOnline ? FluentTheme.StatusOnline : FluentTheme.ThemeTextMuted, 20);
                e.Graphics.DrawImage(ico, (picCategory.Width - 20) / 2, (picCategory.Height - 20) / 2);

                // Small live status dot at bottom right
                int dotX = picCategory.Width - 12;
                int dotY = picCategory.Height - 12;
                using (var ringBrush = new SolidBrush(FluentTheme.ThemeCardFill))
                {
                    e.Graphics.FillEllipse(ringBrush, dotX - 2, dotY - 2, 12, 12);
                }
                using (var dotBrush = new SolidBrush(statusColor))
                {
                    e.Graphics.FillEllipse(dotBrush, dotX, dotY, 8, 8);
                }
            };
            pnl.Controls.Add(picCategory);

            // 2. Device Name & Title
            var lblDevName = new Label
            {
                Text = dev.deviceName,
                Font = FluentTheme.SubTitle,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(72, 18),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            pnl.Controls.Add(lblDevName);

            // 3. Site Badge
            var lblBadge = new Label
            {
                Text = dev.siteCode ?? "SPJ",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextSecondary,
                BackColor = FluentTheme.ThemeSurfaceSoft,
                Size = new Size(46, 22),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(lblDevName.Right + 8, 18),
                UseMnemonic = false
            };
            lblBadge.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, lblBadge.Width - 1, lblBadge.Height - 1);
                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 6);
            };
            pnl.Controls.Add(lblBadge);

            // 4. Subtitle / Metadata
            string statusStr = dev.isOnline ? "Active now" : $"Last seen: {dev.lastHeartbeat}";
            string ipText = string.IsNullOrWhiteSpace(dev.ipAddress) ? "N/A" : dev.ipAddress;
            var lblMeta = new Label
            {
                Text = $"Employee: {dev.employeeName} ({dev.employeeId})   •   IP: {ipText}   •   {statusStr}",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(72, 46),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            pnl.Controls.Add(lblMeta);

            // 5. Action Button: Remote Desktop
            var btnRemote = new GlassButton
            {
                Text = dev.isOnline ? "Connect" : "Offline",
                Glyph = "remote",
                Variant = dev.isOnline ? GlassButtonVariant.Accent : GlassButtonVariant.Ghost,
                Size = new Size(156, 38),
                Location = new Point(width - 172, (height - 38) / 2),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Radius = 8,
                Font = FluentTheme.SubTextBold,
                Enabled = dev.isOnline
            };
            btnRemote.Click += (s, e) =>
            {
                OnConnectRequested?.Invoke(dev);
            };
            pnl.Controls.Add(btnRemote);

            pnl.Resize += (s, e) =>
            {
                btnRemote.Location = new Point(pnl.ClientSize.Width - 172, (pnl.ClientSize.Height - 38) / 2);
            };

            pnl.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, pnl.ClientRectangle, 12);
            };

            AttachWheelRecursive(pnl);

            return pnl;
        }

        private void AttachWheelRecursive(Control ctrl)
        {
            ctrl.MouseWheel += (s, e) => _scrollBar.DoMouseWheel(e.Delta);
            foreach (Control c in ctrl.Controls)
            {
                AttachWheelRecursive(c);
            }
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
    }
}
