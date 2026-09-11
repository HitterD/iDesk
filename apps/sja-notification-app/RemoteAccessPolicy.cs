using System;

namespace SJANotificationApp
{
    /// <summary>
    /// Kebijakan akses fitur Remote Desktop di sisi aplikasi desktop.
    /// Fail-closed: role kosong / tidak dikenal TIDAK boleh me-remote.
    /// Operator = ADMIN atau role apapun yang diawali "AGENT"
    /// (AGENT, AGENT_ADMIN, AGENT_ORACLE, AGENT_WEB_DEV, AGENT_MOBILE_DEV,
    /// AGENT_OPERATIONAL_SUPPORT), selaras dengan enum UserRole backend.
    /// </summary>
    public static class RemoteAccessPolicy
    {
        public static bool IsRemoteOperator(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return false;
            string normalized = role.Trim().ToUpperInvariant();
            return normalized == "ADMIN" || normalized.StartsWith("AGENT", StringComparison.Ordinal);
        }
    }
}
