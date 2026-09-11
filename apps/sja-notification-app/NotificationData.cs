using System;
using System.Collections.Generic;

namespace SJANotificationApp
{
    public class NotificationAttachment
    {
        public string Name { get; set; } = "";
        public string? Size { get; set; }
        public string? Url { get; set; }
    }

    public class NotificationData
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string App { get; set; } = "iDesk";
        public string AppCode { get; set; } = "idesk";
        public string Title { get; set; } = "Notifikasi Baru";
        public string Message { get; set; } = "";
        public string Body
        {
            get => Message;
            set => Message = value;
        }
        public string? Url { get; set; }
        public string? ActionUrl
        {
            get => Url;
            set => Url = value;
        }
        public string Priority { get; set; } = "normal"; // normal, high, urgent
        public string? Avatar { get; set; }
        public string Display { get; set; } = "both"; // toast, popup, both
        public string AccentColor { get; set; } = "#3B82F6";
        public DateTime Timestamp { get; set; } = DateTime.Now;

        // Rich Metadata for Popup Display Window
        public string? From { get; set; }
        public string? To { get; set; }
        public string? Subject { get; set; }
        public string? Category { get; set; }
        public string? TicketNumber { get; set; }

        public List<NotificationAttachment> Attachments { get; set; } = new();
        public string? CallbackUrl { get; set; }
        public string? TicketId { get; set; }

        public bool IsConversationNotification()
        {
            if (string.Equals(Category, "TICKET_REPLY", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(Category, "CHAT_MESSAGE_RECEIVED", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(Category, "CHAT_CONVERSATION", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(Category, "CONVERSATION", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!string.IsNullOrEmpty(Category) &&
                (Category.IndexOf("chat", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 Category.IndexOf("reply", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 Category.IndexOf("percakapan", StringComparison.OrdinalIgnoreCase) >= 0))
            {
                return true;
            }

            return false;
        }
    }
}
