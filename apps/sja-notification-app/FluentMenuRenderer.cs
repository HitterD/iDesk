using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.CompilerServices;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Dark Enterprise Theme ContextMenuStrip Renderer (Docker Desktop / Visual Studio Code style).
    /// Provides deep-charcoal matte surface, refined rounded item highlights, seamless icon spacing,
    /// and crisp monochrome vector accents.
    /// </summary>
    public class FluentMenuRenderer : ToolStripProfessionalRenderer
    {
        private const int MenuCornerRadius = 8;

        // Acrylic is applied once per drop-down window handle; the cached result tells the painter
        // whether it must simulate the frost instead. Weak keys so closed drop-downs are collectable.
        private static readonly ConditionalWeakTable<ToolStrip, AcrylicState> AcrylicStates = new ConditionalWeakTable<ToolStrip, AcrylicState>();

        public FluentMenuRenderer() : base(new AdaptiveEnterpriseColorTable())
        {
            // DWM rounds the actual window; GDI corner rounding on top of it would double-draw.
            RoundedEdges = false;
        }

        private static bool EnsureAcrylic(ToolStrip strip)
        {
            var state = AcrylicStates.GetOrCreateValue(strip);
            if (!strip.IsHandleCreated) return state.Active;

            IntPtr handle = strip.Handle;
            if (state.Handle != handle)
            {
                state.Handle = handle;
                state.Active = FluentTheme.TryApplyDarkAcrylic(handle, smallCorners: true);
            }

            return state.Active;
        }

        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
        {
            bool acrylicActive = EnsureAcrylic(e.ToolStrip);
            FluentTheme.PaintFrostedCanvas(e.Graphics, e.AffectedBounds, acrylicActive);
        }

        protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
        {
            // Intentionally empty: the frosted canvas already covers this column, and any fill here
            // would reintroduce the retro separator margin.
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
            using var pen = new Pen(FluentTheme.ThemeCardHairline, 1);
            FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, MenuCornerRadius);
        }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (e.Item.IsOnDropDown)
            {
                var rect = new Rectangle(4, 1, e.Item.Width - 8, e.Item.Height - 2);
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

                if (e.Item.Selected && e.Item.Enabled)
                {
                    using var brush = new SolidBrush(FluentTheme.ThemeMenuHover);
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 6);

                    using var borderPen = new Pen(FluentTheme.ThemeMenuBorder, 1);
                    FluentTheme.DrawRoundedRectangle(e.Graphics, borderPen, rect, 6);
                }
                else if (e.Item.Pressed)
                {
                    using var brush = new SolidBrush(FluentTheme.ThemeMenuSelected);
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 6);
                }
            }
            else
            {
                base.OnRenderMenuItemBackground(e);
            }
        }

        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            int y = e.Item.Height / 2;
            using var pen = new Pen(FluentTheme.ThemeMenuBorder, 1);
            e.Graphics.DrawLine(pen, 12, y, e.Item.Width - 12, y);
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextColor = e.Item.Enabled ? FluentTheme.ThemeMenuTextPrimary : FluentTheme.ThemeTextMuted;
            e.TextFont = e.Item.Font;
            base.OnRenderItemText(e);
        }

        protected override void OnRenderItemCheck(ToolStripItemImageRenderEventArgs e)
        {
            // Bare checkmark: without any legacy Win32 button background box.
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            int x = e.ImageRectangle.X + (e.ImageRectangle.Width - 16) / 2;
            int y = e.ImageRectangle.Y + (e.ImageRectangle.Height - 16) / 2;
            FluentTheme.DrawCheckmark(e.Graphics, new Point(x, y), FluentTheme.ThemeAccent);
        }

        protected override void OnRenderButtonBackground(ToolStripItemRenderEventArgs e)
        {
            // Suppress default Win32 checked button background rectangle
        }

        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            bool isEnabled = e.Item != null && e.Item.Enabled;
            using var pen = new Pen(isEnabled ? FluentTheme.ThemeMenuTextSecondary : FluentTheme.ThemeTextMuted, 1.6f)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round
            };

            var rect = e.ArrowRectangle;
            int midY = rect.Y + rect.Height / 2;
            int rightX = rect.Right - 4;

            // Sleek chevron right >
            e.Graphics.DrawLines(pen, new[]
            {
                new Point(rightX - 5, midY - 4),
                new Point(rightX, midY),
                new Point(rightX - 5, midY + 4)
            });
        }
    }

    /// <summary>
    /// Per-drop-down record of whether DWM accepted the acrylic backdrop for a given window handle.
    /// A drop-down can be recreated with a new handle, so the handle is stored alongside the result.
    /// </summary>
    internal class AcrylicState
    {
        public IntPtr Handle { get; set; } = IntPtr.Zero;

        public bool Active { get; set; }
    }

    /// <summary>
    /// Dynamic ColorTable that automatically adapts between Windows Dark and Light modes.
    /// </summary>
    internal class AdaptiveEnterpriseColorTable : ProfessionalColorTable
    {
        public override Color MenuBorder => FluentTheme.ThemeMenuBorderStrong;
        public override Color MenuItemBorder => Color.Transparent;
        public override Color MenuItemSelected => FluentTheme.ThemeMenuHover;
        public override Color MenuItemSelectedGradientBegin => FluentTheme.ThemeMenuHover;
        public override Color MenuItemSelectedGradientEnd => FluentTheme.ThemeMenuHover;
        public override Color MenuItemPressedGradientBegin => FluentTheme.ThemeMenuSelected;
        public override Color MenuItemPressedGradientEnd => FluentTheme.ThemeMenuSelected;
        public override Color MenuItemPressedGradientMiddle => FluentTheme.ThemeMenuSelected;
        public override Color ToolStripDropDownBackground => FluentTheme.ThemeMenuBackground;
        public override Color ImageMarginGradientBegin => FluentTheme.ThemeMenuBackground;
        public override Color ImageMarginGradientMiddle => FluentTheme.ThemeMenuBackground;
        public override Color ImageMarginGradientEnd => FluentTheme.ThemeMenuBackground;
        public override Color SeparatorDark => FluentTheme.ThemeMenuBorder;
        public override Color SeparatorLight => Color.Transparent;
    }
}
