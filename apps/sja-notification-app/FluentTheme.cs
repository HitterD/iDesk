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
        // Nilai mentah ada di ThemeTokens.cs. Semua akses lewat properti adaptif di bawah.

        /// <summary>Navy merek Santos. Hanya untuk logo — bukan warna antarmuka.</summary>
        public static readonly Color NavyBrand = ThemeTokens.NavyBrand;

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
                        if (_themeMode == "system")
                        {
                            ThemeChanged?.Invoke();
                        }
                    }
                };
            }
            catch { }
        }

        private static string _themeMode = "light"; // "light" | "dark" | "system"

        public static string CurrentThemeMode => _themeMode;

        public static void SetThemeMode(string mode)
        {
            _themeMode = string.IsNullOrWhiteSpace(mode) ? "light" : mode.Trim().ToLowerInvariant();
            ThemeChanged?.Invoke();
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
                if (_themeMode == "light") return false;
                if (_themeMode == "dark") return true;

                // "system" mode: read Windows registry
                try
                {
                    object? val = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 1);
                    if (val is int i) return i == 0;
                }
                catch { }
                return false; // Default to light mode if unreadable
            }
        }

        // Adaptive Canvas & Card Tokens
        public static Color ThemeCanvasTop => IsDarkTheme ? ThemeTokens.DarkCanvas : ThemeTokens.LightCanvas;
        public static Color ThemeCanvasBottom => IsDarkTheme ? ThemeTokens.DarkCanvasBottom : ThemeTokens.LightCanvasBottom;
        public static Color ThemeSidebar => IsDarkTheme ? ThemeTokens.DarkSidebar : ThemeTokens.LightSidebar;
        public static Color ThemeSurface => IsDarkTheme ? ThemeTokens.DarkSurface : ThemeTokens.LightSurface;
        public static Color ThemeSurfaceSoft => IsDarkTheme ? ThemeTokens.DarkSurfaceSoft : ThemeTokens.LightSurfaceSoft;
        public static Color ThemeCardFill => IsDarkTheme ? ThemeTokens.DarkSurface : ThemeTokens.LightSurface;
        public static Color ThemeCardFillSoft => IsDarkTheme ? ThemeTokens.DarkSurfaceSoft : ThemeTokens.LightSurfaceSoft;
        public static Color ThemeCardHairline => IsDarkTheme ? ThemeTokens.DarkHairline : ThemeTokens.LightHairline;
        public static Color ThemeCardHairlineStrong => IsDarkTheme ? ThemeTokens.DarkHairlineStrong : ThemeTokens.LightHairlineStrong;
        public static Color ThemeCardHighlight => IsDarkTheme ? ThemeTokens.DarkHighlight : ThemeTokens.LightHighlight;
        public static Color ThemeHover => IsDarkTheme ? ThemeTokens.DarkHover : ThemeTokens.LightHover;
        public static Color ThemeInputWell => IsDarkTheme ? ThemeTokens.DarkWell : ThemeTokens.LightWell;
        public static Color ThemeInputBorder => IsDarkTheme ? ThemeTokens.DarkInputBorder : ThemeTokens.LightInputBorder;

        // Adaptive Typography Tokens
        public static Color ThemeTextPrimary => IsDarkTheme ? ThemeTokens.DarkTextPrimary : ThemeTokens.LightTextPrimary;
        public static Color ThemeTextSecondary => IsDarkTheme ? ThemeTokens.DarkTextSecondary : ThemeTokens.LightTextSecondary;
        public static Color ThemeTextMuted => IsDarkTheme ? ThemeTokens.DarkTextMuted : ThemeTokens.LightTextMuted;

        // Adaptive Accent Tokens
        public static Color ThemeAccent => IsDarkTheme ? ThemeTokens.DarkAccent : ThemeTokens.LightAccent;
        public static Color ThemeAccentHover => IsDarkTheme ? ThemeTokens.DarkAccentHover : ThemeTokens.LightAccentHover;
        public static Color ThemeAccentPressed => IsDarkTheme ? ThemeTokens.DarkAccentPressed : ThemeTokens.LightAccentPressed;
        public static Color ThemeAccentSoft => IsDarkTheme ? ThemeTokens.DarkAccentSoft : ThemeTokens.LightAccentSoft;
        public static Color ThemeAccentText => ThemeAccent;

        // Adaptive Menu & Dropdown Tokens
        public static Color ThemeMenuBackground => IsDarkTheme ? ThemeTokens.DarkMenuBackground : ThemeTokens.LightMenuBackground;
        public static Color ThemeMenuSurface => IsDarkTheme ? ThemeTokens.DarkMenuSurface : ThemeTokens.LightMenuSurface;
        public static Color ThemeMenuHover => IsDarkTheme ? ThemeTokens.DarkMenuHover : ThemeTokens.LightMenuHover;
        public static Color ThemeMenuSelected => IsDarkTheme ? ThemeTokens.DarkMenuSelected : ThemeTokens.LightMenuSelected;
        public static Color ThemeMenuBorder => IsDarkTheme ? ThemeTokens.DarkMenuBorder : ThemeTokens.LightMenuBorder;
        public static Color ThemeMenuBorderStrong => IsDarkTheme ? ThemeTokens.DarkMenuBorderStrong : ThemeTokens.LightMenuBorderStrong;
        public static Color ThemeMenuTextPrimary => ThemeTextPrimary;
        public static Color ThemeMenuTextSecondary => ThemeTextSecondary;

        // Status Tokens
        public static Color ThemeStatusOnline => IsDarkTheme ? ThemeTokens.DarkOnline : ThemeTokens.LightOnline;
        public static Color ThemeStatusWarn => IsDarkTheme ? ThemeTokens.DarkWarn : ThemeTokens.LightWarn;
        public static Color ThemeStatusCritical => IsDarkTheme ? ThemeTokens.DarkCritical : ThemeTokens.LightCritical;
        public static Color ThemeStatusCriticalText => IsDarkTheme ? ThemeTokens.DarkCriticalInk : ThemeTokens.LightCriticalInk;
        public static Color ThemeStatusOnlineBg => Color.FromArgb(IsDarkTheme ? 28 : 24, ThemeStatusOnline);
        public static Color ThemeStatusOfflineBg => Color.FromArgb(IsDarkTheme ? 28 : 24, ThemeStatusCritical);

        // Kompatibilitas pemanggil lama — dipetakan ke token status.
        public static Color StatusOnline => ThemeStatusOnline;
        public static Color StatusOffline => ThemeStatusCritical;
        public static Color StatusPending => ThemeStatusWarn;

        // Status & Priority Tokens
        public static (Color Bg, Color Text, Color Border) GetPriorityTheme(string? priority)
        {
            string p = priority?.ToLowerInvariant() ?? "";

            Color accent;
            if (p == "critical" || p == "blocker") accent = ThemeStatusCritical;
            else if (p == "high" || p == "urgent") accent = ThemeStatusWarn;
            else if (p == "low") accent = ThemeStatusOnline;
            else accent = ThemeAccent;

            return (
                Color.FromArgb(IsDarkTheme ? 32 : 22, accent),
                accent,
                Color.FromArgb(IsDarkTheme ? 72 : 64, accent)
            );
        }

        // ---- Token gelap tetap, untuk permukaan yang selalu gelap (viewer remote) ----
        public static Color FixedDarkCanvas => ThemeTokens.DarkCanvas;
        public static Color FixedDarkSurface => ThemeTokens.DarkSurface;
        public static Color FixedDarkTextPrimary => ThemeTokens.DarkTextPrimary;
        public static Color FixedDarkTextSecondary => ThemeTokens.DarkTextSecondary;
        public static Color FixedDarkHairline => ThemeTokens.DarkHairline;
        public static Color FixedDarkOnline => ThemeTokens.DarkOnline;
        public static Color FixedDarkWarn => ThemeTokens.DarkWarn;
        public static Color FixedDarkCritical => ThemeTokens.DarkCritical;

        public static string GetPriorityDisplayLabel(string? priority)
        {
            string p = priority?.ToLowerInvariant() ?? "";
            if (p == "critical" || p == "blocker") return "Blocker";
            if (p == "high" || p == "urgent") return "Urgent";
            if (p == "low") return "Low";
            if (p == "medium" || p == "normal") return "Normal";
            return !string.IsNullOrWhiteSpace(priority) ? priority.ToUpperInvariant() : "INFO";
        }

        // ================= 2. TYPOGRAPHY ENGINE =================
        private static readonly string FontFamilyName = GetBestFontFamily();

        private static string GetBestFontFamily()
        {
            string[] candidates = { "Segoe UI Variable Text", "Segoe UI", "Arial" };
            foreach (var name in candidates)
            {
                try
                {
                    using var testFont = new Font(name, 9F, FontStyle.Regular);
                    if (testFont.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                    {
                        return name;
                    }
                }
                catch { }
            }
            return "Segoe UI";
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

        /// <summary>
        /// Cubic Ease-Out curve for ultra-smooth 60 FPS Apple-like transitions.
        /// </summary>
        public static float EaseOutCubic(float t)
        {
            float f = Math.Clamp(t, 0.0f, 1.0f) - 1.0f;
            return f * f * f + 1.0f;
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

            Color bgTop = ThemeCanvasTop;
            Color bgBot = ThemeCanvasBottom;

            if (acrylicActive)
            {
                // Semi-translucent tint allowing Windows 11 DWM Acrylic/Mica to breathe through
                Color tintColor = Color.FromArgb(dark ? 170 : 175, ThemeCanvasBottom);
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
        /// Draws a modern macOS Sequoia Translucent Glass card:
        /// Frosted glass surface, multi-pass ambient shadow, and 1px specular top highlight.
        /// </summary>
        public static void PaintGlassCard(Graphics g, Rectangle rect, int radius, Color? fill = null, Color? hairline = null, bool drawShadow = true)
        {
            if (rect.Width <= 0 || rect.Height <= 0) return;

            g.SmoothingMode = SmoothingMode.AntiAlias;
            var body = new Rectangle(rect.X, rect.Y, rect.Width - 1, rect.Height - 1);

            if (drawShadow && rect.Height > 10 && rect.Width > 10)
            {
                if (!IsDarkTheme)
                {
                    // Multi-pass soft Apple ambient shadow
                    var shadow1 = new Rectangle(rect.X, rect.Y + 1, rect.Width - 1, rect.Height);
                    using var b1 = new SolidBrush(Color.FromArgb(10, 0, 0, 0));
                    FillRoundedRectangle(g, b1, shadow1, radius);

                    var shadow2 = new Rectangle(rect.X, rect.Y + 3, rect.Width - 1, rect.Height);
                    using var b2 = new SolidBrush(Color.FromArgb(5, 0, 0, 0));
                    FillRoundedRectangle(g, b2, shadow2, radius);
                }
                else
                {
                    var shadowDark = new Rectangle(rect.X, rect.Y + 2, rect.Width - 1, rect.Height);
                    using var bDark = new SolidBrush(Color.FromArgb(28, 0, 0, 0));
                    FillRoundedRectangle(g, bDark, shadowDark, radius);
                }
            }

            // Glass Fill
            Color cardFill = fill ?? ThemeCardFill;
            using (var brush = new SolidBrush(cardFill))
            {
                FillRoundedRectangle(g, brush, body, radius);
            }

            // Outer Hairline Border
            Color edgeColor = hairline ?? ThemeCardHairline;
            using (var edge = new Pen(edgeColor, 1f))
            {
                DrawRoundedRectangle(g, edge, body, radius);
            }

            // Specular Top Highlight (macOS physical glass inner reflection along top border)
            if (body.Width > 14 && body.Height > 14)
            {
                Color specularColor = IsDarkTheme
                    ? Color.FromArgb(32, 255, 255, 255)
                    : Color.FromArgb(175, 255, 255, 255);
                using var specularPen = new Pen(specularColor, 1f);
                int d = Math.Max(2, (radius - 1) * 2);
                int arcH = Math.Min(body.Height - 2, d);
                using var path = new GraphicsPath();
                path.AddArc(body.X + 1, body.Y + 1, d, arcH, 180, 90);
                path.AddLine(body.X + 1 + radius, body.Y + 1, body.Right - 1 - radius, body.Y + 1);
                path.AddArc(body.Right - 1 - d, body.Y + 1, d, arcH, 270, 90);
                g.DrawPath(specularPen, path);
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

            using var borderPen = new Pen(ThemeCardHairline, 1);
            g.DrawPath(borderPen, path);
        }

        // ================= 5. VECTOR GLYPH GENERATOR (Adaptive Size Vector Icons) =================
        private const int GearTeeth = 8;
        private const float GearCenter = 7.75f;
        private const float GearOuterRadius = 6.3f;
        private const float GearRootRadius = 4.6f;
        private const float GearHubRadius = 2.2f;

        /// <summary>
        /// Menggambar ikon gear (cogwheel) 8 gigi pada kanvas glyph 16x16.
        /// Profil gigi dihitung trigonometris agar simetris di semua ukuran skala.
        /// </summary>
        private static void DrawGearGlyph(Graphics g, Pen pen)
        {
            using var path = new GraphicsPath();
            float step = (float)(Math.PI * 2.0 / GearTeeth);
            float half = step / 2f;
            float toothSpan = half * 0.52f;
            var points = new System.Collections.Generic.List<PointF>();

            for (int i = 0; i < GearTeeth; i++)
            {
                float mid = i * step;
                points.Add(GearPoint(mid - toothSpan, GearOuterRadius));
                points.Add(GearPoint(mid + toothSpan, GearOuterRadius));
                points.Add(GearPoint(mid + half - toothSpan * 0.55f, GearRootRadius));
                points.Add(GearPoint(mid + half + toothSpan * 0.55f, GearRootRadius));
            }

            path.AddPolygon(points.ToArray());
            g.DrawPath(pen, path);
            g.DrawEllipse(pen, GearCenter - GearHubRadius, GearCenter - GearHubRadius, GearHubRadius * 2f, GearHubRadius * 2f);
        }

        private static PointF GearPoint(float angleRadians, float radius)
        {
            return new PointF(
                GearCenter + radius * (float)Math.Cos(angleRadians),
                GearCenter + radius * (float)Math.Sin(angleRadians));
        }

        public static Bitmap GetMenuIcon(string iconName, Color? tintColor = null, int size = 16)
        {
            if (size <= 0) size = 16;
            var bmp = new Bitmap(size, size);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.Clear(Color.Transparent);

            if (size != 16)
            {
                float scale = size / 16f;
                g.ScaleTransform(scale, scale);
            }

            Color c = tintColor ?? ThemeTextSecondary;
            using var pen = new Pen(c, 1.3f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
            using var brush = new SolidBrush(c);

            switch (iconName.ToLowerInvariant())
            {
                case "home":
                    g.DrawLine(pen, 2.5f, 7.5f, 8f, 2.5f);
                    g.DrawLine(pen, 8f, 2.5f, 13.5f, 7.5f);
                    g.DrawLine(pen, 4f, 7f, 4f, 13.5f);
                    g.DrawLine(pen, 12f, 7f, 12f, 13.5f);
                    g.DrawLine(pen, 4f, 13.5f, 12f, 13.5f);
                    g.DrawRectangle(pen, 6.5f, 9.5f, 3f, 4f);
                    break;

                case "sun":
                    g.DrawEllipse(pen, 5f, 5f, 6f, 6f);
                    g.DrawLine(pen, 8f, 1.5f, 8f, 3.5f);
                    g.DrawLine(pen, 8f, 12.5f, 8f, 14.5f);
                    g.DrawLine(pen, 1.5f, 8f, 3.5f, 8f);
                    g.DrawLine(pen, 12.5f, 8f, 14.5f, 8f);
                    g.DrawLine(pen, 3.5f, 3.5f, 5f, 5f);
                    g.DrawLine(pen, 11f, 11f, 12.5f, 12.5f);
                    g.DrawLine(pen, 3.5f, 12.5f, 5f, 11f);
                    g.DrawLine(pen, 11f, 5f, 12.5f, 3.5f);
                    break;

                case "moon":
                    using (var moonPath = new GraphicsPath())
                    {
                        moonPath.AddArc(3f, 2.5f, 10f, 11f, -80, 230);
                        moonPath.AddArc(5.5f, 4f, 7.5f, 8f, 130, -180);
                        moonPath.CloseFigure();
                        g.DrawPath(pen, moonPath);
                    }
                    break;

                case "lock":
                    g.DrawArc(pen, 5f, 2.5f, 6f, 6f, 180, 180);
                    g.DrawLine(pen, 5f, 5.5f, 5f, 7f);
                    g.DrawLine(pen, 11f, 5.5f, 11f, 7f);
                    g.DrawRectangle(pen, 3.5f, 7f, 9f, 6.5f);
                    g.FillEllipse(brush, 7f, 9.5f, 2f, 2f);
                    break;

                case "plus":
                    g.DrawLine(pen, 8f, 3.5f, 8f, 12.5f);
                    g.DrawLine(pen, 3.5f, 8f, 12.5f, 8f);
                    break;

                case "trash":
                    g.DrawLine(pen, 3f, 4.5f, 13f, 4.5f);
                    g.DrawLine(pen, 6f, 2.5f, 10f, 2.5f);
                    g.DrawLine(pen, 4.5f, 4.5f, 5.2f, 13.5f);
                    g.DrawLine(pen, 11.5f, 4.5f, 10.8f, 13.5f);
                    g.DrawLine(pen, 5.2f, 13.5f, 10.8f, 13.5f);
                    g.DrawLine(pen, 7f, 6.5f, 7f, 11.5f);
                    g.DrawLine(pen, 9f, 6.5f, 9f, 11.5f);
                    break;

                case "check":
                    g.DrawLine(pen, 3.5f, 8f, 6.5f, 11.5f);
                    g.DrawLine(pen, 6.5f, 11.5f, 12.5f, 4.5f);
                    break;

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
                    using (var arcPath = CreateRoundedPath(new Rectangle(2, 3, 11, 9), 2))
                        g.DrawPath(pen, arcPath);
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
                    // Cogwheel/gear: 8 gigi mengelilingi lubang poros di tengah.
                    DrawGearGlyph(g, pen);
                    break;

                case "startup":
                    using (var stPath = CreateRoundedPath(new Rectangle(2, 2, 11, 11), 2))
                        g.DrawPath(pen, stPath);
                    g.DrawLine(pen, 4.5f, 7.5f, 6.5f, 9.5f);
                    g.DrawLine(pen, 6.5f, 9.5f, 10.5f, 5.5f);
                    break;

                case "exit":
                    g.DrawLine(pen, 7f, 2.5f, 3f, 2.5f);
                    g.DrawLine(pen, 3f, 2.5f, 3f, 12.5f);
                    g.DrawLine(pen, 3f, 12.5f, 7f, 12.5f);
                    g.DrawLine(pen, 6f, 7.5f, 13f, 7.5f);
                    g.DrawLine(pen, 10.5f, 5f, 13f, 7.5f);
                    g.DrawLine(pen, 10.5f, 10f, 13f, 7.5f);
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

                case "chevron-right":
                    g.DrawLines(pen, new[]
                    {
                        new PointF(6.5f, 4.5f),
                        new PointF(10f, 8f),
                        new PointF(6.5f, 11.5f)
                    });
                    break;

                case "maximize":
                    g.DrawRectangle(pen, 4f, 4f, 8f, 8f);
                    break;

                case "restore":
                    g.DrawRectangle(pen, 3f, 6f, 7f, 7f);
                    g.DrawLine(pen, 6f, 3.5f, 12.5f, 3.5f);
                    g.DrawLine(pen, 12.5f, 3.5f, 12.5f, 10f);
                    break;

                case "external":
                    g.DrawLine(pen, 7f, 3f, 3.5f, 3f);
                    g.DrawLine(pen, 3.5f, 3f, 3.5f, 12.5f);
                    g.DrawLine(pen, 3.5f, 12.5f, 13f, 12.5f);
                    g.DrawLine(pen, 13f, 12.5f, 13f, 9f);
                    g.DrawLine(pen, 8.5f, 7.5f, 13f, 3f);
                    g.DrawLine(pen, 9.5f, 3f, 13f, 3f);
                    g.DrawLine(pen, 13f, 3f, 13f, 6.5f);
                    break;

                case "search":
                    g.DrawEllipse(pen, 3f, 3f, 8f, 8f);
                    g.DrawLine(pen, 10f, 10f, 13.5f, 13.5f);
                    break;

                case "refresh":
                    g.DrawArc(pen, 3f, 3f, 10f, 10f, 60, 250);
                    g.DrawLines(pen, new[]
                    {
                        new PointF(9.5f, 1.5f),
                        new PointF(12.8f, 4.2f),
                        new PointF(9.3f, 6f)
                    });
                    break;

                case "warning":
                    g.DrawLines(pen, new[]
                    {
                        new PointF(8f, 2.5f),
                        new PointF(14f, 13f),
                        new PointF(2f, 13f),
                        new PointF(8f, 2.5f)
                    });
                    g.DrawLine(pen, 8f, 6f, 8f, 9.5f);
                    g.FillEllipse(brush, 7.2f, 10.8f, 1.6f, 1.6f);
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
