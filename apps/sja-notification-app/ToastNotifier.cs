using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Toolkit.Uwp.Notifications;

namespace SJANotificationApp
{
    public static class ToastNotifier
    {
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool AllowSetForegroundWindow(int dwProcessId);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        private const int SW_RESTORE = 9;
        private const int ASFW_ANY = -1;

        private static bool _initialized = false;
        private static readonly ConcurrentDictionary<string, NotificationData> _recentNotifications = new();

        public static event Action<NotificationData>? NotificationOpened;

        public static void Initialize()
        {
            if (_initialized) return;

            // Handle user interacting with the toast notification or buttons
            ToastNotificationManagerCompat.OnActivated += toastArgs =>
            {
                try
                {
                    var args = ToastArguments.Parse(toastArgs.Argument);
                    args.TryGetValue("id", out string? notifId);

                    NotificationData? notif = null;
                    if (!string.IsNullOrWhiteSpace(notifId))
                    {
                        _recentNotifications.TryGetValue(notifId, out notif);
                    }

                    // 1. Direct Open URL action button
                    if (args.TryGetValue("action", out string? action) && action == "open_url")
                    {
                        args.TryGetValue("url", out string? targetUrl);
                        string finalUrl = !string.IsNullOrWhiteSpace(targetUrl) ? targetUrl : (notif?.Url ?? "");
                        if (!string.IsNullOrWhiteSpace(finalUrl))
                        {
                            AppLogger.Log($"[ToastNotifier] Tombol 'Buka di Web' diklik -> membuka browser: {finalUrl}");
                            AcknowledgeRead(notifId);
                            OpenUrlInBrowser(finalUrl);
                        }
                        return;
                    }

                    // 2. Open Popup Detail action button
                    if (action == "open_popup")
                    {
                        if (notif != null)
                        {
                            AppLogger.Log($"[ToastNotifier] Tombol 'Buka Popup Detail' diklik -> membuka popup window: {notif.Title}");
                            NotificationOpened?.Invoke(notif);
                        }
                        return;
                    }

                    // 3. Quick reply submission (WhatsApp style)
                    if (action == "quick_reply")
                    {
                        if (toastArgs.UserInput.TryGetValue("replyText", out object? replyObj) && replyObj is string replyText && !string.IsNullOrWhiteSpace(replyText))
                        {
                            args.TryGetValue("callbackUrl", out string? callbackUrl);
                            _ = HandleToastQuickReplyAsync(notifId, replyText, callbackUrl, notif);
                        }
                        return;
                    }

                    // 4. Click on notification body:
                    // Untuk notifikasi conversation, supresi popup window dan langsung buka web percakapan
                    if (notif != null && notif.IsConversationNotification())
                    {
                        AppLogger.Log($"[ToastNotifier] Badan toast conversation diklik -> membuka percakapan web: {notif.Title}");
                        string finalUrl = !string.IsNullOrWhiteSpace(notif.Url) ? notif.Url : (args.TryGetValue("url", out string? u) ? u : "");
                        if (!string.IsNullOrWhiteSpace(finalUrl))
                        {
                            OpenUrlInBrowser(finalUrl);
                        }
                        return;
                    }

                    // Untuk notifikasi non-conversation: buka popup detail dan browser jika ada URL
                    if (notif != null)
                    {
                        AppLogger.Log($"[ToastNotifier] Badan toast diklik -> membuka popup window: {notif.Title}");
                        NotificationOpened?.Invoke(notif);
                    }

                    if (args.TryGetValue("url", out string? defaultUrl) && !string.IsNullOrWhiteSpace(defaultUrl))
                    {
                        OpenUrlInBrowser(defaultUrl);
                    }
                    else if (notif != null && !string.IsNullOrWhiteSpace(notif.Url))
                    {
                        OpenUrlInBrowser(notif.Url);
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[ToastNotifier] Error handling activation: {ex.Message}");
                }
            };

            EnsureToastRegistryEnabled();
            _initialized = true;
        }

        private static void EnsureToastRegistryEnabled()
        {
            try
            {
                string aumid = Program.AppUserModelId;
                string regPath = $@"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\{aumid}";
                using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(regPath);
                if (key != null)
                {
                    key.SetValue("Enabled", 1, Microsoft.Win32.RegistryValueKind.DWord);
                    key.SetValue("ShowInActionCenter", 1, Microsoft.Win32.RegistryValueKind.DWord);
                    key.SetValue("ShowBanners", 1, Microsoft.Win32.RegistryValueKind.DWord);
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[ToastNotifier] EnsureToastRegistryEnabled error: {ex.Message}");
            }
        }

        public static void ShowNotification(string appName, string title, string message, string? targetUrl = null, string? priority = null, bool playSound = true)
        {
            var data = new NotificationData
            {
                App = string.IsNullOrWhiteSpace(appName) ? "iDesk" : appName,
                Title = string.IsNullOrWhiteSpace(title) ? "Notifikasi Baru" : title,
                Message = message ?? "",
                Url = targetUrl,
                Priority = priority ?? "normal",
                From = appName,
                Subject = title
            };
            ShowNotification(data, playSound);
        }

        public static void ShowNotification(NotificationData data, bool playSound = true)
        {
            try
            {
                Initialize();

                _recentNotifications[data.Id] = data;

                var builder = new ToastContentBuilder();

                // 1. Enterprise Circular Avatar with Santos / iDesk Logo
                string avatarFilePath = EnsureAvatarPath(data.Avatar, data.From ?? data.App, data.App);
                if (File.Exists(avatarFilePath))
                {
                    builder.AddAppLogoOverride(new Uri(avatarFilePath), ToastGenericAppLogoCrop.Circle);
                }

                // 2. Attribution Header (Clean, professional without emojis)
                string appLabel = !string.IsNullOrWhiteSpace(data.App) ? data.App : "iDesk Helpdesk";
                builder.AddAttributionText($"{appLabel} • PT Santos Jaya Abadi");

                // 3. Structured Content:
                // Line 1: Ticket ID + Title / Category (Clean deduplicated prefix)
                string titleText;
                if (!string.IsNullOrWhiteSpace(data.Title))
                {
                    if (!string.IsNullOrWhiteSpace(data.TicketNumber) && !data.Title.Contains(data.TicketNumber))
                    {
                        titleText = $"[#{data.TicketNumber}] {data.Title}";
                    }
                    else
                    {
                        titleText = data.Title;
                    }
                }
                else
                {
                    titleText = !string.IsNullOrWhiteSpace(data.TicketNumber) ? $"[#{data.TicketNumber}] Notifikasi Baru" : "Notifikasi Baru";
                }
                builder.AddText(titleText);

                // Line 2: Sender Info & Message Snippet
                string senderText = !string.IsNullOrWhiteSpace(data.From) ? $"{data.From}: " : "";
                builder.AddText($"{senderText}{data.Message}");

                // 4. Default click argument (opens browser)
                builder.AddArgument("action", "open_url");
                builder.AddArgument("id", data.Id);
                if (!string.IsNullOrWhiteSpace(data.Url))
                {
                    builder.AddArgument("url", data.Url);
                }

                bool isConversation = data.IsConversationNotification();

                // 5. Action Elements:
                // Jika notifikasi adalah CONVERSATION -> tambahkan inline reply box + tombol Kirim
                if (isConversation)
                {
                    builder.AddInputTextBox("replyText", "Ketik balasan Anda...", "");
                    builder.AddButton(new ToastButton()
                        .SetContent("Kirim")
                        .AddArgument("action", "quick_reply")
                        .AddArgument("id", data.Id)
                        .SetBackgroundActivation());

                    if (!string.IsNullOrWhiteSpace(data.Url))
                    {
                        builder.AddButton(new ToastButton()
                            .SetContent("Buka Percakapan di Web →")
                            .AddArgument("action", "open_url")
                            .AddArgument("url", data.Url)
                            .AddArgument("id", data.Id));
                    }
                    // CATATAN: Tombol "Detail" (Popup) TIDAK DITAMPILKAN untuk conversation sesuai permintaan
                }
                else
                {
                    // Non-conversation notification (Ticket baru, SLA, Update, dsb.)
                    if (!string.IsNullOrWhiteSpace(data.Url))
                    {
                        builder.AddButton(new ToastButton()
                            .SetContent("Buka di Web →")
                            .AddArgument("action", "open_url")
                            .AddArgument("url", data.Url)
                            .AddArgument("id", data.Id));
                    }

                    builder.AddButton(new ToastButton()
                        .SetContent("Detail")
                        .AddArgument("action", "open_popup")
                        .AddArgument("id", data.Id));
                }

                // 6. Audio chime selection
                if (playSound)
                {
                    builder.AddAudio(new ToastAudio()
                    {
                        Src = new Uri("ms-winsoundevent:Notification.Default")
                    });
                }
                else
                {
                    builder.AddAudio(new ToastAudio() { Silent = true });
                }

                // Priority scenario
                if (string.Equals(data.Priority, "urgent", StringComparison.OrdinalIgnoreCase))
                {
                    builder.SetToastScenario(ToastScenario.Reminder);
                }
                else
                {
                    builder.SetToastScenario(ToastScenario.Default);
                }

                builder.Show();
                AppLogger.Info($"[ToastNotifier] Windows Toast berhasil dimunculkan untuk '{data.Title}'");
            }
            catch (Exception ex)
            {
                AppLogger.Error($"[ToastNotifier] Gagal memunculkan toast: {ex.Message}", ex);
            }
        }

        private static async Task HandleToastQuickReplyAsync(string? notifId, string replyText, string? callbackUrl, NotificationData? notif)
        {
            if (string.IsNullOrWhiteSpace(replyText)) return;

            AppLogger.Info($"[ToastNotifier] Memproses Quick Reply untuk notif ID: {notifId}, Ticket: {notif?.TicketNumber ?? notif?.TicketId}");

            // 1. Ekstrak Target Ticket ID
            string? ticketId = notif?.TicketId;
            if (string.IsNullOrWhiteSpace(ticketId) && notif?.Url != null)
            {
                var match = System.Text.RegularExpressions.Regex.Match(notif.Url, @"/tickets/([a-zA-Z0-9-]+)");
                if (match.Success)
                {
                    ticketId = match.Groups[1].Value;
                }
            }

            var cfg = AppConfig.Load();
            var session = DeviceSecurityStorage.LoadSession();
            string? jwtToken = session?.Token;

            bool sentDirectly = false;
            string targetUrl = notif?.Url ?? cfg.IdeskServerUrl;

            // 2. Coba kirim langsung ke iDesk API jika ticketId & session token ada
            if (!string.IsNullOrWhiteSpace(ticketId))
            {
                try
                {
                    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
                    if (!string.IsNullOrWhiteSpace(jwtToken))
                    {
                        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", jwtToken);
                    }

                    string ideskApiBase = cfg.IdeskServerUrl.TrimEnd('/');
                    string replyEndpoint = $"{ideskApiBase}/api/v1/tickets/{ticketId}/reply";

                    var form = new MultipartFormDataContent();
                    form.Add(new StringContent(replyText, Encoding.UTF8), "content");
                    form.Add(new StringContent("false"), "isInternal");

                    var response = await client.PostAsync(replyEndpoint, form);
                    if (response.IsSuccessStatusCode)
                    {
                        sentDirectly = true;
                        AppLogger.Info($"[ToastNotifier] Quick reply berhasil dikirim ke iDesk API: {replyEndpoint}");
                    }
                    else
                    {
                        AppLogger.Warn($"[ToastNotifier] Quick reply API gagal: status {response.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[ToastNotifier] Error kirim quick reply ke iDesk API: {ex.Message}");
                }
            }

            // 3. Jika belum terkirim dan ada callbackUrl, panggil callbackUrl
            if (!sentDirectly && !string.IsNullOrWhiteSpace(callbackUrl))
            {
                try
                {
                    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                    var payload = new
                    {
                        notificationId = notifId,
                        ticketId = ticketId,
                        ticketNumber = notif?.TicketNumber,
                        reply = replyText,
                        sender = session?.FullName ?? Environment.UserName,
                        timestamp = DateTime.UtcNow
                    };

                    var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                    var res = await client.PostAsync(callbackUrl, content);
                    if (res.IsSuccessStatusCode)
                    {
                        sentDirectly = true;
                        AppLogger.Info($"[ToastNotifier] Quick reply berhasil diteruskan via callbackUrl: {callbackUrl}");
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[ToastNotifier] Gagal memanggil callbackUrl: {ex.Message}");
                }
            }

            // 4. UX Feedback ke user
            if (sentDirectly)
            {
                // Tampilkan Toast konfirmasi sukses singkat
                ShowReplyStatusToast(true, notif?.TicketNumber ?? "Tiket", replyText, targetUrl);
            }
            else
            {
                // Tampilkan Toast peringatan gagal dan buka percakapan di browser agar pesan tidak hilang
                ShowReplyStatusToast(false, notif?.TicketNumber ?? "Tiket", replyText, targetUrl);
                OpenUrlInBrowser(targetUrl);
            }
        }

        private static void ShowReplyStatusToast(bool success, string ticketTag, string messageSnippet, string targetUrl)
        {
            try
            {
                var builder = new ToastContentBuilder();
                builder.AddAttributionText("iDesk Helpdesk • PT Santos Jaya Abadi");

                if (success)
                {
                    builder.AddText($"Balasan Terkirim ke [#{ticketTag}]");
                    builder.AddText($"\"{messageSnippet}\"");
                    builder.AddAudio(new ToastAudio { Src = new Uri("ms-winsoundevent:Notification.Default") });
                }
                else
                {
                    builder.AddText($"Gagal Mengirim Balasan ke [#{ticketTag}]");
                    builder.AddText("Koneksi atau sesi belum terhubung. Mengalihkan ke browser...");
                }

                if (!string.IsNullOrWhiteSpace(targetUrl))
                {
                    builder.AddArgument("action", "open_url");
                    builder.AddArgument("url", targetUrl);
                    builder.AddButton(new ToastButton()
                        .SetContent("Buka Percakapan di Web →")
                        .AddArgument("action", "open_url")
                        .AddArgument("url", targetUrl));
                }

                builder.Show();
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[ToastNotifier] Gagal memunculkan toast status reply: {ex.Message}");
            }
        }

        private static string EnsureAvatarPath(string? avatarUrl, string senderName, string appName = "iDesk")
        {
            try
            {
                string cacheDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SJANotifier", "cache"
                );
                if (!Directory.Exists(cacheDir)) Directory.CreateDirectory(cacheDir);

                // Check local assets first: santos-logo.png, then idesk-logo.png
                string santosLogoAsset = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "santos-logo.png");
                string ideskLogoAsset = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "idesk-logo.png");

                string logoToUse = File.Exists(santosLogoAsset) ? santosLogoAsset : ideskLogoAsset;

                if (File.Exists(logoToUse))
                {
                    string cachedLogoAvatar = Path.Combine(cacheDir, "avatar_sja_brand.png");
                    if (!File.Exists(cachedLogoAvatar))
                    {
                        using var srcImg = Image.FromFile(logoToUse);
                        using var bmp = new Bitmap(128, 128);
                        using var g = Graphics.FromImage(bmp);
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;

                        using var bgBrush = new SolidBrush(Color.White);
                        g.FillRectangle(bgBrush, 0, 0, 128, 128);

                        // Center logo nicely with padding
                        g.DrawImage(srcImg, new Rectangle(14, 14, 100, 100));
                        bmp.Save(cachedLogoAvatar, ImageFormat.Png);
                    }
                    return cachedLogoAvatar;
                }

                // If local file path exists, return it
                if (!string.IsNullOrWhiteSpace(avatarUrl) && File.Exists(avatarUrl))
                {
                    return avatarUrl;
                }

                // Generate clean initials badge
                string sanitizedName = string.IsNullOrWhiteSpace(senderName) ? "SJA" : senderName.Trim();
                string initial = sanitizedName.Substring(0, Math.Min(2, sanitizedName.Length)).ToUpperInvariant();
                string cachedAvatar = Path.Combine(cacheDir, $"avatar_{initial}.png");

                if (File.Exists(cachedAvatar)) return cachedAvatar;

                using var initialBmp = new Bitmap(96, 96);
                using var initialG = Graphics.FromImage(initialBmp);
                initialG.SmoothingMode = SmoothingMode.AntiAlias;
                initialG.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                using var brush = new SolidBrush(FluentTheme.NavyBrand);
                initialG.FillRectangle(brush, 0, 0, 96, 96);

                using var font = FluentTheme.GetFont(22F, FontStyle.Bold);
                using var textBrush = new SolidBrush(Color.White);
                var sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                initialG.DrawString(initial, font, textBrush, new RectangleF(0, 0, 96, 96), sf);

                initialBmp.Save(cachedAvatar, ImageFormat.Png);
                return cachedAvatar;
            }
            catch
            {
                return "";
            }
        }

        public static void ShowTestNotification(string displayMode = "both")
        {
            TriggerIdeskScenario("created", displayMode);
        }

        public static void TriggerIdeskScenario(string scenario, string displayMode = "both", string? baseUrl = null)
        {
            NotificationData data;
            string key = scenario?.ToLowerInvariant() ?? "created";
            string server = !string.IsNullOrWhiteSpace(baseUrl) ? baseUrl.TrimEnd('/') : "https://idesk.santos.co.id";

            switch (key)
            {
                case "assigned":
                case "ticket_assigned":
                    data = new NotificationData
                    {
                        App = "iDesk",
                        Title = "Tiket #TKT-2026-0988 Ditugaskan ke Anda",
                        Message = "Tiket 'Troubleshoot Switch Core Cisco Server Lt 2' telah ditugaskan ke Anda oleh Anton Wijaya (Supervisor IT). Harap segera lakukan diagnosa.",
                        Url = $"{server}/tickets/TKT-2026-0988",
                        Priority = "high",
                        Display = displayMode,
                        Avatar = "idesk",
                        From = "Anton Wijaya (IT Supervisor)",
                        To = "Anda (Support Engineer)",
                        Subject = "Troubleshoot Switch Core Server Lantai 2",
                        Category = "Network & Infrastructure",
                        TicketNumber = "TKT-2026-0988",
                        CallbackUrl = "http://127.0.0.1:18399/reply-ack"
                    };
                    data.Attachments.Add(new NotificationAttachment { Name = "topologi_switch_lt2.pdf", Size = "1.4 MB", Url = server });
                    break;

                case "sla":
                case "sla_warning":
                case "urgent":
                    data = new NotificationData
                    {
                        App = "iDesk",
                        Title = "⚠️ SLA Warning: Tiket #080926-GEN-0001 Sisa 15 Menit!",
                        Message = "Tiket 'Printer rusak / tidak merespon' mendekati batas waktu penanganan SLA. Segera lakukan eskalasi.",
                        Url = $"{server}/tickets/21cc1b78-72fe-4b34-81c7-0c6f2296d22f",
                        Priority = "urgent",
                        Display = displayMode,
                        Avatar = "idesk",
                        From = "SLA Engine Monitor",
                        To = "Tim Helpdesk Support",
                        Subject = "Peringatan Batas Waktu SLA",
                        Category = "Hardware Support",
                        TicketNumber = "#080926-GEN-0001",
                        CallbackUrl = "http://127.0.0.1:18399/reply-ack"
                    };
                    break;

                case "reply":
                case "ticket_reply":
                case "chat":
                    data = new NotificationData
                    {
                        App = "iDesk",
                        Title = "Pesan Baru pada Tiket #080926-GEN-0001",
                        Message = "Halo tim IT, teknisi sudah cek ke lokasi lantai 2 SPJ, mohon segera ditindaklanjuti penggantian kabel roll.",
                        Url = $"{server}/tickets/21cc1b78-72fe-4b34-81c7-0c6f2296d22f",
                        Priority = "normal",
                        Display = displayMode,
                        Avatar = "idesk",
                        From = "User SPJ (Staff SPJ)",
                        To = "Anda (Assignee IT)",
                        Subject = "Kendala Printer Rusak Lantai 2",
                        Category = "TICKET_REPLY",
                        TicketNumber = "#080926-GEN-0001",
                        TicketId = "21cc1b78-72fe-4b34-81c7-0c6f2296d22f",
                        CallbackUrl = "http://127.0.0.1:18399/reply-ack"
                    };
                    data.Attachments.Add(new NotificationAttachment { Name = "foto_printer_lantai2.jpg", Size = "420 KB", Url = server });
                    break;

                case "hardware":
                case "hardware_request":
                case "eform":
                    data = new NotificationData
                    {
                        App = "iDesk",
                        Title = "Pengajuan Hardware Baru: Laptop Dell Latitude 5440",
                        Message = "Pengajuan aset hardware baru #HW-2026-041 dari Dept Purchasing memerlukan persetujuan Manager IT & Dept Lead.",
                        Url = $"{server}/hardware-requests/HW-2026-041",
                        Priority = "high",
                        Display = displayMode,
                        Avatar = "idesk",
                        From = "Siti Rahma (Purchasing SPJ)",
                        To = "IT Manager & Dept Lead",
                        Subject = "Pengadaan Laptop Dept Purchasing 2026",
                        Category = "Hardware & Asset",
                        TicketNumber = "HW-2026-041",
                        CallbackUrl = "http://127.0.0.1:18399/reply-ack"
                    };
                    data.Attachments.Add(new NotificationAttachment { Name = "dokumen_po_hardware.pdf", Size = "680 KB", Url = server });
                    break;

                default: // Tiket Baru Masuk (TICKET_CREATED)
                    data = new NotificationData
                    {
                        App = "iDesk",
                        Title = "Tiket Baru #TKT-2026-1042: Kendala Printer Lantai 2",
                        Message = "Dear Tim IT, printer jaringan di lantai 2 SPJ mendadak offline dan antrean cetak macet. Mohon bantuannya yaa.",
                        Url = $"{server}/tickets/TKT-2026-1042",
                        Priority = "normal",
                        Display = displayMode,
                        Avatar = "idesk",
                        From = "Mas Yudi Yudi (Staff SPJ)",
                        To = "Tim Helpdesk Support",
                        Subject = "Kendala Printer SPJ Lantai 2",
                        Category = "Hardware Support",
                        TicketNumber = "TKT-2026-1042",
                        CallbackUrl = "http://127.0.0.1:18399/reply-ack"
                    };
                    data.Attachments.Add(new NotificationAttachment { Name = "tambahan.xlsx", Size = "142 KB", Url = server });
                    break;
            }

            AppLogger.Log($"[ToastNotifier] Memicu skenario '{key}' (mode: {displayMode}) untuk '{data.Title}' | URL: {data.Url}");

            bool isConversation = data.IsConversationNotification();

            if (displayMode == "toast" || displayMode == "both" || isConversation)
            {
                ShowNotification(data);
            }

            // Supresi popup untuk conversation
            if (!isConversation && (displayMode == "popup" || displayMode == "both"))
            {
                NotificationOpened?.Invoke(data);
            }
        }

        public static void OpenUrlInBrowser(string url)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(url)) return;

