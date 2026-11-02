using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Secure AnyDesk-style Agent Viewer Console.
    /// Requests a server-authorized session, authenticates the P2P connection,
    /// renders tile-diff frames, and performs streamed file transfer without size limits.
    /// </summary>
    public enum RemoteSessionState
    {
        Requesting,
        Authenticating,
        AwaitingConsent,
        Connecting,
        Connected,
        Disconnected,
        Failed
    }

    public class RemoteViewerForm : Form
    {
        private RemoteSessionState _state = RemoteSessionState.Requesting;
        private const int ConnectTimeoutMs = 5000;
        private static readonly TimeSpan AuthenticationTimeout = TimeSpan.FromSeconds(5);
        private const int FileChunkSize = 64 * 1024;

        private readonly AppConfig _config;
        private readonly DeviceDirectoryItem _targetDev;
        private readonly SjaNativeWebSocketClient? _sharedWsClient;
        private readonly SemaphoreSlim _sendLock = new(1, 1);
        private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(15) };

        private TcpClient? _tcpClient;
        private NetworkStream? _stream;
        private CancellationTokenSource? _cts;
        private Bitmap? _remoteCanvas;
        private string _sessionId = string.Empty;
        private string _sessionSecret = string.Empty;
        private string _agentDeviceId = string.Empty;
        private string? _pendingTransferId;
        private TaskCompletionSource<bool>? _fileApprovalTcs;

        private Panel _pnlHeader = null!;
        private PictureBox _picScreen = null!;
        private Label _lblStatus = null!;
        private GlassButton _btnDisconnect = null!;
        private GlassButton _btnSendFile = null!;
        private GlassButton _btnOverlaySize = null!;
        private GlassButton _btnOverlayContent = null!;
        private GlassButton _btnFullscreen = null!;
        private GlassButton _btnMax = null!;
        private GlassButton _btnMin = null!;
        private GlassButton _btnClose = null!;
        private string _overlayMode = "FULL"; // FULL | PIP (tampilan overlay di sisi user)
        private string _overlayContent = "IMAGE"; // IMAGE | VIDEO
        private bool _isFullscreen;
        private FormBorderStyle _prevBorderStyle;
        private FormWindowState _prevWindowState;
        private Rectangle _prevBounds;

        private int _remoteWidth = 1920;
        private int _remoteHeight = 1080;
        private bool _isConnecting;
        private bool _isAuthenticated;
        private bool _useRelay;

        public RemoteViewerForm(AppConfig config, DeviceDirectoryItem targetDev, SjaNativeWebSocketClient? sharedWsClient = null)
        {
            _config = config;
            _targetDev = targetDev;
            _sharedWsClient = sharedWsClient;
            if (_sharedWsClient != null) _sharedWsClient.OnRemoteMessageReceived += HandleRelayMessage;

            InitializeComponent();
            FluentTheme.ApplyWindows11Styles(Handle);
            _ = ConnectToTargetAsync();
        }

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
            if (m.Msg == WM_NCHITTEST && !_isFullscreen)
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

        private void SetState(RemoteSessionState state, string? detail = null)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(() => SetState(state, detail)));
                return;
            }

            _state = state;
            (string text, Color color) = state switch
            {
                RemoteSessionState.Requesting => ("Requesting a secure session…", FluentTheme.FixedDarkTextSecondary),
                RemoteSessionState.Authenticating => ("Authenticating…", FluentTheme.FixedDarkTextSecondary),
                RemoteSessionState.AwaitingConsent => ("Waiting for user consent…", FluentTheme.FixedDarkWarn),
                RemoteSessionState.Connecting => ("Connecting…", FluentTheme.FixedDarkTextSecondary),
                RemoteSessionState.Connected => ("Connected • Session active", FluentTheme.FixedDarkOnline),
                RemoteSessionState.Disconnected => ("Session disconnected", FluentTheme.FixedDarkCritical),
                RemoteSessionState.Failed => ("Connection failed", FluentTheme.FixedDarkCritical),
                _ => ("", FluentTheme.FixedDarkTextSecondary)
            };

            _lblStatus.Text = string.IsNullOrEmpty(detail) ? text : $"{text} — {detail}";
            _lblStatus.ForeColor = color;
        }
        private void InitializeComponent()
        {
            Text = $"SJA Remote • {_targetDev.deviceName} ({_targetDev.ipAddress})";
            Size = new Size(1366, 820);
            MinimumSize = new Size(800, 600);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            Font = FluentTheme.Body;
            BackColor = FluentTheme.FixedDarkCanvas;
            ForeColor = FluentTheme.FixedDarkTextPrimary;
            ShowInTaskbar = true;
            DoubleBuffered = true;
            KeyPreview = true;

            try
            {
                string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "app.ico");
                Icon = File.Exists(icoPath) ? new Icon(icoPath) : SystemIcons.Application;
            }
            catch { Icon = SystemIcons.Application; }

            _pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = FluentTheme.FixedDarkSurface,
                Padding = new Padding(16, 6, 12, 6)
            };

            var picIcon = new PictureBox
            {
                Size = new Size(18, 18),
                Location = new Point(14, 13),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = FluentTheme.GetMenuIcon("remote", FluentTheme.FixedDarkTextSecondary, 18)
            };
            _pnlHeader.Controls.Add(picIcon);

            var lblTitle = new Label
            {
                Text = $"{_targetDev.deviceName}  •  {_targetDev.employeeName} ({_targetDev.ipAddress})",
                Font = FluentTheme.GetFont(10.5F, FontStyle.Bold),
                ForeColor = FluentTheme.FixedDarkTextPrimary,
                Location = new Point(38, 12),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlHeader.Controls.Add(lblTitle);

            _btnClose = new GlassButton
            {
                Size = new Size(28, 28),
                Location = new Point(Width - 36, 8),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "close",
                Radius = 6
            };
            _btnClose.Click += (s, e) => Close();
            _pnlHeader.Controls.Add(_btnClose);

            _btnMax = new GlassButton
            {
                Size = new Size(28, 28),
                Location = new Point(Width - 68, 8),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "maximize",
                Radius = 6
            };
            _btnMax.Click += (s, e) =>
            {
                if (_isFullscreen) ToggleFullscreen();
                else
                {
                    WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
                    _btnMax.Glyph = WindowState == FormWindowState.Maximized ? "restore" : "maximize";
                }
            };
            _pnlHeader.Controls.Add(_btnMax);

            _btnMin = new GlassButton
            {
                Size = new Size(28, 28),
                Location = new Point(Width - 100, 8),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "minimize",
                Radius = 6
            };
            _btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;
            _pnlHeader.Controls.Add(_btnMin);

            Controls.Add(_pnlHeader);

            // 2. Toolbar Panel
            var pnlToolbar = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = FluentTheme.FixedDarkCanvas,
                Padding = new Padding(12, 6, 12, 6)
            };
            pnlToolbar.Paint += (s, e) =>
            {
                using var p = new Pen(FluentTheme.FixedDarkHairline, 1f);
                e.Graphics.DrawLine(p, 0, pnlToolbar.Height - 1, pnlToolbar.Width, pnlToolbar.Height - 1);
            };

            _lblStatus = new Label
            {
                Text = "Requesting a secure session…",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.FixedDarkTextSecondary,
                Location = new Point(14, 13),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlToolbar.Controls.Add(_lblStatus);

            _btnDisconnect = new GlassButton
            {
                Text = "Disconnect",
                Size = new Size(95, 30),
                Location = new Point(Width - 110, 7),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Danger,
                Radius = 6,
                Font = FluentTheme.CaptionBold
            };
            _btnDisconnect.Click += (s, e) => Close();
            pnlToolbar.Controls.Add(_btnDisconnect);

            _btnSendFile = new GlassButton
            {
                Text = "Send file",
                Glyph = "plus",
                Size = new Size(95, 30),
                Location = new Point(Width - 212, 7),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.CaptionBold,
                Enabled = false
            };
            _btnSendFile.Click += (s, e) => OpenSendFileDialog();
            pnlToolbar.Controls.Add(_btnSendFile);

            _btnFullscreen = new GlassButton
            {
                Text = "Fullscreen",
                Size = new Size(90, 30),
                Location = new Point(Width - 308, 7),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.CaptionBold
            };
            _btnFullscreen.Click += (s, e) => ToggleFullscreen();
            pnlToolbar.Controls.Add(_btnFullscreen);

            _btnOverlaySize = new GlassButton
            {
                Text = "Overlay: Full",
                Size = new Size(110, 30),
                Location = new Point(Width - 424, 7),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.CaptionBold
            };
            _btnOverlaySize.Click += (s, e) => ToggleOperatorOverlaySize();
            pnlToolbar.Controls.Add(_btnOverlaySize);

            _btnOverlayContent = new GlassButton
            {
                Text = "Media: Image",
                Size = new Size(110, 30),
                Location = new Point(Width - 540, 7),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.CaptionBold
            };
            _btnOverlayContent.Click += (s, e) => ToggleOperatorOverlayContent();
            pnlToolbar.Controls.Add(_btnOverlayContent);

            Controls.Add(pnlToolbar);

            _pnlHeader.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            lblTitle.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);

            Resize += (s, e) =>
            {
                _btnClose.Location = new Point(Width - 36, 8);
                _btnMax.Location = new Point(Width - 68, 8);
                _btnMin.Location = new Point(Width - 100, 8);
                _btnDisconnect.Location = new Point(Width - 110, 7);
                _btnSendFile.Location = new Point(Width - 212, 7);
                _btnFullscreen.Location = new Point(Width - 308, 7);
                _btnOverlaySize.Location = new Point(Width - 424, 7);
                _btnOverlayContent.Location = new Point(Width - 540, 7);
                _btnMax.Glyph = WindowState == FormWindowState.Maximized ? "restore" : "maximize";
            };

            _picScreen = new PictureBox
            {
                Dock = DockStyle.Fill,
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Black
            };

            _picScreen.MouseMove += (s, e) => SendMouseEvent("mm", e.X, e.Y, 0);
            _picScreen.MouseDown += (s, e) => SendMouseEvent("md", e.X, e.Y, MouseButtonNumber(e.Button));
            _picScreen.MouseUp += (s, e) => SendMouseEvent("mu", e.X, e.Y, MouseButtonNumber(e.Button));
            _picScreen.MouseWheel += (s, e) => SendCommand(new { t = "mw", d = e.Delta });
            KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.F11)
                {
                    ToggleFullscreen();
                    e.Handled = true;
                    return;
                }
                SendKeyEvent("kd", (int)e.KeyCode);
            };
            KeyUp += (s, e) => SendKeyEvent("ku", (int)e.KeyCode);

            Controls.Add(_picScreen);
            Controls.Add(_pnlHeader);
            FormClosing += (s, e) => Disconnect();
        }

        private void ToggleFullscreen()
        {
            if (!_isFullscreen)
            {
                _prevWindowState = WindowState;
                _prevBounds = Bounds;

                WindowState = FormWindowState.Normal;
                Bounds = Screen.FromControl(this).Bounds;
                _pnlHeader.Visible = false;
                _isFullscreen = true;
                _btnFullscreen.Text = "Exit Full";
            }
            else
            {
                WindowState = _prevWindowState;
                Bounds = _prevBounds;
                _pnlHeader.Visible = true;
                _isFullscreen = false;
                _btnFullscreen.Text = "Fullscreen";
            }
        }

        private static int MouseButtonNumber(MouseButtons button) =>
            button == MouseButtons.Left ? 1 : button == MouseButtons.Right ? 2 : 3;

        private async Task ConnectToTargetAsync()
        {
            if (_isConnecting) return;
            _isConnecting = true;
            _cts = new CancellationTokenSource();

            try
            {
                if (!await RequestSessionAsync(_cts.Token)) return;

                if (!P2pConnectionSupport.IsUsableDirectLanIp(_targetDev.ipAddress))
                {
                    AppLogger.Info($"[Viewer] Target {_targetDev.deviceName} tidak memiliki IP LAN langsung yang valid ({_targetDev.ipAddress}), langsung menggunakan relay.");
                    if (await StartRelayFallbackAsync(_cts.Token)) return;
                    throw new InvalidOperationException("Relay WebSocket tidak tersedia untuk target ini.");
                }

                try
                {
                    _lblStatus.Text = $"Menghubungi P2P {_targetDev.ipAddress}:{RemoteHostEngine.TCP_PORT}...";
                    _tcpClient = new TcpClient();
                    using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token);
                    connectCts.CancelAfter(ConnectTimeoutMs);
                    await _tcpClient.ConnectAsync(_targetDev.ipAddress, RemoteHostEngine.TCP_PORT, connectCts.Token);

                    _stream = _tcpClient.GetStream();
                    SetState(RemoteSessionState.Authenticating, "P2P");
                    await RemoteHostEngine.WriteCommandAsync(_stream, new
                    {
                        t = "auth",
                        sessionId = _sessionId,
                        secret = _sessionSecret
                    }, _cts.Token);

                    using var authResponse = await P2pConnectionSupport.RunWithTimeoutAsync(
                        authCt => RemoteHostEngine.ReadCommandAsync(_stream, authCt),
                        AuthenticationTimeout,
                        _cts.Token);
                    string authType = authResponse?.RootElement.TryGetProperty("t", out var authProp) == true
                        ? authProp.GetString() ?? "" : "";
                    if (authType != "auth_ok") throw new UnauthorizedAccessException("Host menolak token sesi remote.");
                }
                catch (Exception ex) when (
                    !_cts.IsCancellationRequested &&
                    (ex is SocketException || ex is OperationCanceledException || P2pConnectionSupport.ShouldFallback(ex)))
                {
                    AppLogger.Warn($"[Viewer] Direct P2P gagal, beralih ke relay: {ex.Message}");
                    CloseDirectConnection();
                    if (await StartRelayFallbackAsync(_cts.Token)) return;
                    throw;
                }

                _isAuthenticated = true;
                _btnSendFile.Enabled = true;
                SetState(RemoteSessionState.AwaitingConsent);
                AppLogger.Info($"[Viewer] Sesi P2P terautentikasi ke {_targetDev.ipAddress}:{RemoteHostEngine.TCP_PORT}");

                await ReceiveFramesLoopAsync(_cts.Token);
            }
            catch (OperationCanceledException)
            {
                if (!_cts.IsCancellationRequested)
                {
                    SetState(RemoteSessionState.Failed, "Cannot reach host");
                }
            }
            catch (Exception ex)
            {
                _lblStatus.Text = $"Gagal terhubung: {ex.Message}";
                AppLogger.Error("[Viewer] Connection error", ex);
            }
            finally
            {
                _isConnecting = false;
            }
        }

        private async Task<bool> StartRelayFallbackAsync(CancellationToken ct)
        {
            if (_sharedWsClient == null || string.IsNullOrWhiteSpace(_agentDeviceId)) return false;
            _useRelay = true;
            _isAuthenticated = true;
            _btnSendFile.Enabled = false; // File transfer remains direct-stream only; no false success via relay.
            SetState(RemoteSessionState.Connecting, "Relay");

            bool sent = await _sharedWsClient.SendJsonAsync(new
            {
                action = "REMOTE_SIGNAL",
                targetDeviceId = _targetDev.id,
                sessionId = _sessionId,
                sessionSecret = _sessionSecret,
                signal = "START_RELAY"
            }, ct);

            if (!sent)
            {
                _useRelay = false;
                _isAuthenticated = false;
                return false;
            }

            SetState(RemoteSessionState.Connected, "WS Relay");
            AppLogger.Info($"[Viewer] Secure WS relay activated for session {_sessionId}");
            return true;
        }

        private void ToggleOperatorOverlaySize()
        {
            _overlayMode = _overlayMode == "FULL" ? "PIP" : "FULL";
            _btnOverlaySize.Text = _overlayMode == "FULL" ? "Overlay: Full" : "Overlay: PIP";
            SendOverlayModeSignal();
        }

        private void ToggleOperatorOverlayContent()
        {
            _overlayContent = _overlayContent == "IMAGE" ? "VIDEO" : "IMAGE";
            _btnOverlayContent.Text = _overlayContent == "IMAGE" ? "Media: Image" : "Media: Video";
            SendOverlayModeSignal();
        }

        private void SendOverlayModeSignal()
        {
            if (_sharedWsClient == null || _cts == null || string.IsNullOrWhiteSpace(_sessionId)) return;
            AppLogger.Info($"[Viewer] Operator mengubah overlay user: mode={_overlayMode}, konten={_overlayContent}");
            _ = _sharedWsClient.SendJsonAsync(new
            {
                action = "REMOTE_SIGNAL",
                targetDeviceId = _targetDev.id,
                sessionId = _sessionId,
                sessionSecret = _sessionSecret,
                signal = "SET_OVERLAY_MODE",
                overlayMode = _overlayMode,
                contentType = _overlayContent
            }, _cts.Token);
        }

        private void HandleRelayMessage(string action, JsonElement message)
        {
            if (!_useRelay || IsDisposed || action != "REMOTE_FRAME") return;
            string sessionId = message.TryGetProperty("sessionId", out var sid) ? sid.GetString() ?? "" : "";
            if (!string.Equals(sessionId, _sessionId, StringComparison.Ordinal)) return;

            try
            {
                string base64 = message.TryGetProperty("data", out var data) ? data.GetString() ?? "" : "";
                if (string.IsNullOrEmpty(base64)) return;
                byte[] packet = Convert.FromBase64String(base64);
                ApplyRelayTilePacket(packet);
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[Viewer] Invalid relay frame: {ex.Message}");
            }
        }

        private void ApplyRelayTilePacket(byte[] packet)
        {
            using var stream = new MemoryStream(packet, writable: false);
            using var reader = new BinaryReader(stream);
            if (reader.ReadUInt32() != RemoteHostEngine.FRAME_MAGIC_TILES) return;
            int width = reader.ReadInt16();
            int height = reader.ReadInt16();
            int count = reader.ReadInt16();
            if (width <= 0 || height <= 0 || count < 0 || count > 4096) return;

            var tiles = new (Rectangle rect, Image image)[count];
            for (int i = 0; i < count; i++)
            {
                int x = reader.ReadInt16();
                int y = reader.ReadInt16();
                int tileW = reader.ReadInt16();
                int tileH = reader.ReadInt16();
                int length = reader.ReadInt32();
                if (length <= 0 || length > 1024 * 1024) throw new InvalidDataException("Relay tile length invalid");
                using var tileStream = new MemoryStream(reader.ReadBytes(length));
                using var decoded = Image.FromStream(tileStream);
                tiles[i] = (new Rectangle(x, y, tileW, tileH), new Bitmap(decoded));
            }

            _remoteWidth = width;
            _remoteHeight = height;
            BeginInvoke(() => ApplyTiles(width, height, tiles));
        }

        private async Task<bool> RequestSessionAsync(CancellationToken ct)
        {
            var localSession = DeviceSecurityStorage.LoadSession();
            if (localSession == null || string.IsNullOrWhiteSpace(localSession.Token))
            {
                _lblStatus.Text = "Perangkat agent belum terdaftar/login.";
                return false;
            }

            _agentDeviceId = localSession.DeviceId;
            if (string.IsNullOrWhiteSpace(_agentDeviceId))
            {
                _lblStatus.Text = "Registrasi lama tidak memiliki Device ID. Silakan logout dan login ulang sekali.";
                return false;
            }
            _lblStatus.Text = "Meminta otorisasi sesi dari server...";

            using var request = new HttpRequestMessage(HttpMethod.Post,
                $"{_config.SjaServerUrl.TrimEnd('/')}/v1/remote/session/request");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", localSession.Token);
            request.Content = new StringContent(JsonSerializer.Serialize(new
            {
                targetDeviceId = _targetDev.id,
                agentName = string.IsNullOrWhiteSpace(localSession.FullName) ? "Santos ICT Support" : localSession.FullName
            }), Encoding.UTF8, "application/json");

            using var response = await _httpClient.SendAsync(request, ct);
            string json = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                _lblStatus.Text = $"Server menolak sesi ({(int)response.StatusCode}).";
                AppLogger.Warn($"[Viewer] Session request rejected: HTTP {(int)response.StatusCode}");
                return false;
            }

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("session", out var session))
            {
                _lblStatus.Text = "Respons sesi server tidak valid.";
                return false;
            }

            _sessionId = session.GetProperty("sessionId").GetString() ?? "";
            _sessionSecret = session.GetProperty("sessionSecret").GetString() ?? "";
            if (string.IsNullOrWhiteSpace(_sessionId) || string.IsNullOrWhiteSpace(_sessionSecret))
            {
                _lblStatus.Text = "Server tidak mengirim kredensial sesi.";
                return false;
            }

            return true;
        }

        private async Task ReceiveFramesLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && _stream != null && _tcpClient?.Connected == true)
            {
                try
                {
                    byte[] magicBytes = await ReadExactAsync(_stream, 4, ct);
                    uint magic = BitConverter.ToUInt32(magicBytes, 0);

                    if (magic == RemoteHostEngine.FRAME_MAGIC_TILES)
                    {
                        await ReceiveTileBatchAsync(_stream, ct);
                        if (_state == RemoteSessionState.AwaitingConsent || _state == RemoteSessionState.Connecting) SetState(RemoteSessionState.Connected);
                    }
                    else if (magic == RemoteHostEngine.FRAME_MAGIC_FULL)
                    {
                        await ReceiveLegacyFrameAsync(_stream, ct);
                    }
                    else if (magic == RemoteHostEngine.CMD_MAGIC)
                    {
                        await ReceiveHostCommandAsync(_stream, ct);
                    }
                    else
                    {
                        throw new InvalidDataException($"Magic frame tidak dikenal: 0x{magic:X8}");
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[Viewer] Frame stream error: {ex.Message}");
                    break;
                }
            }

            if (!IsDisposed) BeginInvoke(() => SetState(RemoteSessionState.Disconnected));
        }

        private async Task ReceiveHostCommandAsync(Stream stream, CancellationToken ct)
        {
            byte[] lengthBytes = await ReadExactAsync(stream, 4, ct);
            int length = BitConverter.ToInt32(lengthBytes, 0);
            if (length <= 0 || length > 2 * 1024 * 1024)
                throw new InvalidDataException("Ukuran command host tidak valid.");

            byte[] payload = await ReadExactAsync(stream, length, ct);
            using var doc = JsonDocument.Parse(payload);
            string type = doc.RootElement.TryGetProperty("t", out var t) ? t.GetString() ?? "" : "";
            string transferId = doc.RootElement.TryGetProperty("transferId", out var id) ? id.GetString() ?? "" : "";

            if (!string.Equals(transferId, _pendingTransferId, StringComparison.Ordinal)) return;
            if (type == "file_accept")
            {
                _fileApprovalTcs?.TrySetResult(true);
            }
            else if (type == "file_reject")
            {
                _fileApprovalTcs?.TrySetResult(false);
            }
            else if (type == "file_complete")
            {
                if (!IsDisposed) BeginInvoke(() => _lblStatus.Text = "✓ File diterima dan disimpan oleh perangkat target");
            }
        }

        private async Task ReceiveTileBatchAsync(Stream stream, CancellationToken ct)
        {
            byte[] batchHeader = await ReadExactAsync(stream, 6, ct);
            int width = BitConverter.ToInt16(batchHeader, 0);
            int height = BitConverter.ToInt16(batchHeader, 2);
            int tileCount = BitConverter.ToInt16(batchHeader, 4);
            if (width <= 0 || height <= 0 || tileCount < 0 || tileCount > 4096)
                throw new InvalidDataException("Header tile tidak valid.");

            _remoteWidth = width;
            _remoteHeight = height;
            var tiles = new (Rectangle rect, Image image)[tileCount];

            try
            {
                for (int i = 0; i < tileCount; i++)
                {
                    byte[] tileHeader = await ReadExactAsync(stream, 12, ct);
                    int x = BitConverter.ToInt16(tileHeader, 0);
                    int y = BitConverter.ToInt16(tileHeader, 2);
                    int tileW = BitConverter.ToInt16(tileHeader, 4);
                    int tileH = BitConverter.ToInt16(tileHeader, 6);
                    int len = BitConverter.ToInt32(tileHeader, 8);
                    if (len <= 0 || len > 1024 * 1024) throw new InvalidDataException("Ukuran tile tidak valid.");

                    byte[] jpeg = await ReadExactAsync(stream, len, ct);
                    using var ms = new MemoryStream(jpeg);
                    using var decoded = Image.FromStream(ms);
                    tiles[i] = (new Rectangle(x, y, tileW, tileH), new Bitmap(decoded));
                }

                if (!IsDisposed)
                {
                    BeginInvoke(() => ApplyTiles(width, height, tiles));
                }
            }
            catch
            {
                foreach (var tile in tiles) tile.image?.Dispose();
                throw;
            }
        }

        private void ApplyTiles(int width, int height, (Rectangle rect, Image image)[] tiles)
        {
            if (_remoteCanvas == null || _remoteCanvas.Width != width || _remoteCanvas.Height != height)
            {
                _remoteCanvas?.Dispose();
                _remoteCanvas = new Bitmap(width, height);
            }

            using (var g = Graphics.FromImage(_remoteCanvas))
            {
                foreach (var tile in tiles)
                {
                    using (tile.image)
                    {
                        g.DrawImage(tile.image, tile.rect);
                    }
                }
            }

            var old = _picScreen.Image;
            _picScreen.Image = (Image)_remoteCanvas.Clone();
            old?.Dispose();
        }

        private async Task ReceiveLegacyFrameAsync(Stream stream, CancellationToken ct)
        {
            byte[] rest = await ReadExactAsync(stream, 8, ct);
            int len = BitConverter.ToInt32(rest, 0);
            _remoteWidth = BitConverter.ToInt16(rest, 4);
            _remoteHeight = BitConverter.ToInt16(rest, 6);
            if (len <= 0 || len > 64 * 1024 * 1024) throw new InvalidDataException("Ukuran frame tidak valid.");

            byte[] payload = await ReadExactAsync(stream, len, ct);
            using var ms = new MemoryStream(payload);
            using var decoded = Image.FromStream(ms);
            var image = new Bitmap(decoded);
            if (!IsDisposed)
            {
                BeginInvoke(() =>
                {
                    var old = _picScreen.Image;
                    _picScreen.Image = image;
                    old?.Dispose();
                });
            }
        }

        private static async Task<byte[]> ReadExactAsync(Stream stream, int length, CancellationToken ct)
        {
            byte[] data = new byte[length];
            int read = 0;
            while (read < length)
            {
                int amount = await stream.ReadAsync(data, read, length - read, ct);
                if (amount == 0) throw new EndOfStreamException();
                read += amount;
            }
            return data;
        }

        private void SendMouseEvent(string type, int picX, int picY, int button)
        {
            if (!_isAuthenticated || _picScreen.ClientSize.Width <= 0 || _picScreen.ClientSize.Height <= 0) return;

            Rectangle display = GetDisplayedImageRectangle();
            if (!display.Contains(picX, picY)) return;

            float scaleX = (float)_remoteWidth / display.Width;
            float scaleY = (float)_remoteHeight / display.Height;
            int rx = Math.Clamp((int)((picX - display.X) * scaleX), 0, _remoteWidth - 1);
            int ry = Math.Clamp((int)((picY - display.Y) * scaleY), 0, _remoteHeight - 1);
            SendCommand(new { t = type, x = rx, y = ry, b = button });
        }

        private Rectangle GetDisplayedImageRectangle()
        {
            if (_picScreen.Image == null) return _picScreen.ClientRectangle;
            float scale = Math.Min(
                (float)_picScreen.ClientSize.Width / _picScreen.Image.Width,
                (float)_picScreen.ClientSize.Height / _picScreen.Image.Height);
            int width = (int)(_picScreen.Image.Width * scale);
            int height = (int)(_picScreen.Image.Height * scale);
            return new Rectangle((_picScreen.ClientSize.Width - width) / 2, (_picScreen.ClientSize.Height - height) / 2, width, height);
        }

        private void SendKeyEvent(string type, int keyCode)
        {
            if (!_isAuthenticated) return;
            SendCommand(new { t = type, k = keyCode });
        }

        private void SendCommand(object command)
        {
            if (!_isAuthenticated || _cts == null) return;
            if (_useRelay)
            {
                if (_sharedWsClient != null)
                {
                    _ = _sharedWsClient.SendJsonAsync(new
                    {
                        action = "REMOTE_INPUT",
                        targetDeviceId = _targetDev.id,
                        sessionId = _sessionId,
                        sessionSecret = _sessionSecret,
                        payload = command
                    }, _cts.Token);
                }
                return;
            }

            if (_stream == null || !_stream.CanWrite) return;
            _ = SendCommandAsync(command, _cts.Token);
        }

        private async Task SendCommandAsync(object command, CancellationToken ct)
        {
            if (_stream == null || !_stream.CanWrite) return;
            await _sendLock.WaitAsync(ct);
            try
            {
                await RemoteHostEngine.WriteCommandAsync(_stream, command, ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                AppLogger.Warn($"[Viewer] Gagal kirim perintah: {ex.Message}");
            }
            finally
            {
                _sendLock.Release();
            }
        }

        private async void OpenSendFileDialog()
        {
            if (!_isAuthenticated || _stream == null || _cts == null) return;
            using var dialog = new OpenFileDialog
            {
                Title = "Choose a file to send",
                Filter = "All files (*.*)|*.*"
            };
            if (dialog.ShowDialog() != DialogResult.OK) return;

            string path = dialog.FileName;
            string fileName = Path.GetFileName(path);
            long fileSize = new FileInfo(path).Length;
            string transferId = Guid.NewGuid().ToString("N");

            try
            {
                _btnSendFile.Enabled = false;
                _pendingTransferId = transferId;
                _fileApprovalTcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                _lblStatus.Text = $"Menunggu persetujuan penerima untuk '{fileName}'...";
                await SendCommandAsync(new { t = "file_offer", transferId, name = fileName, size = fileSize }, _cts.Token);

                bool accepted = await _fileApprovalTcs.Task.WaitAsync(TimeSpan.FromMinutes(2), _cts.Token);
                if (!accepted)
                {
                    _lblStatus.Text = $"Transfer '{fileName}' ditolak oleh pengguna target";
                    return;
                }

                byte[] buffer = new byte[FileChunkSize];
                await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
                    FileChunkSize, FileOptions.Asynchronous | FileOptions.SequentialScan);

                long sent = 0;
                int read;
                while ((read = await fs.ReadAsync(buffer.AsMemory(0, buffer.Length), _cts.Token)) > 0)
                {
                    sent += read;
                    byte[] chunk = read == buffer.Length ? buffer : buffer[..read];
                    await SendCommandAsync(new
                    {
                        t = "file_chunk",
                        transferId,
                        data = Convert.ToBase64String(chunk),
                        last = sent == fileSize
                    }, _cts.Token);

                    int percent = fileSize == 0 ? 100 : (int)(sent * 100 / fileSize);
                    _lblStatus.Text = $"Mengirim '{fileName}' • {percent}% ({FormatBytes(sent)} / {FormatBytes(fileSize)})";
                }

                if (fileSize == 0)
                {
                    await SendCommandAsync(new { t = "file_chunk", transferId, data = "", last = true }, _cts.Token);
                }

                _lblStatus.Text = $"✓ File '{fileName}' telah dikirim";
            }
            catch (Exception ex)
            {
                _lblStatus.Text = "File transfer failed";
                AppLogger.Error("Gagal mentransfer file ke host", ex);
                await SendCommandAsync(new { t = "file_cancel", transferId }, CancellationToken.None);
            }
            finally
            {
                _pendingTransferId = null;
                _fileApprovalTcs = null;
                _btnSendFile.Enabled = _isAuthenticated;
            }
        }

        private static string FormatBytes(long bytes)
        {
            if (bytes >= 1024L * 1024 * 1024) return $"{bytes / (1024d * 1024 * 1024):0.0} GB";
            if (bytes >= 1024L * 1024) return $"{bytes / (1024d * 1024):0.0} MB";
            if (bytes >= 1024) return $"{bytes / 1024d:0.0} KB";
            return $"{bytes} B";
        }

        private void CloseDirectConnection()
        {
            try { _stream?.Close(); } catch { }
            try { _tcpClient?.Close(); } catch { }
            _stream = null;
            _tcpClient = null;
        }

        private void Disconnect()
        {
            if (_sharedWsClient != null) _sharedWsClient.OnRemoteMessageReceived -= HandleRelayMessage;
            _isAuthenticated = false;
            _cts?.Cancel();
            CloseDirectConnection();
            _remoteCanvas?.Dispose();
            _remoteCanvas = null;
            _httpClient.Dispose();
        }
    }
}
