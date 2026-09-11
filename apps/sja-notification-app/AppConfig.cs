using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace SJANotificationApp
{
    public class AppConfig
    {
        // Default target is Santos Central Server (10.10.6.13 / idesk.santos.co.id)
        public string SjaServerUrl { get; set; } = "http://10.10.6.13:18302";
        public string SjaWsUrl { get; set; } = "ws://10.10.6.13:18305";
        public string IdeskServerUrl { get; set; } = "http://idesk.santos.co.id";
        public string KeycloakServerUrl { get; set; } = "http://10.10.6.13:18080";
        public bool PlaySound { get; set; } = true;
        public bool StartWithWindows { get; set; } = true;
        public string DefaultDisplayMode { get; set; } = "both"; // "toast" | "popup" | "both"
        public int AutoDismissSeconds { get; set; } = 12; // 0 = manual close only, >0 = seconds

        private static readonly string ConfigDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SJANotifier"
        );
        private static readonly string ConfigFilePath = Path.Combine(ConfigDirectory, "config.json");

        public static AppConfig Load()
        {
            AppConfig config;
            try
            {
                if (File.Exists(ConfigFilePath))
                {
                    string json = File.ReadAllText(ConfigFilePath);
                    config = JsonSerializer.Deserialize<AppConfig>(json) ?? new AppConfig();
                }
                else
                {
                    config = new AppConfig();
                }
            }
            catch
            {
                config = new AppConfig();
            }

            // 1. Auto-migrate legacy localhost or legacy port references
            // If the user's config still points to localhost, migrate to central Santos IP/domain
            if (!string.IsNullOrEmpty(config.SjaServerUrl) && (config.SjaServerUrl.Contains("localhost") || config.SjaServerUrl.Contains("127.0.0.1")))
            {
                config.SjaServerUrl = "http://10.10.6.13:18302";
            }
            if (!string.IsNullOrEmpty(config.SjaWsUrl) && (config.SjaWsUrl.Contains("localhost") || config.SjaWsUrl.Contains("127.0.0.1")))
            {
                config.SjaWsUrl = "ws://10.10.6.13:18305";
            }

            // 2. Allow dynamic host override via environment variables
            string? envHost = Environment.GetEnvironmentVariable("SJA_SERVER_HOST");
            if (!string.IsNullOrWhiteSpace(envHost))
            {
                config.SetServerHost(envHost);
            }

            string? envSjaUrl = Environment.GetEnvironmentVariable("SJA_SERVER_URL");
            if (!string.IsNullOrWhiteSpace(envSjaUrl))
            {
                config.SjaServerUrl = envSjaUrl.TrimEnd('/');
            }

            string? envSjaWs = Environment.GetEnvironmentVariable("SJA_WS_URL");
            if (!string.IsNullOrWhiteSpace(envSjaWs))
            {
                config.SjaWsUrl = envSjaWs.TrimEnd('/');
            }

            string? envIdeskUrl = Environment.GetEnvironmentVariable("IDESK_SERVER_URL");
            if (!string.IsNullOrWhiteSpace(envIdeskUrl))
            {
                config.IdeskServerUrl = envIdeskUrl.TrimEnd('/');
            }

            // Save migrated settings
            config.Save();
            return config;
        }

        public void SetServerHost(string host)
        {
            if (string.IsNullOrWhiteSpace(host)) return;
            host = host.Trim().TrimEnd('/');
            if (host.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || host.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || host.StartsWith("ws://", StringComparison.OrdinalIgnoreCase) || host.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var uri = new Uri(host);
                    host = uri.Host;
                }
                catch { }
            }

            SjaServerUrl = $"http://{host}:18302";
            SjaWsUrl = $"ws://{host}:18305";
            KeycloakServerUrl = $"http://{host}:18080";
        }

        /// <summary>
        /// Auto-discover the best active SJA server in priority:
        /// 1. idesk.santos.co.id (Domain)
        /// 2. 10.10.6.13 (Current Master Server LAN IP)
        /// 3. localhost (Local Developer instance)
        /// </summary>
        public async Task<string> ProbeAndSetBestServerAsync()
        {
            string[] candidates = new[]
            {
                "idesk.santos.co.id",
                "10.10.6.13",
                "localhost"
            };

            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(1500) };

            foreach (var candidate in candidates)
            {
                try
                {
                    string testUrl = $"http://{candidate}:18302/health";
                    var resp = await client.GetAsync(testUrl);
                    if (resp.IsSuccessStatusCode)
                    {
                        SetServerHost(candidate);
                        Save();
                        AppLogger.Info($"[AutoDiscovery] Berhasil menemukan active SJA server: {candidate}");
                        return candidate;
                    }
                }
                catch
                {
                    // Candidate unreachable, try next
                }
            }

            return "10.10.6.13";
        }

        public void Save()
        {
            try
            {
                if (!Directory.Exists(ConfigDirectory))
                {
                    Directory.CreateDirectory(ConfigDirectory);
                }

                var options = new JsonSerializerOptions { WriteIndented = true };
                string json = JsonSerializer.Serialize(this, options);
                File.WriteAllText(ConfigFilePath, json);
            }
            catch
            {
                // Ignore save errors
            }
        }
    }
}
