using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Media;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SJANotificationApp
{
    /// <summary>
    /// Apple-styled Inset Grouped Settings Panel for SJA Notifier.
    /// Follows macOS System Settings layout: section headers, inset grouped cards with hairline row dividers,
    /// squircle input wells, and segmented controls.
    /// Can be hosted inside MainWindowForm tab or standalone SettingsForm modal.
    /// </summary>
    public class SettingsControlPanel : Panel
    {
        private readonly AppConfig _config;
        private TextBox _txtWsUrl = null!;
        private TextBox _txtServerUrl = null!;
        private GlassDropdown _cmbDisplayMode = null!;
        private GlassDropdown _cmbAutoDismiss = null!;
        private FluentToggleSwitch _swSound = null!;
        private FluentToggleSwitch _swAutoStart = null!;
        private Panel _pnlThemeSegment = null!;
        private Button _btnThemeLight = null!;
        private Button _btnThemeDark = null!;
        private Button _btnThemeSystem = null!;
        private string _selectedThemeMode = "light";
        private Panel? _pnlSaveCard;

        // Container & cards for responsive resizing
        private Panel _pnlScrollContent = null!;
        private Panel _cardTheme = null!;
        private Panel _cardNotif = null!;
        private Panel _cardSystem = null!;
        private Panel _pnlServerBox = null!;
        private Panel _pnlWsBox = null!;
        private GlassButton _btnTestAudio = null!;
        private GlassButton _btnSaveNow = null!;
        private FluentScrollBar _modernScrollBar = null!;
        private int _totalContentHeight = 840;

        private const string RegistryRunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppRegistryName = "SJANotifier";

        public event Action? SettingsSaved;

        public SettingsControlPanel(AppConfig config)
        {
            _config = config;
            _selectedThemeMode = _config.ThemeMode ?? "light";
            InitializeComponent();
            FluentTheme.ThemeChanged += OnThemeChanged;
        }

        private void InitializeComponent()
        {
            Dock = DockStyle.Fill;
            BackColor = Color.Transparent;
            Font = FluentTheme.Body;
            ForeColor = FluentTheme.ThemeTextPrimary;

            var pnlBody = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent
            };

            _pnlScrollContent = new Panel
            {
                Location = new Point(16, 12),
                Size = new Size(pnlBody.ClientSize.Width - 36, 840),
                BackColor = Color.Transparent
            };

            _modernScrollBar = new FluentScrollBar
            {
                Dock = DockStyle.Right,
                Width = 10,
                Minimum = 0,
                Maximum = 100,
                LargeChange = 50
            };
            _modernScrollBar.ValueChanged += (s, e) =>
            {
                _pnlScrollContent.Top = 12 - _modernScrollBar.Value;
            };

            pnlBody.Controls.Add(_pnlScrollContent);
            pnlBody.Controls.Add(_modernScrollBar);
            Controls.Add(pnlBody);

            int y = 4;

            // ==========================================
            // GROUP 1: TAMPILAN & TEMA
            // ==========================================
            AddSectionHeader("Appearance", ref y, _pnlScrollContent);

            _cardTheme = CreateGroupCard(ref y, _pnlScrollContent, 108);

            var lblThemeTitle = new Label
            {
                Text = "Theme Appearance",
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 14),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardTheme.Controls.Add(lblThemeTitle);

            var lblThemeSub = new Label
            {
                Text = "Choose light, dark, or follow Windows system theme.",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(16, 33),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardTheme.Controls.Add(lblThemeSub);

            _pnlThemeSegment = new Panel
            {
                Location = new Point(16, 58),
                Size = new Size(_cardTheme.Width - 32, 36),
                BackColor = Color.Transparent
            };
            _pnlThemeSegment.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, _pnlThemeSegment.Width - 1, _pnlThemeSegment.Height - 1);
                using var b = new SolidBrush(FluentTheme.ThemeInputWell);
                FluentTheme.FillRoundedRectangle(e.Graphics, b, rect, 8);
                using var p = new Pen(FluentTheme.ThemeInputBorder, 1f);
                FluentTheme.DrawRoundedRectangle(e.Graphics, p, rect, 8);
            };

            int segW = Math.Max(60, (_pnlThemeSegment.Width - 8) / 3);
            _btnThemeLight = CreateSegmentButton("Light", 3, 3, segW, () => SetThemeSelection("light"));
            _btnThemeDark = CreateSegmentButton("Dark", 3 + segW + 2, 3, segW, () => SetThemeSelection("dark"));
            _btnThemeSystem = CreateSegmentButton("System", 3 + (segW + 2) * 2, 3, segW, () => SetThemeSelection("system"));

            _pnlThemeSegment.Controls.Add(_btnThemeLight);
            _pnlThemeSegment.Controls.Add(_btnThemeDark);
            _pnlThemeSegment.Controls.Add(_btnThemeSystem);
            _cardTheme.Controls.Add(_pnlThemeSegment);
            UpdateThemeButtonStyles();

            y += 14;

            // ==========================================
            // GROUP 2: NOTIFIKASI & SUARA
            // ==========================================
            AddSectionHeader("Notifications & sound", ref y, _pnlScrollContent);

            // Card 2: 3 rows with 2 hairline dividers (Height: 264)
            _cardNotif = CreateGroupCard(ref y, _pnlScrollContent, 264);
            _cardNotif.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 16, 98, _cardNotif.Width - 16, 98);
                e.Graphics.DrawLine(pen, 16, 196, _cardNotif.Width - 16, 196);
            };

            // Row 1: Mode Tampilan Notifikasi
            var lblDisplayTitle = new Label
            {
                Text = "Notification Display Mode",
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 14),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardNotif.Controls.Add(lblDisplayTitle);

            var lblDisplaySub = new Label
            {
                Text = "Choose how notifications appear on screen:",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(16, 33),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardNotif.Controls.Add(lblDisplaySub);

            _cmbDisplayMode = new GlassDropdown
            {
                Location = new Point(16, 54),
                Size = new Size(_cardNotif.Width - 32, 30),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };
            _cmbDisplayMode.Items.Add("Both (Windows toast and popup window)");
            _cmbDisplayMode.Items.Add("Windows toast only");
            _cmbDisplayMode.Items.Add("Popup window only");
            _cmbDisplayMode.SelectedIndex = _config.DefaultDisplayMode switch
            {
                "toast" => 1,
                "popup" => 2,
                _ => 0
            };
            _cardNotif.Controls.Add(_cmbDisplayMode);

            // Row 2: Durasi Tampil Popup
            var lblDismissTitle = new Label
            {
                Text = "Popup Duration",
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 110),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardNotif.Controls.Add(lblDismissTitle);

            var lblDismissSub = new Label
            {
                Text = "Popups close automatically when not hovered.",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(16, 129),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardNotif.Controls.Add(lblDismissSub);

            _cmbAutoDismiss = new GlassDropdown
            {
                Location = new Point(16, 150),
                Size = new Size(_cardNotif.Width - 32, 30),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };
            _cmbAutoDismiss.Items.Add("12 seconds");
            _cmbAutoDismiss.Items.Add("30 seconds");
            _cmbAutoDismiss.Items.Add("Keep open (manual close only)");
            _cmbAutoDismiss.SelectedIndex = _config.AutoDismissSeconds switch
            {
                30 => 1,
                0 => 2,
                _ => 0
            };
            _cardNotif.Controls.Add(_cmbAutoDismiss);

            // Row 3: Audio & Nada Dering
            var lblAudioTitle = new Label
            {
                Text = "Notification Sound",
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 210),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardNotif.Controls.Add(lblAudioTitle);

            var lblAudioSub = new Label
            {
                Text = "Play a sound when notifications arrive.",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(16, 229),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardNotif.Controls.Add(lblAudioSub);

            _btnTestAudio = new GlassButton
            {
                Text = "Test sound",
                Location = new Point(_cardNotif.Width - 146, 212),
                Size = new Size(82, 30),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Variant = GlassButtonVariant.Ghost,
                Radius = 8,
                Font = FluentTheme.CaptionBold
            };
            _btnTestAudio.Click += (s, e) => SystemSounds.Asterisk.Play();
            _cardNotif.Controls.Add(_btnTestAudio);

            _swSound = new FluentToggleSwitch
            {
                Location = new Point(_cardNotif.Width - 54, 216),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Checked = _config.PlaySound
            };
            _cardNotif.Controls.Add(_swSound);

            y += 14;

            // ==========================================
            // GROUP 3: SISTEM & JARINGAN
            // ==========================================
            AddSectionHeader("System & network", ref y, _pnlScrollContent);

            // Card 3: 3 rows (Height: 236)
            _cardSystem = CreateGroupCard(ref y, _pnlScrollContent, 236);
            _cardSystem.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var pen = new Pen(FluentTheme.ThemeCardHairline, 1f);
                e.Graphics.DrawLine(pen, 16, 68, _cardSystem.Width - 16, 68);
                e.Graphics.DrawLine(pen, 16, 150, _cardSystem.Width - 16, 150);
            };

            // Row 1: Mulai Otomatis
            var lblStartupTitle = new Label
            {
                Text = "Start with Windows",
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 14),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardSystem.Controls.Add(lblStartupTitle);

            var lblStartupSub = new Label
            {
                Text = "Launch minimized to system tray on Windows startup.",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(16, 33),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            _cardSystem.Controls.Add(lblStartupSub);

            _swAutoStart = new FluentToggleSwitch
            {
                Location = new Point(_cardSystem.Width - 54, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Checked = CheckAutoStartEnabled()
            };
            _cardSystem.Controls.Add(_swAutoStart);

            // Row 2: URL Server Web iDesk
            var lblServer = new Label
            {
                Text = "iDesk Server URL",
                Location = new Point(16, 80),
                AutoSize = true,
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                UseMnemonic = false
            };
            _cardSystem.Controls.Add(lblServer);

            _pnlServerBox = CreateInputBox(16, 102, _cardSystem.Width - 32, out _txtServerUrl);
            _txtServerUrl.Text = _config.IdeskServerUrl;
            _cardSystem.Controls.Add(_pnlServerBox);

            // Row 3: SJA Gateway WebSocket Endpoint
            var lblWs = new Label
            {
                Text = "SJA Gateway WebSocket (WSS)",
                Location = new Point(16, 162),
                AutoSize = true,
                Font = FluentTheme.BodyBold,
                ForeColor = FluentTheme.ThemeTextPrimary,
                UseMnemonic = false
            };
            _cardSystem.Controls.Add(lblWs);

            _pnlWsBox = CreateInputBox(16, 184, _cardSystem.Width - 32, out _txtWsUrl);
            _txtWsUrl.Text = _config.SjaWsUrl;
            _cardSystem.Controls.Add(_pnlWsBox);

            y += 18;

            // ==========================================
            // BOTTOM ACTION BAR
            // ==========================================
            var pnlSaveCard = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(_pnlScrollContent.Width, 54),
                BackColor = Color.Transparent
            };
            _btnSaveNow = new GlassButton
            {
                Text = "Save changes",
                Size = new Size(240, 40),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(pnlSaveCard.Width - 240, 6),
                Variant = GlassButtonVariant.Accent,
                Radius = 10,
                Font = FluentTheme.SubTextBold
            };
            _btnSaveNow.Click += (s, e) => SaveSettings();
            pnlSaveCard.Controls.Add(_btnSaveNow);
            _pnlSaveCard = pnlSaveCard;
            _pnlScrollContent.Controls.Add(pnlSaveCard);
            y += 64;

            _totalContentHeight = y + 20;
            _pnlScrollContent.Height = _totalContentHeight;

            pnlBody.MouseWheel += (s, e) => _modernScrollBar.DoMouseWheel(e.Delta, 36);
            _pnlScrollContent.MouseWheel += (s, e) => _modernScrollBar.DoMouseWheel(e.Delta, 36);

            pnlBody.Resize += (s, e) => OnBodyResize(pnlBody.ClientSize.Width);
        }

        private void OnBodyResize(int bodyWidth)
        {
            int w = bodyWidth - 28;
            if (w <= 0) return;

            _pnlScrollContent.Width = w;

            // Card 1
            _cardTheme.Width = w;
            _pnlThemeSegment.Width = w - 32;
            int nw = Math.Max(60, (_pnlThemeSegment.Width - 8) / 3);
            _btnThemeLight.Width = nw;
            _btnThemeDark.Location = new Point(3 + nw + 2, 3);
            _btnThemeDark.Width = nw;
            _btnThemeSystem.Location = new Point(3 + (nw + 2) * 2, 3);
            _btnThemeSystem.Width = _pnlThemeSegment.Width - 6 - (nw + 2) * 2;

            // Card 2
            _cardNotif.Width = w;
            _cmbDisplayMode.Width = w - 32;
            _cmbAutoDismiss.Width = w - 32;
            _btnTestAudio.Location = new Point(w - 146, 192);
            _swSound.Location = new Point(w - 54, 196);

            // Card 3
            _cardSystem.Width = w;
            _swAutoStart.Location = new Point(w - 54, 20);
            _pnlServerBox.Width = w - 32;
            _txtServerUrl.Width = _pnlServerBox.Width - 20;
            _pnlWsBox.Width = w - 32;
            _txtWsUrl.Width = _pnlWsBox.Width - 20;

            // Save Card
            if (_pnlSaveCard != null)
            {
                _pnlSaveCard.Width = w;
                _btnSaveNow.Location = new Point(w - 240, 6);
            }

            int maxScroll = Math.Max(0, _totalContentHeight - Height + 10);
            _modernScrollBar.Maximum = maxScroll;
            _modernScrollBar.Visible = maxScroll > 0;
        }

        private void AddSectionHeader(string title, ref int y, Panel container)
        {
            var lblSection = new Label
            {
                Text = title,
                Font = FluentTheme.CaptionBold,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(6, y),
                AutoSize = true,
                BackColor = Color.Transparent,
                UseMnemonic = false
            };
            container.Controls.Add(lblSection);
            y += 24;
        }

        private Panel CreateGroupCard(ref int y, Panel container, int height)
        {
            var pnl = new Panel
            {
                Location = new Point(0, y),
                Size = new Size(container.Width, height),
                BackColor = Color.Transparent,
                Padding = new Padding(16, 12, 16, 12)
            };
            pnl.Paint += (s, e) =>
            {
                FluentTheme.PaintGlassCard(e.Graphics, pnl.ClientRectangle, 12);
            };

            container.Controls.Add(pnl);
            y += height;
            return pnl;
        }

        private Button CreateSegmentButton(string text, int x, int y, int width, Action onClick)
        {
            var btn = new Button
            {
                Text = text,
                Location = new Point(x, y),
                Size = new Size(width, 30),
                FlatStyle = FlatStyle.Flat,
                Font = FluentTheme.CaptionBold,
                Cursor = Cursors.Hand,
                UseMnemonic = false
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.Click += (s, e) => onClick();
            return btn;
        }

        private void SetThemeSelection(string mode)
        {
            _selectedThemeMode = mode;
            FluentTheme.SetThemeMode(mode);
            UpdateThemeButtonStyles();
            Invalidate(true);
        }

        private void UpdateThemeButtonStyles()
        {
            bool isLight = _selectedThemeMode == "light";
            bool isDark = _selectedThemeMode == "dark";
            bool isSystem = _selectedThemeMode == "system";

            StyleSegmentButton(_btnThemeLight, isLight);
            StyleSegmentButton(_btnThemeDark, isDark);
            StyleSegmentButton(_btnThemeSystem, isSystem);
        }

        private void StyleSegmentButton(Button btn, bool active)
        {
            if (active)
            {
                btn.BackColor = FluentTheme.ThemeAccent;
                btn.ForeColor = Color.White;
            }
            else
            {
                btn.BackColor = Color.Transparent;
                btn.ForeColor = FluentTheme.ThemeTextSecondary;
            }
        }

        private Panel CreateInputBox(int x, int y, int width, out TextBox textBox)
        {
            var pnlBox = new Panel
            {
                Location = new Point(x, y),
                Size = new Size(width, 36),
                BackColor = Color.Transparent
            };

            bool focused = false;
            pnlBox.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var rect = new Rectangle(0, 0, pnlBox.Width - 1, pnlBox.Height - 1);
                using (var brush = new SolidBrush(FluentTheme.ThemeInputWell))
                {
                    FluentTheme.FillRoundedRectangle(e.Graphics, brush, rect, 8);
                }
                Color border = focused ? FluentTheme.ThemeAccent : FluentTheme.ThemeInputBorder;
                float stroke = focused ? 1.5f : 1f;
                using var pen = new Pen(border, stroke);
                FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 8);
            };

            var tb = new TextBox
            {
                Location = new Point(12, 8),
                Size = new Size(width - 24, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.None,
                BackColor = FluentTheme.ThemeInputWell,
                Font = FluentTheme.Body,
                ForeColor = FluentTheme.ThemeTextPrimary
            };
            tb.Enter += (s, e) => { focused = true; pnlBox.Invalidate(); };
            tb.Leave += (s, e) => { focused = false; pnlBox.Invalidate(); };
            pnlBox.Click += (s, e) => tb.Focus();
            pnlBox.Controls.Add(tb);

            textBox = tb;
            return pnlBox;
        }

        private string GetSelectedDisplayMode()
        {
            return _cmbDisplayMode.SelectedIndex switch
            {
                1 => "toast",
                2 => "popup",
                _ => "both"
            };
        }

        private int GetSelectedAutoDismissSeconds()
        {
            return _cmbAutoDismiss.SelectedIndex switch
            {
                1 => 30,
                2 => 0,
                _ => 12
            };
        }

        /// <summary>
        /// Sembunyikan tombol simpan inline saat panel dihosting di jendela yang sudah punya footer aksi sendiri.
        /// </summary>
        public void HideInlineSaveButton()
        {
            if (_pnlSaveCard != null) _pnlSaveCard.Visible = false;
        }

        public void SaveSettings()
        {
            string wsUrl = _txtWsUrl.Text.Trim();
            _config.SjaWsUrl = wsUrl;
            _config.DefaultDisplayMode = GetSelectedDisplayMode();
            _config.AutoDismissSeconds = GetSelectedAutoDismissSeconds();
            _config.PlaySound = _swSound.Checked;
            _config.IdeskServerUrl = _txtServerUrl.Text.Trim();
            _config.ThemeMode = _selectedThemeMode;

            try
            {
                var uri = new Uri(wsUrl);
                _config.SjaServerUrl = $"http://{uri.Host}:18302";
            }
            catch { }

            _config.Save();

            SetAutoStart(_swAutoStart.Checked);

            MessageBox.Show("Pengaturan SJA Notifier berhasil disimpan.", "SJA Notifier", MessageBoxButtons.OK, MessageBoxIcon.Information);
            SettingsSaved?.Invoke();
        }

        private bool CheckAutoStartEnabled()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RegistryRunPath, false);
                return key?.GetValue(AppRegistryName) != null;
            }
            catch { return false; }
        }

        private void SetAutoStart(bool enable)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RegistryRunPath, true);
                if (key == null) return;

                if (enable)
                {
                    key.SetValue(AppRegistryName, $"\"{Application.ExecutablePath}\"");
                }
                else
                {
                    key.DeleteValue(AppRegistryName, false);
                }
            }
            catch { }
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
            _selectedThemeMode = FluentTheme.CurrentThemeMode;
            UpdateThemeButtonStyles();
            ApplyThemeToControls(this);
            Invalidate(true);
        }

        private void ApplyThemeToControls(Control parent)
        {
            foreach (Control c in parent.Controls)
            {
                if (c is Label lbl)
                {
                    if (lbl.Font.Bold && lbl.Font.Size <= 8.5F)
                    {
                        lbl.ForeColor = FluentTheme.ThemeTextSecondary;
                    }
                    else if (lbl.Font.Bold)
                    {
                        lbl.ForeColor = FluentTheme.ThemeTextPrimary;
                    }
                    else
                    {
                        lbl.ForeColor = FluentTheme.ThemeTextSecondary;
                    }
                }
                else if (c is TextBox tb)
                {
                    tb.BackColor = FluentTheme.ThemeInputWell;
                    tb.ForeColor = FluentTheme.ThemeTextPrimary;
                }

                if (c.HasChildren)
                {
                    ApplyThemeToControls(c);
                }
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
    }
}
