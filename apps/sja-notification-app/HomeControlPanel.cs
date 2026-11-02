using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Linq;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Halaman Home: tiga notifikasi terbaru dari riwayat lokal,
    /// diikuti tombol menuju halaman History.
    /// </summary>
    public class HomeControlPanel : Panel
    {
        private const int LatestCount = 3;
        private const int RowHeight = 72;
        private const int RowGap = 8;

        private readonly AppConfig _config;
        private readonly Action _onViewAllRequested;
        private readonly List<NotificationData> _items = new();

        private Label _lblTitle = null!;
        private Label _lblSubtitle = null!;
        private GlassButton _btnViewAll = null!;
        private Panel _pnlHeader = null!;
        private HomeStreamCanvas _canvas = null!;

        public HomeControlPanel(AppConfig config, Action onViewAllRequested)
        {
            _config = config;
            _onViewAllRequested = onViewAllRequested;

            Dock = DockStyle.Fill;
            DoubleBuffered = true;
            BackColor = FluentTheme.ThemeCanvasTop;

            InitializeComponent();
            FluentTheme.ThemeChanged += OnThemeChanged;
            RefreshData();
        }

        private void InitializeComponent()
        {
            _pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 56,
                BackColor = Color.Transparent,
                Padding = new Padding(16, 8, 16, 4)
            };

            _lblTitle = new Label
            {
                Text = "Home",
                Font = FluentTheme.GetFont(14F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 6),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlHeader.Controls.Add(_lblTitle);

            _lblSubtitle = new Label
            {
                Text = "Latest notifications",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(17, 32),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlHeader.Controls.Add(_lblSubtitle);

            Controls.Add(_pnlHeader);

            var pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 52,
                BackColor = Color.Transparent,
                Padding = new Padding(16, 6, 16, 10)
            };

            _btnViewAll = new GlassButton
            {
                Text = "View all notifications",
                Variant = GlassButtonVariant.Ghost,
                Font = FluentTheme.CaptionBold,
                Radius = 8,
                Size = new Size(180, 34),
                Location = new Point(16, 8)
            };
            _btnViewAll.Click += (s, e) => _onViewAllRequested?.Invoke();
            pnlBottom.Controls.Add(_btnViewAll);

            Controls.Add(pnlBottom);

            _canvas = new HomeStreamCanvas
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent
            };
            _canvas.NotificationClicked += OnNotificationClicked;
            Controls.Add(_canvas);
            _canvas.BringToFront();
        }

        public void RefreshData()
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action(RefreshData)); return; }

            _items.Clear();
            _items.AddRange(LocalNotificationHistory.LoadAll()
                .OrderByDescending(n => n.Timestamp)
                .Take(LatestCount));

            _canvas.SetItems(_items);
            _btnViewAll.Visible = _items.Count > 0;
            Invalidate(true);
        }

        private void OnNotificationClicked(NotificationData notif)
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

        private void OnThemeChanged()
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action(OnThemeChanged)); return; }
            BackColor = FluentTheme.ThemeCanvasTop;
            _lblTitle.ForeColor = FluentTheme.ThemeTextPrimary;
            _lblSubtitle.ForeColor = FluentTheme.ThemeTextSecondary;
            Invalidate(true);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) FluentTheme.ThemeChanged -= OnThemeChanged;
            base.Dispose(disposing);
        }

        private class HomeStreamCanvas : Control
        {
            private readonly List<NotificationData> _items = new();
            private int _hoveredIndex = -1;

            public event Action<NotificationData>? NotificationClicked;

            public HomeStreamCanvas()
            {
                DoubleBuffered = true;
            }

            public void SetItems(IEnumerable<NotificationData> items)
            {
                _items.Clear();
                _items.AddRange(items);
                _hoveredIndex = -1;
                Invalidate();
            }

            protected override void OnMouseMove(MouseEventArgs e)
            {
                base.OnMouseMove(e);
                int oldHover = _hoveredIndex;
                int rowStep = RowHeight + RowGap;

                if (_items.Count == 0)
                {
                    _hoveredIndex = -1;
                }
                else
                {
                    int adjustedY = e.Y - 6;
                    if (adjustedY >= 0)
                    {
                        int index = adjustedY / rowStep;
                        int rem = adjustedY % rowStep;
                        if (index >= 0 && index < _items.Count && rem <= RowHeight && e.X >= 16 && e.X <= ClientSize.Width - 16)
                            _hoveredIndex = index;
                        else
                            _hoveredIndex = -1;
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
                    using var fTitle = FluentTheme.GetFont(11F, FontStyle.Bold);
                    using var fSub = FluentTheme.Caption;
                    using var bTitle = new SolidBrush(FluentTheme.ThemeTextPrimary);
                    using var bSub = new SolidBrush(FluentTheme.ThemeTextMuted);
                    using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

                    var emptyRect = new Rectangle(16, 20, w - 32, 100);
                    FluentTheme.PaintGlassCard(g, emptyRect, 12, FluentTheme.ThemeCardFillSoft, FluentTheme.ThemeCardHairline, false);
                    g.DrawString("No notifications yet", fTitle, bTitle, new RectangleF(16, 42, w - 32, 22), sf);
                    g.DrawString("Incoming tickets and announcements will appear here.", fSub, bSub, new RectangleF(16, 68, w - 32, 20), sf);
                    return;
                }

                int cardW = Math.Max(200, w - 32);
                int rowStep = RowHeight + RowGap;

                for (int i = 0; i < _items.Count; i++)
                {
                    var notif = _items[i];
                    int cardY = 6 + i * rowStep;
                    var cardRect = new Rectangle(16, cardY, cardW, RowHeight);

                    bool isHover = i == _hoveredIndex;
                    Color fill = isHover ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                    Color border = isHover ? FluentTheme.ThemeAccent : FluentTheme.ThemeCardHairline;

                    FluentTheme.PaintGlassCard(g, cardRect, 10, fill, border, drawShadow: false);

                    var (priBg, priText, priBorder) = FluentTheme.GetPriorityTheme(notif.Priority);
                    var iconRect = new Rectangle(cardRect.X + 12, cardRect.Y + 12, 34, 34);

                    using (var b = new SolidBrush(priBg)) FluentTheme.FillRoundedRectangle(g, b, iconRect, 8);
                    using (var p = new Pen(priBorder, 1f)) FluentTheme.DrawRoundedRectangle(g, p, iconRect, 8);
                    using (var ico = FluentTheme.GetMenuIcon("bell", priText, 16))
                    {
                        g.DrawImage(ico, iconRect.X + (34 - 16) / 2, iconRect.Y + (34 - 16) / 2);
                    }

                    string ticketNum = notif.TicketNumber ?? notif.TicketId ?? notif.App ?? "Notification";
                    using (var fontTicket = FluentTheme.GetFont(8F, FontStyle.Bold))
                    using (var brushTicket = new SolidBrush(FluentTheme.ThemeAccentText))
                    {
                        g.DrawString(ticketNum, fontTicket, brushTicket, cardRect.X + 54, cardRect.Y + 12);
                    }

                    string timeStr = notif.Timestamp.ToString("HH:mm");
                    using (var fontTime = FluentTheme.Caption)
                    using (var brushTime = new SolidBrush(FluentTheme.ThemeTextMuted))
                    using (var sfTime = new StringFormat { Alignment = StringAlignment.Far })
                    {
                        g.DrawString(timeStr, fontTime, brushTime, new RectangleF(cardRect.Right - 80, cardRect.Y + 12, 70, 18), sfTime);
                    }

                    string titleText = notif.Title ?? notif.Message ?? "";
                    using (var fontTitle = FluentTheme.GetFont(9F, FontStyle.Bold))
                    using (var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary))
                    using (var sfTitle = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(titleText, fontTitle, brushTitle, new RectangleF(cardRect.X + 54, cardRect.Y + 30, cardW - 70, 18), sfTitle);
                    }

                    string msgText = notif.Message ?? "";
                    using (var fontMsg = FluentTheme.Caption)
                    using (var brushMsg = new SolidBrush(FluentTheme.ThemeTextSecondary))
                    using (var sfMsg = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(msgText, fontMsg, brushMsg, new RectangleF(cardRect.X + 54, cardRect.Y + 48, cardW - 70, 18), sfMsg);
                    }
                }
            }
        }
    }
}
