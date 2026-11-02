using System;
using System.IO;

namespace SJANotificationApp
{
    public static class AppLogger
    {
        private static readonly object _lock = new();
        private static readonly string LogFilePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SJANotifier",
            "app.log"
        );

        public static void Log(string message) => Info(message);

        public static void Info(string message) => WriteEntry("INFO", message);

        public static void Warn(string message) => WriteEntry("WARN", message);

        public static void Error(string message, Exception? ex = null)
        {
            string full = ex != null ? $"{message} | Exception: {ex.Message} \n{ex.StackTrace}" : message;
            WriteEntry("ERROR", full);
        }

        private static void WriteEntry(string level, string message)
        {
            try
            {
                lock (_lock)
                {
                    string dir = Path.GetDirectoryName(LogFilePath)!;
                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                    File.AppendAllText(LogFilePath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [{level}] {message}{Environment.NewLine}");
                }
            }
            catch
            {
                // Never crash because of logging
            }
        }
    }
}
