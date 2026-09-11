using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SJANotificationApp
{
    public class LocalWebhookListener
    {
        private HttpListener? _listener;
        private readonly int _port;
        private readonly CancellationTokenSource _cts = new();

        public LocalWebhookListener(int port)
        {
            _port = port;
        }

        public void Start()
        {
            Task.Run(() => ListenLoopAsync(_cts.Token));
        }

        public void Stop()
        {
            _cts.Cancel();
            try { _listener?.Stop(); _listener?.Close(); } catch { }
        }

        private async Task ListenLoopAsync(CancellationToken ct)
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://127.0.0.1:{_port}/");
                _listener.Prefixes.Add($"http://localhost:{_port}/");
                _listener.Start();
                AppLogger.Info($"[LocalWebhook] Server aktif di port {_port}");

                while (!ct.IsCancellationRequested && _listener.IsListening)
                {
                    var context = await _listener.GetContextAsync();
                    _ = Task.Run(() => HandleRequestAsync(context));
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[LocalWebhook] Listener exception: {ex.Message}");
            }
        }

        private async Task HandleRequestAsync(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            // Restrict CORS specifically to Santos intranet domain and local origin
            string origin = req.Headers["Origin"] ?? "";
            bool isAllowedOrigin = string.IsNullOrEmpty(origin) ||
                                  origin.StartsWith("http://idesk.santos.co.id", StringComparison.OrdinalIgnoreCase) ||
                                  origin.StartsWith("https://idesk.santos.co.id", StringComparison.OrdinalIgnoreCase) ||
                                  origin.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                                  origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase);

            if (isAllowedOrigin)
            {
                res.Headers.Add("Access-Control-Allow-Origin", string.IsNullOrEmpty(origin) ? "*" : origin);
            }
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            try
            {
                string path = req.Url?.AbsolutePath.TrimEnd('/').ToLowerInvariant() ?? "";

                if (path == "/health")
                {
                    var cfg = AppConfig.Load();
                    var healthJson = JsonSerializer.Serialize(new
                    {
                        status = "ok",
                        app = "SJA Notification App",
                        version = "2.0.0",
                        company = "PT Santos Jaya Abadi",
                        defaultDisplayMode = cfg.DefaultDisplayMode
                    });
                    await SendJsonResponseAsync(res, 200, healthJson);
                    return;
                }

                if (path == "/show" || path == "/open")
                {
                    TrayApplicationContext.Instance?.ShowMainWindow();
                    await SendJsonResponseAsync(res, 200, "{\"success\":true,\"message\":\"Window opened\"}");
                    return;
                }

                if (path == "/preview")
                {
                    string viewMode = req.QueryString["view"] ?? "dashboard";
                    TrayApplicationContext.Instance?.ShowPreviewMode(viewMode);
                    await SendJsonResponseAsync(res, 200, "{\"success\":true,\"message\":\"Preview mode activated\"}");
                    return;
                }

                if (path == "/test")
                {
                    string scenario = req.QueryString["scenario"] ?? "created";
                    string display = req.QueryString["display"] ?? "both";
                    string? baseUrl = req.QueryString["baseUrl"];

                    AppLogger.Info($"[LocalWebhook] Test trigger: scenario={scenario}, display={display}");
                    ToastNotifier.TriggerIdeskScenario(scenario, display, baseUrl);

                    await SendJsonResponseAsync(res, 200, "{\"success\":true,\"message\":\"Notifikasi dipicu\"}");
                    return;
                }

                if (path == "/notify" && req.HttpMethod == "POST")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();

                    NotificationData? notif = null;
                    try
                    {
                        using var doc = JsonDocument.Parse(body);
                        var root = doc.RootElement;

                        notif = JsonSerializer.Deserialize<NotificationData>(body, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        // Enrich data dari metadata nested jika ada (dari frontend forwardToDesktopNotifier)
                        if (notif != null && root.TryGetProperty("metadata", out var metaProp) && metaProp.ValueKind == JsonValueKind.Object)
                        {
                            if (metaProp.TryGetProperty("from", out var f) && !string.IsNullOrEmpty(f.GetString())) notif.From = f.GetString();
                            if (metaProp.TryGetProperty("to", out var t) && !string.IsNullOrEmpty(t.GetString())) notif.To = t.GetString();
                            if (metaProp.TryGetProperty("subject", out var s) && !string.IsNullOrEmpty(s.GetString())) notif.Subject = s.GetString();
                            if (metaProp.TryGetProperty("category", out var c) && !string.IsNullOrEmpty(c.GetString())) notif.Category = c.GetString();
                            if (metaProp.TryGetProperty("ticketNumber", out var tn) && !string.IsNullOrEmpty(tn.GetString())) notif.TicketNumber = tn.GetString();
                            if (metaProp.TryGetProperty("ticketId", out var tid) && !string.IsNullOrEmpty(tid.GetString())) notif.TicketId = tid.GetString();
                        }
                    }
                    catch (Exception ex)
                    {
                        AppLogger.Warn($"[LocalWebhook] Gagal parse body notify: {ex.Message}");
                    }

                    if (notif != null)
                    {
                        bool isConversation = notif.IsConversationNotification();
                        AppLogger.Info($"[LocalWebhook] Notify request diterima: {notif.Title} (display: {notif.Display}, isConversation: {isConversation})");
                        string mode = (notif.Display ?? "both").ToLowerInvariant();
                        if (mode == "toast" || mode == "both" || isConversation)
                        {
                            ToastNotifier.ShowNotification(notif);
                        }
                        if (!isConversation && (mode == "popup" || mode == "both"))
                        {
                            TrayApplicationContext.ShowPopupWindow(notif);
                        }
                        await SendJsonResponseAsync(res, 200, "{\"success\":true}");
                        return;
                    }
                }

                if (path == "/config" && req.HttpMethod == "POST")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("defaultDisplayMode", out var modeProp))
                    {
                        var cfg = AppConfig.Load();
                        cfg.DefaultDisplayMode = modeProp.GetString() ?? "both";
                        cfg.Save();
                        AppLogger.Info($"[LocalWebhook] Config updated: DefaultDisplayMode={cfg.DefaultDisplayMode}");
                    }
                    await SendJsonResponseAsync(res, 200, "{\"success\":true}");
                    return;
                }

                if (path == "/session/sync" && req.HttpMethod == "POST")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    using var doc = JsonDocument.Parse(body);
                    var root = doc.RootElement;

                    string identifier = root.TryGetProperty("identifier", out var idProp) ? idProp.GetString() ?? "" : "";
                    string password = root.TryGetProperty("password", out var pwProp) ? pwProp.GetString() ?? "" : "";
                    string deviceToken = root.TryGetProperty("deviceToken", out var dtProp) ? dtProp.GetString() ?? "" : "";

                    if (!string.IsNullOrEmpty(deviceToken))
                    {
                        AppLogger.Info("[LocalWebhook] Auto-sync received deviceToken directly");
                        var session = new UserProfileSession
                        {
                            Token = deviceToken,
                            DeviceId = root.TryGetProperty("deviceId", out var deviceIdProp) ? deviceIdProp.GetString() ?? "" : ""
                        };
                        if (root.TryGetProperty("user", out var userProp))
                        {
                            session.EmployeeId = userProp.TryGetProperty("employeeId", out var empId) ? empId.GetString() ?? "" : "";
                            session.FullName = userProp.TryGetProperty("name", out var empName) ? empName.GetString() ?? "" : "";
                            session.Email = userProp.TryGetProperty("email", out var empEmail) ? empEmail.GetString() ?? "" : "";
                            session.SiteCode = userProp.TryGetProperty("siteCode", out var empSite) ? empSite.GetString() ?? "SPJ" : "SPJ";
                        }
                        DeviceSecurityStorage.SaveSession(session);
                        TrayApplicationContext.Instance?.ReconnectWithToken(deviceToken);
                        await SendJsonResponseAsync(res, 200, "{\"success\":true,\"message\":\"Token disinkronkan\"}");
                        return;
                    }

                    if (!string.IsNullOrEmpty(identifier) && !string.IsNullOrEmpty(password))
                    {
                        var cfg = AppConfig.Load();
                        var manager = new DeviceActivationManager(cfg.SjaServerUrl);
                        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                        string? token = await manager.LoginDirectAsync(identifier, password, cts.Token);

                        if (!string.IsNullOrEmpty(token))
                        {
                            AppLogger.Info($"[LocalWebhook] Auto-sync session berhasil untuk '{identifier}'");
                            TrayApplicationContext.Instance?.ReconnectWithToken(token);
                            await SendJsonResponseAsync(res, 200, "{\"success\":true,\"message\":\"Desktop notifier connected\"}");
                            return;
                        }
                    }

                    await SendJsonResponseAsync(res, 400, "{\"success\":false,\"message\":\"Kredensial tidak valid untuk sync\"}");
                    return;
                }

                if (path == "/session/logout" && req.HttpMethod == "POST")
                {
                    AppLogger.Info("[LocalWebhook] Session logout request diterima dari web");
                    TrayApplicationContext.Instance?.LogoutCurrentSession();
                    await SendJsonResponseAsync(res, 200, "{\"success\":true,\"message\":\"Desktop notifier logged out\"}");
                    return;
                }

                res.StatusCode = 404;
                res.Close();
            }
            catch (Exception ex)
            {
                AppLogger.Error("[LocalWebhook] Request handler error", ex);
                res.StatusCode = 500;
                res.Close();
            }
        }

        private static async Task SendJsonResponseAsync(HttpListenerResponse res, int statusCode, string json)
        {
            res.StatusCode = statusCode;
            res.ContentType = "application/json; charset=utf-8";
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            res.ContentLength64 = bytes.Length;
            await res.OutputStream.WriteAsync(bytes, 0, bytes.Length);
            res.Close();
        }
    }
}
