using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
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
    /// Menampilkan daftar seluruh PC dengan SJA Notifier, IP address, status online/offline, dan tombol Remote Desktop.
    /// </summary>
    public class RemoteDeviceBrowserForm : Form
    {
        private readonly AppConfig _config;
        private readonly HttpClient _httpClient;
        private List<DeviceDirectoryItem> _allDevices = new();
        private List<DeviceDirectoryItem> _filteredDevices = new();

        private Panel _pnlHeader = null!;
        private Panel _pnlContent = null!;
        private Panel _pnlCards = null!;
        private FluentScrollBar _scrollBar = null!;
        private TextBox _txtSearch = null!;
        private ComboBox _cbSite = null!;
        private Label _lblStatusInfo = null!;
        private GlassButton _btnRefresh = null!;
        private GlassButton _btnClose = null!;
        private GlassButton _btnMax = null!;
        private GlassButton _btnMin = null!;

        public Action<DeviceDirectoryItem>? OnConnectRequested;

        public RemoteDeviceBrowserForm(AppConfig config)
        {
            if (!RemoteAccessPolicy.IsRemoteOperator(DeviceSecurityStorage.LoadSession()?.Role))
            {
                throw new UnauthorizedAccessException("Fitur Remote Desktop hanya tersedia untuk akun ADMIN atau AGENT.");
            }
            _config = config;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

            InitializeComponent();
            FluentTheme.ApplyWindows11Styles(Handle);
            _ = LoadDevicesAsync();
        }

        private void InitializeComponent()
        {
            Text = "SJA Remote Desktop • Direktori Perangkat Santos";
            Size = new Size(1100, 720);
            MinimumSize = new Size(720, 520);
            FormBorderStyle = FormBorderStyle.Sizable;
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

            // ================= HEADER =================
            _pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 68,
                BackColor = FluentTheme.ThemeCardFill,
                Padding = new Padding(18, 12, 14, 12)
            };

            var lblTitle = new Label
            {
                Text = "SJA Remote Desktop",
                Font = FluentTheme.SubTitle,
                ForeColor = FluentTheme.ThemeTextPrimary,
                AutoSize = true,
                Location = new Point(18, 14)
            };

            var lblSubtitle = new Label
            {
                Text = "Pilih perangkat Santos yang online untuk memulai kendali jarak jauh (AnyDesk-style)",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                AutoSize = true,
                Location = new Point(18, 38)
            };

            _btnClose = new GlassButton
            {
                Text = "✕",
                Size = new Size(32, 32),
                Location = new Point(Width - 46, 16),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6
            };
            _btnClose.Click += (s, e) => Close();

            _btnMax = new GlassButton
            {
                Text = "🗖",
                Size = new Size(32, 32),
                Location = new Point(Width - 82, 16),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6
            };
            _btnMax.Click += (s, e) =>
            {
                WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
                _btnMax.Text = WindowState == FormWindowState.Maximized ? "🗗" : "🗖";
            };

            _btnMin = new GlassButton
            {
                Text = "—",
                Size = new Size(32, 32),
                Location = new Point(Width - 118, 16),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6
            };
            _btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;

            _pnlHeader.Controls.AddRange(new Control[] { lblTitle, lblSubtitle, _btnMin, _btnMax, _btnClose });
            _pnlHeader.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            lblTitle.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            lblSubtitle.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);

            // ================= FILTER / TOOLBAR =================
            var pnlFilter = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = FluentTheme.ThemeCanvasTop,
                Padding = new Padding(18, 10, 18, 8)
            };

            _txtSearch = new TextBox
            {
                Location = new Point(18, 12),
                Width = 320,
                Height = 28,
                Font = FluentTheme.Body,
                BackColor = FluentTheme.ThemeCardFill,
                ForeColor = FluentTheme.ThemeTextPrimary,
                BorderStyle = BorderStyle.FixedSingle,
                PlaceholderText = "Cari nama PC, NIK, nama karyawan, atau IP..."
            };
            _txtSearch.TextChanged += (s, e) => ApplyFilter();

            _cbSite = new ComboBox
            {
                Location = new Point(350, 12),
                Width = 140,
                Height = 28,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = FluentTheme.Body,
                BackColor = FluentTheme.ThemeCardFill,
                ForeColor = FluentTheme.ThemeTextPrimary
            };
            _cbSite.Items.AddRange(new object[] { "Semua Site (ALL)", "SPJ (Sepanjang)", "KRW (Karawang)", "JTB (Jatake)", "SMG (Semarang)" });
            _cbSite.SelectedIndex = 0;
            _cbSite.SelectedIndexChanged += (s, e) => ApplyFilter();

            _btnRefresh = new GlassButton
            {
                Text = "Segarkan",
                Glyph = "test",
                Size = new Size(100, 28),
                Location = new Point(500, 12),
                Variant = GlassButtonVariant.Ghost,
                Radius = 6
            };
            _btnRefresh.Click += async (s, e) => await LoadDevicesAsync();

            _lblStatusInfo = new Label
            {
                Location = new Point(610, 16),
                AutoSize = true,
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Text = "Memuat data..."
            };

            pnlFilter.Controls.AddRange(new Control[] { _txtSearch, _cbSite, _btnRefresh, _lblStatusInfo });

            // ================= BODY & CARD LIST =================
            _pnlContent = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = FluentTheme.ThemeCanvasTop,
                Padding = new Padding(18, 0, 18, 14)
            };

            _pnlCards = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = false,
                BackColor = FluentTheme.ThemeCanvasTop
            };

            _scrollBar = new FluentScrollBar
            {
                Dock = DockStyle.Right,
                Width = 8,
                Visible = false
            };
            _scrollBar.ValueChanged += (s, e) =>
            {
                _pnlCards.AutoScrollPosition = new Point(0, _scrollBar.Value);
            };

            _pnlContent.Controls.Add(_pnlCards);
            _pnlContent.Controls.Add(_scrollBar);

            pnlRoot.Controls.Add(_pnlContent);
            pnlRoot.Controls.Add(pnlFilter);
            pnlRoot.Controls.Add(_pnlHeader);
            Controls.Add(pnlRoot);

            Resize += (s, e) =>
            {
                _btnClose.Location = new Point(Width - 46, 16);
                _btnMax.Location = new Point(Width - 82, 16);
                _btnMin.Location = new Point(Width - 118, 16);
                _btnMax.Text = WindowState == FormWindowState.Maximized ? "🗗" : "🗖";
                RenderCards();
            };
        }

        private async Task LoadDevicesAsync()
        {
            _btnRefresh.Enabled = false;
            _lblStatusInfo.Text = "Menghubungi server...";

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
                    _lblStatusInfo.Text = $"Gagal ({res.StatusCode})";
                }
            }
            catch (Exception ex)
            {
                _lblStatusInfo.Text = "Koneksi terputus";
                AppLogger.Error("Gagal mengambil data perangkat dari server", ex);
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

            int onlineCount = _allDevices.Count(d => d.isOnline);
            _lblStatusInfo.Text = $"{onlineCount} Online • {_filteredDevices.Count} Ditampilkan";

            RenderCards();
        }

        private void RenderCards()
        {
            _pnlCards.SuspendLayout();
            _pnlCards.Controls.Clear();

            if (_filteredDevices.Count == 0)
            {
                var lblEmpty = new Label
                {
                    Text = "Tidak ada perangkat yang cocok dengan kriteria pencarian.",
                    Font = FluentTheme.Body,
                    ForeColor = FluentTheme.ThemeTextSecondary,
                    TextAlign = ContentAlignment.MiddleCenter,
                    Dock = DockStyle.Fill
                };
                _pnlCards.Controls.Add(lblEmpty);
                _pnlCards.ResumeLayout();
                _scrollBar.Visible = false;
                return;
            }

            int cardHeight = 82;
            int gap = 8;
            int y = 4;
            int cardWidth = _pnlCards.Width - (_scrollBar.Visible ? 14 : 4);
            if (cardWidth < 200) cardWidth = 600;

            foreach (var dev in _filteredDevices)
            {
                var card = CreateDeviceCard(dev, cardWidth, cardHeight);
                card.Location = new Point(2, y);
                _pnlCards.Controls.Add(card);
                y += cardHeight + gap;
            }

            _pnlCards.AutoScrollMinSize = new Size(0, y + 10);
            _scrollBar.Maximum = Math.Max(0, y - _pnlCards.Height + 10);
            _scrollBar.Visible = _scrollBar.Maximum > 0;

            _pnlCards.ResumeLayout();
        }

        private Panel CreateDeviceCard(DeviceDirectoryItem dev, int width, int height)
        {
            var pnl = new Panel
            {
                Size = new Size(width, height),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BackColor = FluentTheme.ThemeCardFill,
                Padding = new Padding(14, 10, 14, 10)
            };

            // Status Indicator Circle
            Color statusColor = dev.isOnline ? Color.FromArgb(16, 185, 129) : Color.FromArgb(156, 163, 175);
            var pnlIndicator = new Panel
            {
                Size = new Size(12, 12),
                Location = new Point(14, 18),
                BackColor = Color.Transparent
            };
            pnlIndicator.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var b = new SolidBrush(statusColor);
                e.Graphics.FillEllipse(b, 1, 1, 10, 10);
            };

            // Device & Employee Title
            var lblDevName = new Label
            {
                Text = dev.deviceName,
                Font = FluentTheme.SubTitle,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(34, 12),
                AutoSize = true
            };

            var lblBadge = new Label
            {
                Text = dev.siteCode ?? "SPJ",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeAccent,
                BackColor = Color.FromArgb(20, FluentTheme.ThemeAccent),
                Padding = new Padding(4, 2, 4, 2),
                AutoSize = true,
                Location = new Point(lblDevName.Right + 8, 14)
            };

            // Subtitle: User & IP info
            string statusStr = dev.isOnline ? "Aktif Sekarang" : $"Terakhir: {dev.lastHeartbeat}";
            var lblMeta = new Label
            {
                Text = $"Karyawan: {dev.employeeName} ({dev.employeeId})  •  IP: {dev.ipAddress}  •  Status: {statusStr}",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(34, 38),
                AutoSize = true
            };

            // Action Button: Remote Desktop
            var btnRemote = new GlassButton
            {
                Text = "Mulai Remote",
                Glyph = "remote",
                Variant = dev.isOnline ? GlassButtonVariant.Accent : GlassButtonVariant.Ghost,
                Size = new Size(130, 36),
                Location = new Point(width - 150, (height - 36) / 2),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Radius = 6,
                Enabled = dev.isOnline
            };
            btnRemote.Click += (s, e) =>
            {
                OnConnectRequested?.Invoke(dev);
            };

            pnl.Controls.AddRange(new Control[] { pnlIndicator, lblDevName, lblBadge, lblMeta, btnRemote });

            pnl.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, pnl.ClientRectangle, 8);
            };

            return pnl;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
            e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
        }
    }
}
