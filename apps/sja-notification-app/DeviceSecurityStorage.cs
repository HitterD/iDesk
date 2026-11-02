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
        public static void SaveSession(UserProfileSession session)
        {
            try
            {
                ProfileStore.Instance.SetActiveSession(session);
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal menyimpan device session", ex);
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
            try
            {
                return ProfileStore.Instance.GetActiveSession();
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal membaca device session", ex);
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
                ProfileStore.Instance.ClearActiveSession();
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal menghapus device session aktif", ex);
            }
        }
    }
}
