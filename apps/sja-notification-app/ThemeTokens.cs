using System.Drawing;

namespace SJANotificationApp
{
    /// <summary>
    /// Nilai warna mentah untuk tema terang dan gelap.
    /// Hanya dibaca oleh FluentTheme; berkas lain memakai properti FluentTheme.
    /// </summary>
    internal static class ThemeTokens
    {
        // ---- Terang ----
        internal static readonly Color LightCanvas = Color.FromArgb(245, 245, 247);
        internal static readonly Color LightCanvasBottom = Color.FromArgb(240, 240, 244);
        internal static readonly Color LightSidebar = Color.FromArgb(241, 241, 244);
        internal static readonly Color LightSurface = Color.FromArgb(255, 255, 255);
        internal static readonly Color LightSurfaceSoft = Color.FromArgb(250, 250, 250);
        internal static readonly Color LightWell = Color.FromArgb(242, 242, 245);
        internal static readonly Color LightHairline = Color.FromArgb(23, 0, 0, 0);
        internal static readonly Color LightHairlineStrong = Color.FromArgb(40, 0, 0, 0);
        internal static readonly Color LightHighlight = Color.FromArgb(175, 255, 255, 255);
        internal static readonly Color LightHover = Color.FromArgb(10, 0, 0, 0);
        internal static readonly Color LightInputBorder = Color.FromArgb(209, 209, 214);
        internal static readonly Color LightTextPrimary = Color.FromArgb(29, 29, 31);
        internal static readonly Color LightTextSecondary = Color.FromArgb(94, 94, 99);
        internal static readonly Color LightTextMuted = Color.FromArgb(142, 142, 147);
        internal static readonly Color LightAccent = Color.FromArgb(0, 113, 227);
        internal static readonly Color LightAccentHover = Color.FromArgb(0, 122, 255);
        internal static readonly Color LightAccentPressed = Color.FromArgb(0, 88, 176);
        internal static readonly Color LightAccentSoft = Color.FromArgb(235, 244, 255);
        internal static readonly Color LightOnline = Color.FromArgb(36, 138, 61);
        internal static readonly Color LightWarn = Color.FromArgb(178, 80, 0);
        internal static readonly Color LightCritical = Color.FromArgb(201, 37, 45);
        internal static readonly Color LightCriticalInk = Color.FromArgb(255, 255, 255);
        internal static readonly Color LightMenuBackground = Color.FromArgb(255, 255, 255);
        internal static readonly Color LightMenuSurface = Color.FromArgb(245, 245, 247);
        internal static readonly Color LightMenuHover = Color.FromArgb(235, 235, 240);
        internal static readonly Color LightMenuSelected = Color.FromArgb(224, 238, 255);
        internal static readonly Color LightMenuBorder = Color.FromArgb(229, 229, 234);
        internal static readonly Color LightMenuBorderStrong = Color.FromArgb(209, 209, 214);

        // ---- Gelap ----
        internal static readonly Color DarkCanvas = Color.FromArgb(28, 28, 30);
        internal static readonly Color DarkCanvasBottom = Color.FromArgb(22, 22, 24);
        internal static readonly Color DarkSidebar = Color.FromArgb(32, 32, 34);
        internal static readonly Color DarkSurface = Color.FromArgb(37, 37, 39);
        internal static readonly Color DarkSurfaceSoft = Color.FromArgb(43, 43, 46);
        internal static readonly Color DarkWell = Color.FromArgb(26, 26, 28);
        internal static readonly Color DarkHairline = Color.FromArgb(28, 255, 255, 255);
        internal static readonly Color DarkHairlineStrong = Color.FromArgb(48, 255, 255, 255);
        internal static readonly Color DarkHighlight = Color.FromArgb(28, 255, 255, 255);
        internal static readonly Color DarkHover = Color.FromArgb(18, 255, 255, 255);
        internal static readonly Color DarkInputBorder = Color.FromArgb(56, 56, 60);
        internal static readonly Color DarkTextPrimary = Color.FromArgb(245, 245, 247);
        internal static readonly Color DarkTextSecondary = Color.FromArgb(174, 174, 178);
        internal static readonly Color DarkTextMuted = Color.FromArgb(142, 142, 147);
        internal static readonly Color DarkAccent = Color.FromArgb(10, 132, 255);
        internal static readonly Color DarkAccentHover = Color.FromArgb(64, 156, 255);
        internal static readonly Color DarkAccentPressed = Color.FromArgb(0, 113, 227);
        internal static readonly Color DarkAccentSoft = Color.FromArgb(26, 44, 76);
        internal static readonly Color DarkOnline = Color.FromArgb(48, 209, 88);
        internal static readonly Color DarkWarn = Color.FromArgb(255, 159, 10);
        internal static readonly Color DarkCritical = Color.FromArgb(255, 105, 97);
        internal static readonly Color DarkCriticalInk = Color.FromArgb(28, 28, 30);
        internal static readonly Color DarkMenuBackground = Color.FromArgb(32, 32, 34);
        internal static readonly Color DarkMenuSurface = Color.FromArgb(40, 40, 44);
        internal static readonly Color DarkMenuHover = Color.FromArgb(50, 50, 56);
        internal static readonly Color DarkMenuSelected = Color.FromArgb(26, 44, 76);
        internal static readonly Color DarkMenuBorder = Color.FromArgb(56, 56, 60);
        internal static readonly Color DarkMenuBorderStrong = Color.FromArgb(72, 72, 76);

        // ---- Merek (tidak bertema; hanya untuk logo) ----
        internal static readonly Color NavyBrand = Color.FromArgb(15, 58, 117);
    }
}
