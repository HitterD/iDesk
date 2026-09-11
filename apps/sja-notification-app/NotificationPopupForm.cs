using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Modern Enterprise Windows 11 Fluent 2 Notification Toast Form.
    /// Frameless custom card anchored at bottom-right of active display, with smooth slide-in,
    /// smart auto-dismiss with hover pause, high-contrast ticket metadata, and corporate hierarchy.
    /// </summary>
    public class NotificationPopupForm : Form
    {
        private readonly NotificationData _data;
        private readonly AppConfig? _config;
        private Image? _loadedImage;
        private string? _imageSourcePathOrUrl;
        private readonly List<NotificationAttachment> _nonImageAttachments = new();

        // Animation & Auto-Dismiss State
        private int _targetX;
        private int _targetY;
        private System.Windows.Forms.Timer? _animTimer;
        private System.Windows.Forms.Timer? _dismissTimer;
        private int _autoDismissSeconds = 12;
        private int _animStep = 0;
        private const int TotalAnimSteps = 8;

        // Win32 Interop for bring-to-front & top-most
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const int CS_DROPSHADOW = 0x00020000;
        private const int WS_EX_TOPMOST = 0x00000008;

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ClassStyle |= CS_DROPSHADOW;
                cp.ExStyle |= WS_EX_TOPMOST; // Enforce TopMost at OS level
                return cp;
            }
        }

        public NotificationPopupForm(NotificationData data, AppConfig? config = null)
        {
            _data = data;
            _config = config;
            if (_config != null && _config.AutoDismissSeconds >= 0)
            {
                _autoDismissSeconds = _config.AutoDismissSeconds;
            }

            ProcessAttachments();
            InitializeComponent();
            FluentTheme.ApplyWindows11Styles(Handle);
            PositionBottomRightToast();
        }

        private void ProcessAttachments()
        {
            if (_data.Attachments != null)
            {
                foreach (var att in _data.Attachments)
                {
                    if (IsImageAttachment(att) && _loadedImage == null)
                    {
                        _imageSourcePathOrUrl = !string.IsNullOrWhiteSpace(att.Url) ? att.Url : att.Name;
                        _loadedImage = TryLoadImage(_imageSourcePathOrUrl);
                    }
                    else
                    {
                        _nonImageAttachments.Add(att);
                    }
                }
            }

            if (_loadedImage == null && !string.IsNullOrWhiteSpace(_data.Avatar))
            {
                if (IsImageUrl(_data.Avatar))
                {
                    _imageSourcePathOrUrl = _data.Avatar;
                    _loadedImage = TryLoadImage(_data.Avatar);
                }
            }
        }

        private static bool IsImageAttachment(NotificationAttachment att)
        {
            string name = att.Name ?? "";
            string url = att.Url ?? "";
            return IsImageUrl(name) || IsImageUrl(url);
        }

        private static bool IsImageUrl(string pathOrUrl)
        {
            if (string.IsNullOrWhiteSpace(pathOrUrl)) return false;
            string clean = pathOrUrl.Split('?')[0].ToLowerInvariant();
            return clean.EndsWith(".png") || clean.EndsWith(".jpg") ||
                   clean.EndsWith(".jpeg") || clean.EndsWith(".webp") ||
                   clean.EndsWith(".gif") || clean.EndsWith(".bmp");
        }

        private static Image? TryLoadImage(string pathOrUrl)
        {
            if (string.IsNullOrWhiteSpace(pathOrUrl)) return null;

            try
            {
                if (File.Exists(pathOrUrl))
                {
                    using var fs = new FileStream(pathOrUrl, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    return Image.FromStream(fs);
                }

                if (pathOrUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    pathOrUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    string cacheDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "SJANotifier", "cache", "images"
                    );
                    Directory.CreateDirectory(cacheDir);

                    using var sha = SHA256.Create();
                    byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(pathOrUrl));
                    string hashStr = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant().Substring(0, 16);
                    string ext = Path.GetExtension(pathOrUrl.Split('?')[0]);
                    if (string.IsNullOrEmpty(ext) || ext.Length > 5) ext = ".png";
                    string localPath = Path.Combine(cacheDir, $"{hashStr}{ext}");

                    if (File.Exists(localPath) && new FileInfo(localPath).Length > 0)
                    {
                        using var fs = new FileStream(localPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                        return Image.FromStream(fs);
                    }

                    using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(2.5) };
                    byte[] bytes = client.GetByteArrayAsync(pathOrUrl).GetAwaiter().GetResult();
                    File.WriteAllBytes(localPath, bytes);

                    using var ms = new MemoryStream(bytes);
                    return Image.FromStream(ms);
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"Failed to load notification image '{pathOrUrl}': {ex.Message}");
            }
            return null;
        }

        private void PositionBottomRightToast()
        {
            try
            {
                Screen? targetScreen = null;
                try
                {
                    IntPtr fg = GetForegroundWindow();
                    if (fg != IntPtr.Zero)
                    {
                        targetScreen = Screen.FromHandle(fg);
                    }
                }
                catch {}

                if (targetScreen == null)
                {
                    try
                    {
                        targetScreen = Screen.FromPoint(Cursor.Position);
                    }
                    catch {}
                }

                targetScreen ??= Screen.PrimaryScreen ?? Screen.AllScreens[0];
                Rectangle area = targetScreen.WorkingArea;

                _targetX = area.Right - Width - 16;
                _targetY = area.Bottom - Height - 16;

                StartPosition = FormStartPosition.Manual;
                Location = new Point(_targetX, _targetY + 24);
                Opacity = 0.0;
            }
            catch
            {
                StartPosition = FormStartPosition.CenterScreen;
                Opacity = 1.0;
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            try
            {
                TopMost = true;

                // Force foreground promotion without stealing active keyboard focus
                IntPtr fgWnd = GetForegroundWindow();
                uint fgThread = 0;
                if (fgWnd != IntPtr.Zero)
                {
                    GetWindowThreadProcessId(fgWnd, out fgThread);
                }
                uint curThread = GetCurrentThreadId();

                if (fgThread != 0 && fgThread != curThread)
                {
                    AttachThreadInput(curThread, fgThread, true);
                }

                SetWindowPos(Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                BringWindowToTop(Handle);
                SetForegroundWindow(Handle);
                SwitchToThisWindow(Handle, true);

                if (fgThread != 0 && fgThread != curThread)
                {
                    AttachThreadInput(curThread, fgThread, false);
                }

                // Subtle professional asterisk chime
                try
                {
                    System.Media.SystemSounds.Asterisk.Play();
                }
                catch {}

                StartSlideInAnimation();
            }
            catch (Exception ex)
            {
                AppLogger.Log($"[NotificationPopupForm] OnShown error: {ex.Message}");
                Opacity = 1.0;
            }
        }

        private void StartSlideInAnimation()
        {
            _animStep = 0;
            _animTimer = new System.Windows.Forms.Timer { Interval = 15 };
            _animTimer.Tick += (s, e) =>
            {
                _animStep++;
                float progress = (float)_animStep / TotalAnimSteps;
                if (progress >= 1.0f)
                {
                    _animTimer.Stop();
                    _animTimer.Dispose();
                    _animTimer = null;
                    Location = new Point(_targetX, _targetY);
                    Opacity = 1.0;
                    StartAutoDismissTimer();
                }
                else
                {
                    // Ease out quadratic
                    float ease = 1f - (1f - progress) * (1f - progress);
                    int curY = _targetY + (int)(24 * (1f - ease));
                    Location = new Point(_targetX, curY);
                    Opacity = ease;
                }
            };
            _animTimer.Start();
        }

        private void StartAutoDismissTimer()
        {
            if (_autoDismissSeconds <= 0) return;

            _dismissTimer = new System.Windows.Forms.Timer { Interval = _autoDismissSeconds * 1000 };
            _dismissTimer.Tick += (s, e) =>
            {
                _dismissTimer.Stop();
                Close();
            };
            _dismissTimer.Start();
        }

        private void RegisterHoverHandlers(Control ctrl)
        {
            ctrl.MouseEnter += (s, e) => _dismissTimer?.Stop();
            ctrl.MouseLeave += (s, e) =>
            {
                if (!ClientRectangle.Contains(PointToClient(Cursor.Position)))
                {
                    _dismissTimer?.Start();
                }
            };
            foreach (Control child in ctrl.Controls)
            {
                RegisterHoverHandlers(child);
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var borderPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
            e.Graphics.DrawRectangle(borderPen, 0, 0, Width - 1, Height - 1);
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            base.OnFormClosed(e);
            _animTimer?.Stop();
            _animTimer?.Dispose();
            _dismissTimer?.Stop();
            _dismissTimer?.Dispose();
            _loadedImage?.Dispose();
            _loadedImage = null;
        }

        private void InitializeComponent()
        {
            Text = $"SJA Notifier • {_data.App ?? "iDesk"}";
            FormBorderStyle = FormBorderStyle.None;
            Font = FluentTheme.Body;
            BackColor = FluentTheme.ThemeCanvasTop;
            ForeColor = FluentTheme.ThemeTextPrimary;
            TopMost = true;
            ShowInTaskbar = true;
            MaximizeBox = false;
            DoubleBuffered = true;

            // ================= 1. DYNAMIC COMPACT SIZE CALCULATION =================
            int windowWidth = 490;
            int cardInnerWidth = windowWidth - 28 - 24; // Form width (490) - body padding (14*2) - card padding (12*2) = 438px
            string msg = _data.Message ?? "";
            int msgHeight = TextRenderer.MeasureText(
                msg,
                FluentTheme.GetFont(10F, FontStyle.Regular),
                new Size(cardInnerWidth - 12, 0),
                TextFormatFlags.WordBreak
            ).Height;
            msgHeight = Math.Max(26, Math.Min(msgHeight, 180));

            int imageBoxHeight = _loadedImage != null ? 190 : 0;
            int nonImgHeight = _nonImageAttachments.Count > 0 ? (_nonImageAttachments.Count * 38) : 0;

            // Header (66) + Footer (54) + Body & Card padding (44) + Meta (32) + Divider (1) + msg + attachments
            int calculatedHeight = 197 + msgHeight + (imageBoxHeight > 0 ? imageBoxHeight + 12 : 0) + (nonImgHeight > 0 ? nonImgHeight + 8 : 0);
            calculatedHeight = Math.Max(270, Math.Min(calculatedHeight, 580));

            Size = new Size(windowWidth, calculatedHeight);
            MinimumSize = new Size(420, 250);

            var pnlRoot = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(1),
                BackColor = FluentTheme.ThemeCanvasTop
            };
            Controls.Add(pnlRoot);

            // Priority Accent Line
            Color priorityStripeColor = FluentTheme.ThemeAccent;
            if (!string.IsNullOrWhiteSpace(_data.Priority))
            {
                var pTheme = FluentTheme.GetPriorityTheme(_data.Priority);
                priorityStripeColor = pTheme.Text;
            }

            var pnlStripe = new Panel
            {
                Dock = DockStyle.Left,
                Width = 4,
                BackColor = priorityStripeColor
            };
            pnlRoot.Controls.Add(pnlStripe);

            // ================= 2. HEADER BAR =================
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 66,
                BackColor = FluentTheme.ThemeCardFill,
                Padding = new Padding(16, 12, 14, 10)
            };
            pnlHeader.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Paint += (s, e) =>
            {
                using var linePen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(linePen, 0, pnlHeader.Height - 1, pnlHeader.Width, pnlHeader.Height - 1);
            };

            // Avatar / Brand Mark
            var picAvatar = new PictureBox
            {
                Size = new Size(38, 38),
                Location = new Point(14, 14),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            picAvatar.Image = CreateBrandIcon();
            picAvatar.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(picAvatar);

            // Subtitle & Brand Tag
            var lblBrand = new Label
            {
                Text = $"{(_data.App ?? "iDesk Support").ToUpperInvariant()} • PT SANTOS JAYA ABADI",
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(60, 13),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            lblBrand.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(lblBrand);

            // Headline Title
            string cleanTitle = !string.IsNullOrWhiteSpace(_data.Title) ? _data.Title : "Notifikasi Masuk";
            var lblTitle = new Label
            {
                Text = cleanTitle,
                Font = FluentTheme.Headline,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(60, 31),
                Size = new Size(pnlHeader.Width - 110, 24),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                AutoEllipsis = true,
                BackColor = Color.Transparent
            };
            lblTitle.MouseDown += (s, e) => FluentTheme.EnableWindowDrag(Handle, e);
            pnlHeader.Controls.Add(lblTitle);

            // Minimalist Close Button (X)
            var btnCloseX = new GlassButton
            {
                Size = new Size(28, 28),
                Location = new Point(pnlHeader.Width - 38, 17),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                GlyphOnly = true,
                Glyph = "close",
                Radius = 6,
                Cursor = Cursors.Hand
            };
            btnCloseX.Click += (s, e) => Close();
            pnlHeader.Controls.Add(btnCloseX);

            pnlRoot.Controls.Add(pnlHeader);

            // ================= 3. FOOTER ACTION BAR =================
            var pnlFooter = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 52,
                BackColor = FluentTheme.ThemeCardFillSoft,
                Padding = new Padding(14, 10, 14, 10)
            };
            pnlFooter.Paint += (s, e) =>
            {
                using var linePen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(linePen, 0, 0, pnlFooter.Width, 0);
            };

            // Timestamp Label
            var lblTimestamp = new Label
            {
                Text = $"Terkirim: {_data.Timestamp:HH:mm} WIB",
                ForeColor = FluentTheme.ThemeTextMuted,
                Font = FluentTheme.SubText,
                Location = new Point(14, 18),
                AutoSize = true,
                Anchor = AnchorStyles.Bottom | AnchorStyles.Left
            };
            pnlFooter.Controls.Add(lblTimestamp);

            // Close Button (Secondary)
            var btnClose = new GlassButton
            {
                Text = "Tutup",
                Size = new Size(80, 34),
                Location = new Point(pnlFooter.Width - 96, 10),
                Anchor = AnchorStyles.Bottom | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 6,
                Font = FluentTheme.SubTextBold
            };
            btnClose.Click += (s, e) => Close();
            pnlFooter.Controls.Add(btnClose);

            // Primary Action Button (Buka Tiket)
            if (!string.IsNullOrWhiteSpace(_data.Url))
            {
                var btnOpenWeb = new GlassButton
                {
                    Text = "Buka Tiket ➔",
                    Size = new Size(140, 34),
                    Location = new Point(pnlFooter.Width - 246, 10),
                    Anchor = AnchorStyles.Bottom | AnchorStyles.Right,
                    Variant = GlassButtonVariant.Accent,
                    Radius = 6,
                    Font = FluentTheme.SubTextBold
                };
                btnOpenWeb.Click += (s, e) =>
                {
                    AppLogger.Log($"[NotificationPopupForm] Membuka URL web: {_data.Url}");
                    ToastNotifier.OpenUrlInBrowser(_data.Url);
                    Close();
                };
                pnlFooter.Controls.Add(btnOpenWeb);
            }

            pnlRoot.Controls.Add(pnlFooter);

            // ================= 4. BODY CONTENT CARD =================
            var pnlBody = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(12, 10, 12, 10),
                BackColor = FluentTheme.ThemeCanvasTop
            };
            pnlRoot.Controls.Add(pnlBody);
            pnlBody.BringToFront();

            var pnlCard = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = FluentTheme.ThemeCardFill,
                Padding = new Padding(12, 10, 12, 10)
            };
            pnlCard.Paint += (s, e) =>
            {
                var rect = new Rectangle(0, 0, pnlCard.Width - 1, pnlCard.Height - 1);
                using var borderPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, borderPen, rect, 8);
            };

            // Metadata Strip: Ticket ID Badge, Priority Pill, Category
            var pnlMeta = new Panel
            {
                Dock = DockStyle.Top,
                Height = 28,
                BackColor = Color.Transparent,
                Padding = new Padding(0, 0, 0, 4)
            };

            string ticketTag = !string.IsNullOrWhiteSpace(_data.TicketNumber) ? $"#{_data.TicketNumber}" : "";
            string categoryInfo = !string.IsNullOrWhiteSpace(_data.Category) ? _data.Category : "Layanan ICT";
            string ticketText = string.IsNullOrEmpty(ticketTag) ? "TIKET" : ticketTag;
            int badgeWidth = Math.Max(70, TextRenderer.MeasureText(ticketText, FluentTheme.CaptionBold).Width + 14);

            var lblTicketBadge = new Label
            {
                Text = ticketText,
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeAccentText,
                BackColor = Color.Transparent,
                AutoSize = false,
                Size = new Size(badgeWidth, 22),
                Location = new Point(0, 1),
                TextAlign = ContentAlignment.MiddleCenter
            };
            lblTicketBadge.Paint += (s, e) =>
            {
                var r = new Rectangle(0, 0, lblTicketBadge.Width - 1, lblTicketBadge.Height - 1);
                using var bgBrush = new SolidBrush(FluentTheme.ThemeAccentSoft);
                using var borderPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                FluentTheme.FillRoundedRectangle(e.Graphics, bgBrush, r, 4);
                FluentTheme.DrawRoundedRectangle(e.Graphics, borderPen, r, 4);

                using var textBrush = new SolidBrush(FluentTheme.ThemeAccentText);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                e.Graphics.DrawString(ticketText, FluentTheme.CaptionBold, textBrush, new RectangleF(0, 0, lblTicketBadge.Width, lblTicketBadge.Height), sf);
            };
            pnlMeta.Controls.Add(lblTicketBadge);

            int metaLeft = badgeWidth + 8;

            if (!string.IsNullOrWhiteSpace(_data.Priority) && !_data.Priority.Equals("normal", StringComparison.OrdinalIgnoreCase))
            {
                var pTheme = FluentTheme.GetPriorityTheme(_data.Priority);
                string priorityLabel = _data.Priority.ToUpperInvariant();
                int prioWidth = TextRenderer.MeasureText(priorityLabel, FluentTheme.CaptionBold).Width + 14;

                var lblPriority = new Label
                {
                    Text = priorityLabel,
                    Font = FluentTheme.CaptionBold,
                    ForeColor = pTheme.Text,
                    BackColor = Color.Transparent,
                    AutoSize = false,
                    Size = new Size(prioWidth, 22),
                    Location = new Point(metaLeft, 1),
                    TextAlign = ContentAlignment.MiddleCenter
                };
                lblPriority.Paint += (s, e) =>
                {
                    var r = new Rectangle(0, 0, lblPriority.Width - 1, lblPriority.Height - 1);
                    using var bgBrush = new SolidBrush(pTheme.Bg);
                    using var borderPen = new Pen(pTheme.Border, 1f);
                    FluentTheme.FillRoundedRectangle(e.Graphics, bgBrush, r, 4);
                    FluentTheme.DrawRoundedRectangle(e.Graphics, borderPen, r, 4);

                    using var textBrush = new SolidBrush(pTheme.Text);
                    var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                    e.Graphics.DrawString(priorityLabel, FluentTheme.CaptionBold, textBrush, new RectangleF(0, 0, lblPriority.Width, lblPriority.Height), sf);
                };
                pnlMeta.Controls.Add(lblPriority);
                metaLeft += prioWidth + 8;
            }

            var lblMetaDetails = new Label
            {
                Text = $"• {categoryInfo}",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(metaLeft, 2),
                Size = new Size(Math.Max(50, pnlCard.Width - metaLeft - 20), 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                AutoEllipsis = true,
                TextAlign = ContentAlignment.MiddleLeft
            };
            pnlMeta.Controls.Add(lblMetaDetails);

            pnlCard.Controls.Add(pnlMeta);

            // Divider Line
            var pnlDivider = new Panel
            {
                Dock = DockStyle.Top,
                Height = 1,
                BackColor = FluentTheme.ThemeCardHairline
            };
            pnlCard.Controls.Add(pnlDivider);

            // Scrollable Content Area with absolute layout so children don't overlap
            var pnlScrollContent = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                BackColor = FluentTheme.ThemeCardFill,
                Padding = new Padding(0, 6, 2, 6)
            };
            pnlScrollContent.HorizontalScroll.Enabled = false;
            pnlScrollContent.HorizontalScroll.Visible = false;

            int availTextWidth = cardInnerWidth - 10;
            int textH = TextRenderer.MeasureText(
                _data.Message ?? "",
                FluentTheme.GetFont(9.5F, FontStyle.Regular),
                new Size(availTextWidth, 0),
                TextFormatFlags.WordBreak
            ).Height;

            var lblMessage = new Label
            {
                Text = _data.Message,
                Font = FluentTheme.GetFont(9.5F, FontStyle.Regular),
                ForeColor = FluentTheme.ThemeTextPrimary,
                BackColor = Color.Transparent,
                AutoSize = false,
                Size = new Size(availTextWidth, textH + 4),
                Location = new Point(0, 4)
            };
            pnlScrollContent.Controls.Add(lblMessage);

            int currentY = lblMessage.Bottom + 12;

            // Image Preview (if present)
            if (_loadedImage != null)
            {
                var pnlImagePreview = new Panel
                {
                    Location = new Point(0, currentY),
                    Size = new Size(cardInnerWidth, 170),
                    Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                    BackColor = FluentTheme.ThemeCardFillSoft,
                    Cursor = Cursors.Hand
                };

                pnlImagePreview.Paint += (s, e) =>
                {
                    e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
                    e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;

                    var targetRect = new Rectangle(0, 0, pnlImagePreview.Width, pnlImagePreview.Height);

                    float imgAspect = (float)_loadedImage.Width / _loadedImage.Height;
                    float boxAspect = (float)targetRect.Width / targetRect.Height;

                    int dw, dh, dx, dy;
                    if (imgAspect > boxAspect)
                    {
                        dw = targetRect.Width;
                        dh = (int)(targetRect.Width / imgAspect);
                        dx = 0;
                        dy = (targetRect.Height - dh) / 2;
                    }
                    else
                    {
                        dw = (int)(targetRect.Height * imgAspect);
                        dh = targetRect.Height;
                        dx = (targetRect.Width - dw) / 2;
                        dy = 0;
                    }

                    var drawRect = new Rectangle(dx, dy, dw, dh);
                    FluentTheme.DrawRoundedImage(e.Graphics, _loadedImage, drawRect, 6);

                    string badgeText = "🔍 Klik untuk gambar penuh";
                    using var badgeFont = FluentTheme.CaptionBold;
                    var badgeSize = TextRenderer.MeasureText(badgeText, badgeFont);
                    int bw = badgeSize.Width + 16;
                    int bh = badgeSize.Height + 6;
                    var badgeRect = new Rectangle(targetRect.Width - bw - 10, targetRect.Height - bh - 8, bw, bh);

                    using var badgeBg = new SolidBrush(Color.FromArgb(210, 15, 23, 42));
                    FluentTheme.FillRoundedRectangle(e.Graphics, badgeBg, badgeRect, 4);
                    TextRenderer.DrawText(e.Graphics, badgeText, badgeFont, badgeRect, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                };

                pnlImagePreview.Click += (s, e) =>
                {
                    if (!string.IsNullOrWhiteSpace(_imageSourcePathOrUrl))
                    {
                        ToastNotifier.OpenUrlInBrowser(_imageSourcePathOrUrl);
                    }
                };

                pnlScrollContent.Controls.Add(pnlImagePreview);
                currentY = pnlImagePreview.Bottom + 10;
            }

            // Non-image Attachments
            if (_nonImageAttachments.Count > 0)
            {
                foreach (var att in _nonImageAttachments)
                {
                    var pnlAtt = new Panel
                    {
                        Location = new Point(0, currentY),
                        Size = new Size(cardInnerWidth, 32),
                        Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                        BackColor = FluentTheme.ThemeCardFillSoft,
                        Cursor = Cursors.Hand
                    };
                    pnlAtt.Paint += (s, e) =>
                    {
                        var r = new Rectangle(0, 0, pnlAtt.Width - 1, pnlAtt.Height - 1);
                        using var borderPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                        FluentTheme.DrawRoundedRectangle(e.Graphics, borderPen, r, 6);

                        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                        using var iconPen = new Pen(FluentTheme.ThemeAccentText, 1.3f);
                        var docPts = new Point[]
                        {
                            new Point(10, 8),
                            new Point(16, 8),
                            new Point(20, 12),
                            new Point(20, 22),
                            new Point(10, 22),
                            new Point(10, 8)
                        };
                        e.Graphics.DrawLines(iconPen, docPts);
                        e.Graphics.DrawLine(iconPen, 16, 8, 16, 12);
                        e.Graphics.DrawLine(iconPen, 16, 12, 20, 12);
                    };

                    string sizeInfo = string.IsNullOrWhiteSpace(att.Size) ? "" : $" ({att.Size})";
                    var lblAtt = new Label
                    {
                        Text = $"{att.Name}{sizeInfo}",
                        Font = FluentTheme.SubTextBold,
                        ForeColor = FluentTheme.ThemeAccentText,
                        Location = new Point(28, 1),
                        Size = new Size(Math.Max(100, pnlAtt.Width - 36), 28),
                        Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                        TextAlign = ContentAlignment.MiddleLeft,
                        Cursor = Cursors.Hand
                    };
                    if (!string.IsNullOrWhiteSpace(att.Url))
                    {
                        lblAtt.Click += (s, e) => ToastNotifier.OpenUrlInBrowser(att.Url);
                        pnlAtt.Click += (s, e) => ToastNotifier.OpenUrlInBrowser(att.Url);
                    }

                    pnlAtt.Controls.Add(lblAtt);
                    pnlScrollContent.Controls.Add(pnlAtt);
                    currentY = pnlAtt.Bottom + 6;
                }
            }

            pnlCard.Controls.Add(pnlScrollContent);
            pnlScrollContent.BringToFront();
            pnlBody.Controls.Add(pnlCard);

            // Register recursive hover detection for auto-dismiss pause
            RegisterHoverHandlers(pnlRoot);
        }

        private Image CreateBrandIcon()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string santosLogoAsset = Path.Combine(baseDir, "assets", "santos-logo.png");
            string ideskLogoAsset = Path.Combine(baseDir, "assets", "idesk-logo.png");

            string logoToUse = File.Exists(santosLogoAsset) ? santosLogoAsset : ideskLogoAsset;

            var bmp = new Bitmap(36, 36);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;

            using var bgBrush = new SolidBrush(FluentTheme.ThemeCardFillSoft);
            g.FillEllipse(bgBrush, 0, 0, 35, 35);

            using var borderPen = new Pen(FluentTheme.ThemeCardHairline, 1f);
            g.DrawEllipse(borderPen, 0, 0, 35, 35);

            if (File.Exists(logoToUse))
            {
                try
                {
                    using var src = Image.FromFile(logoToUse);
                    g.DrawImage(src, new Rectangle(5, 5, 26, 26));
                    return bmp;
                }
                catch { }
            }

            using var font = FluentTheme.CaptionBold;
            using var textBrush = new SolidBrush(FluentTheme.ThemeAccentText);
            var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString("SJA", font, textBrush, new RectangleF(0, 0, 36, 36), sf);

            return bmp;
        }
    }
}
