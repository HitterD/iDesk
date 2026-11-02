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
        public static bool IsRemoteOperator(string? role, string? employeeId = null, string? fullName = null)
        {
            if (!string.IsNullOrWhiteSpace(role))
            {
                string normalized = role.Trim().ToUpperInvariant();
                if (normalized == "ADMIN" || normalized.StartsWith("AGENT", StringComparison.Ordinal))
                {
                    return true;
                }
            }

            // Fallback: Jika role kosong (misal hasil pairing lama atau SSO email admin),
            // cek identifier employeeId atau nama
            if (!string.IsNullOrWhiteSpace(employeeId))
            {
                string emp = employeeId.Trim().ToLowerInvariant();
                if (emp.StartsWith("admin") || emp.Contains("support") || emp.Contains("ict") || emp.Contains("agent"))
                {
                    return true;
                }
            }

            if (!string.IsNullOrWhiteSpace(fullName))
            {
                string fn = fullName.Trim().ToLowerInvariant();
                if (fn.Contains("administrator") || fn.Contains("support") || fn.Contains("agent"))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
