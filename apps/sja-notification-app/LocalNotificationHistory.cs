using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace SJANotificationApp
{
    public static class LocalNotificationHistory
    {
        private static readonly object _lock = new();
        private static readonly string HistoryFilePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SJANotifier",
            "history.json"
        );

        private const int MaxHistory = 50;

        public static void Add(NotificationData item)
        {
            try
            {
                lock (_lock)
                {
                    var list = LoadAll();
                    list.Insert(0, item);
                    if (list.Count > MaxHistory)
                    {
                        list.RemoveRange(MaxHistory, list.Count - MaxHistory);
                    }
                    Save(list);
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"Failed to save notification history: {ex.Message}");
            }
        }

        public static List<NotificationData> LoadAll()
        {
            try
            {
                lock (_lock)
                {
                    if (File.Exists(HistoryFilePath))
                    {
                        string json = File.ReadAllText(HistoryFilePath);
                        var items = JsonSerializer.Deserialize<List<NotificationData>>(json, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        return items ?? new List<NotificationData>();
                    }
                }
            }
            catch { }
            return new List<NotificationData>();
        }

        private static void Save(List<NotificationData> list)
        {
            string dir = Path.GetDirectoryName(HistoryFilePath)!;
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(HistoryFilePath, json);
        }

        public static void Clear()
        {
            try
            {
                lock (_lock)
                {
                    if (File.Exists(HistoryFilePath))
                    {
                        File.Delete(HistoryFilePath);
                    }
                }
            }
            catch { }
        }
    }
}
