using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SJANotificationApp
{
    /// <summary>
    /// Centralized Fluent Light Enterprise Design System for SJA Notification App.
    /// Provides consistent colors, typography, drawing utilities, and Windows 11 DWM integration.
    /// </summary>
    public static class FluentTheme
    {
        // ================= 1. COLOR TOKENS =================
        public static readonly Color Background = Color.FromArgb(244, 246, 248);     // Slate-50/100 #F4F6F8
        public static readonly Color Surface = Color.FromArgb(255, 255, 255);        // Pure White #FFFFFF
        public static readonly Color SubtleSurface = Color.FromArgb(241, 245, 249); // Slate-100 #F1F5F9
        public static readonly Color HoverSurface = Color.FromArgb(241, 245, 249);  // Slate-100 #F1F5F9
        public static readonly Color SelectedSurface = Color.FromArgb(226, 232, 240);// Slate-200 #E2E8F0

        // Borders
        public static readonly Color BorderSubtle = Color.FromArgb(226, 232, 240);  // Slate-200 #E2E8F0
        public static readonly Color BorderStrong = Color.FromArgb(203, 213, 225);  // Slate-300 #CBD5E1

        // Typography Colors
        public static readonly Color TextPrimary = Color.FromArgb(15, 23, 42);      // Slate-900 #0F172A
        public static readonly Color TextSecondary = Color.FromArgb(71, 85, 105);   // Slate-600 #475569
        public static readonly Color TextMuted = Color.FromArgb(148, 163, 184);     // Slate-400 #94A3B8

        // Santos Deep Navy Brand
        public static readonly Color NavyBrand = Color.FromArgb(15, 58, 117);       // Santos Deep Navy #0F3A75
        public static readonly Color NavyHover = Color.FromArgb(30, 78, 148);       // Navy Hover #1E4E94
        public static readonly Color NavyPressed = Color.FromArgb(10, 42, 85);      // Deep Navy Pressed #0A2A55

        // Dark Enterprise Theme Tokens
        public static readonly Color DarkMenuBackground = Color.FromArgb(24, 24, 27);    // Zinc-900 #18181B
        public static readonly Color DarkMenuSurface = Color.FromArgb(34, 34, 38);       // Dark Surface #222226
        public static readonly Color DarkMenuHover = Color.FromArgb(45, 45, 52);         // Dark Hover #2D2D34
        public static readonly Color DarkMenuSelected = Color.FromArgb(56, 56, 64);      // Dark Pressed #383840
        public static readonly Color DarkMenuBorder = Color.FromArgb(45, 45, 52);        // Subtle Border #2D2D34
        public static readonly Color DarkMenuBorderStrong = Color.FromArgb(63, 63, 70);  // Medium Border #3F3F46
        public static readonly Color DarkMenuTextPrimary = Color.FromArgb(244, 244, 245); // Zinc-100 #F4F4F5
        public static readonly Color DarkMenuTextSecondary = Color.FromArgb(161, 161, 170);// Zinc-400 #A1A1AA
        public static readonly Color DarkMenuTextMuted = Color.FromArgb(113, 113, 122);  // Zinc-500 #71717A
        public static readonly Color DarkLiveDot = Color.FromArgb(16, 185, 129);          // Emerald-500 #10B981
        public static readonly Color DarkLiveDotHalo = Color.FromArgb(18, 16, 185, 129);  // Subtle Emerald Halo
        public static readonly Color DarkBadgeBg = Color.FromArgb(38, 38, 44);           // Subtle Pill #26262C

        // Clean Modern Canvas & Card Tokens
        public static readonly Color GlassCanvasTop = Color.FromArgb(24, 24, 27);        // Zinc-900 #18181B
        public static readonly Color GlassCanvasBottom = Color.FromArgb(18, 18, 20);     // Zinc-950 #121214
        public static readonly Color GlassCardFill = Color.FromArgb(34, 34, 38);         // Zinc-850 #222226
        public static readonly Color GlassCardFillSoft = Color.FromArgb(27, 27, 30);     // Zinc-900 #1B1B1E
        public static readonly Color GlassHairline = Color.FromArgb(55, 55, 62);         // Subtle hairline #37373E
        public static readonly Color GlassHairlineStrong = Color.FromArgb(75, 75, 84);   // Strong hairline #4B4B54
        public static readonly Color GlassHover = Color.FromArgb(45, 45, 52);            // Hover #2D2D34
        public static readonly Color GlassPressed = Color.FromArgb(56, 56, 64);          // Pressed #383840
        public static readonly Color GlassInset = Color.FromArgb(18, 18, 20);            // Input well #121214

        // Accent tuned for dark surfaces
        public static readonly Color Accent = Color.FromArgb(37, 99, 235);               // Royal Blue #2563EB
        public static readonly Color AccentHover = Color.FromArgb(59, 130, 246);          // Blue Hover #3B82F6
        public static readonly Color AccentPressed = Color.FromArgb(29, 78, 216);         // Blue Pressed #1D4ED8
        public static readonly Color AccentSoft = Color.FromArgb(30, 41, 59);             // Slate-800 #1E293B
        public static readonly Color AccentGlow = Color.FromArgb(20, 37, 99, 235);        // Subtle glow
        public static readonly Color AccentText = Color.FromArgb(96, 165, 250);          // Blue-400 #60A5FA

        // Destructive tokens on dark
        public static readonly Color DangerText = Color.FromArgb(239, 68, 68);           // Red-500 #EF4444
        public static readonly Color DangerFill = Color.FromArgb(30, 239, 68, 68);        // Red @ 12%
        public static readonly Color DangerHairline = Color.FromArgb(60, 239, 68, 68);    // Red @ 24%
        public static readonly Color DangerHover = Color.FromArgb(45, 239, 68, 68);       // Red @ 18%

        // ================= 1b. DYNAMIC ADAPTIVE THEME ENGINE (WINDOWS SYNC) =================
        private static bool? _themeOverride;

        public static event Action? ThemeChanged;

        static FluentTheme()
        {
            try
            {
                SystemEvents.UserPreferenceChanged += (s, e) =>
                {
                    if (e.Category == UserPreferenceCategory.General || e.Category == UserPreferenceCategory.Color)
                    {
                        ThemeChanged?.Invoke();
                    }
                };
            }
            catch { }
        }

        public static void SetThemeOverride(bool? isDark)
        {
            _themeOverride = isDark;
            ThemeChanged?.Invoke();
        }

        public static bool IsDarkTheme
        {
            get
            {
                if (_themeOverride.HasValue) return _themeOverride.Value;
                try
                {
                    object? val = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 1);
                    if (val is int i) return i == 0;
                }
                catch { }
                return false; // Default to clean light enterprise theme if registry cannot be read
            }
        }

        // Adaptive Canvas & Card Tokens
        public static Color ThemeCanvasTop => IsDarkTheme ? GlassCanvasTop : Color.FromArgb(246, 248, 250);
        public static Color ThemeCanvasBottom => IsDarkTheme ? GlassCanvasBottom : Color.FromArgb(240, 243, 246);
        public static Color ThemeCardFill => IsDarkTheme ? GlassCardFill : Color.FromArgb(255, 255, 255);
        public static Color ThemeCardFillSoft => IsDarkTheme ? GlassCardFillSoft : Color.FromArgb(246, 248, 250);
        public static Color ThemeCardHairline => IsDarkTheme ? GlassHairline : Color.FromArgb(226, 232, 240);
        public static Color ThemeCardHairlineStrong => IsDarkTheme ? GlassHairlineStrong : Color.FromArgb(203, 213, 225);
        public static Color ThemeCardHighlight => IsDarkTheme ? Color.FromArgb(12, 255, 255, 255) : Color.Transparent;
        public static Color ThemeInputWell => IsDarkTheme ? Color.FromArgb(20, 20, 23) : Color.FromArgb(255, 255, 255);
        public static Color ThemeInputBorder => IsDarkTheme ? GlassHairline : Color.FromArgb(203, 213, 225);

        // Adaptive Typography Tokens
        public static Color ThemeTextPrimary => IsDarkTheme ? DarkMenuTextPrimary : Color.FromArgb(15, 23, 42); // Slate-900 #0F172A
        public static Color ThemeTextSecondary => IsDarkTheme ? DarkMenuTextSecondary : Color.FromArgb(71, 85, 105); // Slate-600 #475569
        public static Color ThemeTextMuted => IsDarkTheme ? DarkMenuTextMuted : Color.FromArgb(148, 163, 184); // Slate-400 #94A3B8

        // Adaptive Accent Tokens (Dual-Tone: Santos Deep Navy on light, Royal Blue on dark)
        public static Color ThemeAccent => IsDarkTheme ? Accent : NavyBrand;
        public static Color ThemeAccentHover => IsDarkTheme ? AccentHover : NavyHover;
        public static Color ThemeAccentPressed => IsDarkTheme ? AccentPressed : NavyPressed;
        public static Color ThemeAccentSoft => IsDarkTheme ? AccentSoft : Color.FromArgb(239, 246, 255);
        public static Color ThemeAccentText => IsDarkTheme ? AccentText : NavyBrand;

        // Adaptive Menu & Dropdown Tokens
        public static Color ThemeMenuBackground => IsDarkTheme ? DarkMenuBackground : Color.FromArgb(255, 255, 255);
        public static Color ThemeMenuSurface => IsDarkTheme ? DarkMenuSurface : Color.FromArgb(248, 250, 252);
        public static Color ThemeMenuHover => IsDarkTheme ? DarkMenuHover : Color.FromArgb(241, 245, 249);
        public static Color ThemeMenuSelected => IsDarkTheme ? DarkMenuSelected : Color.FromArgb(226, 232, 240);
        public static Color ThemeMenuBorder => IsDarkTheme ? DarkMenuBorder : Color.FromArgb(226, 232, 240);
        public static Color ThemeMenuBorderStrong => IsDarkTheme ? DarkMenuBorderStrong : Color.FromArgb(203, 213, 225);
        public static Color ThemeMenuTextPrimary => IsDarkTheme ? DarkMenuTextPrimary : Color.FromArgb(15, 23, 42);
        public static Color ThemeMenuTextSecondary => IsDarkTheme ? DarkMenuTextSecondary : Color.FromArgb(71, 85, 105);

        // Status Indicators (Solid Muted Corporate, NO Neon Blur)
        public static readonly Color StatusOnline = Color.FromArgb(16, 185, 129); // Emerald-500 #10B981
        public static readonly Color StatusOffline = Color.FromArgb(239, 68, 68); // Rose-500 #EF4444
        public static readonly Color StatusPending = Color.FromArgb(245, 158, 11); // Amber-500 #F59E0B
        public static Color ThemeStatusOnlineBg => IsDarkTheme ? Color.FromArgb(6, 78, 59) : Color.FromArgb(236, 253, 245);
        public static Color ThemeStatusOfflineBg => IsDarkTheme ? Color.FromArgb(127, 29, 29) : Color.FromArgb(254, 242, 242);

        // Status & Priority Tokens (Background, Text, Border)
        public static readonly (Color Bg, Color Text, Color Border) PriorityUrgent = (
            Color.FromArgb(254, 242, 242), // Red-50
            Color.FromArgb(220, 38, 38),   // Red-600
            Color.FromArgb(252, 165, 165)  // Red-300
        );

        public static readonly (Color Bg, Color Text, Color Border) PriorityHigh = (
            Color.FromArgb(255, 251, 235), // Amber-50
            Color.FromArgb(217, 119, 6),   // Amber-600
            Color.FromArgb(253, 230, 138)  // Amber-300
        );

        public static readonly (Color Bg, Color Text, Color Border) PriorityNormal = (
            Color.FromArgb(239, 246, 255), // Blue-50
            Color.FromArgb(37, 99, 235),   // Blue-600
            Color.FromArgb(191, 219, 254)  // Blue-200
        );

        public static readonly (Color Bg, Color Text, Color Border) PrioritySuccess = (
            Color.FromArgb(236, 253, 245), // Emerald-50
            Color.FromArgb(5, 150, 105),   // Emerald-600
            Color.FromArgb(167, 243, 208)  // Emerald-200
        );

        public static (Color Bg, Color Text, Color Border) GetPriorityTheme(string? priority)
        {
            return (priority?.ToLowerInvariant()) switch
            {
                "urgent" => PriorityUrgent,
                "high" => PriorityHigh,
                "low" => PrioritySuccess,
                _ => PriorityNormal
            };
        }

        // ================= 2. TYPOGRAPHY ENGINE =================
        private static readonly string FontFamilyName = GetBestFontFamily();

        private static string GetBestFontFamily()
        {
            using var testFont = new Font("Segoe UI Variable Text", 9F, FontStyle.Regular);
            return testFont.Name.Equals("Segoe UI Variable Text", StringComparison.OrdinalIgnoreCase)
                ? "Segoe UI Variable Text"
                : "Segoe UI";
        }

        public static Font GetFont(float size, FontStyle style = FontStyle.Regular)
        {
            return new Font(FontFamilyName, size, style);
        }

        public static Font Body => GetFont(9F, FontStyle.Regular);
        public static Font BodyBold => GetFont(9F, FontStyle.Bold);
        public static Font BodyMedium => GetFont(9F, FontStyle.Regular);
        public static Font SubText => GetFont(8.5F, FontStyle.Regular);
        public static Font SubTextBold => GetFont(8.5F, FontStyle.Bold);
        public static Font SubTitle => GetFont(10.5F, FontStyle.Bold);
        public static Font Caption => GetFont(8F, FontStyle.Regular);
        public static Font CaptionBold => GetFont(8F, FontStyle.Bold);
        public static Font Title => GetFont(11F, FontStyle.Bold);
        public static Font Headline => GetFont(13F, FontStyle.Bold);

        // ================= 3. GRAPHICS & PATH UTILITIES =================
        public static GraphicsPath CreateRoundedPath(Rectangle rect, int radius)
        {
            var path = new GraphicsPath();
            if (radius <= 0)
            {
                path.AddRectangle(rect);
                return path;
            }

            int diameter = radius * 2;
            if (diameter > rect.Width) diameter = rect.Width;
            if (diameter > rect.Height) diameter = rect.Height;

            path.AddArc(rect.X, rect.Y, diameter, diameter, 180, 90);
            path.AddArc(rect.Right - diameter, rect.Y, diameter, diameter, 270, 90);
            path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rect.X, rect.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void FillRoundedRectangle(Graphics g, Brush brush, Rectangle rect, int radius)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CreateRoundedPath(rect, radius);
            g.FillPath(brush, path);
        }

        public static void DrawRoundedRectangle(Graphics g, Pen pen, Rectangle rect, int radius)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CreateRoundedPath(rect, radius);
            g.DrawPath(pen, path);
        }

        // ================= 4. WINDOWS 11 DWM & WIN32 INTEROP =================
        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        private const int DWMWCP_ROUND = 2;
        private const int DWMWCP_ROUNDSMALL = 3;
        private const int DWMWA_BORDER_COLOR = 34;
        private const int DWMWA_SYSTEMBACKDROP_TYPE = 38;
        private const int DWMSBT_TRANSIENTWINDOW = 3; // Acrylic
        private const int HRESULT_OK = 0;

        // Border colors in DWM BGR order (0x00BBGGRR)
        private const int BorderColorLightSlate = 0x00E1D5CB; // Slate-300 #CBD5E1
        private const int BorderColorDarkHairline = 0x0034322E; // #2E3234 charcoal hairline

        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HTCAPTION = 0x2;

        public static void ApplyWindows11Styles(IntPtr handle)
        {
            try
            {
                int cornerPreference = DWMWCP_ROUND;
                DwmSetWindowAttribute(handle, DWMWA_WINDOW_CORNER_PREFERENCE, ref cornerPreference, sizeof(int));

                int borderColor = BorderColorLightSlate;
                DwmSetWindowAttribute(handle, DWMWA_BORDER_COLOR, ref borderColor, sizeof(int));
            }
            catch
            {
                // Fallback for older Windows builds
            }
        }

        /// <summary>
        /// Applies the dark frosted-glass chrome: immersive dark titlebar, rounded corners,
        /// dark hairline border, and the Windows 11 Acrylic system backdrop.
        /// </summary>
        /// <returns>true when the Acrylic backdrop was accepted by DWM; false when the caller
        /// must paint the simulated frosted layer instead (older builds / composition off).</returns>
        public static bool TryApplyDarkAcrylic(IntPtr handle, bool smallCorners = false)
        {
            try
            {
                int darkMode = IsDarkTheme ? 1 : 0;
                DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));

                int cornerPreference = smallCorners ? DWMWCP_ROUNDSMALL : DWMWCP_ROUND;
                DwmSetWindowAttribute(handle, DWMWA_WINDOW_CORNER_PREFERENCE, ref cornerPreference, sizeof(int));

                int borderColor = IsDarkTheme ? BorderColorDarkHairline : BorderColorLightSlate;
                DwmSetWindowAttribute(handle, DWMWA_BORDER_COLOR, ref borderColor, sizeof(int));

                int backdrop = DWMSBT_TRANSIENTWINDOW;
                int hr = DwmSetWindowAttribute(handle, DWMWA_SYSTEMBACKDROP_TYPE, ref backdrop, sizeof(int));
                return hr == HRESULT_OK;
            }
            catch
            {
                return false;
            }
        }

        // ================= 4b. CLEAN MODERN ENTERPRISE CANVAS PAINTER =================
        /// <summary>
        /// Paints the modern enterprise canvas: clean background with subtle border.
        /// Fully eliminates synthetic grain noise and glowing ambient orbs.
        /// </summary>
        public static void PaintFrostedCanvas(Graphics g, Rectangle bounds, bool acrylicActive)
        {
            if (bounds.Width <= 0 || bounds.Height <= 0) return;

            g.SmoothingMode = SmoothingMode.AntiAlias;
            bool dark = IsDarkTheme;

            Color bgTop = dark ? GlassCanvasTop : Color.FromArgb(246, 248, 250);
            Color bgBot = dark ? GlassCanvasBottom : Color.FromArgb(240, 243, 246);

            if (acrylicActive)
            {
                Color tintColor = dark
                    ? Color.FromArgb(210, GlassCanvasBottom)
                    : Color.FromArgb(235, 246, 248, 250);
                using var tint = new SolidBrush(tintColor);
                g.FillRectangle(tint, bounds);
            }
            else
            {
                using var gradient = new LinearGradientBrush(
                    new Rectangle(bounds.X, bounds.Y, bounds.Width, bounds.Height + 1),
                    bgTop,
                    bgBot,
                    LinearGradientMode.Vertical);
                g.FillRectangle(gradient, bounds);
            }

            // Clean 1px hairline border around the entire canvas
            using var borderPen = new Pen(ThemeCardHairline, 1f);
            g.DrawRectangle(borderPen, bounds.X, bounds.Y, bounds.Width - 1, bounds.Height - 1);
        }

        /// <summary>
        /// Draws a box-less checkmark inside a 16x16 cell anchored at <paramref name="origin"/>.
        /// </summary>
        public static void DrawCheckmark(Graphics g, Point origin, Color color)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;

            using var pen = new Pen(color, 1.7f)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round,
                LineJoin = LineJoin.Round
            };

            g.DrawLines(pen, new[]
            {
                new PointF(origin.X + 3.5f, origin.Y + 8.5f),
                new PointF(origin.X + 6.5f, origin.Y + 11.5f),
                new PointF(origin.X + 12.5f, origin.Y + 4.5f)
            });
        }

        /// <summary>
        /// Draws a clean enterprise card: flat or subtle fill with crisp 1px hairline edge.
        /// </summary>
        public static void PaintGlassCard(Graphics g, Rectangle rect, int radius, Color? fill = null, Color? hairline = null)
        {
            if (rect.Width <= 0 || rect.Height <= 0) return;

            g.SmoothingMode = SmoothingMode.AntiAlias;
            var body = new Rectangle(rect.X, rect.Y, rect.Width - 1, rect.Height - 1);

            using (var brush = new SolidBrush(fill ?? ThemeCardFill))
            {
                FillRoundedRectangle(g, brush, body, radius);
            }

            using (var edge = new Pen(hairline ?? ThemeCardHairline, 1f))
            {
                DrawRoundedRectangle(g, edge, body, radius);
            }
        }

        /// <summary>
        /// Draws a clean 8px solid status dot (emerald green for online, rose red for offline).
        /// </summary>
        public static void DrawStatusDot(Graphics g, int x, int y, bool isOnline, int size = 8)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            Color dotColor = isOnline ? StatusOnline : StatusOffline;
            using var brush = new SolidBrush(dotColor);
            g.FillEllipse(brush, x, y, size, size);
        }

        public static void EnableWindowDrag(IntPtr hwnd, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(hwnd, WM_NCLBUTTONDOWN, (IntPtr)HTCAPTION, IntPtr.Zero);
            }
        }

        public static void DrawRoundedImage(Graphics g, Image img, Rectangle targetRect, int radius)
        {
            using var path = CreateRoundedPath(targetRect, radius);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            var oldClip = g.Clip;
            g.SetClip(path, CombineMode.Intersect);
            g.DrawImage(img, targetRect);
            g.Clip = oldClip;

            using var borderPen = new Pen(BorderSubtle, 1);
            g.DrawPath(borderPen, path);
        }

        // ================= 5. VECTOR GLYPH GENERATOR (16x16 Menu Icons) =================
        public static Bitmap GetMenuIcon(string iconName, Color? tintColor = null)
        {
            var bmp = new Bitmap(16, 16);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.Clear(Color.Transparent);

            Color c = tintColor ?? TextSecondary;
            using var pen = new Pen(c, 1.3f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
            using var brush = new SolidBrush(c);

            switch (iconName.ToLowerInvariant())
            {
                case "user":
                    g.DrawEllipse(pen, 5f, 2f, 5f, 5f);
                    g.DrawArc(pen, 2.5f, 8.5f, 10f, 6.5f, 190, 160);
                    break;

                case "browser":
                case "globe":
                    g.DrawEllipse(pen, 2f, 2f, 11f, 11f);
                    g.DrawLine(pen, 2f, 7.5f, 13f, 7.5f);
                    g.DrawEllipse(pen, 5f, 2f, 5f, 11f);
                    break;

                case "portal":
                case "idesk":
                    using (var pBrush = new SolidBrush(c))
                    {
                        g.FillRectangle(pBrush, 2, 2, 5, 5);
                        g.FillRectangle(pBrush, 9, 2, 5, 5);
                        g.FillRectangle(pBrush, 2, 9, 5, 5);
                        g.FillRectangle(pBrush, 9, 9, 5, 5);
                    }
                    break;

                case "history":
                    g.DrawEllipse(pen, 2f, 2f, 11f, 11f);
                    g.DrawLine(pen, 7.5f, 4.5f, 7.5f, 7.5f);
                    g.DrawLine(pen, 7.5f, 7.5f, 10.5f, 7.5f);
                    break;

                case "archive":
                    g.DrawRectangle(pen, 2f, 3f, 11f, 9f);
                    g.DrawLine(pen, 2f, 6.5f, 13f, 6.5f);
                    g.DrawLine(pen, 6f, 9f, 9f, 9f);
                    break;

                case "test":
                case "bell":
                    g.DrawArc(pen, 4f, 3f, 7f, 8f, 180, 180);
                    g.DrawLine(pen, 3f, 11f, 12f, 11f);
                    g.DrawLine(pen, 4f, 7f, 3f, 11f);
                    g.DrawLine(pen, 11f, 7f, 12f, 11f);
                    g.FillEllipse(brush, 6.5f, 11.5f, 2f, 2f);
                    break;

                case "settings":
                    g.DrawEllipse(pen, 4f, 4f, 7f, 7f);
                    g.DrawLine(pen, 7.5f, 1.5f, 7.5f, 4f);
                    g.DrawLine(pen, 7.5f, 11f, 7.5f, 13.5f);
                    g.DrawLine(pen, 1.5f, 7.5f, 4f, 7.5f);
                    g.DrawLine(pen, 11f, 7.5f, 13.5f, 7.5f);
                    break;

                case "startup":
                    g.DrawRectangle(pen, 2.5f, 2.5f, 10f, 10f);
                    g.DrawLine(pen, 4.5f, 7.5f, 6.5f, 9.5f);
                    g.DrawLine(pen, 6.5f, 9.5f, 10.5f, 5.5f);
                    break;

                case "exit":
                    using (var redPen = new Pen(Color.FromArgb(239, 68, 68), 1.3f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                    {
                        g.DrawLine(redPen, 7f, 2.5f, 3f, 2.5f);
                        g.DrawLine(redPen, 3f, 2.5f, 3f, 12.5f);
                        g.DrawLine(redPen, 3f, 12.5f, 7f, 12.5f);
                        g.DrawLine(redPen, 6f, 7.5f, 13f, 7.5f);
                        g.DrawLine(redPen, 10.5f, 5f, 13f, 7.5f);
                        g.DrawLine(redPen, 10.5f, 10f, 13f, 7.5f);
                    }
                    break;

                case "remote":
                    // Monitor frame + stand, with a small remote-session c‍ursor inside.
                    g.DrawRectangle(pen, 1.8f, 2.5f, 12.4f, 8.5f);
                    g.DrawLine(pen, 6f, 13.5f, 10f, 13.5f);
                    g.DrawLine(pen, 8f, 11f, 8f, 13.5f);
                    using (var arrowPath = new GraphicsPath())
                    {
                        arrowPath.AddPolygon(new[]
                        {
                            new PointF(6.2f, 4.8f),
                            new PointF(10.2f, 6.9f),
                            new PointF(8.4f, 7.3f),
                            new PointF(9.3f, 9.1f),
                            new PointF(8.2f, 9.6f),
                            new PointF(7.4f, 7.8f),
                            new PointF(6.2f, 8.9f)
                        });
                        g.FillPath(brush, arrowPath);
                    }
                    break;

                case "close":
                    g.DrawLine(pen, 4.5f, 4.5f, 11.5f, 11.5f);
                    g.DrawLine(pen, 11.5f, 4.5f, 4.5f, 11.5f);
                    break;

                case "minimize":
                    g.DrawLine(pen, 4.5f, 8f, 11.5f, 8f);
                    break;

                case "chevron-down":
                    g.DrawLines(pen, new[]
                    {
                        new PointF(4.5f, 6.5f),
                        new PointF(8f, 10f),
                        new PointF(11.5f, 6.5f)
                    });
                    break;
            }

            return bmp;
        }

        // ================= 6. MULTI-FRAME 32-BIT ICO BUILDER =================
        public static void CreateMultiFrameIco(Image sourceImg, string outPath, int[]? customSizes = null)
        {
            int[] sizes = customSizes ?? new int[] { 16, 24, 32, 48, 64, 128, 256 };
            var pngStreams = new System.Collections.Generic.List<byte[]>();

            foreach (int sz in sizes)
            {
                using var bmp = new Bitmap(sz, sz);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.Clear(Color.Transparent);

                    // High-contrast circular white badge
                    using var bgBrush = new SolidBrush(Color.White);
                    g.FillEllipse(bgBrush, 0.5f, 0.5f, sz - 1f, sz - 1f);

                    using var borderPen = new Pen(Color.FromArgb(203, 213, 225), Math.Max(1f, sz / 32f));
                    g.DrawEllipse(borderPen, 0.5f, 0.5f, sz - 1f, sz - 1f);

                    // Centered logo inside with balanced padding
                    int pad = (int)Math.Max(2, sz * 0.16f);
                    g.DrawImage(sourceImg, new Rectangle(pad, pad, sz - pad * 2, sz - pad * 2));
                }

                using var ms = new System.IO.MemoryStream();
                bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                pngStreams.Add(ms.ToArray());
            }

            var dir = System.IO.Path.GetDirectoryName(outPath);
            if (!string.IsNullOrEmpty(dir)) System.IO.Directory.CreateDirectory(dir);

            using var fs = new System.IO.FileStream(outPath, System.IO.FileMode.Create, System.IO.FileAccess.Write);
            using var bw = new System.IO.BinaryWriter(fs);

            bw.Write((short)0); // reserved
            bw.Write((short)1); // type 1 = ICO
            bw.Write((short)sizes.Length); // count

            int offset = 6 + (16 * sizes.Length);
            for (int i = 0; i < sizes.Length; i++)
            {
                int sz = sizes[i];
                byte[] png = pngStreams[i];
                bw.Write((byte)(sz >= 256 ? 0 : sz));
                bw.Write((byte)(sz >= 256 ? 0 : sz));
                bw.Write((byte)0); // colors
                bw.Write((byte)0); // reserved
                bw.Write((short)1); // planes
                bw.Write((short)32); // bitCount
                bw.Write((int)png.Length);
                bw.Write((int)offset);
                offset += png.Length;
            }

            foreach (var png in pngStreams)
            {
                bw.Write(png);
            }
        }
    }
}
