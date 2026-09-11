using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SJANotificationApp
{
    public class DeviceActivationManager
    {
        private readonly HttpClient _httpClient = new HttpClient();
        private readonly string _apiBaseUrl;

        public DeviceActivationManager(string apiBaseUrl)
        {
            _apiBaseUrl = apiBaseUrl.TrimEnd('/');
        }

        public async Task<string?> LoginDirectAsync(string nik, string password, CancellationToken ct)
        {
            try
            {
                var payload = new
                {
                    nik = nik.Trim(),
                    password = password,
                    deviceName = Environment.MachineName,
                    windowsUsername = Environment.UserName,
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{_apiBaseUrl}/v1/devices/auth/login", content, ct);

                if (!response.IsSuccessStatusCode)
                {
                    AppLogger.Warn($"Gagal login perangkat via NIK: HTTP {response.StatusCode}");
                    return null;
                }

                var resJson = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(resJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
                {
                    string token = root.GetProperty("deviceToken").GetString()!;

                    var session = new UserProfileSession
                    {
                        Token = token,
                        DeviceId = root.TryGetProperty("deviceId", out var devIdProp) ? devIdProp.GetString() ?? "" : "",
                    };

                    if (root.TryGetProperty("employee", out var empProp))
                    {
                        session.EmployeeId = empProp.TryGetProperty("nik", out var nikProp) ? nikProp.GetString() ?? "" : "";
                        session.FullName = empProp.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
                        session.Email = empProp.TryGetProperty("email", out var emailProp) ? emailProp.GetString() ?? "" : "";
                        session.SiteCode = empProp.TryGetProperty("siteCode", out var siteProp) ? siteProp.GetString() ?? "SPJ" : "SPJ";
                        session.Role = empProp.TryGetProperty("role", out var roleProp) ? roleProp.GetString() ?? "" : "";
                    }

                    DeviceSecurityStorage.SaveSession(session);
                    AppLogger.Info($"Perangkat berhasil login via NIK [{nik}] ({session.FullName}) dan profil tersimpan di DPAPI");
                    return token;
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal login perangkat via NIK", ex);
            }

            return null;
        }

        public class PairingSessionInfo
        {
            public string SessionId { get; set; } = "";
            public string Code { get; set; } = "";
            public string ActivationUrl { get; set; } = "";
        }

        public async Task<PairingSessionInfo?> RequestPairingSessionAsync(CancellationToken ct)
        {
            try
            {
                var payload = new
                {
                    deviceName = Environment.MachineName,
                    windowsUsername = Environment.UserName,
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{_apiBaseUrl}/v1/devices/activation/request", content, ct);

                if (!response.IsSuccessStatusCode)
                {
                    AppLogger.Warn($"Gagal request aktivasi perangkat: HTTP {response.StatusCode}");
                    return null;
                }

                var resJson = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(resJson);
                var root = doc.RootElement;
                return new PairingSessionInfo
                {
                    SessionId = root.GetProperty("sessionId").GetString()!,
                    Code = root.GetProperty("code").GetString()!,
                    ActivationUrl = root.GetProperty("activationUrl").GetString()!
                };
            }
            catch (Exception ex)
            {
                AppLogger.Error("Error request pairing session", ex);
                return null;
            }
        }

        public async Task<string?> PollPairingSessionAsync(string sessionId, CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    await Task.Delay(2500, ct);
                    var pollRes = await _httpClient.GetAsync($"{_apiBaseUrl}/v1/devices/activation/poll?sessionId={sessionId}", ct);
                    if (pollRes.IsSuccessStatusCode)
                    {
                        var pollJson = await pollRes.Content.ReadAsStringAsync(ct);
                        using var pollDoc = JsonDocument.Parse(pollJson);
                        string status = pollDoc.RootElement.GetProperty("status").GetString()!;

                        if (status == "APPROVED")
                        {
                            string token = pollDoc.RootElement.GetProperty("deviceToken").GetString()!;
                            var session = new UserProfileSession
                            {
                                Token = token,
                                DeviceId = pollDoc.RootElement.TryGetProperty("deviceId", out var devIdProp) ? devIdProp.GetString() ?? "" : ""
                            };

                            if (pollDoc.RootElement.TryGetProperty("employee", out var empProp))
                            {
                                session.EmployeeId = empProp.TryGetProperty("nik", out var nikProp) ? nikProp.GetString() ?? "" : "";
                                session.FullName = empProp.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
                                session.SiteCode = empProp.TryGetProperty("siteCode", out var siteProp) ? siteProp.GetString() ?? "SPJ" : "SPJ";
                            }

                            DeviceSecurityStorage.SaveSession(session);
                            AppLogger.Info($"Perangkat berhasil diaktivasi via Web untuk '{session.FullName}' ({session.EmployeeId}) dan token tersimpan di DPAPI");
                            return token;
                        }
                        else if (status == "EXPIRED")
                        {
                            AppLogger.Warn("Sesi aktivasi kedaluwarsa.");
                            return null;
                        }
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal polling aktivasi perangkat", ex);
            }
            return null;
        }

        public async Task<string?> RequestPairingAndOpenBrowserAsync(CancellationToken ct)
        {
            try
            {
                var sessionInfo = await RequestPairingSessionAsync(ct);
                if (sessionInfo == null) return null;

                AppLogger.Info($"Aktivasi dimulai: Kode {sessionInfo.Code}, Session {sessionInfo.SessionId}");

                // Buka browser pengguna otomatis
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = sessionInfo.ActivationUrl,
                        UseShellExecute = true,
                    });
                }
                catch (Exception ex)
                {
                    AppLogger.Warn($"Tidak dapat membuka browser otomatis: {ex.Message}");
                }

                return await PollPairingSessionAsync(sessionInfo.SessionId, ct);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal menjalankan alur pairing perangkat", ex);
                return null;
            }
        }

        /// <summary>
        /// Enterprise Direct Login via Keycloak OAuth 2.0 / OpenID Connect Token Endpoint
        /// </summary>
        public async Task<string?> LoginKeycloakOidcAsync(string keycloakUrl, string username, string password, CancellationToken ct)
        {
            try
            {
                string tokenEndpoint = $"{keycloakUrl.TrimEnd('/')}/realms/santos-corp/protocol/openid-connect/token";
                AppLogger.Info($"[Keycloak OIDC] Memulai autentikasi token untuk [{username}] via {tokenEndpoint}");

                var form = new System.Collections.Generic.Dictionary<string, string>
                {
                    { "client_id", "sja-notification-app" },
                    { "grant_type", "password" },
                    { "username", username.Trim() },
                    { "password", password },
                    { "scope", "openid profile email" }
                };

                using var reqContent = new FormUrlEncodedContent(form);
                var resp = await _httpClient.PostAsync(tokenEndpoint, reqContent, ct);

                if (!resp.IsSuccessStatusCode)
                {
                    AppLogger.Warn($"[Keycloak OIDC] Autentikasi gagal: HTTP {resp.StatusCode}");
                    return null;
                }

                var resJson = await resp.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(resJson);
                var root = doc.RootElement;

                string accessToken = root.GetProperty("access_token").GetString()!;
                string idToken = root.TryGetProperty("id_token", out var idProp) ? idProp.GetString() ?? "" : "";

                // Exchange Keycloak tokens with SJA Backend to register device
                string exchangeUrl = $"{_apiBaseUrl}/v1/devices/auth/keycloak-token";
                var exchangePayload = new
                {
                    accessToken,
                    idToken,
                    deviceName = Environment.MachineName,
                    windowsUsername = Environment.UserName
                };

                var exContent = new StringContent(JsonSerializer.Serialize(exchangePayload), Encoding.UTF8, "application/json");
                var exResp = await _httpClient.PostAsync(exchangeUrl, exContent, ct);

                if (!exResp.IsSuccessStatusCode)
                {
                    AppLogger.Warn($"[Keycloak OIDC] Token exchange gagal di SJA Backend: HTTP {exResp.StatusCode}");
                    return null;
                }

                var exJson = await exResp.Content.ReadAsStringAsync(ct);
                using var exDoc = JsonDocument.Parse(exJson);
                var exRoot = exDoc.RootElement;

                if (exRoot.TryGetProperty("success", out var sProp) && sProp.GetBoolean())
                {
                    string deviceToken = exRoot.GetProperty("deviceToken").GetString()!;
                    var session = new UserProfileSession
                    {
                        Token = deviceToken,
                        DeviceId = exRoot.TryGetProperty("deviceId", out var devIdProp) ? devIdProp.GetString() ?? "" : ""
                    };

                    if (exRoot.TryGetProperty("employee", out var empProp))
                    {
                        session.EmployeeId = empProp.TryGetProperty("nik", out var nikProp) ? nikProp.GetString() ?? "" : username;
                        session.FullName = empProp.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "Karyawan Santos";
                        session.Email = empProp.TryGetProperty("email", out var emailProp) ? emailProp.GetString() ?? "" : "";
                        session.SiteCode = empProp.TryGetProperty("siteCode", out var siteProp) ? siteProp.GetString() ?? "SPJ" : "SPJ";
                        session.Role = empProp.TryGetProperty("role", out var roleProp) ? roleProp.GetString() ?? "" : "USER";
                    }

                    DeviceSecurityStorage.SaveSession(session);
                    AppLogger.Info($"[Keycloak OIDC] Berhasil mendaftarkan perangkat via Keycloak Token: {session.FullName} ({session.EmployeeId})");
                    return deviceToken;
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error("[Keycloak OIDC] Exception saat login:", ex);
            }

            return null;
        }
    }
}
