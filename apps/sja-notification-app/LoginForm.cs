using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SJANotificationApp
{
    public class LoginForm : Form
    {
        private readonly AppConfig _config;
        private TextBox _txtNik = null!;
        private TextBox _txtPassword = null!;
        private Button _btnLogin = null!;
        private Label _lblStatus = null!;
        private ProgressBar _progressBar = null!;

        public event Action<string>? OnLoginSuccess;

        public LoginForm(AppConfig config)
        {
            _config = config;
            InitializeComponent();
            FluentTheme.ApplyWindows11Styles(Handle);
        }

        private void InitializeComponent()
        {
            Text = "SJA Notifier • Masuk Akun Karyawan";
            Size = new Size(460, 490);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            Font = FluentTheme.Body;
            BackColor = FluentTheme.Background;
            ForeColor = FluentTheme.TextPrimary;
            Icon = SystemIcons.Information;

            var pnlRoot = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(0)
            };
            Controls.Add(pnlRoot);

            // ================= 1. HEADER =================
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 76,
                BackColor = FluentTheme.Surface,
                Padding = new Padding(22, 16, 22, 14)
            };
            pnlHeader.Paint += (s, e) =>
            {
                using var linePen = new Pen(FluentTheme.BorderSubtle, 1);
                e.Graphics.DrawLine(linePen, 0, pnlHeader.Height - 1, pnlHeader.Width, pnlHeader.Height - 1);
            };

            var picLogo = new PictureBox
            {
                Size = new Size(42, 42),
                Location = new Point(22, 16),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            picLogo.Image = LoadSantosLogo();
            pnlHeader.Controls.Add(picLogo);

            var lblTitle = new Label
            {
                Text = "Masuk Akun Karyawan",
                Font = FluentTheme.Headline,
                ForeColor = FluentTheme.TextPrimary,
                Location = new Point(74, 16),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlHeader.Controls.Add(lblTitle);

            var lblSub = new Label
            {
                Text = "Single Truth Credential via iDesk IdP",
                Font = FluentTheme.SubText,
                ForeColor = FluentTheme.TextSecondary,
                Location = new Point(74, 40),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            pnlHeader.Controls.Add(lblSub);
            pnlRoot.Controls.Add(pnlHeader);

            // ================= 2. BODY =================
            var pnlBody = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(22, 18, 22, 18),
                BackColor = FluentTheme.Background
            };
            pnlRoot.Controls.Add(pnlBody);
            pnlBody.BringToFront();

            var pnlCard = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = FluentTheme.Surface,
                Padding = new Padding(20, 18, 20, 18)
            };
            pnlCard.Paint += (s, e) =>
            {
                var rect = new Rectangle(0, 0, pnlCard.Width - 1, pnlCard.Height - 1);
                using var pen = new Pen(FluentTheme.BorderSubtle, 1);
                FluentTheme.DrawRoundedRectangle(e.Graphics, pen, rect, 10);
            };

            int y = 14;

            var lblNik = new Label
            {
                Text = "NIK atau Email Karyawan:",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.TextSecondary,
                Location = new Point(20, y),
                AutoSize = true
            };
            pnlCard.Controls.Add(lblNik);

            y += 24;
            _txtNik = new TextBox
            {
                Location = new Point(20, y),
                Size = new Size(pnlCard.Width - 40, 30),
                Font = FluentTheme.GetFont(9.5F, FontStyle.Regular),
                PlaceholderText = "Contoh: 00061058 atau user.spj@idesk.com",
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.FixedSingle
            };
            pnlCard.Controls.Add(_txtNik);

            y += 46;
            var lblPass = new Label
            {
                Text = "Password Akun (iDesk / HRIS):",
                Font = FluentTheme.SubTextBold,
                ForeColor = FluentTheme.TextSecondary,
                Location = new Point(20, y),
                AutoSize = true
            };
            pnlCard.Controls.Add(lblPass);

            y += 24;
            _txtPassword = new TextBox
            {
                Location = new Point(20, y),
                Size = new Size(pnlCard.Width - 40, 30),
                Font = FluentTheme.GetFont(9.5F, FontStyle.Regular),
                UseSystemPasswordChar = true,
                PlaceholderText = "••••••••",
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BorderStyle = BorderStyle.FixedSingle
            };
            pnlCard.Controls.Add(_txtPassword);

            y += 42;
            _lblStatus = new Label
            {
                Text = "",
                Font = FluentTheme.SubText,
                ForeColor = Color.FromArgb(220, 38, 38),
                Location = new Point(20, y),
                Size = new Size(pnlCard.Width - 40, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                AutoEllipsis = true
            };
            pnlCard.Controls.Add(_lblStatus);

            y += 22;
            _progressBar = new ProgressBar
            {
                Location = new Point(20, y),
                Size = new Size(pnlCard.Width - 40, 4),
                Style = ProgressBarStyle.Marquee,
                Visible = false,
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };
            pnlCard.Controls.Add(_progressBar);

            y += 16;
            _btnLogin = new Button
            {
                Text = "Masuk & Hubungkan Perangkat →",
                Location = new Point(20, y),
                Size = new Size(pnlCard.Width - 40, 42),
                BackColor = FluentTheme.NavyBrand,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = FluentTheme.BodyBold,
                Cursor = Cursors.Hand,
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };
            _btnLogin.FlatAppearance.BorderSize = 0;
            _btnLogin.FlatAppearance.MouseOverBackColor = FluentTheme.NavyHover;
            _btnLogin.FlatAppearance.MouseDownBackColor = FluentTheme.NavyPressed;
            _btnLogin.Click += async (s, e) => await DoLoginAsync();
            pnlCard.Controls.Add(_btnLogin);

            pnlBody.Controls.Add(pnlCard);

            // Enter key trigger
            AcceptButton = _btnLogin;
        }

        private async Task DoLoginAsync()
        {
            string nik = _txtNik.Text.Trim();
            string pass = _txtPassword.Text;

            if (string.IsNullOrWhiteSpace(nik) || string.IsNullOrWhiteSpace(pass))
            {
                _lblStatus.Text = "Harap masukkan NIK/Email dan Password.";
                _lblStatus.ForeColor = Color.FromArgb(220, 38, 38);
                return;
            }

            _btnLogin.Enabled = false;
            _txtNik.Enabled = false;
            _txtPassword.Enabled = false;
            _progressBar.Visible = true;
            _lblStatus.ForeColor = FluentTheme.NavyBrand;
            _lblStatus.Text = "Memvalidasi kredensial ke iDesk IdP...";

            var manager = new DeviceActivationManager(_config.SjaServerUrl);
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            string? token = await manager.LoginDirectAsync(nik, pass, cts.Token);

            _progressBar.Visible = false;

            if (!string.IsNullOrEmpty(token))
            {
                _lblStatus.ForeColor = Color.FromArgb(5, 150, 105);
                _lblStatus.Text = "Autentikasi berhasil. Perangkat terhubung.";
                await Task.Delay(800);
                OnLoginSuccess?.Invoke(token);
                Close();
            }
            else
            {
                _lblStatus.ForeColor = Color.FromArgb(220, 38, 38);
                _lblStatus.Text = "NIK atau Password tidak valid.";
                _btnLogin.Enabled = true;
                _txtNik.Enabled = true;
                _txtPassword.Enabled = true;
                _txtPassword.SelectAll();
                _txtPassword.Focus();
            }
        }

        private Image LoadSantosLogo()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string path = Path.Combine(baseDir, "assets", "santos-logo.png");
                if (File.Exists(path))
                {
                    using var img = Image.FromFile(path);
                    var bmp = new Bitmap(42, 42);
                    using var g = Graphics.FromImage(bmp);
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;

                    using var brush = new SolidBrush(FluentTheme.SubtleSurface);
                    g.FillEllipse(brush, 0, 0, 41, 41);

                    using var pen = new Pen(FluentTheme.BorderSubtle, 1f);
                    g.DrawEllipse(pen, 0, 0, 41, 41);

                    g.DrawImage(img, new Rectangle(6, 6, 30, 30));
                    return bmp;
                }
            }
            catch { }

            var fallback = new Bitmap(42, 42);
            using (var g = Graphics.FromImage(fallback))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using var brush = new SolidBrush(FluentTheme.SubtleSurface);
                g.FillEllipse(brush, 0, 0, 41, 41);

                using var font = FluentTheme.CaptionBold;
                using var textBrush = new SolidBrush(FluentTheme.NavyBrand);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString("SJA", font, textBrush, new RectangleF(0, 0, 42, 42), sf);
            }
            return fallback;
        }
    }
}
