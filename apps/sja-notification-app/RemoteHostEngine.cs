using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Remote Desktop Host Engine running on the client PC.
    /// Features:
    /// 1. Handshake security with token authorization & timeout.
    /// 2. Tile-Based JPEG Diffing (64x64) reducing bandwidth from ~40Mbps to ~1-2Mbps.
    /// 3. Zero frame transmission during countdown veto gate.
    /// 4. Length-prefixed framed control stream (anti-buffer overflow).
    /// 5. Chunked stream-to-disk binary file transfer without file size limits.
    /// 6. Dual-mode support: direct P2P TCP (port 18389) and WebSocket Frame Relay fallback.
    /// </summary>
    public class RemoteHostEngine : IDisposable
    {
        public const int TCP_PORT = 18389;
        public const uint FRAME_MAGIC_FULL = 0x534A4101; // Legacy full frame
        public const uint FRAME_MAGIC_TILES = 0x534A4102; // Tile-diff frame
        public const uint CMD_MAGIC = 0x534A434D;        // Command framing "SJCM"

        private const int TILE_SIZE = 64;

        private readonly int _port;
        private TcpListener? _listener;
        private TcpClient? _client;
        private NetworkStream? _stream;
        private readonly SemaphoreSlim _streamWriteLock = new(1, 1);
        private CancellationTokenSource? _cts;
        private bool _isRunning;

        // Session authorization state
        private readonly object _authLock = new();
        private string? _authorizedSessionId;
        private string? _authorizedSessionSecret;
        private string? _authorizedAgentDeviceId;
        private string? _authorizedAgentIp;
        private DateTime _sessionExpiresAt;
        private bool _isConsentGranted;
        private bool _relayCaptureActive;

        // Active file transfer state
        private string? _activeTransferId;
        private string? _activeTransferFileName;
        private string? _activeTransferTempPath;
        private FileStream? _activeTransferStream;

        // Events
        public event Action<string>? OnSessionStarted;
        public event Action<string>? OnSessionEnded;
        public event Action<string, long, Action<bool>>? OnFileTransferRequested; // fileName, size, callback(accepted)
        public event Action<byte[]>? OnRelayFrameReady;

        public bool IsRunning => _isRunning;
        public bool IsConsentGranted => _isConsentGranted;
        public string? ActiveSessionId => _authorizedSessionId;
        public string? ActiveSessionSecret => _authorizedSessionSecret;
        public string? AuthorizedAgentDeviceId => _authorizedAgentDeviceId;

        public RemoteHostEngine(int port = TCP_PORT)
        {
            _port = port;
        }

        public void AuthorizeSession(string sessionId, string sessionSecret, string agentDeviceId, string agentIp, DateTime expiresAt, int countdownSeconds)
        {
            lock (_authLock)
            {
                _authorizedSessionId = sessionId;
                _authorizedSessionSecret = sessionSecret;
                _authorizedAgentDeviceId = agentDeviceId;
                _authorizedAgentIp = agentIp;
                _sessionExpiresAt = expiresAt.ToUniversalTime();
                _isConsentGranted = false;
                _relayCaptureActive = false;
            }
            AppLogger.Info($"[RemoteHost] Sesi diotorisasi: SessionId={sessionId} dari IP={agentIp}, menunggu consent ({countdownSeconds}s)");
        }

        public void GrantConsent()
        {
            lock (_authLock)
            {
                _isConsentGranted = true;
            }
            AppLogger.Info("[RemoteHost] Izin layar diberikan oleh pengguna (countdown selesai/dilewati)");
        }

        public void RevokeSession()
        {
            lock (_authLock)
            {
                _authorizedSessionId = null;
                _authorizedSessionSecret = null;
                _authorizedAgentDeviceId = null;
                _isConsentGranted = false;
                _relayCaptureActive = false;
            }
            CleanupActiveFileTransfer();
            try { _client?.Close(); } catch { }
            AppLogger.Info("[RemoteHost] Sesi remote dibatalkan/ditolak oleh pengguna");
        }

        public int BoundPort => (_listener?.LocalEndpoint as IPEndPoint)?.Port ?? _port;

        public void Start()
        {
            if (_isRunning) return;
            _isRunning = true;
            _cts = new CancellationTokenSource();

            try
            {
                _listener = new TcpListener(IPAddress.Any, _port);
                _listener.Start();
                AppLogger.Info($"[RemoteHost] Listener P2P aktif pada port {BoundPort}");
            }
            catch (Exception ex)
            {
                AppLogger.Error("[RemoteHost] Kesalahan listener TCP", ex);
                _isRunning = false;
                throw;
            }

            Task.Run(async () =>
            {
                try
                {
                    while (!_cts.Token.IsCancellationRequested)
                    {
                        var client = await _listener.AcceptTcpClientAsync(_cts.Token);
                        _ = HandleAgentClientAsync(client, _cts.Token);
                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex)
                {
                    AppLogger.Error("[RemoteHost] Kesalahan accept TCP", ex);
                }
            });
        }

        private async Task HandleAgentClientAsync(TcpClient client, CancellationToken ct)
        {
            string agentEp = client.Client.RemoteEndPoint?.ToString() ?? "unknown";
            AppLogger.Info($"[RemoteHost] Koneksi masuk dari endpoint: {agentEp}");

            var stream = client.GetStream();
            using var authCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, authCts.Token);

            // 1. Mandatory Handshake Token Validation
            try
            {
                var authDoc = await ReadCommandAsync(stream, linkedCts.Token);
                if (authDoc == null)
                {
                    AppLogger.Warn($"[RemoteHost] Handshake gagal dari {agentEp}: payload kosong atau invalid");
                    client.Close();
                    return;
                }

                var root = authDoc.RootElement;
                string type = root.TryGetProperty("t", out var t) ? t.GetString() ?? "" : "";
                string sessionId = root.TryGetProperty("sessionId", out var sid) ? sid.GetString() ?? "" : "";
                string secret = root.TryGetProperty("secret", out var s) ? s.GetString() ?? "" : "";

                bool authorized = false;
                lock (_authLock)
                {
                    if (type == "auth" &&
                        !string.IsNullOrEmpty(_authorizedSessionId) &&
                        _authorizedSessionId == sessionId &&
                        _authorizedSessionSecret == secret &&
                        DateTime.UtcNow <= _sessionExpiresAt)
                    {
                        authorized = true;
                    }
                }

                if (!authorized)
                {
                    AppLogger.Warn($"[RemoteHost] Percobaan akses remote tidak sah dari {agentEp}! Sesi ditolak.");
                    await WriteCommandAsync(stream, new { t = "auth_fail", reason = "Token sesi tidak valid atau telah kadaluarsa" }, ct);
                    client.Close();
                    return;
                }

                await WriteCommandAsync(stream, new { t = "auth_ok", status = "authorized" }, ct);
                AppLogger.Info($"[RemoteHost] Autentikasi sukses untuk sesi {sessionId} dari {agentEp}");
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[RemoteHost] Timeout/kesalahan handshake dari {agentEp}: {ex.Message}");
                client.Close();
                return;
            }

            _client = client;
            _stream = stream;
            OnSessionStarted?.Invoke(agentEp);

            var sessionCts = CancellationTokenSource.CreateLinkedTokenSource(ct);

            // 2. Tile-Based JPEG Diff Capture Loop
            var captureTask = Task.Run(async () =>
            {
                await RunTileCaptureLoopAsync(stream, sessionCts.Token);
            }, sessionCts.Token);

            // 3. Length-Prefixed Input & File Receive Loop
            var inputTask = Task.Run(async () =>
            {
                while (!sessionCts.Token.IsCancellationRequested && client.Connected)
                {
                    try
                    {
                        using var cmdDoc = await ReadCommandAsync(stream, sessionCts.Token);
                        if (cmdDoc == null) break;
                        await ProcessIncomingCommandAsync(cmdDoc.RootElement, stream, sessionCts.Token);
                    }
                    catch (OperationCanceledException) { break; }
                    catch (Exception ex)
                    {
                        AppLogger.Warn($"[RemoteHost] Kesalahan pembacaan input: {ex.Message}");
                        break;
                    }
                }
            }, sessionCts.Token);

            await Task.WhenAny(captureTask, inputTask);
            sessionCts.Cancel();

            CleanupActiveFileTransfer();
            AppLogger.Info($"[RemoteHost] Sesi dengan {agentEp} selesai");
            OnSessionEnded?.Invoke(agentEp);
            try { client.Close(); } catch { }
        }

        private async Task RunTileCaptureLoopAsync(Stream stream, CancellationToken ct)
        {
            var bounds = Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1920, 1080);
            int width = bounds.Width;
            int height = bounds.Height;

            int cols = (width + TILE_SIZE - 1) / TILE_SIZE;
            int rows = (height + TILE_SIZE - 1) / TILE_SIZE;
            int totalTiles = cols * rows;

            ulong[] prevTileHashes = new ulong[totalTiles];
            bool forceKeyframe = true;
            int frameCounter = 0;
            int consecutiveErrors = 0;

            var jpegEncoder = GetEncoder(ImageFormat.Jpeg);
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 70L);

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    // Hard Gate: Do not capture or transmit ANY pixels while user countdown is active
                    if (!_isConsentGranted)
                    {
                        await Task.Delay(100, ct);
                        continue;
                    }

                    bounds = Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1920, 1080);
                    if (bounds.Width != width || bounds.Height != height)
                    {
                        width = bounds.Width;
                        height = bounds.Height;
                        cols = (width + TILE_SIZE - 1) / TILE_SIZE;
                        rows = (height + TILE_SIZE - 1) / TILE_SIZE;
                        totalTiles = cols * rows;
                        prevTileHashes = new ulong[totalTiles];
                        forceKeyframe = true;
                    }

                    frameCounter++;
                    if (frameCounter >= 250) // periodic keyframe every ~10 seconds
                    {
                        forceKeyframe = true;
                        frameCounter = 0;
                    }

                    using var bmp = new Bitmap(width, height, PixelFormat.Format24bppRgb);
                    using (var g = Graphics.FromImage(bmp))
                    {
                        g.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
                    }

                    var bmpData = bmp.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
                    var dirtyTiles = new List<(int col, int row, byte[] jpeg)>();

                    try
                    {
                        unsafe
                        {
                            byte* ptr = (byte*)bmpData.Scan0;
                            int stride = bmpData.Stride;

                            for (int r = 0; r < rows; r++)
                            {
                                int tileY = r * TILE_SIZE;
                                int tileH = Math.Min(TILE_SIZE, height - tileY);

                                for (int c = 0; c < cols; c++)
                                {
                                    int tileX = c * TILE_SIZE;
                                    int tileW = Math.Min(TILE_SIZE, width - tileX);
                                    int tileIdx = r * cols + c;

                                    ulong hash = ComputeTileHash(ptr, tileX, tileY, tileW, tileH, stride);
                                    if (forceKeyframe || hash != prevTileHashes[tileIdx])
                                    {
                                        prevTileHashes[tileIdx] = hash;

                                        // Crop tile via direct memory copy (prevents "Bitmap region is already locked" GDI+ crash)
                                        using var tileBmp = new Bitmap(tileW, tileH, PixelFormat.Format24bppRgb);
                                        var tileData = tileBmp.LockBits(new Rectangle(0, 0, tileW, tileH), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
                                        try
                                        {
                                            byte* dPtr = (byte*)tileData.Scan0;
                                            int bytesPerRow = tileW * 3;
                                            for (int y = 0; y < tileH; y++)
                                            {
                                                byte* srcRow = ptr + (tileY + y) * stride + (tileX * 3);
                                                byte* dstRow = dPtr + y * tileData.Stride;
                                                Buffer.MemoryCopy(srcRow, dstRow, bytesPerRow, bytesPerRow);
                                            }
                                        }
                                        finally
                                        {
                                            tileBmp.UnlockBits(tileData);
                                        }

                                        using var ms = new MemoryStream();
                                        tileBmp.Save(ms, jpegEncoder, encoderParams);
                                        dirtyTiles.Add((c, r, ms.ToArray()));
                                    }
                                }
                            }
                        }
                    }
                    finally
                    {
                        bmp.UnlockBits(bmpData);
                    }

                    forceKeyframe = false;

                    // Send Tile Batch if there are dirty tiles
                    if (dirtyTiles.Count > 0)
                    {
                        byte[] packet = BuildTilePacket(width, height, dirtyTiles);
                        if (stream != Stream.Null)
                        {
                            await _streamWriteLock.WaitAsync(ct);
                            try
                            {
                                await stream.WriteAsync(packet, 0, packet.Length, ct);
                                await stream.FlushAsync(ct);
                            }
                            finally
                            {
                                _streamWriteLock.Release();
                            }
                        }

                        // Broadcast to WS relay if active
                        OnRelayFrameReady?.Invoke(packet);
                    }

                    consecutiveErrors = 0;
                    await Task.Delay(40, ct); // ~25 FPS
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    consecutiveErrors++;
                    AppLogger.Warn($"[RemoteHost] Loop capture tile error ({consecutiveErrors}/5): {ex.Message}");
                    if (consecutiveErrors >= 5)
                    {
                        AppLogger.Error("[RemoteHost] Loop capture tile gagal 5 kali berturut-turut, menghentikan sesi.", ex);
                        break;
                    }
                    await Task.Delay(500, ct);
                }
            }
        }

        private static unsafe ulong ComputeTileHash(byte* scan0, int tx, int ty, int tw, int th, int stride)
        {
            // FNV-1a 64-bit hash over tile RGB pixels (sample every 2 pixels for max throughput)
            ulong hash = 14695981039346656037UL;
            for (int y = 0; y < th; y += 2)
            {
                byte* row = scan0 + (ty + y) * stride + (tx * 3);
                for (int x = 0; x < tw; x += 2)
                {
                    hash ^= row[x * 3];
                    hash *= 1099511628211UL;
                    hash ^= row[x * 3 + 1];
                    hash *= 1099511628211UL;
                    hash ^= row[x * 3 + 2];
                    hash *= 1099511628211UL;
                }
            }
            return hash;
        }

        private static byte[] BuildTilePacket(int width, int height, List<(int col, int row, byte[] jpeg)> tiles)
        {
            using var ms = new MemoryStream();
            using var bw = new BinaryWriter(ms);

            // Header: Magic(4B) | TotalW(2B) | TotalH(2B) | TileCount(2B)
            bw.Write(FRAME_MAGIC_TILES);
            bw.Write((short)width);
            bw.Write((short)height);
            bw.Write((short)tiles.Count);

            foreach (var t in tiles)
            {
                short px = (short)(t.col * TILE_SIZE);
                short py = (short)(t.row * TILE_SIZE);
                short pw = (short)Math.Min(TILE_SIZE, width - px);
                short ph = (short)Math.Min(TILE_SIZE, height - py);

                bw.Write(px);
                bw.Write(py);
                bw.Write(pw);
                bw.Write(ph);
                bw.Write(t.jpeg.Length);
                bw.Write(t.jpeg);
            }

            return ms.ToArray();
        }

        private async Task ProcessIncomingCommandAsync(JsonElement root, Stream stream, CancellationToken ct)
        {
            string type = root.TryGetProperty("t", out var t) ? t.GetString() ?? "" : "";

            if (type == "mm") // Mouse Move
            {
                int x = root.GetProperty("x").GetInt32();
                int y = root.GetProperty("y").GetInt32();
                Cursor.Position = new Point(x, y);
            }
            else if (type == "md") // Mouse Down
            {
                int btn = root.GetProperty("b").GetInt32();
                uint flag = btn == 1 ? MOUSEEVENTF_LEFTDOWN : btn == 2 ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_MIDDLEDOWN;
                mouse_event(flag, 0, 0, 0, UIntPtr.Zero);
            }
            else if (type == "mu") // Mouse Up
            {
                int btn = root.GetProperty("b").GetInt32();
                uint flag = btn == 1 ? MOUSEEVENTF_LEFTUP : btn == 2 ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_MIDDLEUP;
                mouse_event(flag, 0, 0, 0, UIntPtr.Zero);
            }
            else if (type == "mw") // Mouse Wheel
            {
                int delta = root.GetProperty("d").GetInt32();
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
            }
            else if (type == "kd") // Key Down
            {
                byte vk = (byte)root.GetProperty("k").GetInt32();
                keybd_event(vk, 0, 0, UIntPtr.Zero);
            }
            else if (type == "ku") // Key Up (fixes stuck key)
            {
                byte vk = (byte)root.GetProperty("k").GetInt32();
                keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            }
            else if (type == "file_offer") // Safe File Transfer Initiation
            {
                string rawName = root.GetProperty("name").GetString() ?? "file.bin";
                long size = root.GetProperty("size").GetInt64();
                string transferId = root.GetProperty("transferId").GetString() ?? Guid.NewGuid().ToString("N");

                // Security: Prevent path traversal
                string safeName = Path.GetFileName(rawName);
                if (string.IsNullOrWhiteSpace(safeName)) safeName = "file.bin";

                AppLogger.Info($"[RemoteHost] Penawaran transfer file diterima: {safeName} ({size:N0} bytes)");

                // Show approval dialog / callback
                bool accepted = false;
                if (OnFileTransferRequested != null)
                {
                    var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                    OnFileTransferRequested(safeName, size, (res) => tcs.TrySetResult(res));
                    accepted = await tcs.Task.WaitAsync(TimeSpan.FromMinutes(2), ct);
                }

                if (!accepted)
                {
                    await WriteHostCommandAsync(stream, new { t = "file_reject", transferId, reason = "Ditolak oleh pengguna" }, ct);
                    return;
                }

                string downloadsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                Directory.CreateDirectory(downloadsDir);
                string tempPath = Path.Combine(downloadsDir, $"{safeName}.sjatmp.{Guid.NewGuid():N}");

                CleanupActiveFileTransfer();
                _activeTransferId = transferId;
                _activeTransferFileName = safeName;
                _activeTransferTempPath = tempPath;
                _activeTransferStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 64 * 1024, true);

                await WriteHostCommandAsync(stream, new { t = "file_accept", transferId }, ct);
                AppLogger.Info($"[RemoteHost] Transfer file disetujui: {safeName} -> temp {tempPath}");
            }
            else if (type == "file_chunk") // Stream chunk directly to disk (supports GBs without memory overhead)
            {
                string transferId = root.GetProperty("transferId").GetString() ?? "";
                string b64 = root.GetProperty("data").GetString() ?? "";
                bool isLast = root.GetProperty("last").GetBoolean();

                if (_activeTransferStream != null && _activeTransferId == transferId)
                {
                    byte[] chunk = string.IsNullOrEmpty(b64) ? Array.Empty<byte>() : Convert.FromBase64String(b64);
                    await _activeTransferStream.WriteAsync(chunk, 0, chunk.Length, ct);

                    if (isLast)
                    {
                        await _activeTransferStream.FlushAsync(ct);
                        _activeTransferStream.Close();
                        _activeTransferStream.Dispose();
                        _activeTransferStream = null;

                        string downloadsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                        string destPath = Path.Combine(downloadsDir, _activeTransferFileName!);

                        // Avoid overwriting if target exists
                        if (File.Exists(destPath))
                        {
                            string ext = Path.GetExtension(_activeTransferFileName!);
                            string nameWithout = Path.GetFileNameWithoutExtension(_activeTransferFileName!);
                            destPath = Path.Combine(downloadsDir, $"{nameWithout} ({DateTime.Now:yyyyMMdd_HHmmss}){ext}");
                        }

                        File.Move(_activeTransferTempPath!, destPath);
                        AppLogger.Info($"[RemoteHost] Transfer file selesai dan tersimpan di: {destPath}");

                        var notif = new NotificationData
                        {
                            Title = "SJA File Transfer",
                            Message = $"File '{Path.GetFileName(destPath)}' berhasil diterima di folder Downloads.",
                            Display = "toast",
                            Priority = "normal",
                            App = "SJA Remote",
                            AppCode = "sja"
                        };
                        ToastNotifier.ShowNotification(notif, true);

                        await WriteHostCommandAsync(stream, new { t = "file_complete", transferId }, ct);
                        _activeTransferId = null;
                        _activeTransferTempPath = null;
                    }
                }
            }
            else if (type == "file_cancel")
            {
                CleanupActiveFileTransfer();
            }
        }

        public void EnableRelayCapture()
        {
            if (_cts == null || _cts.IsCancellationRequested || _relayCaptureActive) return;
            _relayCaptureActive = true;
            _ = Task.Run(async () =>
            {
                try
                {
                    await RunTileCaptureLoopAsync(Stream.Null, _cts.Token);
                }
                finally
                {
                    _relayCaptureActive = false;
                }
            }, _cts.Token);
        }

        public async Task ProcessRelayInputAsync(string json, CancellationToken ct = default)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                await ProcessIncomingCommandAsync(doc.RootElement, Stream.Null, ct);
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[RemoteHost] Relay input process error: {ex.Message}");
            }
        }

        private void CleanupActiveFileTransfer()
        {
            try
            {
                if (_activeTransferStream != null)
                {
                    _activeTransferStream.Close();
                    _activeTransferStream.Dispose();
                    _activeTransferStream = null;
                }
                if (!string.IsNullOrEmpty(_activeTransferTempPath) && File.Exists(_activeTransferTempPath))
                {
                    File.Delete(_activeTransferTempPath);
                }
            }
            catch { }
            _activeTransferId = null;
            _activeTransferTempPath = null;
        }

        #region Framing Helpers
        private async Task WriteHostCommandAsync(Stream stream, object command, CancellationToken ct)
        {
            await _streamWriteLock.WaitAsync(ct);
            try
            {
                await WriteCommandAsync(stream, command, ct);
            }
            finally
            {
                _streamWriteLock.Release();
            }
        }

        public static async Task WriteCommandAsync(Stream s, object cmd, CancellationToken ct)
        {
            if (s == Stream.Null) return;
            string json = JsonSerializer.Serialize(cmd);
            byte[] payload = Encoding.UTF8.GetBytes(json);

            byte[] header = new byte[8];
            BitConverter.GetBytes(CMD_MAGIC).CopyTo(header, 0);
            BitConverter.GetBytes(payload.Length).CopyTo(header, 4);

            await s.WriteAsync(header, 0, header.Length, ct);
            await s.WriteAsync(payload, 0, payload.Length, ct);
            await s.FlushAsync(ct);
        }

        public static async Task<JsonDocument?> ReadCommandAsync(Stream s, CancellationToken ct)
        {
            byte[] header = new byte[8];
            int hRead = 0;
            while (hRead < 8)
            {
                int r = await s.ReadAsync(header, hRead, 8 - hRead, ct);
                if (r == 0) return null;
                hRead += r;
            }

            uint magic = BitConverter.ToUInt32(header, 0);
            if (magic != CMD_MAGIC)
            {
                AppLogger.Warn($"[RemoteHost] Invalid command magic: 0x{magic:X8}");
                return null;
            }

            int len = BitConverter.ToInt32(header, 4);
            // This caps one protocol message only, not the transferred file size.
            const int MaxCommandBytes = 2 * 1024 * 1024;
            if (len <= 0 || len > MaxCommandBytes)
            {
                AppLogger.Warn($"[RemoteHost] Invalid command length: {len}");
                return null;
            }

            byte[] payload = new byte[len];
            int pRead = 0;
            while (pRead < len)
            {
                int r = await s.ReadAsync(payload, pRead, len - pRead, ct);
                if (r == 0) return null;
                pRead += r;
            }

            return JsonDocument.Parse(payload);
        }
        #endregion

        private static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            ImageCodecInfo[] codecs = ImageCodecInfo.GetImageEncoders();
            foreach (ImageCodecInfo codec in codecs)
            {
                if (codec.FormatID == format.Guid) return codec;
            }
            return codecs[0];
        }

        #region Win32 P/Invoke
        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        #endregion

        public void Stop()
        {
            _cts?.Cancel();
            try { _client?.Close(); } catch { }
            try { _listener?.Stop(); } catch { }
            CleanupActiveFileTransfer();
            _isRunning = false;
        }

        public void Dispose()
        {
            Stop();
        }
    }
}