                if (File.Exists(url))
                {
                    AppLogger.Log($"[OpenUrlInBrowser] Membuka file lokal: {url}");
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                    return;
                }

                if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                    !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
                    !url.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
                {
                    url = "https://" + url;
                }

                AppLogger.Log($"[OpenUrlInBrowser] Membuka URL tindak lanjut: {url}");

                // Standard modern Windows ShellExecute
                // OS automatically launches/activates default browser tab without modifying window geometry/maximized state
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                AppLogger.Log($"[OpenUrlInBrowser] Failed to open URL {url}: {ex.Message}");
            }
        }

        public static void AcknowledgeRead(string? jobId)
        {
            if (string.IsNullOrWhiteSpace(jobId)) return;
            Task.Run(async () =>
            {
                try
                {
                    var cfg = AppConfig.Load();
                    using var hc = new HttpClient();
                    var payload = new { id = jobId, jobId = jobId, employeeId = Environment.UserName };
                    var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                    await hc.PostAsync($"{cfg.SjaServerUrl.TrimEnd('/')}/v1/notifications/is-read", content);
                    AppLogger.Info($"[ToastNotifier] Read receipt sent for notification: {jobId}");
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[ToastNotifier] Failed to send read receipt: {ex.Message}");
                }
            });
        }
    }
}
