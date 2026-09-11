using System;
using System.IO;
using System.Collections.Generic;
using System.Drawing;
using System.Text.Json;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SJANotificationApp
{
    public class TrayApplicationContext : ApplicationContext
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetThreadDesktop(IntPtr hDesktop);

        private readonly NotifyIcon _notifyIcon;
        private readonly AppConfig _config;
        private SjaNativeWebSocketClient? _wsClient;
        private LocalWebhookListener? _webhookListener;
        private RemoteHostEngine? _remoteHostEngine;
        private RemotePrivacyOverlayForm? _activePrivacyOverlay;
        private readonly CancellationTokenSource _cts = new();
        private bool _isConnected = false;

        private const string RegistryRunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppRegistryName = "SJANotificationApp";
        private readonly SynchronizationContext? _uiSyncContext;
        private readonly int _mainThreadId;

        public static TrayApplicationContext? Instance { get; private set; }
        private MainWindowForm? _mainWindow;
        private bool _keepMenuOpenRequested = false;

        public TrayApplicationContext()
        {
            Instance = this;
            _mainThreadId = Thread.CurrentThread.ManagedThreadId;
            _uiSyncContext = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
            _config = AppConfig.Load();

            // Background task: Auto-discover best SJA server (idesk.santos.co.id -> 10.10.6.13 -> localhost)
            Task.Run(async () =>
            {
                await _config.ProbeAndSetBestServerAsync();
            });

            // Start Local Webhook Listener on port 18399 for browser IPC
            try
            {
                _webhookListener = new LocalWebhookListener(18399);
                _webhookListener.Start();
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"Failed to start webhook listener: {ex.Message}");
            }

            // Start secure Remote Desktop Host Engine (Port 18389)
            try
            {
                _remoteHostEngine = new RemoteHostEngine();
                _remoteHostEngine.OnSessionStarted += agentEp =>
                {
                    AppLogger.Info($"[RemoteHost] Sesi terautentikasi dari agen {agentEp}");
                };
                _remoteHostEngine.OnSessionEnded += agentEp =>
                {
                    AppLogger.Info($"[RemoteHost] Sesi diakhiri oleh agen {agentEp}");
                    _uiSyncContext?.Post(_ => CloseRemoteOverlay(), null);
                };
                _remoteHostEngine.OnFileTransferRequested += (fileName, fileSize, callback) =>
                {
                    _uiSyncContext?.Post(_ =>
                    {
                        string sizeText = FormatFileSize(fileSize);
                        var result = MessageBox.Show(
                            $"Petugas ICT ingin mengirim file:\n\n{fileName}\nUkuran: {sizeText}\n\nSimpan ke folder Downloads?",
                            "Persetujuan Transfer File SJA Remote",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question,
                            MessageBoxDefaultButton.Button2);
                        callback(result == DialogResult.Yes);
                    }, null);
                };
                _remoteHostEngine.Start();
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"Failed to start RemoteHostEngine: {ex.Message}");
            }

            // Create Tray NotifyIcon
            _notifyIcon = new NotifyIcon
            {
                Icon = CreateAppIcon(),
                Text = "SJA Notification App (Santos Jaya Abadi)",
                Visible = true,
                ContextMenuStrip = BuildContextMenu()
            };
            AppLogger.Info($"[Tray] NotifyIcon created. Visible={_notifyIcon.Visible}, Icon={_notifyIcon.Icon?.Size}");

            // Modern Windows 11: Single & Double left-click membuka Dashboard Modal Utama (Gambar 1)
            _notifyIcon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    ShowMainWindow();
                }
            };

            _notifyIcon.DoubleClick += (s, e) =>
            {
                ShowMainWindow();
            };

            ToastNotifier.NotificationOpened += ShowPopupWindow;

            // Otomatis aktifkan auto-start saat Windows boot secara default
            if (!CheckAutoStartEnabled())
            {
                SetAutoStart(true);
            }

            // Dengarkan perubahan tema Windows (Dark/Light) untuk refresh menu
            FluentTheme.ThemeChanged += () =>
            {
                _uiSyncContext?.Post(_ => UpdateContextMenu(), null);
            };

            // Start WebSocket connection if device token exists
            InitializeConnection();

            // Jika perangkat belum terhubung, langsung buka window utama agar user bisa langsung login
            string? token = DeviceSecurityStorage.LoadToken();
            if (string.IsNullOrEmpty(token))
            {
                _uiSyncContext?.Post(_ => ShowMainWindow(), null);
            }
        }

        public void ShowMainWindow()
        {
            if (Thread.CurrentThread.ManagedThreadId != _mainThreadId)
            {
                _uiSyncContext?.Post(_ => ShowMainWindow(), null);
                return;
            }

            try
            {
                if (_mainWindow == null || _mainWindow.IsDisposed)
                {
                    _mainWindow = new MainWindowForm(_config, _isConnected);
                    _mainWindow.OnSessionChanged += () =>
                    {
                        InitializeConnection();
                        UpdateContextMenu();
                    };
                    _mainWindow.FormClosed += (s, e) => _mainWindow = null;
                    _mainWindow.Show();
                }
                else
                {
                    _mainWindow.UpdateConnectionState(_isConnected);
                    _mainWindow.WindowState = FormWindowState.Normal;
                    _mainWindow.BringToFront();
                    _mainWindow.Activate();
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal membuka MainWindow", ex);
            }
        }

        public SjaNativeWebSocketClient? GetWebSocketClient() => _wsClient;

        public void ShowPreviewMode(string mode)
        {
            if (Thread.CurrentThread.ManagedThreadId != _mainThreadId)
            {
                _uiSyncContext?.Post(_ => ShowPreviewMode(mode), null);
                return;
            }
            ShowMainWindow();
            _mainWindow?.PreviewState(mode);
        }

        private void InitializeConnection()
        {
            string? token = DeviceSecurityStorage.LoadToken();
            if (string.IsNullOrEmpty(token))
            {
                _notifyIcon.ShowBalloonTip(
                    4000,
                    "Perangkat Belum Terhubung",
                    "Klik kanan tray icon dan pilih 'Hubungkan Perangkat' untuk mengaktifkan notifikasi.",
                    ToolTipIcon.Warning
                );
                return;
            }

            _wsClient = new SjaNativeWebSocketClient(_config.SjaWsUrl, token);
            _wsClient.OnNotificationReceived += OnNotificationReceived;
            _wsClient.OnRemoteMessageReceived += (action, payload) =>
            {
                if (action == "REMOTE_SESSION_INVITE")
                {
                    string sessionId = payload.TryGetProperty("sessionId", out var sid) ? sid.GetString() ?? "" : "";
                    string sessionSecret = payload.TryGetProperty("sessionSecret", out var secret) ? secret.GetString() ?? "" : "";
                    string agentDeviceId = payload.TryGetProperty("agentDeviceId", out var adid) ? adid.GetString() ?? "" : "";
                    string agentName = payload.TryGetProperty("agentName", out var an) ? an.GetString() ?? "" : "Santos ICT Support";
                    string agentIp = payload.TryGetProperty("agentIp", out var aip) ? aip.GetString() ?? "" : "10.10.x.x";
                    int countdown = payload.TryGetProperty("countdownSeconds", out var cs) && cs.TryGetInt32(out int parsedCountdown)
                        ? Math.Clamp(parsedCountdown, 1, 120) : 10;
                    DateTime expiresAt = payload.TryGetProperty("expiresAt", out var exp) && DateTime.TryParse(exp.GetString(), out var parsedExpiry)
                        ? parsedExpiry.ToUniversalTime() : DateTime.UtcNow.AddHours(1);
                    var images = ParseSlideshowImages(payload);

                    if (string.IsNullOrWhiteSpace(sessionId) || string.IsNullOrWhiteSpace(sessionSecret) || string.IsNullOrWhiteSpace(agentDeviceId))
                    {
                        AppLogger.Warn("[RemoteHost] Undangan remote ditolak: kredensial sesi tidak lengkap");
                        return;
                    }

                    _remoteHostEngine?.AuthorizeSession(sessionId, sessionSecret, agentDeviceId, agentIp, expiresAt, countdown);
                    _uiSyncContext?.Post(_ => ShowRemoteOverlay(agentName, agentIp, images, countdown), null);
                }
                else if (action == "REMOTE_SIGNAL")
                {
                    string signal = payload.TryGetProperty("signal", out var sig) ? sig.GetString() ?? "" : "";
                    if (signal == "START_RELAY" && _remoteHostEngine != null && _wsClient != null)
                    {
                        _remoteHostEngine.OnRelayFrameReady -= SendRelayFrame;
                        _remoteHostEngine.OnRelayFrameReady += SendRelayFrame;
                        _remoteHostEngine.EnableRelayCapture();
                    }
                }
                else if (action == "REMOTE_INPUT")
                {
                    if (payload.TryGetProperty("payload", out var inputPayload))
                    {
                        _ = _remoteHostEngine?.ProcessRelayInputAsync(inputPayload.GetRawText());
                    }
                }
                else if (action == "REMOTE_SESSION_TERMINATED")
                {
                    _remoteHostEngine?.RevokeSession();
                    _uiSyncContext?.Post(_ => CloseRemoteOverlay(), null);
                }
            };
            _wsClient.OnConnectionStatusChanged += (connected) =>
            {
                if (_isConnected != connected)
                {
                    _isConnected = connected;
                    UpdateContextMenu();
                    _mainWindow?.UpdateConnectionState(connected);
                }
            };
            _wsClient.OnTokenRejected += () =>
            {
                Action handleRejection = () =>
                {
                    _isConnected = false;
                    DeviceSecurityStorage.Clear();
                    UpdateContextMenu();
                    _notifyIcon.ShowBalloonTip(
                        5000,
                        "Perangkat Perlu Dihubungkan",
                        "Koneksi ditolak server (token tidak terdaftar). Silakan login atau hubungkan ulang perangkat.",
                        ToolTipIcon.Warning
                    );
                };

                if (Thread.CurrentThread.ManagedThreadId != _mainThreadId)
                {
                    _uiSyncContext?.Post(_ => handleRejection(), null);
                }
                else
                {
                    handleRejection();
                }
            };

            Task.Run(() => _wsClient.StartAsync(_cts.Token));
        }

        private void SendRelayFrame(byte[] packet)
        {
            var profile = DeviceSecurityStorage.LoadSession();
            string? sessionId = _remoteHostEngine?.ActiveSessionId;
            if (_wsClient == null || profile == null || string.IsNullOrWhiteSpace(profile.DeviceId) || string.IsNullOrWhiteSpace(sessionId)) return;

            // Session secret is deliberately held in the host engine and forwarded only through the
            // authenticated device WebSocket path; relay payloads are bounded by the server.
            string? sessionSecret = _remoteHostEngine?.ActiveSessionSecret;
            string? agentDeviceId = _remoteHostEngine?.AuthorizedAgentDeviceId;
            if (string.IsNullOrWhiteSpace(sessionSecret) || string.IsNullOrWhiteSpace(agentDeviceId)) return;

            _ = _wsClient.SendJsonAsync(new
            {
                action = "REMOTE_FRAME",
                targetDeviceId = agentDeviceId,
                sessionId,
                sessionSecret,
                data = Convert.ToBase64String(packet)
            }, _cts.Token);
        }

        private void ShowRemoteOverlay(string agentName, string agentIp, List<string>? images, int countdown)
        {
            CloseRemoteOverlay();
            _activePrivacyOverlay = new RemotePrivacyOverlayForm(agentName, agentIp, images, countdown);
            _activePrivacyOverlay.OnConsentGranted += () => _remoteHostEngine?.GrantConsent();
            _activePrivacyOverlay.OnSessionTerminatedByUser += () =>
            {
                _remoteHostEngine?.RevokeSession();
                CloseRemoteOverlay();
            };
            _activePrivacyOverlay.Show();
        }

        private void CloseRemoteOverlay()
        {
            if (_activePrivacyOverlay != null && !_activePrivacyOverlay.IsDisposed)
            {
                _activePrivacyOverlay.Close();
            }
            _activePrivacyOverlay = null;
        }

        private static List<string>? ParseSlideshowImages(JsonElement payload)
        {
            if (!payload.TryGetProperty("mediaConfig", out var mediaConfig) ||
                !mediaConfig.TryGetProperty("slideshowImages", out var imagesElement) ||
                imagesElement.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var images = new List<string>();
            foreach (var item in imagesElement.EnumerateArray())
            {
                string? value = item.GetString();
                if (!string.IsNullOrWhiteSpace(value) &&
                    Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
                    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                {
                    images.Add(value);
                }
            }
            return images.Count > 0 ? images : null;
        }

        private static string FormatFileSize(long bytes)
        {
            if (bytes >= 1024L * 1024 * 1024) return $"{bytes / (1024d * 1024 * 1024):0.0} GB";
            if (bytes >= 1024L * 1024) return $"{bytes / (1024d * 1024):0.0} MB";
            if (bytes >= 1024) return $"{bytes / 1024d:0.0} KB";
            return $"{bytes} B";
        }

        private void OnNotificationReceived(NotificationData data)
        {
            string mode = (data.Display ?? _config.DefaultDisplayMode ?? "both").Trim().ToLowerInvariant();
            bool isConversation = data.IsConversationNotification();
            AppLogger.Info($"[OnNotificationReceived] Notifikasi diterima: '{data.Title}' | App: {data.AppCode} | Mode: {mode} | IsConversation: {isConversation}");

            // Persist to local offline history cache
            LocalNotificationHistory.Add(data);

            // Selalu tampilkan Windows Toast jika mode toast/both atau jika tipe conversation
            if (mode == "toast" || mode == "both" || isConversation)
            {
                ToastNotifier.ShowNotification(data, _config.PlaySound);
            }

            // Supresi total popup window tengah layar untuk notifikasi conversation
            if (!isConversation && (mode == "popup" || mode == "both"))
            {
                ShowPopupWindow(data);
            }
        }

        public static void ShowPopupWindow(NotificationData data)
        {
            var thread = new Thread(() =>
            {
                try
                {
                    Program.EnsureInteractiveDesktop();
                    AppLogger.Info($"[ShowPopupWindow] Menampilkan dialog untuk '{data.Title}'");
                    using var form = new NotificationPopupForm(data);
                    form.ShowDialog();
                    AppLogger.Info($"[ShowPopupWindow] Dialog ditutup untuk '{data.Title}'");
                }
                catch (Exception ex)
                {
                    AppLogger.Error("Error menampilkan popup window", ex);
                }
            });
            thread.SetApartmentState(ApartmentState.STA);
            thread.IsBackground = true;
            thread.Start();
        }

        private void UpdateContextMenu()
        {
            if (Thread.CurrentThread.ManagedThreadId != _mainThreadId)
            {
                _uiSyncContext?.Post(_ => UpdateContextMenu(), null);
                return;
            }

            try
            {
                var oldMenu = _notifyIcon.ContextMenuStrip;
                _notifyIcon.ContextMenuStrip = BuildContextMenu();
                oldMenu?.Dispose();
            }
            catch (Exception ex)
            {
                AppLogger.Error("Error updating context menu", ex);
            }
        }

        private ContextMenuStrip BuildContextMenu()
        {
            var menu = new ContextMenuStrip
            {
                Renderer = new FluentMenuRenderer(),
                Font = FluentTheme.Body,
                ShowImageMargin = true,
                ShowCheckMargin = false,
                BackColor = FluentTheme.ThemeMenuBackground
            };

            // Anti-auto-close mechanism for interactive/toggle items
            menu.Closing += (s, e) =>
            {
                if (e.CloseReason == ToolStripDropDownCloseReason.ItemClicked && _keepMenuOpenRequested)
                {
                    e.Cancel = true;
                    _keepMenuOpenRequested = false;
                }
            };

            // 1. Enterprise Status Header Card (Adaptive Light/Dark Theme)
            menu.Items.Add(CreateHeaderControlHost());

            // 2. Blok 1: Workspace & Dashboard
            var dashboardItem = new ToolStripMenuItem("Buka Dashboard Status...", FluentTheme.GetMenuIcon("portal", FluentTheme.ThemeMenuTextSecondary), (s, e) => ShowMainWindow())
            {
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            menu.Items.Add(dashboardItem);

            var openIdeskItem = new ToolStripMenuItem("Buka Portal Web iDesk", FluentTheme.GetMenuIcon("globe", FluentTheme.ThemeMenuTextSecondary), (s, e) =>
            {
                ToastNotifier.OpenUrlInBrowser(_config.IdeskServerUrl);
            })
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            menu.Items.Add(openIdeskItem);

            menu.Items.Add(new ToolStripSeparator());

            // 3. Blok 2: Riwayat, Pengaturan & Uji
            var openHistoryItem = new ToolStripMenuItem("Riwayat Notifikasi Desktop...", FluentTheme.GetMenuIcon("history", FluentTheme.ThemeMenuTextSecondary), (s, e) =>
            {
                var historyForm = new HistoryForm(_config);
                historyForm.ShowDialog();
            })
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            menu.Items.Add(openHistoryItem);

            var settingsItem = new ToolStripMenuItem("Pengaturan Notifikasi...", FluentTheme.GetMenuIcon("settings", FluentTheme.ThemeMenuTextSecondary), (s, e) =>
            {
                var settingsForm = new SettingsForm(_config);
                settingsForm.ShowDialog();
            })
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            menu.Items.Add(settingsItem);

            // Sub-menu Uji Notifikasi
            var testMenu = new ToolStripMenuItem("Uji Notifikasi", FluentTheme.GetMenuIcon("test", FluentTheme.ThemeMenuTextSecondary))
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            testMenu.DropDown.Renderer = new FluentMenuRenderer();
            testMenu.DropDown.Font = FluentTheme.Body;
            testMenu.DropDown.BackColor = FluentTheme.ThemeMenuBackground;
            testMenu.DropDown.Closing += (s, e) =>
            {
                if (e.CloseReason == ToolStripDropDownCloseReason.ItemClicked && _keepMenuOpenRequested)
                {
                    e.Cancel = true;
                    _keepMenuOpenRequested = false;
                }
            };

            var testToast = new ToolStripMenuItem("Tes Toast Windows", null, (s, e) =>
            {
                _keepMenuOpenRequested = true;
                ToastNotifier.ShowTestNotification("toast");
            })
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            var testPopup = new ToolStripMenuItem("Tes Popup Window", null, (s, e) =>
            {
                _keepMenuOpenRequested = true;
                ToastNotifier.ShowTestNotification("popup");
            })
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            var testBoth = new ToolStripMenuItem("Tes Keduanya", null, (s, e) =>
            {
                _keepMenuOpenRequested = true;
                ToastNotifier.ShowTestNotification("both");
            })
            {
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };

            testMenu.DropDownItems.Add(testToast);
            testMenu.DropDownItems.Add(testPopup);
            testMenu.DropDownItems.Add(testBoth);
            menu.Items.Add(testMenu);

            menu.Items.Add(new ToolStripSeparator());

            // 4. Blok 3: Sistem & Preferensi
            bool isAutoStart = CheckAutoStartEnabled();
            var autoStartItem = new ToolStripMenuItem("Jalankan Saat Windows Start")
            {
                Checked = isAutoStart,
                CheckOnClick = true,
                ForeColor = FluentTheme.ThemeMenuTextPrimary
            };
            autoStartItem.Click += (s, e) =>
            {
                _keepMenuOpenRequested = true;
                SetAutoStart(autoStartItem.Checked);
            };
            menu.Items.Add(autoStartItem);

            string? token = DeviceSecurityStorage.LoadToken();
            if (!string.IsNullOrEmpty(token))
            {
                var logoutItem = new ToolStripMenuItem("Keluar Akun (Logout)...", FluentTheme.GetMenuIcon("exit", Color.FromArgb(248, 113, 113)), (s, e) =>
                {
                    var confirm = MessageBox.Show(
                        "Apakah Anda yakin ingin keluar dari akun ini di SJA Notification?\n\nAplikasi akan tetap berjalan di background untuk menerima notifikasi saat akun lain login.",
                        "Keluar Akun",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question
                    );
                    if (confirm == DialogResult.Yes)
                    {
                        LogoutCurrentSession();
                    }
                })
                {
                    ForeColor = Color.FromArgb(248, 113, 113)
                };
                menu.Items.Add(logoutItem);
            }

            var exitItem = new ToolStripMenuItem("Tutup Notifier (Exit)", FluentTheme.GetMenuIcon("exit", Color.FromArgb(248, 113, 113)), (s, e) =>
            {
                var confirm = MessageBox.Show(
                    "Menutup SJA Notifier akan menonaktifkan penerimaan notifikasi desktop secara real-time.\n\nApakah Anda yakin ingin keluar dari aplikasi?",
                    "Tutup SJA Notifier",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button2
                );
                if (confirm == DialogResult.Yes)
                {
                    ExitApplication();
                }
            })
            {
                ForeColor = Color.FromArgb(248, 113, 113)
            };
            menu.Items.Add(exitItem);

            return menu;
        }

        private ToolStripControlHost CreateHeaderControlHost()
        {
            var session = DeviceSecurityStorage.LoadSession();
            bool hasUser = session != null && !string.IsNullOrWhiteSpace(session.FullName);

            var pnl = new Panel
            {
                Size = new Size(296, 84),
                BackColor = Color.Transparent,
                Padding = new Padding(12, 10, 12, 8)
            };

            pnl.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

                // Header background matching active theme
                using (var bgBrush = new SolidBrush(FluentTheme.ThemeMenuSurface))
                {
                    e.Graphics.FillRectangle(bgBrush, pnl.ClientRectangle);
                }

                // Subtle bottom hairline divider
                using var linePen = new Pen(FluentTheme.ThemeCardHairline, 1);
                e.Graphics.DrawLine(linePen, 0, pnl.Height - 1, pnl.Width, pnl.Height - 1);

                // Live status dot and text rendered cleanly without neon halo
                bool connected = _isConnected;
                Color dotColor = connected ? FluentTheme.StatusOnline : FluentTheme.StatusOffline;
                using (var dotBrush = new SolidBrush(dotColor))
                {
                    e.Graphics.FillEllipse(dotBrush, 54, 56, 6, 6);
                }

                string statusText = connected ? "Gateway Terhubung (Live WSS)" : "Gateway Terputus (Offline)";
                Color statusTextColor = connected
                    ? (FluentTheme.IsDarkTheme ? Color.FromArgb(52, 211, 153) : Color.FromArgb(5, 150, 105))
                    : (FluentTheme.IsDarkTheme ? Color.FromArgb(248, 113, 113) : Color.FromArgb(220, 38, 38));
                using var font = FluentTheme.CaptionBold;
                var textRect = new Rectangle(66, 50, pnl.Width - 72, 20);
                TextRenderer.DrawText(e.Graphics, statusText, font, textRect, statusTextColor,
                    TextFormatFlags.Left | TextFormatFlags.Top | TextFormatFlags.EndEllipsis);
            };

            // Avatar circle on left
            var picAvatar = new PictureBox
            {
                Size = new Size(36, 36),
                Location = new Point(12, 12),
                BackColor = Color.Transparent
            };
            picAvatar.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new Rectangle(0, 0, picAvatar.Width - 1, picAvatar.Height - 1);
                using var b = new SolidBrush(FluentTheme.ThemeAccentSoft);
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, b, r, 18);
                }
                using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                {
                    FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 18);
                }

                string initial = hasUser && !string.IsNullOrWhiteSpace(session!.FullName)
                    ? session.FullName.Substring(0, 1).ToUpper()
                    : "S";
                using var font = FluentTheme.GetFont(11F, FontStyle.Bold);
                using var textBrush = new SolidBrush(FluentTheme.ThemeAccentText);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(initial, font, textBrush, new RectangleF(0, 0, 36, 36), sf);
            };
            pnl.Controls.Add(picAvatar);

            // User name / title
            string userDisplay = hasUser ? session!.FullName : "iDesk Notifier";
            var lblUser = new Label
            {
                Text = userDisplay,
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(54, 10),
                Size = new Size(hasUser && !string.IsNullOrWhiteSpace(session?.SiteCode) ? 186 : 230, 18),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            pnl.Controls.Add(lblUser);

            // Sub info (NIK • MachineName)
            string subInfo = hasUser
                ? $"{session!.EmployeeId} • {Environment.MachineName}"
                : $"Versi 2.0 • {Environment.MachineName}";

            var lblSub = new Label
            {
                Text = subInfo,
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextMuted,
                Location = new Point(54, 30),
                Size = new Size(230, 15),
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            pnl.Controls.Add(lblSub);

            // Site Badge (e.g. SPJ)
            if (hasUser && !string.IsNullOrWhiteSpace(session?.SiteCode))
            {
                var lblSite = new Label
                {
                    Text = session.SiteCode,
                    Font = FluentTheme.CaptionBold,
                    ForeColor = FluentTheme.IsDarkTheme ? Color.FromArgb(147, 197, 253) : Color.FromArgb(30, 41, 59),
                    BackColor = FluentTheme.IsDarkTheme ? FluentTheme.DarkBadgeBg : Color.FromArgb(241, 245, 249),
                    Location = new Point(pnl.Width - 46, 10),
                    Size = new Size(36, 18),
                    TextAlign = ContentAlignment.MiddleCenter
                };
                lblSite.Paint += (s, e) =>
                {
                    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    var r = new Rectangle(0, 0, lblSite.Width - 1, lblSite.Height - 1);
                    using var p = new Pen(FluentTheme.ThemeCardHairline, 1f);
                    FluentTheme.DrawRoundedRectangle(e.Graphics, p, r, 4);
                };
                pnl.Controls.Add(lblSite);
            }

            return new ToolStripControlHost(pnl)
            {
                AutoSize = false,
                Size = new Size(296, 84),
                Margin = Padding.Empty,
                Padding = Padding.Empty
            };
        }

        private Icon CreateAppIcon()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string icoPath = Path.Combine(baseDir, "assets", "app.ico");
                string pngPath = Path.Combine(baseDir, "assets", "santos-logo.png");
                string ideskPath = Path.Combine(baseDir, "assets", "idesk-logo.png");
                string logoToUse = File.Exists(pngPath) ? pngPath : ideskPath;

                if (File.Exists(logoToUse))
                {
                    // Generate crisp multi-frame ICO if missing or old/corrupted (< 1KB)
                    if (!File.Exists(icoPath) || new FileInfo(icoPath).Length < 1000)
                    {
                        using var img = Image.FromFile(logoToUse);
                        FluentTheme.CreateMultiFrameIco(img, icoPath, new[] { 16, 24, 32, 48, 64, 128, 256 });
                    }

                    if (File.Exists(icoPath))
                    {
                        return new Icon(icoPath);
                    }
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"Failed to create or load app.ico: {ex.Message}");
            }
            return SystemIcons.Application;
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
            catch {}
        }

        public void ReconnectWithToken(string token)
        {
            if (Thread.CurrentThread.ManagedThreadId != _mainThreadId)
            {
                _uiSyncContext?.Post(_ => ReconnectWithToken(token), null);
                return;
            }

            try
            {
                var currentSession = DeviceSecurityStorage.LoadSession();
                if (currentSession != null && currentSession.Token != token)
                {
                    currentSession.Token = token;
                    DeviceSecurityStorage.SaveSession(currentSession);
                }
                else if (currentSession == null)
                {
                    DeviceSecurityStorage.SaveToken(token);
                }

                _wsClient?.Disconnect();
                InitializeConnection();
                UpdateContextMenu();
                _mainWindow?.RefreshDataState();
                _notifyIcon.ShowBalloonTip(
                    4000,
                    "Desktop Notifier Terhubung",
                    "Sesi web iDesk berhasil disinkronkan ke aplikasi desktop.",
                    ToolTipIcon.Info
                );
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal reconnect with token", ex);
            }
        }

        public void LogoutCurrentSession()
        {
            if (Thread.CurrentThread.ManagedThreadId != _mainThreadId)
            {
                _uiSyncContext?.Post(_ => LogoutCurrentSession(), null);
                return;
            }

            try
            {
                _wsClient?.Disconnect();
                DeviceSecurityStorage.Clear();
                _isConnected = false;
                UpdateContextMenu();
                _mainWindow?.RefreshDataState();
                _notifyIcon.ShowBalloonTip(
                    4000,
                    "Sesi Telah Keluar",
                    "Akun telah keluar. Silakan login kembali melalui web iDesk atau menu tray.",
                    ToolTipIcon.Info
                );
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal logout current session", ex);
            }
        }

        private void ExitApplication()
        {
            _cts.Cancel();
            _remoteHostEngine?.Dispose();
            _wsClient?.Disconnect();
            _webhookListener?.Stop();
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            Application.Exit();
        }
    }
}
