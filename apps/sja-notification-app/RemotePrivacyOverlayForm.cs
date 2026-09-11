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

        private const int OverlayPipWidth = 480;
        private const int OverlayPipHeight = 270;
        private const int OverlayBarHeightActive = 170;

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
        private Panel _pnlMedia = null!;
        private AxWMPLib.AxWindowsMediaPlayer? _videoPlayer;
        private Panel _pnlBottom = null!;
        private Label _lblStatusTitle = null!;
        private Label _lblAgentInfo = null!;
        private Label _lblCountdown = null!;
        private Label _lblCountdownBig = null!;
        private GlassButton _btnAllowNow = null!;
        private GlassButton _btnDisconnect = null!;
        private string _videoUrl = string.Empty;
        private string _contentType = "IMAGE"; // IMAGE | VIDEO
        private bool _consentGranted;
        private Rectangle _prevBounds;
        private FormWindowState _prevWindowState = FormWindowState.Maximized;
        private Size _prevMediaSize = Size.Empty;

        public event Action? OnConsentGranted;
        public event Action? OnSessionTerminatedByUser;

        public RemotePrivacyOverlayForm(string agentName, string agentIp, List<string>? images = null, int countdownSeconds = 10, string contentType = "IMAGE", string videoUrl = "")
        {
            _agentName = string.IsNullOrWhiteSpace(agentName) ? "Santos ICT Support" : agentName;
            _agentIp = string.IsNullOrWhiteSpace(agentIp) ? "10.10.x.x" : agentIp;
            _remainingSeconds = countdownSeconds > 0 ? countdownSeconds : 10;
            _contentType = string.Equals(contentType, "VIDEO", StringComparison.OrdinalIgnoreCase) ? "VIDEO" : "IMAGE";
            _videoUrl = videoUrl?.Trim() ?? "";

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
            ApplyContentVisibility();
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

            // Media area: slideshow gambar atau video (mode awal dari server)
            _pnlMedia = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(15, 23, 42)
            };
            _picSlide = new PictureBox
            {
                Dock = DockStyle.Fill,
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.FromArgb(15, 23, 42),
                Enabled = false // jangan menelan klik/mouse: input agent harus tembus ke desktop
            };
            _pnlMedia.Controls.Add(_picSlide);
            Controls.Add(_pnlMedia);

            try
            {
                _videoPlayer = new AxWMPLib.AxWindowsMediaPlayer();
                ((System.ComponentModel.ISupportInitialize)_videoPlayer).BeginInit();
                _videoPlayer.Dock = DockStyle.Fill;
                _videoPlayer.Enabled = true;
                _videoPlayer.Visible = false;
                _pnlMedia.Controls.Add(_videoPlayer);
                ((System.ComponentModel.ISupportInitialize)_videoPlayer).EndInit();
                _videoPlayer.settings.mute = true;
                _videoPlayer.settings.autoStart = true;
                _videoPlayer.uiMode = "none";
                _videoPlayer.stretchToFit = true;
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[PrivacyOverlay] Player video tidak tersedia, fallback ke gambar: {ex.Message}");
                _videoPlayer = null;
            }

            // Bottom bar status & aksi (lebih tinggi agar teks besar terbaca jelas)
            _pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = OverlayBarHeightActive,
                BackColor = Color.FromArgb(220, 15, 23, 42),
                Padding = new Padding(32, 18, 32, 18)
            };

            _lblStatusTitle = new Label
            {
                Text = "PERMINTAAN BANTUAN REMOTE SANTOS ICT",
                Font = new Font(FluentTheme.Body.FontFamily, 20f, FontStyle.Bold),
                ForeColor = Color.FromArgb(59, 130, 246),
                Location = new Point(32, 16),
                AutoSize = true
            };

            _lblAgentInfo = new Label
            {
                Text = $"Petugas: {_agentName}  •  Alamat IP: {_agentIp}",
                Font = new Font(FluentTheme.Body.FontFamily, 13f, FontStyle.Regular),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(32, 54),
                AutoSize = true
            };

            _lblCountdown = new Label
            {
                Text = "Petugas meminta izin mengendalikan komputer ini.",
                Font = new Font(FluentTheme.Body.FontFamily, 14f, FontStyle.Bold),
                ForeColor = Color.FromArgb(251, 191, 36),
                Location = new Point(32, 84),
                AutoSize = true
            };

            _lblCountdownBig = new Label
            {
                Text = _remainingSeconds.ToString(),
                Font = new Font(FluentTheme.Body.FontFamily, 30f, FontStyle.Bold),
                ForeColor = Color.FromArgb(251, 191, 36),
                Location = new Point(32, 112),
                AutoSize = true
            };

            _btnAllowNow = new GlassButton
            {
                Text = "IZINKAN SEKARANG",
                Size = new Size(260, 60),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point((Screen.PrimaryScreen?.Bounds.Width ?? 1000) - 300, 55),
                Variant = GlassButtonVariant.Accent,
                Radius = 10,
                Font = new Font(FluentTheme.Body.FontFamily, 13f, FontStyle.Bold)
            };
            _btnAllowNow.Click += (s, e) => GrantConsentFromUser();
            AcceptButton = _btnAllowNow;

            _btnDisconnect = new GlassButton
            {
                Text = $"TOLAK AKSES ({_remainingSeconds}s)",
                Size = new Size(260, 60),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point((Screen.PrimaryScreen?.Bounds.Width ?? 1000) - 580, 55),
                Variant = GlassButtonVariant.Danger,
                Radius = 10,
                Font = new Font(FluentTheme.Body.FontFamily, 13f, FontStyle.Bold)
            };
            _btnDisconnect.Click += (s, e) =>
            {
                OnSessionTerminatedByUser?.Invoke();
                Close();
            };

            _pnlBottom.Controls.AddRange(new Control[] { _lblStatusTitle, _lblAgentInfo, _lblCountdown, _lblCountdownBig, _btnAllowNow, _btnDisconnect });
            Controls.Add(_pnlBottom);
            _pnlBottom.BringToFront();

            Resize += (s, e) =>
            {
                _btnAllowNow.Location = new Point(Width - 300, 55);
                _btnDisconnect.Location = new Point(Width - 580, 55);
                // PiP selalu terkunci di kanan-bawah, tidak bisa di-resize user
                if (WindowState == FormWindowState.Normal && _prevMediaSize != Size.Empty)
                {
                    var work = Screen.FromControl(this).WorkingArea;
                    Location = new Point(work.Right - Width - 16, work.Bottom - Height - 16);
                }
            };
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                // Click-through OS-level: overlay TIDAK PERNAH menelan klik/mouse,
                // baik dari user lokal maupun input agent (mouse_event/keybd_event).
                // Panel bawah dikecualikan via WM_NCHITTEST di bawah agar tombol tetap bisa diklik.
                if (_consentGranted) cp.ExStyle |= WS_EX_TRANSPARENT;
                return cp;
            }
        }

        protected override void WndProc(ref Message m)
        {
            // Area tombol bawah harus tetap bisa diklik; area media tembus ke desktop
            // HANYA setelah consent (sebelum consent overlay menahan semua klik).
            if (m.Msg == WM_NCHITTEST)
            {
                base.WndProc(ref m);
                if (!_consentGranted) return; // fase countdown: blokir semua klik
                if (_pnlBottom != null && _pnlBottom.ClientRectangle.Contains(_pnlBottom.PointToClient(PointToScreen(
                    PointToClient(new Point(m.LParam.ToInt32() & 0xFFFF, m.LParam.ToInt32() >> 16))))))
                {
                    return; // biarkan hasil hit-test normal (tombol bisa diklik)
                }
                m.Result = (IntPtr)HTTRANSPARENT;
                return;
            }
            base.WndProc(ref m);
        }

        private void GrantConsentFromUser()
        {
            if (_consentGranted) return;
            _consentGranted = true;
            _countdownTimer?.Stop();
            _btnAllowNow.Visible = false;
            _lblCountdownBig.Visible = false;
            _lblStatusTitle.Text = "SESI BANTUAN REMOTE AKTIF";
            _lblCountdown.Text = "Petugas sedang mengendalikan komputer ini. Anda tetap bisa melihat layarnya.";
            _lblCountdown.ForeColor = Color.FromArgb(52, 211, 153);
            _btnDisconnect.Text = "PUTUSKAN SESI REMOTE";
            _btnDisconnect.Size = new Size(300, 60);
            _btnDisconnect.Location = new Point(Width - 340, 55);
            // Terapkan click-through OS-level sekarang (RecreateHandle agar CreateParams dibaca ulang)
            try { RecreateHandle(); ApplyDisplayAffinityProtection(); } catch { }
            OnConsentGranted?.Invoke();
        }

        /// <summary>
        /// Dipanggil HANYA via sinyal agent/admin (REMOTE_SIGNAL SET_OVERLAY_MODE).
        /// User lokal tidak memiliki tombol untuk ini.
        /// </summary>
        public void ApplyOperatorOverlayMode(string overlayMode, string? contentType = null, string? mediaUrl = null)
        {
            if (IsDisposed) return;
            if (!string.IsNullOrWhiteSpace(contentType)) SetContentType(contentType, mediaUrl);
            bool pip = string.Equals(overlayMode, "PIP", StringComparison.OrdinalIgnoreCase);
            if (InvokeRequired) { BeginInvoke(new Action(() => ApplyOperatorOverlayMode(overlayMode, null, null))); return; }

            if (pip)
            {
                if (WindowState != FormWindowState.Normal || _prevMediaSize == Size.Empty)
                {
                    _prevBounds = Bounds;
                    _prevWindowState = WindowState;
                    _prevMediaSize = _pnlMedia.Size;
                }
                FormBorderStyle = FormBorderStyle.SizableToolWindow;
                MaximizeBox = false;
                MinimizeBox = false;
                TopMost = true;
                ShowInTaskbar = true;
                WindowState = FormWindowState.Normal;
                Size = new Size(OverlayPipWidth, OverlayPipHeight + _pnlBottom.Height);
                var work = Screen.FromControl(this).WorkingArea;
                Location = new Point(work.Right - Width - 16, work.Bottom - Height - 16);
            }
            else
            {
                FormBorderStyle = FormBorderStyle.None;
                TopMost = true;
                WindowState = FormWindowState.Maximized;
                _prevMediaSize = Size.Empty;
            }
            AppLogger.Info($"[PrivacyOverlay] Mode overlay diubah operator menjadi {(pip ? "PIP" : "FULL")}, konten={_contentType}");
        }

        public void SetContentType(string contentType, string? mediaUrl = null)
        {
            bool wantVideo = string.Equals(contentType, "VIDEO", StringComparison.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(mediaUrl)) _videoUrl = mediaUrl.Trim();
            if (wantVideo && string.IsNullOrWhiteSpace(_videoUrl))
            {
                AppLogger.Warn("[PrivacyOverlay] Mode VIDEO diminta tanpa URL, fallback ke IMAGE");
                wantVideo = false;
            }
            if (wantVideo && _videoPlayer == null)
            {
                AppLogger.Warn("[PrivacyOverlay] Player video tidak tersedia, fallback ke IMAGE");
                wantVideo = false;
            }
            _contentType = wantVideo ? "VIDEO" : "IMAGE";
            if (InvokeRequired) { BeginInvoke(new Action(() => ApplyContentVisibility())); return; }
            ApplyContentVisibility();
        }

        private void ApplyContentVisibility()
        {
            bool showVideo = _contentType == "VIDEO" && _videoPlayer != null && !string.IsNullOrWhiteSpace(_videoUrl);
            if (_videoPlayer != null) _videoPlayer.Visible = showVideo;
            _picSlide.Visible = !showVideo;
            if (showVideo)
            {
                try
                {
                    _videoPlayer!.settings.mute = true;
                    _videoPlayer!.URL = _videoUrl;
                    _videoPlayer!.Ctlcontrols.play();
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[PrivacyOverlay] Gagal memutar video, fallback ke gambar: {ex.Message}");
                    _contentType = "IMAGE";
                    _videoPlayer!.Visible = false;
                    _picSlide.Visible = true;
                }
            }
            else
            {
                try { if (_videoPlayer != null) _videoPlayer.Ctlcontrols.stop(); } catch { }
            }
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
            _lblCountdownBig.Text = _remainingSeconds.ToString();
            _countdownTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _countdownTimer.Tick += (s, e) =>
            {
                _remainingSeconds--;
                if (_remainingSeconds > 0)
                {
                    _lblCountdownBig.Text = _remainingSeconds.ToString();
                    _btnDisconnect.Text = $"TOLAK AKSES ({_remainingSeconds}s)";
                }
                else
                {
                    GrantConsentFromUser();
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
            try { if (_videoPlayer != null) _videoPlayer.Ctlcontrols.stop(); } catch { }
            try { if (_videoPlayer != null) _videoPlayer.close(); } catch { }
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
