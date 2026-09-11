using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SJANotificationApp
{
    public class UserProfileSession
    {
        public string Token { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
        public string EmployeeId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string SiteCode { get; set; } = "SPJ";
        public string Role { get; set; } = string.Empty;
    }

    public static class DeviceSecurityStorage
    {
        private static readonly string StoragePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SJANotifier",
            "device.dat"
        );

        public static void SaveSession(UserProfileSession session)
        {
            try
            {
                var dir = Path.GetDirectoryName(StoragePath);
                if (!string.IsNullOrEmpty(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                string json = JsonSerializer.Serialize(session);
                byte[] plainBytes = Encoding.UTF8.GetBytes(json);
                byte[] cipherBytes = ProtectedData.Protect(plainBytes, null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(StoragePath, cipherBytes);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal menyimpan device session ke DPAPI", ex);
            }
        }

        public static void SaveToken(string token)
        {
            var session = LoadSession() ?? new UserProfileSession();
            session.Token = token;
            SaveSession(session);
        }

        public static UserProfileSession? LoadSession()
        {
            if (!File.Exists(StoragePath)) return null;
            try
            {
                byte[] cipherBytes = File.ReadAllBytes(StoragePath);
                byte[] plainBytes = ProtectedData.Unprotect(cipherBytes, null, DataProtectionScope.CurrentUser);
                string raw = Encoding.UTF8.GetString(plainBytes);

                // Backward compatibility if older file only contained bare token string
                if (!raw.TrimStart().StartsWith("{"))
                {
                    return new UserProfileSession { Token = raw.Trim() };
                }

                return JsonSerializer.Deserialize<UserProfileSession>(raw);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal membaca device session dari DPAPI", ex);
                return null;
            }
        }

        public static string? LoadToken()
        {
            var session = LoadSession();
            return session?.Token;
        }

        public static void Clear()
        {
            try
            {
                if (File.Exists(StoragePath)) File.Delete(StoragePath);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal menghapus device session", ex);
            }
        }
    }
}
