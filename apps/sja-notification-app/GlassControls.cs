using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Visual treatment for <see cref="GlassButton"/>.
    /// </summary>
    public enum GlassButtonVariant
    {
        /// <summary>Solid azure primary action.</summary>
        Accent,

        /// <summary>Translucent secondary action with hairline edge.</summary>
        Ghost,

        /// <summary>Muted red destructive action.</summary>
        Danger
    }

    /// <summary>
    /// Fully owner-drawn button for the frosted dark theme. Replaces FlatStyle buttons whose
    /// Win32-painted borders cannot be themed.
    /// </summary>
    public class GlassButton : Control, IButtonControl
    {
        private const int DefaultRadius = 9;
        private const int GlyphSize = 16;
        private const int GlyphTextGap = 8;
        private const int EdgePadding = 14;

        private bool _hovered;
        private bool _pressed;
        private DialogResult _dialogResult;
        private bool _isDefault;

        // Smooth Hover Animation State (0.0f = Rest, 1.0f = Hover)
        private float _hoverProgress = 0.0f;
        private System.Windows.Forms.Timer? _animTimer;

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public DialogResult DialogResult
        {
            get => _dialogResult;
            set => _dialogResult = value;
        }

        public void NotifyDefault(bool value)
        {
            _isDefault = value;
            Invalidate();
        }

        public void PerformClick()
        {
            if (CanSelect)
            {
                OnClick(EventArgs.Empty);
            }
        }

        public GlassButton()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            BackColor = Color.Transparent;
            Font = FluentTheme.BodyMedium;
            Cursor = Cursors.Hand;
            Height = 40;
        }

        /// <summary>Visual treatment of the button.</summary>
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public GlassButtonVariant Variant { get; set; } = GlassButtonVariant.Ghost;

        /// <summary>Corner radius in pixels.</summary>
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Radius { get; set; } = DefaultRadius;

        /// <summary>Optional vector glyph key resolved through <see cref="FluentTheme.GetMenuIcon"/>.</summary>
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public string? Glyph { get; set; }

        /// <summary>When true the glyph is centered and the caption is not drawn (icon-only button).</summary>
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public bool GlyphOnly { get; set; }

        protected override void OnMouseEnter(EventArgs e)
        {
            _hovered = true;
            StartHoverAnimation(target: 1.0f);
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _hovered = false;
            _pressed = false;
            StartHoverAnimation(target: 0.0f);
            base.OnMouseLeave(e);
        }

        private void StartHoverAnimation(float target)
        {
            _animTimer?.Stop();
            _animTimer?.Dispose();
            _animTimer = new System.Windows.Forms.Timer { Interval = 16 };
            _animTimer.Tick += (s, e) =>
            {
                float step = 0.2f;
                if (Math.Abs(_hoverProgress - target) <= step)
                {
                    _hoverProgress = target;
                    _animTimer?.Stop();
                    _animTimer?.Dispose();
                    _animTimer = null;
                }
                else if (_hoverProgress < target)
                {
                    _hoverProgress += step;
                }
                else
                {
                    _hoverProgress -= step;
                }
                Invalidate();
            };
            _animTimer.Start();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _animTimer?.Stop();
                _animTimer?.Dispose();
                _animTimer = null;
            }
            base.Dispose(disposing);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                _pressed = true;
                Invalidate();
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            _pressed = false;
            Invalidate();
            base.OnMouseUp(e);
        }

        protected override void OnEnabledChanged(EventArgs e)
        {
            Invalidate();
            base.OnEnabledChanged(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var body = new Rectangle(0, 0, Width - 1, Height - 1);
            (Color fill, Color hairline, Color text) = ResolvePalette();

            using (var brush = new SolidBrush(fill))
            {
                FluentTheme.FillRoundedRectangle(g, brush, body, Radius);
            }

            if (hairline != Color.Transparent)
            {
                using var edge = new Pen(hairline, 1f);
                FluentTheme.DrawRoundedRectangle(g, edge, body, Radius);
            }

            DrawContent(g, body, text);
        }

        private static Color BlendColor(Color c1, Color c2, float amount)
        {
            float r = c1.R + (c2.R - c1.R) * amount;
            float g = c1.G + (c2.G - c1.G) * amount;
            float b = c1.B + (c2.B - c1.B) * amount;
            float a = c1.A + (c2.A - c1.A) * amount;
            return Color.FromArgb((int)a, (int)r, (int)g, (int)b);
        }

        private (Color Fill, Color Hairline, Color Text) ResolvePalette()
        {
            if (!Enabled)
            {
                return (FluentTheme.ThemeCardFillSoft, FluentTheme.ThemeCardHairline, FluentTheme.ThemeTextMuted);
            }

            bool dark = FluentTheme.IsDarkTheme;

            if (_pressed)
            {
                return Variant switch
                {
                    GlassButtonVariant.Accent => (FluentTheme.ThemeAccentPressed, Color.Transparent, Color.White),
                    GlassButtonVariant.Danger => (Color.FromArgb(48, FluentTheme.ThemeStatusCritical), Color.FromArgb(80, FluentTheme.ThemeStatusCritical), FluentTheme.ThemeStatusCritical),
                    _ => (FluentTheme.ThemeMenuSelected, FluentTheme.ThemeCardHairlineStrong, FluentTheme.ThemeTextPrimary)
                };
            }

            // Smooth Interpolation based on _hoverProgress
            return Variant switch
            {
                GlassButtonVariant.Accent => (
                    BlendColor(FluentTheme.ThemeAccent, FluentTheme.ThemeAccentHover, _hoverProgress),
                    Color.Transparent,
                    Color.White),

                GlassButtonVariant.Danger => (
                    BlendColor(Color.FromArgb(24, FluentTheme.ThemeStatusCritical), Color.FromArgb(40, FluentTheme.ThemeStatusCritical), _hoverProgress),
                    Color.FromArgb(64, FluentTheme.ThemeStatusCritical),
                    FluentTheme.ThemeStatusCritical),

                _ => (
                    BlendColor(FluentTheme.ThemeCardFill, FluentTheme.ThemeMenuHover, _hoverProgress),
                    BlendColor(FluentTheme.ThemeCardHairline, FluentTheme.ThemeCardHairlineStrong, _hoverProgress),
                    FluentTheme.ThemeTextPrimary)
            };
        }

        private void DrawContent(Graphics g, Rectangle body, Color textColor)
        {
            bool hasGlyph = !string.IsNullOrEmpty(Glyph);

            if (GlyphOnly)
            {
                if (!hasGlyph) return;
                using var centered = FluentTheme.GetMenuIcon(Glyph!, textColor);
                g.DrawImage(centered, body.X + (body.Width - GlyphSize) / 2, body.Y + (body.Height - GlyphSize) / 2);
                return;
            }

            if (!hasGlyph)
            {
                TextRenderer.DrawText(g, Text, Font, body, textColor,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
                return;
            }

            var textSize = TextRenderer.MeasureText(g, Text, Font, new Size(body.Width, body.Height), TextFormatFlags.NoPadding);
            int contentWidth = textSize.Width + GlyphSize + GlyphTextGap;
            int contentX = body.X + Math.Max(4, (body.Width - contentWidth) / 2);

            using var glyph = FluentTheme.GetMenuIcon(Glyph!, textColor);
            g.DrawImage(glyph, contentX, body.Y + (body.Height - GlyphSize) / 2);
            contentX += GlyphSize + GlyphTextGap;

            var textRect = new Rectangle(contentX, body.Y, body.Right - contentX, body.Height);
            TextRenderer.DrawText(g, Text, Font, textRect, textColor,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        }
    }

    /// <summary>
    /// Modern replacement for <see cref="ComboBox"/>. The closed state is a translucent well and
    /// the open state is a fully custom-painted popup, so no Win32 list frame or scrollbar leaks through.
    /// </summary>
    public class GlassDropdown : Control
    {
        private const int Radius = 9;
        private const int SidePadding = 13;
        private const int GlyphSize = 16;
        private const int PopupGap = 5;
        private const int PopupInset = 1;

        private readonly List<string> _items = new List<string>();
        private int _selectedIndex = -1;
        private bool _hovered;
        private bool _open;
        private ToolStripDropDown? _popup;

        /// <summary>Raised after <see cref="SelectedIndex"/> changes through user interaction or code.</summary>
        public event EventHandler? SelectedIndexChanged;

        public GlassDropdown()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            BackColor = Color.Transparent;
            Font = FluentTheme.Body;
            Cursor = Cursors.Hand;
            Height = 38;
        }

        /// <summary>Option captions, in display order.</summary>
        public IList<string> Items => _items;

        /// <summary>Index of the chosen option, or -1 when nothing is selected.</summary>
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int SelectedIndex
        {
            get => _selectedIndex;
            set
            {
                if (value == _selectedIndex) return;
                if (value < -1 || value >= _items.Count) return;

                _selectedIndex = value;
                Invalidate();
                SelectedIndexChanged?.Invoke(this, EventArgs.Empty);
            }
        }

        public string SelectedText => _selectedIndex >= 0 && _selectedIndex < _items.Count ? _items[_selectedIndex] : string.Empty;

        protected override void OnMouseEnter(EventArgs e)
        {
            _hovered = true;
            Invalidate();
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _hovered = false;
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                if (_open) ClosePopup();
                else OpenPopup();
            }
            base.OnMouseDown(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var body = new Rectangle(0, 0, Width - 1, Height - 1);

            // Recessed well: darker than the card it sits on, so inputs read as "carved in".
            using (var brush = new SolidBrush(FluentTheme.ThemeInputWell))
            {
                FluentTheme.FillRoundedRectangle(g, brush, body, Radius);
            }

            Color hairline = _open || _hovered ? FluentTheme.ThemeAccent : FluentTheme.ThemeInputBorder;
            using (var edge = new Pen(hairline, 1f))
            {
                FluentTheme.DrawRoundedRectangle(g, edge, body, Radius);
            }

            var textRect = new Rectangle(body.X + SidePadding, body.Y, body.Width - SidePadding * 2 - GlyphSize, body.Height);
            TextRenderer.DrawText(g, SelectedText, Font, textRect, FluentTheme.ThemeTextPrimary,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);

            using var chevron = FluentTheme.GetMenuIcon("chevron-down", FluentTheme.ThemeTextSecondary);
            g.DrawImage(chevron, body.Right - SidePadding - GlyphSize + 4, body.Y + (body.Height - GlyphSize) / 2);
        }

        private void OpenPopup()
        {
            if (_items.Count == 0) return;

            var list = new GlassDropdownList(_items, _selectedIndex, Width);
            list.ItemChosen += (s, index) =>
            {
                SelectedIndex = index;
                ClosePopup();
            };
            list.DismissRequested += (s, e) => ClosePopup();

            var host = new ToolStripControlHost(list)
            {
                AutoSize = false,
                Size = list.Size,
                Margin = Padding.Empty,
                Padding = Padding.Empty
            };

            _popup = new ToolStripDropDown
            {
                AutoSize = false,
                AutoClose = true,
                DropShadowEnabled = true,
                Padding = Padding.Empty,
                Margin = Padding.Empty,
                Renderer = new BareToolStripRenderer(),
                Size = new Size(list.Width + PopupInset * 2, list.Height + PopupInset * 2)
            };
            _popup.Items.Add(host);

            _popup.Opened += (s, e) =>
            {
                bool acrylic = FluentTheme.TryApplyDarkAcrylic(_popup.Handle, smallCorners: true);
                list.SetAcrylicActive(acrylic);
                list.Focus();
            };
            _popup.Closed += (s, e) =>
            {
                _open = false;
                _popup = null;
                Invalidate();
            };

            _popup.Show(this, new Point(0, Height + PopupGap));
            _open = true;
            Invalidate();
        }

        private void ClosePopup()
        {
            _popup?.Close(ToolStripDropDownCloseReason.ItemClicked);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _popup?.Dispose();
                _popup = null;
            }
            base.Dispose(disposing);
        }
    }

    /// <summary>
    /// Custom-painted option list hosted inside the <see cref="GlassDropdown"/> popup window.
    /// </summary>
    internal class GlassDropdownList : Control
    {
        private const int RowHeight = 34;
        private const int PanelRadius = 8;
        private const int RowRadius = 6;
        private const int CheckSlotWidth = 17;
        private const int PanelPadding = 6;
        private const int CheckSize = 16;

        private readonly List<string> _items;
        private int _hoverIndex = -1;
        private int _selectedIndex;
        private bool _acrylicActive;

        internal event EventHandler<int>? ItemChosen;
        internal event EventHandler? DismissRequested;

        internal GlassDropdownList(List<string> items, int selectedIndex, int width)
        {
            _items = items;
            _selectedIndex = selectedIndex;

            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.Selectable,
                true);

            Font = FluentTheme.Body;
            TabStop = true;
            Size = new Size(width, items.Count * RowHeight + PanelPadding * 2);
        }

        internal void SetAcrylicActive(bool active)
        {
            _acrylicActive = active;
            Invalidate();
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            int index = IndexFromPoint(e.Y);
            if (index != _hoverIndex)
            {
                _hoverIndex = index;
                Invalidate();
            }
            base.OnMouseMove(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _hoverIndex = -1;
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            int index = IndexFromPoint(e.Y);
            if (index >= 0) ItemChosen?.Invoke(this, index);
            base.OnMouseDown(e);
        }

        protected override bool IsInputKey(Keys keyData)
        {
            return keyData is Keys.Up or Keys.Down or Keys.Enter or Keys.Escape || base.IsInputKey(keyData);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            switch (e.KeyCode)
            {
                case Keys.Down:
                    MoveHover(1);
                    break;
                case Keys.Up:
                    MoveHover(-1);
                    break;
                case Keys.Enter:
                    if (_hoverIndex >= 0) ItemChosen?.Invoke(this, _hoverIndex);
                    break;
                case Keys.Escape:
                    DismissRequested?.Invoke(this, EventArgs.Empty);
                    break;
                default:
                    base.OnKeyDown(e);
                    return;
            }
            e.Handled = true;
        }

        private void MoveHover(int delta)
        {
            int start = _hoverIndex >= 0 ? _hoverIndex : _selectedIndex;
            int next = Math.Clamp(start + delta, 0, _items.Count - 1);
            if (next == _hoverIndex) return;
            _hoverIndex = next;
            Invalidate();
        }

        private int IndexFromPoint(int y)
        {
            int index = (y - PanelPadding) / RowHeight;
            return index >= 0 && index < _items.Count ? index : -1;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            FluentTheme.PaintFrostedCanvas(g, ClientRectangle, _acrylicActive);

            using (var edge = new Pen(FluentTheme.ThemeCardHairline, 1f))
            {
                FluentTheme.DrawRoundedRectangle(g, edge, new Rectangle(0, 0, Width - 1, Height - 1), PanelRadius);
            }

            for (int i = 0; i < _items.Count; i++)
            {
                var row = new Rectangle(PanelPadding, PanelPadding + i * RowHeight, Width - PanelPadding * 2, RowHeight);
                bool isHover = i == _hoverIndex;
                bool isSelected = i == _selectedIndex;

                if (isHover)
                {
                    using var hover = new SolidBrush(FluentTheme.ThemeMenuHover);
                    FluentTheme.FillRoundedRectangle(g, hover, row, RowRadius);
                }
                else if (isSelected)
                {
                    using var selected = new SolidBrush(FluentTheme.ThemeAccentSoft);
                    FluentTheme.FillRoundedRectangle(g, selected, row, RowRadius);
                }

                if (isSelected)
                {
                    FluentTheme.DrawCheckmark(g, new Point(row.X + 4, row.Y + (row.Height - CheckSize) / 2), FluentTheme.ThemeAccent);
                }

                Color textColor = isSelected ? FluentTheme.ThemeAccentText : FluentTheme.ThemeTextPrimary;
                var textRect = new Rectangle(row.X + CheckSlotWidth + 8, row.Y, row.Width - CheckSlotWidth - 12, row.Height);
                TextRenderer.DrawText(g, _items[i], Font, textRect, textColor,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
            }
        }
    }

    /// <summary>
    /// Renderer that suppresses all default ToolStrip chrome so the hosted control owns every pixel.
    /// </summary>
    internal class BareToolStripRenderer : ToolStripRenderer
    {
        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
        {
            // Hosted control paints the surface.
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
            // Hosted control paints the hairline.
        }
    }

    /// <summary>
    /// Modern Windows 11 Fluent 2 Toggle Switch.
    /// </summary>
    public class FluentToggleSwitch : Control
    {
        private bool _checked;
        private bool _hovered;

        public event EventHandler? CheckedChanged;

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public bool Checked
        {
            get => _checked;
            set
            {
                if (_checked != value)
                {
                    _checked = value;
                    Invalidate();
                    CheckedChanged?.Invoke(this, EventArgs.Empty);
                }
            }
        }

        public FluentToggleSwitch()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            Size = new Size(40, 22);
            Cursor = Cursors.Hand;
            BackColor = Color.Transparent;
        }

        protected override void OnMouseEnter(EventArgs e) { _hovered = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { _hovered = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnClick(EventArgs e)
        {
            Checked = !Checked;
            base.OnClick(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            int h = 22;
            int w = 40;
            int radius = h / 2;

            var trackRect = new Rectangle(0, (Height - h) / 2, w, h);

            Color trackColor;
            Color borderColor = Color.Transparent;

            if (_checked)
            {
                trackColor = _hovered ? FluentTheme.ThemeAccentHover : FluentTheme.ThemeAccent;
            }
            else
            {
                trackColor = _hovered ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeSurfaceSoft;
                borderColor = FluentTheme.ThemeInputBorder;
            }

            using (var brush = new SolidBrush(trackColor))
            {
                FluentTheme.FillRoundedRectangle(g, brush, trackRect, radius);
            }

            if (!_checked && borderColor != Color.Transparent)
            {
                using var borderPen = new Pen(borderColor, 1f);
                FluentTheme.DrawRoundedRectangle(g, borderPen, new Rectangle(trackRect.X, trackRect.Y, trackRect.Width - 1, trackRect.Height - 1), radius);
            }

            // Knob
            int thumbSize = 14;
            int thumbX = _checked ? (trackRect.Right - thumbSize - 4) : (trackRect.Left + 4);
            int thumbY = trackRect.Top + (h - thumbSize) / 2;

            Color thumbColor = _checked ? Color.White : FluentTheme.ThemeTextSecondary;

            using (var thumbBrush = new SolidBrush(thumbColor))
            {
                g.FillEllipse(thumbBrush, thumbX, thumbY, thumbSize, thumbSize);
            }
        }
    }

    /// <summary>
    /// Smooth Minimalist Windows 11 Overlay Scrollbar.
    /// Thin rounded pill thumb (4px idle, 8px active), transparent track, smooth wheel easing.
    /// </summary>
    public class FluentScrollBar : Control
    {
        private int _minimum = 0;
        private int _maximum = 100;
        private int _value = 0;
        private int _largeChange = 10;
        private int _smallChange = 1;

        private bool _isThumbHovered;
        private bool _isThumbDragging;
        private bool _isBarHovered;
        private bool _isScrolling;
        private int _dragStartY;
        private int _dragStartValue;

        // Smooth scroll animation engine
        private readonly System.Windows.Forms.Timer _animTimer;
        private float _currentScrollPos = 0;
        private float _targetScrollPos = 0;
        private int _idleCounter = 0;

        public event EventHandler? ValueChanged;

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Minimum
        {
            get => _minimum;
            set
            {
                _minimum = value;
                Invalidate();
            }
        }

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Maximum
        {
            get => _maximum;
            set
            {
                _maximum = Math.Max(_minimum, value);
                if (_value > _maximum) Value = _maximum;
                _targetScrollPos = Math.Min(_targetScrollPos, _maximum);
                _currentScrollPos = Math.Min(_currentScrollPos, _maximum);
                Invalidate();
            }
        }

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Value
        {
            get => _value;
            set
            {
                int clamped = Math.Max(_minimum, Math.Min(_maximum, value));
                if (_value != clamped)
                {
                    _value = clamped;
                    if (!_animTimer.Enabled)
                    {
                        _currentScrollPos = clamped;
                        _targetScrollPos = clamped;
                    }
                    Invalidate();
                    ValueChanged?.Invoke(this, EventArgs.Empty);
                }
            }
        }

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int LargeChange
        {
            get => _largeChange;
            set { _largeChange = Math.Max(1, value); Invalidate(); }
        }

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int SmallChange
        {
            get => _smallChange;
            set { _smallChange = Math.Max(1, value); }
        }

        public FluentScrollBar()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            Width = 10;
            BackColor = Color.Transparent;
            Cursor = Cursors.Default;

            _animTimer = new System.Windows.Forms.Timer { Interval = 15 };
            _animTimer.Tick += OnAnimTick;
        }

        /// <summary>
        /// Applies smooth animated mouse-wheel scroll easing.
        /// </summary>
        public void DoMouseWheel(int delta, int step = 45)
        {
            if (!Visible || _maximum <= _minimum) return;
            int direction = delta < 0 ? 1 : -1;
            int notches = Math.Max(1, Math.Abs(delta) / 120);
            _targetScrollPos = Math.Max(_minimum, Math.Min(_maximum, _targetScrollPos + direction * step * notches));
            _isScrolling = true;
            _idleCounter = 0;
            if (!_animTimer.Enabled)
            {
                _animTimer.Start();
            }
            Invalidate();
        }

        private void OnAnimTick(object? sender, EventArgs e)
        {
            float diff = _targetScrollPos - _currentScrollPos;
            if (Math.Abs(diff) < 0.5f)
            {
                _currentScrollPos = _targetScrollPos;
                int intVal = (int)Math.Round(_currentScrollPos);
                if (_value != intVal)
                {
                    _value = intVal;
                    ValueChanged?.Invoke(this, EventArgs.Empty);
                }

                if (!_isBarHovered && !_isThumbDragging && !_isThumbHovered)
                {
                    _idleCounter++;
                    if (_idleCounter > 25)
                    {
                        _isScrolling = false;
                        _animTimer.Stop();
                        Invalidate();
                    }
                }
                else
                {
                    _animTimer.Stop();
                }
            }
            else
            {
                _currentScrollPos += diff * 0.32f;
                int intVal = (int)Math.Round(_currentScrollPos);
                if (_value != intVal)
                {
                    _value = intVal;
                    ValueChanged?.Invoke(this, EventArgs.Empty);
                }
                Invalidate();
            }
        }

        private Rectangle GetThumbRectangle()
        {
            int trackHeight = Height - 4;
            if (trackHeight <= 0 || _maximum <= _minimum)
            {
                return Rectangle.Empty;
            }

            int totalRange = (_maximum - _minimum) + _largeChange;
            int thumbHeight = Math.Max(24, (int)((float)_largeChange / totalRange * trackHeight));
            if (thumbHeight > trackHeight) thumbHeight = trackHeight;

            int availableScroll = trackHeight - thumbHeight;
            int scrollRange = _maximum - _minimum;
            float percent = scrollRange > 0 ? (float)(_value - _minimum) / scrollRange : 0f;

            int thumbY = 2 + (int)(percent * availableScroll);

            bool isActive = _isThumbHovered || _isThumbDragging || _isBarHovered || _isScrolling;
            int thumbWidth = isActive ? Math.Max(6, Width - 2) : Math.Max(3, Width - 6);
            int thumbX = Width - thumbWidth - 1;

            return new Rectangle(thumbX, thumbY, thumbWidth, thumbHeight);
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            _isBarHovered = true;
            Invalidate();
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            _isBarHovered = false;
            if (!_isThumbDragging)
            {
                _isThumbHovered = false;
                Invalidate();
            }
            base.OnMouseLeave(e);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                var thumb = GetThumbRectangle();
                if (thumb.Contains(e.Location))
                {
                    _isThumbDragging = true;
                    _dragStartY = e.Y;
                    _dragStartValue = _value;
                    Capture = true;
                }
                else
                {
                    // Click above or below thumb
                    if (e.Y < thumb.Top)
                    {
                        Value -= _largeChange;
                    }
                    else if (e.Y > thumb.Bottom)
                    {
                        Value += _largeChange;
                    }
                }
            }
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (_isThumbDragging)
            {
                int trackHeight = Height - 4;
                var thumb = GetThumbRectangle();
                int availableScroll = trackHeight - thumb.Height;

                if (availableScroll > 0)
                {
                    int deltaY = e.Y - _dragStartY;
                    int scrollRange = _maximum - _minimum;
                    int deltaVal = (int)((float)deltaY / availableScroll * scrollRange);
                    Value = _dragStartValue + deltaVal;
                }
            }
            else
            {
                var thumb = GetThumbRectangle();
                bool hover = thumb.Contains(e.Location);
                if (hover != _isThumbHovered)
                {
                    _isThumbHovered = hover;
                    Invalidate();
                }
            }
            base.OnMouseMove(e);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            _isThumbDragging = false;
            Capture = false;
            _isThumbHovered = ClientRectangle.Contains(e.Location);
            Invalidate();
            base.OnMouseUp(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            var thumbRect = GetThumbRectangle();
            if (thumbRect.IsEmpty) return;

            bool dark = FluentTheme.IsDarkTheme;
            bool isActive = _isThumbHovered || _isThumbDragging || _isBarHovered || _isScrolling;

            // Draw subtle track when active
            if (isActive)
            {
                var trackRect = new Rectangle(Width - 9, 2, 8, Height - 4);
                using var trackBrush = new SolidBrush(FluentTheme.ThemeHover);
                FluentTheme.FillRoundedRectangle(g, trackBrush, trackRect, 4);
            }

            Color thumbColor;
            if (_isThumbDragging)
            {
                thumbColor = FluentTheme.ThemeTextPrimary;
            }
            else if (_isThumbHovered)
            {
                thumbColor = FluentTheme.ThemeTextSecondary;
            }
            else if (isActive)
            {
                thumbColor = FluentTheme.ThemeTextMuted;
            }
            else
            {
                // Idle thin pill
                thumbColor = FluentTheme.ThemeCardHairlineStrong;
            }

            int radius = Math.Max(2, thumbRect.Width / 2);
            using (var brush = new SolidBrush(thumbColor))
            {
                FluentTheme.FillRoundedRectangle(g, brush, thumbRect, radius);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _animTimer.Stop();
                _animTimer.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    /// <summary>
    /// Reusable Modern Windows 11 Card Container with clean 1px hairline border.
    /// </summary>
    public class FluentCardPanel : Panel
    {
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public int Radius { get; set; } = 10;

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public Color? CustomFill { get; set; }

        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        public Color? CustomBorder { get; set; }

        public FluentCardPanel()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            FluentTheme.PaintGlassCard(e.Graphics, ClientRectangle, Radius, CustomFill, CustomBorder);
        }
    }
}
