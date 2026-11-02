using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// High-performance Apple macOS Sequoia style Notification History Stream Panel.
    /// Uses a single-canvas virtualized GDI+ stream engine with DoubleBuffered = true.
    /// Completely eliminates WinForms recursive transparency overhead, tearing, and glitches.
    /// </summary>
    public class HistoryControlPanel : Panel
    {
        private readonly AppConfig _config;
        private Label _lblTitle = null!;
        private Label _lblCount = null!;
        private GlassButton _btnRefresh = null!;
        private GlassButton _btnClear = null!;
        private FluentScrollBar _scrollBar = null!;
        private NotificationStreamCanvas _canvas = null!;

        public HistoryControlPanel(AppConfig config)
        {
            _config = config;
            InitializeComponent();
            FluentTheme.ThemeChanged += OnThemeChanged;
            LoadNotifications();
        }

        private void InitializeComponent()
        {
            Dock = DockStyle.Fill;
            BackColor = Color.Transparent;
            Font = FluentTheme.Body;
            ForeColor = FluentTheme.ThemeTextPrimary;

            // 1. Sub-Header Stats & Actions Bar
            var pnlTopBar = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.Transparent,
                Padding = new Padding(12, 6, 12, 6)
            };

            _lblTitle = new Label
            {
                Text = "Notification History",
                Font = FluentTheme.GetFont(12F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(12, 4),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlTopBar.Controls.Add(_lblTitle);

            _lblCount = new Label
            {
                Text = "Loading history...",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(13, 27),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlTopBar.Controls.Add(_lblCount);

            _btnClear = new GlassButton
            {
                Text = "Clear all",
                Glyph = "trash",
                Size = new Size(110, 32),
                Location = new Point(pnlTopBar.ClientSize.Width - 228, 10),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 8,
                Font = FluentTheme.CaptionBold
            };
            _btnClear.Click += (s, e) =>
            {
                if (AppDialogs.Confirm(
                    this,
                    "Clear notification history?",
                    "All saved notifications will be removed from this device. This cannot be undone.",
                    "Clear all",
                    isDestructive: true))
                {
                    LocalNotificationHistory.Clear();
                    LoadNotifications();
                }
            };
            pnlTopBar.Controls.Add(_btnClear);

            _btnRefresh = new GlassButton
            {
                Text = "Refresh",
                Glyph = "refresh",
                Size = new Size(100, 32),
                Location = new Point(pnlTopBar.ClientSize.Width - 108, 10),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 8,
                Font = FluentTheme.CaptionBold
            };
            _btnRefresh.Click += (s, e) => LoadNotifications();
            pnlTopBar.Controls.Add(_btnRefresh);

            pnlTopBar.Resize += (s, e) =>
            {
                int w = pnlTopBar.ClientSize.Width;
                _btnRefresh.Location = new Point(w - _btnRefresh.Width - 10, 10);
                _btnClear.Location = new Point(_btnRefresh.Left - _btnClear.Width - 8, 10);
            };

            Controls.Add(pnlTopBar);

            // 2. Body Container hosting Canvas & ScrollBar
            var pnlBody = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                Padding = new Padding(8, 0, 8, 8)
            };

            _scrollBar = new FluentScrollBar
            {
                Dock = DockStyle.Right,
                Width = 10,
                Minimum = 0,
                Maximum = 100,
                LargeChange = 90
            };

            _canvas = new NotificationStreamCanvas
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent
            };

            _canvas.NotificationClicked += OnNotificationItemClicked;
            _canvas.ScrollRequested += (delta) => _scrollBar.DoMouseWheel(delta, 45);

            _scrollBar.ValueChanged += (s, e) =>
            {
                _canvas.SetScrollOffset(_scrollBar.Value);
            };

            _canvas.ContentHeightChanged += (totalH) =>
            {
                int maxScroll = Math.Max(0, totalH - _canvas.ClientSize.Height + 20);
                _scrollBar.Maximum = maxScroll;
                _scrollBar.Visible = maxScroll > 0;
            };

            pnlBody.Controls.Add(_canvas);
            pnlBody.Controls.Add(_scrollBar);
            Controls.Add(pnlBody);
            pnlBody.BringToFront();
        }

        private void OnThemeChanged()
        {
            if (IsDisposed || Disposing) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(OnThemeChanged));
                return;
            }

            ForeColor = FluentTheme.ThemeTextPrimary;
            if (_lblTitle != null) _lblTitle.ForeColor = FluentTheme.ThemeTextPrimary;
            if (_lblCount != null) _lblCount.ForeColor = FluentTheme.ThemeTextSecondary;
            _canvas?.Invalidate();
        }

        public void LoadNotifications()
        {
            var items = LocalNotificationHistory.LoadAll();
            _lblCount.Text = $"{items.Count} stored on this PC";
            _canvas.SetItems(items);
            _btnClear.Enabled = items.Count > 0;
        }

        private void OnNotificationItemClicked(NotificationData notif)
        {
            string targetUrl = !string.IsNullOrWhiteSpace(notif.Url)
                ? notif.Url
                : (!string.IsNullOrWhiteSpace(notif.ActionUrl) ? notif.ActionUrl : _config.IdeskServerUrl);

            if (!string.IsNullOrWhiteSpace(targetUrl))
            {
                try
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = targetUrl,
                        UseShellExecute = true
                    });
                }
                catch { }
            }
            else
            {
                TrayApplicationContext.ShowPopupWindow(notif);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                FluentTheme.ThemeChanged -= OnThemeChanged;
            }
            base.Dispose(disposing);
        }

        /// <summary>
        /// Single-Canvas Double-Buffered Stream Renderer.
        /// Paints visible cards directly via GDI+ with zero child window handles.
        /// </summary>
        private class NotificationStreamCanvas : Control
        {
            private readonly List<NotificationData> _items = new();
            private int _scrollOffset = 0;
            private int _hoveredIndex = -1;
            private const int RowHeight = 72;
            private const int RowGap = 8;
            private const int RowStep = RowHeight + RowGap;

            public event Action<NotificationData>? NotificationClicked;
            public event Action<int>? ScrollRequested;
            public event Action<int>? ContentHeightChanged;

            public NotificationStreamCanvas()
            {
                SetStyle(
                    ControlStyles.AllPaintingInWmPaint |
                    ControlStyles.OptimizedDoubleBuffer |
                    ControlStyles.UserPaint |
                    ControlStyles.ResizeRedraw |
                    ControlStyles.SupportsTransparentBackColor, true);
                DoubleBuffered = true;
                BackColor = Color.Transparent;
            }

            public void SetItems(List<NotificationData> items)
            {
                _items.Clear();
                _items.AddRange(items);
                _hoveredIndex = -1;
                RecalculateContent();
                Invalidate();
            }

            public void SetScrollOffset(int offset)
            {
                if (_scrollOffset != offset)
                {
                    _scrollOffset = offset;
                    Invalidate();
                }
            }

            private void RecalculateContent()
            {
                int totalHeight = _items.Count > 0 ? (_items.Count * RowStep + 16) : 240;
                ContentHeightChanged?.Invoke(totalHeight);
            }

            protected override void OnResize(EventArgs e)
            {
                base.OnResize(e);
                RecalculateContent();
                Invalidate();
            }

            protected override void OnMouseWheel(MouseEventArgs e)
            {
                base.OnMouseWheel(e);
                ScrollRequested?.Invoke(e.Delta);
            }

            protected override void OnMouseMove(MouseEventArgs e)
            {
                base.OnMouseMove(e);
                int oldHover = _hoveredIndex;

                if (_items.Count == 0)
                {
                    _hoveredIndex = -1;
                }
                else
                {
                    int adjustedY = e.Y + _scrollOffset - 6;
                    if (adjustedY >= 0)
                    {
                        int index = adjustedY / RowStep;
                        int rem = adjustedY % RowStep;
                        if (index >= 0 && index < _items.Count && rem <= RowHeight && e.X >= 8 && e.X <= ClientSize.Width - 14)
                        {
                            _hoveredIndex = index;
                        }
                        else
                        {
                            _hoveredIndex = -1;
                        }
                    }
                    else
                    {
                        _hoveredIndex = -1;
                    }
                }

                if (_hoveredIndex != oldHover)
                {
                    Cursor = _hoveredIndex >= 0 ? Cursors.Hand : Cursors.Default;
                    Invalidate();
                }
            }

            protected override void OnMouseLeave(EventArgs e)
            {
                base.OnMouseLeave(e);
                if (_hoveredIndex != -1)
                {
                    _hoveredIndex = -1;
                    Cursor = Cursors.Default;
                    Invalidate();
                }
            }

            protected override void OnMouseUp(MouseEventArgs e)
            {
                base.OnMouseUp(e);
                if (e.Button == MouseButtons.Left && _hoveredIndex >= 0 && _hoveredIndex < _items.Count)
                {
                    NotificationClicked?.Invoke(_items[_hoveredIndex]);
                }
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                var g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                int w = ClientSize.Width;
                int h = ClientSize.Height;
                if (w <= 0 || h <= 0) return;

                if (_items.Count == 0)
                {
                    DrawEmptyState(g, w, h);
                    return;
                }

                int cardW = Math.Max(200, w - 24);
                int firstIdx = Math.Max(0, (_scrollOffset - RowStep) / RowStep);
                int lastIdx = Math.Min(_items.Count - 1, (_scrollOffset + h) / RowStep + 1);

                for (int i = firstIdx; i <= lastIdx; i++)
                {
                    var notif = _items[i];
                    int cardY = 6 + i * RowStep - _scrollOffset;
                    var cardRect = new Rectangle(12, cardY, cardW, RowHeight);

                    bool isHover = i == _hoveredIndex;
                    Color fill = isHover ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                    Color border = isHover ? FluentTheme.ThemeAccent : FluentTheme.ThemeCardHairline;

                    // 1. Draw Apple squircle glass card
                    FluentTheme.PaintGlassCard(g, cardRect, 14, fill, border, drawShadow: true);

                    // 2. Draw Priority squircle icon
                    var (priBg, priText, priBorder) = FluentTheme.GetPriorityTheme(notif.Priority);
                    var iconRect = new Rectangle(cardRect.X + 14, cardRect.Y + 14, 38, 38);

                    using (var b = new SolidBrush(priBg))
                    {
                        FluentTheme.FillRoundedRectangle(g, b, iconRect, 10);
                    }
                    using (var p = new Pen(priBorder, 1f))
                    {
                        FluentTheme.DrawRoundedRectangle(g, p, iconRect, 10);
                    }
                    using (var ico = FluentTheme.GetMenuIcon("bell", priText, 18))
                    {
                        g.DrawImage(ico, iconRect.X + (38 - 18) / 2, iconRect.Y + (38 - 18) / 2);
                    }

                    // 3. Draw Priority Badge Pill
                    string priorityLabel = FluentTheme.GetPriorityDisplayLabel(notif.Priority);
                    var badgeRect = new Rectangle(cardRect.X + 62, cardRect.Y + 12, 58, 18);
                    using (var b = new SolidBrush(priBg))
                    {
                        FluentTheme.FillRoundedRectangle(g, b, badgeRect, 5);
                    }
                    using (var p = new Pen(priBorder, 1f))
                    {
                        FluentTheme.DrawRoundedRectangle(g, p, badgeRect, 5);
                    }
                    using (var fontBadge = FluentTheme.GetFont(7.5F, FontStyle.Bold))
                    using (var brushBadge = new SolidBrush(priText))
                    using (var sfBadge = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                    {
                        g.DrawString(priorityLabel, fontBadge, brushBadge, badgeRect, sfBadge);
                    }

                    // 4. Ticket Number / App Tag
                    string ticketNum = notif.TicketNumber ?? notif.TicketId ?? notif.App ?? "iDesk";
                    using (var fontTicket = FluentTheme.GetFont(8F, FontStyle.Bold))
                    using (var brushTicket = new SolidBrush(FluentTheme.ThemeAccentText))
                    using (var sfTicket = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(ticketNum, fontTicket, brushTicket, new RectangleF(cardRect.X + 126, cardRect.Y + 11, 160, 20), sfTicket);
                    }

                    // 5. Relative Timestamp (Right Aligned)
                    string timeStr = FormatRelativeTime(notif.Timestamp);
                    using (var fontTime = FluentTheme.Caption)
                    using (var brushTime = new SolidBrush(FluentTheme.ThemeTextMuted))
                    using (var sfTime = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(timeStr, fontTime, brushTime, new RectangleF(cardRect.Right - 150, cardRect.Y + 11, 138, 20), sfTime);
                    }

                    // 6. Title (Apple Bold High Contrast)
                    int textW = cardRect.Width - 76;
                    string displayTitle = !string.IsNullOrWhiteSpace(notif.Title) ? notif.Title : "Pemberitahuan Sistem";
                    using (var fontTitle = FluentTheme.GetFont(9.5F, FontStyle.Bold))
                    using (var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary))
                    using (var sfTitle = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(displayTitle, fontTitle, brushTitle, new RectangleF(cardRect.X + 62, cardRect.Y + 34, textW, 20), sfTitle);
                    }

                    // 7. Snippet Body
                    string bodyText = notif.Message ?? notif.Body ?? "";
                    using (var fontBody = FluentTheme.Caption)
                    using (var brushBody = new SolidBrush(FluentTheme.ThemeTextSecondary))
                    using (var sfBody = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(bodyText, fontBody, brushBody, new RectangleF(cardRect.X + 62, cardRect.Y + 54, textW, 20), sfBody);
                    }
                }
            }

            private void DrawEmptyState(Graphics g, int w, int h)
            {
                int midX = w / 2;
                int midY = Math.Min(h / 2, 140);

                var iconRect = new Rectangle(midX - 26, midY - 40, 52, 52);
                using (var b = new SolidBrush(FluentTheme.ThemeAccentSoft))
                {
                    FluentTheme.FillRoundedRectangle(g, b, iconRect, 14);
                }
                using (var p = new Pen(FluentTheme.ThemeCardHairline, 1f))
                {
                    FluentTheme.DrawRoundedRectangle(g, p, iconRect, 14);
                }
                using (var ico = FluentTheme.GetMenuIcon("history", FluentTheme.ThemeAccentText, 24))
                {
                    g.DrawImage(ico, iconRect.X + (52 - 24) / 2, iconRect.Y + (52 - 24) / 2);
                }

                using var fontTitle = FluentTheme.GetFont(11F, FontStyle.Bold);
                using var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary);
                using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

                g.DrawString("No notifications yet", fontTitle, brushTitle, new RectangleF(20, midY + 22, w - 40, 24), sf);

                using var fontSub = FluentTheme.Caption;
                using var brushSub = new SolidBrush(FluentTheme.ThemeTextMuted);
                g.DrawString("New notifications and ticket updates from iDesk will appear here.",
                    fontSub, brushSub, new RectangleF(30, midY + 46, w - 60, 36), sf);
            }

            private static string FormatRelativeTime(DateTime dt)
            {
                if (dt == DateTime.MinValue) return "";
                var now = DateTime.Now;
                var span = now - dt;

                if (span.TotalMinutes < 1) return "Just now";
                if (span.TotalMinutes < 60) return $"{(int)span.TotalMinutes}m ago";
                if (dt.Date == now.Date) return $"Today, {dt:HH:mm}";
                if (dt.Date == now.Date.AddDays(-1)) return $"Yesterday, {dt:HH:mm}";
                return dt.ToString("dd MMM, HH:mm");
            }
        }
    }
}
