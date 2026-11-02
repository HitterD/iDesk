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

            _slideshowUrls = images != null && images.Count > 0 ? images : new List<string>();
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
            _lblStatusTitle.Text = "Remote assistance session active";
            _lblCountdown.Text = "A technician is controlling this computer. You can still see the screen.";
            _lblCountdown.ForeColor = FluentTheme.FixedDarkOnline;
            _btnDisconnect.Text = "End remote session";
            int discW = TextRenderer.MeasureText(_btnDisconnect.Text, _btnDisconnect.Font).Width + 48;
            _btnDisconnect.Size = new Size(discW, 52);
            _btnDisconnect.Location = new Point(Width - discW - 40, 58);
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
                    _btnDisconnect.Text = $"Deny access ({_remainingSeconds}s)";
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
