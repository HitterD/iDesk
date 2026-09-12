using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Dialog konfirmasi beringkai aplikasi, menggantikan MessageBox untuk
    /// keputusan pengguna. MessageBox tetap dipakai untuk galat sistem.
    /// </summary>
    public static class AppDialogs
    {
        public static bool Confirm(IWin32Window? owner, string title, string body,
                                   string confirmLabel, string cancelLabel = "Cancel",
                                   bool isDestructive = false)
        {
            using var dlg = new ConfirmDialogForm(title, body, confirmLabel, cancelLabel, isDestructive);
            return owner != null
                ? dlg.ShowDialog(owner) == DialogResult.OK
                : dlg.ShowDialog() == DialogResult.OK;
        }

        private sealed class ConfirmDialogForm : Form
        {
            public ConfirmDialogForm(string title, string body, string confirmLabel,
                                     string cancelLabel, bool isDestructive)
            {
                FormBorderStyle = FormBorderStyle.None;
                StartPosition = FormStartPosition.CenterParent;
                ShowInTaskbar = false;
                DoubleBuffered = true;
                Size = new Size(380, 160);
                BackColor = FluentTheme.ThemeSurface;

                var lblTitle = new Label
                {
                    Text = title,
                    Font = FluentTheme.GetFont(12F, FontStyle.Bold),
                    ForeColor = FluentTheme.ThemeTextPrimary,
                    Location = new Point(20, 18),
                    Size = new Size(340, 24),
                    AutoEllipsis = true,
                    BackColor = Color.Transparent
                };
                Controls.Add(lblTitle);

                var lblBody = new Label
                {
                    Text = body,
                    Font = FluentTheme.Caption,
                    ForeColor = FluentTheme.ThemeTextSecondary,
                    Location = new Point(20, 46),
                    Size = new Size(340, 52),
                    BackColor = Color.Transparent
                };
                Controls.Add(lblBody);

                var btnCancel = new GlassButton
                {
                    Text = cancelLabel,
                    Variant = GlassButtonVariant.Ghost,
                    Font = FluentTheme.CaptionBold,
                    Radius = 8,
                    Size = new Size(92, 32),
                    Location = new Point(ClientSize.Width - 204, ClientSize.Height - 44)
                };
                btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
                Controls.Add(btnCancel);

                var btnConfirm = new GlassButton
                {
                    Text = confirmLabel,
                    Variant = isDestructive ? GlassButtonVariant.Danger : GlassButtonVariant.Accent,
                    Font = FluentTheme.CaptionBold,
                    Radius = 8,
                    Size = new Size(96, 32),
                    Location = new Point(ClientSize.Width - 104, ClientSize.Height - 44)
                };
                btnConfirm.Click += (s, e) => { DialogResult = DialogResult.OK; Close(); };
                Controls.Add(btnConfirm);

                AcceptButton = btnConfirm;
                CancelButton = btnCancel;
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                base.OnPaint(e);
                var g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = new Pen(FluentTheme.ThemeCardHairlineStrong, 1f);
                FluentTheme.DrawRoundedRectangle(g, p, new Rectangle(0, 0, ClientSize.Width - 1, ClientSize.Height - 1), 12);
            }
        }
    }
}
