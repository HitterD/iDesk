using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Jendela Privacy Overlay Fullscreen sisi Pengguna yang di-remote.
    /// Memakai WDA_EXCLUDEFROMCAPTURE (SetWindowDisplayAffinity) agar tampak di monitor fisik user,
    /// namun sama sekali TIDAK TEREKAM oleh capture engine / tidak terlihat oleh agent peremote.
    /// Menampilkan slideshow 5 foto / pesan resmi Santos, countdown veto, dan tombol Putuskan Sesi.
    /// </summary>
    public class RemotePrivacyOverlayForm : Form
    {
        private const uint WDA_NONE = 0x00000000;
        private const uint WDA_MONITOR = 0x00000001;
        private const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011; // Windows 10 build 19041+

        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WM_NCHITTEST = 0x0084;
        private const int HTTRANSPARENT = -1;

        [DllImport("user32.dll")]
        private static extern uint SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        private const int GWL_EXSTYLE = -20;

        private readonly string _agentName;
        private readonly string _agentIp;
        private readonly List<string> _slideshowUrls;
        private readonly List<Image> _loadedImages = new();
        private int _currentSlideIndex = 0;
        private System.Windows.Forms.Timer? _slideTimer;
        private System.Windows.Forms.Timer? _countdownTimer;
        private int _remainingSeconds = 10;

        private PictureBox _picSlide = null!;
        private Panel _pnlBottom = null!;
        private Label _lblStatusTitle = null!;
        private Label _lblAgentInfo = null!;
        private Label _lblCountdown = null!;
        private GlassButton _btnAllowNow = null!;
        private GlassButton _btnDisconnect = null!;
        private GlassButton _btnMinimize = null!;

        public event Action? OnConsentGranted;
        public event Action? OnSessionTerminatedByUser;

        public RemotePrivacyOverlayForm(string agentName, string agentIp, List<string>? images = null, int countdownSeconds = 10)
        {
            _agentName = string.IsNullOrWhiteSpace(agentName) ? "Santos ICT Support" : agentName;
            _agentIp = string.IsNullOrWhiteSpace(agentIp) ? "10.10.x.x" : agentIp;
            _remainingSeconds = countdownSeconds > 0 ? countdownSeconds : 10;

            _slideshowUrls = images != null && images.Count > 0 ? images : new List<string>
            {
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1200&auto=format&fit=crop"
            };

            InitializeComponent();
            ApplyDisplayAffinityProtection();

            // Set default high-res corporate wallpaper immediately (100% offline safety)
            _picSlide.Image = GenerateCorporateOfflineShieldImage();

            StartSlideshowAsync();
            StartCountdown();
        }

        private Image GenerateCorporateOfflineShieldImage()
        {
            int w = Math.Max(1920, Screen.PrimaryScreen?.Bounds.Width ?? 1920);
            int h = Math.Max(1080, Screen.PrimaryScreen?.Bounds.Height ?? 1080);
            var bmp = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // Corporate deep navy gradient
            using (var brush = new LinearGradientBrush(new Rectangle(0, 0, w, h),
                Color.FromArgb(15, 58, 117), Color.FromArgb(11, 19, 43), 45f))
            {
                g.FillRectangle(brush, 0, 0, w, h);
            }

            // Subtle geometric accent lines
            using var pen = new Pen(Color.FromArgb(20, 255, 255, 255), 1.5f);
            for (int x = -h; x < w + h; x += 140)
            {
                g.DrawLine(pen, x, 0, x + h, h);
            }

            // Center shield text
            using var titleFont = new Font("Segoe UI", 30f, FontStyle.Bold);
            using var subFont = new Font("Segoe UI", 15f, FontStyle.Regular);
            using var descFont = new Font("Segoe UI", 12f, FontStyle.Regular);
            using var brushWhite = new SolidBrush(Color.White);
            using var brushAccent = new SolidBrush(Color.FromArgb(96, 165, 250));
            using var brushSub = new SolidBrush(Color.FromArgb(203, 213, 225));
            using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

            g.DrawString("PT SANTOS JAYA ABADI", titleFont, brushWhite, new RectangleF(0, h / 2 - 80, w, 50), sf);
            g.DrawString("🔒 ICT REMOTE ASSISTANCE & PRIVACY SHIELD", subFont, brushAccent, new RectangleF(0, h / 2 - 20, w, 35), sf);
            g.DrawString("Layar kerja Anda terproteksi dari intipan luar selama sesi bantuan teknis berlangsung.", descFont, brushSub, new RectangleF(0, h / 2 + 25, w, 30), sf);

            return bmp;
        }

        private void InitializeComponent()
        {
            Text = "SJA Remote Assistance • Privacy Shield";
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            TopMost = true;
            ShowInTaskbar = true;
            BackColor = Color.FromArgb(15, 23, 42);
            ForeColor = Color.White;
            DoubleBuffered = true;

            // Background / Slideshow Display
            _picSlide = new PictureBox
            {
                Dock = DockStyle.Fill,
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.FromArgb(15, 23, 42)
            };
            Controls.Add(_picSlide);

            // Overlay Bottom Bar with Status & Putuskan Sesi
            _pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 110,
                BackColor = Color.FromArgb(220, 15, 23, 42),
                Padding = new Padding(32, 16, 32, 16)
            };

            _lblStatusTitle = new Label
            {
                Text = "🔒 SESI BANTUAN REMOTE SANTOS ICT AKTIF",
                Font = FluentTheme.SubTitle,
                ForeColor = Color.FromArgb(59, 130, 246),
                Location = new Point(32, 18),
                AutoSize = true
            };

            _lblAgentInfo = new Label
            {
                Text = $"Petugas: {_agentName}  •  Alamat IP: {_agentIp}  •  Layar kerja Anda terproteksi dari intipan luar",
                Font = FluentTheme.Body,
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(32, 48),
                AutoSize = true
            };

            _lblCountdown = new Label
            {
                Text = $"Memulai dalam {_remainingSeconds} detik... (Klik 'Tolak' untuk membatalkan)",
                Font = FluentTheme.Caption,
                ForeColor = Color.FromArgb(251, 191, 36),
                Location = new Point(32, 74),
                AutoSize = true
            };

            _btnAllowNow = new GlassButton
            {
                Text = "Izinkan Segera",
                Size = new Size(150, 48),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point((Screen.PrimaryScreen?.Bounds.Width ?? 1000) - 380, 28),
                Variant = GlassButtonVariant.Accent,
                Radius = 8
            };
            _btnAllowNow.Click += (s, e) =>
            {
                _countdownTimer?.Stop();
                _btnAllowNow.Visible = false;
                _lblCountdown.Text = "Sesi remote aktif. Anda dapat memutuskan kendali kapan saja.";
                _lblCountdown.ForeColor = Color.FromArgb(52, 211, 153);
                _btnDisconnect.Text = "Putuskan Sesi Remote";
                OnConsentGranted?.Invoke();
            };

            _btnDisconnect = new GlassButton
            {
                Text = "Tolak Akses (10s)",
                Size = new Size(180, 48),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point((Screen.PrimaryScreen?.Bounds.Width ?? 1000) - 220, 28),
                Variant = GlassButtonVariant.Danger,
                Radius = 8
            };
            _btnDisconnect.Click += (s, e) =>
            {
                OnSessionTerminatedByUser?.Invoke();
                Close();
            };

            _btnMinimize = new GlassButton
            {
                Text = "Pantau Layar 🗕",
                Size = new Size(160, 48),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point((Screen.PrimaryScreen?.Bounds.Width ?? 1000) - 560, 28),
                Variant = GlassButtonVariant.Ghost,
                Radius = 8
            };
            _btnMinimize.Click += (s, e) =>
            {
                WindowState = FormWindowState.Minimized;
            };

            _pnlBottom.Controls.AddRange(new Control[] { _lblStatusTitle, _lblAgentInfo, _lblCountdown, _btnMinimize, _btnAllowNow, _btnDisconnect });
            Controls.Add(_pnlBottom);
            _pnlBottom.BringToFront();

            Resize += (s, e) =>
            {
                _btnDisconnect.Location = new Point(Width - 220, 28);
                _btnAllowNow.Location = new Point(Width - 390, 28);
                _btnMinimize.Location = new Point(Width - 560, 28);
            };
        }

        protected override void WndProc(ref Message m)
        {
            // Transparent click-through passthrough for picture area so remote agent can click background desktop
            if (m.Msg == WM_NCHITTEST)
            {
                base.WndProc(ref m);
                Point pt = PointToClient(new Point(m.LParam.ToInt32() & 0xFFFF, m.LParam.ToInt32() >> 16));
                if (_pnlBottom != null && !_pnlBottom.ClientRectangle.Contains(_pnlBottom.PointToClient(PointToScreen(pt))))
                {
                    m.Result = (IntPtr)HTTRANSPARENT;
                    return;
                }
            }
            base.WndProc(ref m);
        }

        private void ApplyDisplayAffinityProtection()
        {
            try
            {
                // WDA_EXCLUDEFROMCAPTURE: Jendela tampil di layar fisik pengguna,
                // tapi API screen-capture (seperti BitBlt/GDI/DirectX) akan menangkap transparan / layar di belakangnya.
                uint result = SetWindowDisplayAffinity(Handle, WDA_EXCLUDEFROMCAPTURE);
                AppLogger.Info($"[PrivacyOverlay] SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) result: {result}");
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[PrivacyOverlay] Gagal set display affinity: {ex.Message}");
            }
        }

        private async void StartSlideshowAsync()
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

            foreach (var url in _slideshowUrls)
            {
                try
                {
                    byte[] data = await client.GetByteArrayAsync(url);
                    using var ms = new MemoryStream(data);
                    using var temp = Image.FromStream(ms);
                    _loadedImages.Add(new Bitmap(temp));
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[PrivacyOverlay] Gagal memuat slide remote '{url}': {ex.Message}");
                }
            }

            if (_loadedImages.Count > 0)
            {
                var fallback = _picSlide.Image;
                _picSlide.Image = _loadedImages[0];
                fallback?.Dispose();
                _slideTimer = new System.Windows.Forms.Timer { Interval = 5000 };
                _slideTimer.Tick += (s, e) =>
                {
                    _currentSlideIndex = (_currentSlideIndex + 1) % _loadedImages.Count;
                    _picSlide.Image = _loadedImages[_currentSlideIndex];
                };
                _slideTimer.Start();
            }
        }

        private void StartCountdown()
        {
            _countdownTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _countdownTimer.Tick += (s, e) =>
            {
                _remainingSeconds--;
                if (_remainingSeconds > 0)
                {
                    _lblCountdown.Text = $"Memulai dalam {_remainingSeconds} detik... (Klik 'Tolak' untuk membatalkan)";
                    _btnDisconnect.Text = $"Tolak Akses ({_remainingSeconds}s)";
                }
                else
                {
                    _countdownTimer.Stop();
                    _btnAllowNow.Visible = false;
                    _lblCountdown.Text = "Sesi remote aktif. Anda dapat memutuskan kendali kapan saja.";
                    _lblCountdown.ForeColor = Color.FromArgb(52, 211, 153);
                    _btnDisconnect.Text = "Putuskan Sesi Remote";
                    OnConsentGranted?.Invoke();
                }
            };
            _countdownTimer.Start();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            _slideTimer?.Stop();
            _slideTimer?.Dispose();
            _countdownTimer?.Stop();
            _countdownTimer?.Dispose();
            _picSlide.Image?.Dispose();
            foreach (var image in _loadedImages)
            {
                if (!ReferenceEquals(image, _picSlide.Image)) image.Dispose();
            }
            _loadedImages.Clear();
            base.OnFormClosing(e);
        }
    }
}
