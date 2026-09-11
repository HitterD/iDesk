using System;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SJANotificationApp
{
    public class SjaNativeWebSocketClient
    {
        private ClientWebSocket? _ws;
        private readonly Uri _serverUri;
        private readonly SemaphoreSlim _sendLock = new(1, 1);
        public event Action<NotificationData>? OnNotificationReceived;
        public event Action<string, JsonElement>? OnRemoteMessageReceived;
        public event Action<bool>? OnConnectionStatusChanged;
        public event Action? OnTokenRejected;

        public async Task<bool> SendJsonAsync(object message, CancellationToken ct = default)
        {
            if (_ws == null || _ws.State != WebSocketState.Open) return false;
            await _sendLock.WaitAsync(ct);
            try
            {
                if (_ws.State != WebSocketState.Open) return false;
                string json = JsonSerializer.Serialize(message);
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
                return true;
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[WS] Gagal mengirim pesan: {ex.Message}");
                return false;
            }
            finally
            {
                _sendLock.Release();
            }
        }

        public SjaNativeWebSocketClient(string serverUrl, string deviceToken)
        {
            string cleanUrl = serverUrl.TrimEnd('/');
            string wsScheme = cleanUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || cleanUrl.StartsWith("wss://", StringComparison.OrdinalIgnoreCase) ? "wss://" : "ws://";
            string hostAndPort = cleanUrl.Replace("https://", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("http://", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("wss://", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("ws://", "", StringComparison.OrdinalIgnoreCase);
            var serverUri = new Uri($"{wsScheme}{hostAndPort}");
            string? p2pIp = P2pConnectionSupport.ResolveLocalP2pIp(serverUri.Host);
            string p2pQuery = string.IsNullOrWhiteSpace(p2pIp)
                ? ""
                : $"&p2pIp={Uri.EscapeDataString(p2pIp)}";

            _serverUri = new Uri($"{serverUri.GetLeftPart(UriPartial.Authority)}/v1/devices/stream?token={Uri.EscapeDataString(deviceToken)}{p2pQuery}");
        }

        public async Task StartAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                bool wasConnected = false;
                try
                {
                    _ws?.Dispose();
                    _ws = new ClientWebSocket();
                    AppLogger.Info($"Menghubungkan ke SJA Gateway: {_serverUri.GetLeftPart(UriPartial.Path)}");
                    await _ws.ConnectAsync(_serverUri, ct);
                    wasConnected = true;
                    OnConnectionStatusChanged?.Invoke(true);
                    AppLogger.Info("Terhubung ke SJA Gateway WebSocket");

                    bool tokenRejected = await ReceiveLoopAsync(ct);
                    if (tokenRejected)
                    {
                        AppLogger.Warn("Token perangkat ditolak server (4003/Perangkat tidak terdaftar). Menghentikan loop koneksi.");
                        OnTokenRejected?.Invoke();
                        break;
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"Koneksi WebSocket terputus: {ex.Message}");
                }
                finally
                {
                    if (wasConnected)
                    {
                        OnConnectionStatusChanged?.Invoke(false);
                    }
                }

                if (!ct.IsCancellationRequested)
                {
                    AppLogger.Info("Menunggu 5 detik sebelum reconnect...");
                    try
                    {
                        await Task.Delay(5000, ct);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }
        }

        private async Task<bool> ReceiveLoopAsync(CancellationToken ct)
        {
            AppLogger.Info($"[WS] ReceiveLoopAsync dimulai, state={_ws?.State}");
            var buffer = new byte[16384];
            bool tokenRejected = false;

            while (_ws?.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                using var ms = new MemoryStream();
                bool isClose = false;

                try
                {
                    while (true)
                    {
                        var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            isClose = true;
                            var status = (int?)(_ws.CloseStatus);
                            var desc = _ws.CloseStatusDescription;
                            AppLogger.Warn($"[WS] Server meminta penutupan koneksi: Status={status} ({_ws.CloseStatus}), Deskripsi='{desc}'");

                            if (status == 4003 || desc?.IndexOf("Forbidden", StringComparison.OrdinalIgnoreCase) >= 0 || desc?.IndexOf("tidak terdaftar", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                tokenRejected = true;
                            }

                            try
                            {
                                await _ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "Closing", ct);
                            }
                            catch { }
                            break;
                        }

                        ms.Write(buffer, 0, result.Count);
                        if (result.EndOfMessage) break;
                    }
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    AppLogger.Warn($"[WS] Kesalahan receive: {ex.Message}");
                    break;
                }

                if (isClose) break;

                var json = Encoding.UTF8.GetString(ms.ToArray());
                // Only log non-frame messages to keep log readable
                if (json.Length < 500)
                {
                    AppLogger.Info($"[WS] Raw frame diterima: {json}");
                }

                try
                {
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    // Handle Remote Session & Signaling messages
                    if (root.TryGetProperty("action", out var actionProp))
                    {
                        string action = actionProp.GetString() ?? "";
                        if (action.StartsWith("REMOTE_"))
                        {
                            OnRemoteMessageReceived?.Invoke(action, root.Clone());
                            continue;
                        }
                    }

                    var notif = JsonSerializer.Deserialize<NotificationData>(json, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                    });

                    if (notif != null && !string.IsNullOrEmpty(notif.Title))
                    {
                        AppLogger.Info($"[WS] Payload valid: Title='{notif.Title}' | Display='{notif.Display}'");
                        OnNotificationReceived?.Invoke(notif);

                        // Kirim balik frame acknowledgement
                        if (!string.IsNullOrEmpty(notif.Id))
                        {
                            var ackPayload = JsonSerializer.Serialize(new { action = "ACK", jobId = notif.Id });
                            var ackBytes = Encoding.UTF8.GetBytes(ackPayload);
                            await _ws.SendAsync(new ArraySegment<byte>(ackBytes), WebSocketMessageType.Text, true, ct);
                            AppLogger.Info($"[WS] ACK terkirim untuk job: {notif.Id}");
                        }
                    }
                    else
                    {
                        AppLogger.Warn("[WS] Hasil deserialisasi bukan notifikasi standar atau null");
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"[WS] Gagal parse pesan: {ex.Message}");
                }
            }

            AppLogger.Info($"[WS] ReceiveLoopAsync berakhir, state={_ws?.State}");
            return tokenRejected;
        }

        public void Disconnect()
        {
            try
            {
                _ws?.Abort();
                _ws?.Dispose();
                _ws = null;
                OnConnectionStatusChanged?.Invoke(false);
            }
            catch {}
        }
    }
}
