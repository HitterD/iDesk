using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace SJANotificationApp
{
    class Program
    {
        private static Mutex? _singleInstanceMutex;

        [System.Runtime.InteropServices.DllImport("shell32.dll", SetLastError = true)]
        private static extern void SetCurrentProcessExplicitAppUserModelID([System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPWStr)] string AppID);

        public const string AppUserModelId = "SantosJayaAbadi.Idesk.Notifier";

        [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetThreadDesktop(IntPtr hDesktop);

        private const int DESKTOP_ALL = 0x01FF;

        public static void EnsureInteractiveDesktop()
        {
            try
            {
                IntPtr hDefault = OpenDesktop("Default", 0, false, DESKTOP_ALL);
                if (hDefault != IntPtr.Zero)
                {
                    bool switched = SetThreadDesktop(hDefault);
                    AppLogger.Info($"[Program] EnsureInteractiveDesktop SetThreadDesktop('Default') switched={switched}");
                }
                else
                {
                    int err = System.Runtime.InteropServices.Marshal.GetLastWin32Error();
                    AppLogger.Warn($"[Program] EnsureInteractiveDesktop OpenDesktop('Default') failed, err={err}");
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warn($"[Program] EnsureInteractiveDesktop exception: {ex.Message}");
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                SetCurrentProcessExplicitAppUserModelID(AppUserModelId);
            }
            catch {}

            // Pastikan thread aplikasi terhubung ke desktop interaktif Windows (WinSta0\Default)
            EnsureInteractiveDesktop();

            if (args != null && args.Length > 0 && args[0] == "--test-render-main")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                string mode = args.Length > 1 ? args[1] : "dashboard";
                bool isLight = args.Length > 2 && args[2].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                var config = new AppConfig();
                using var form = new MainWindowForm(config, true);
                form.PreviewState(mode);
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new System.Drawing.Point(-2000, -2000);
                form.Show();
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, form.Width, form.Height));

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string themeLabel = isLight ? "light" : "dark";
                string outFilename = $"main-window-{mode}-{themeLabel}-preview.png";
                string outPath = Path.Combine(baseDir, outFilename);
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }

            if (args != null && args.Length > 0 && args[0] == "--test-render-tray")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool isLight = args.Length > 1 && args[1].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                var tray = new TrayApplicationContext();
                var mi = typeof(TrayApplicationContext).GetMethod("BuildContextMenu", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                var menu = (ContextMenuStrip)mi!.Invoke(tray, null)!;

                menu.Show(new System.Drawing.Point(-2000, -2000));
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(menu.Width, menu.Height);
                menu.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, menu.Width, menu.Height));

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string themeLabel = isLight ? "light" : "dark";
                string outFilename = $"tray-menu-{themeLabel}-preview.png";
                string outPath = Path.Combine(baseDir, outFilename);
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }

            if (args != null && args.Length > 0 && args[0] == "--test-render-popup")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool isBroadcast = args.Length > 1 && args[1].Equals("broadcast", StringComparison.OrdinalIgnoreCase);
                bool isLight = args.Length > 2 && args[2].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string sampleImgPath = Path.Combine(baseDir, "assets", "santos-logo.png");

                var dummy = isBroadcast
                    ? new NotificationData
                    {
                        App = "SJA",
                        TicketNumber = "BRD-6138",
                        Category = "SYSTEM_BROADCAST",
                        From = "SJA",
                        Title = "[SJA] BRD-6138",
                        Message = "Pengumuman Resmi ICT Site SPJ: Pemeliharaan berkala server dan WiFi kantor SPJ malam ini pukul 21:00 WIB.",
                        Priority = "normal",
                        Url = "https://idesk.santos.co.id/broadcast/BRD-6138"
                    }
                    : new NotificationData
                    {
                        App = "iDesk Support",
                        TicketNumber = "TKT-2026-1042",
                        Category = "Hardware Support",
                        From = "Mas Yudi Yudi (Staff SPJ)",
                        Title = "Tiket Baru #TKT-2026-1042: Kendala Printer Lantai 2",
                        Message = "Dear Tim IT, printer jaringan di lantai 2 SPJ mendadak offline dan antrean cetak macet. Foto printer terlampir di bawah:",
                        Priority = "high",
                        Url = "https://idesk.santos.co.id/tickets/TKT-2026-1042",
                        Attachments = new System.Collections.Generic.List<NotificationAttachment>
                        {
                            new NotificationAttachment { Name = "foto-printer-error.png", Size = "240 KB", Url = sampleImgPath },
                            new NotificationAttachment { Name = "log-antrean-cetak.xlsx", Size = "45 KB", Url = "https://idesk.santos.co.id/attachments/2" }
                        }
                    };

                using var form = new NotificationPopupForm(dummy);
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new System.Drawing.Point(-2000, -2000);
                form.Show();
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, form.Width, form.Height));

                string themeLabel = isLight ? "light" : "dark";
                string outFilename = isBroadcast ? $"popup-preview-broadcast-{themeLabel}.png" : $"popup-preview-image-{themeLabel}.png";
                string outPath = Path.Combine(baseDir, outFilename);
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }

            if (args != null && args.Length > 0 && args[0] == "--test-render-settings")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool isLight = args.Length > 1 && args[1].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                var config = new AppConfig();
                using var form = new SettingsForm(config);
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new System.Drawing.Point(-2000, -2000);
                form.Show();
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, form.Width, form.Height));

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string themeLabel = isLight ? "light" : "dark";
                string outFilename = $"settings-window-{themeLabel}-preview.png";
                string outPath = Path.Combine(baseDir, outFilename);
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }

            if (args != null && args.Length > 0 && args[0] == "--test-render-history")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool isLight = args.Length > 1 && args[1].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                // Populate a mock item if empty
                LocalNotificationHistory.Add(new NotificationData
                {
                    App = "iDesk Support",
                    TicketNumber = "TKT-2026-1042",
                    Title = "Tiket Baru #TKT-2026-1042: Kendala Printer Lantai 2",
                    Message = "Dear Tim IT, printer jaringan di lantai 2 SPJ mendadak offline dan antrean cetak macet.",
                    Priority = "high",
                    Timestamp = DateTime.Now.AddMinutes(-12)
                });

                var config = new AppConfig();
                using var form = new HistoryForm(config);
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new System.Drawing.Point(-2000, -2000);
                form.Show();
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, form.Width, form.Height));

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string themeLabel = isLight ? "light" : "dark";
                string outFilename = $"history-window-{themeLabel}-preview.png";
                string outPath = Path.Combine(baseDir, outFilename);
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }

            // 1. Pastikan hanya ada 1 instance SJANotifier yang berjalan di taskbar
            const string appGuid = "Global\\SJANotificationApp_SantosJayaAbadi_v2";
            _singleInstanceMutex = new Mutex(true, appGuid, out bool isNewInstance);
            if (!isNewInstance)
            {
                // Instance sudah aktif di tray
                return;
            }

            try
            {
                var uiThread = new Thread(() =>
                {
                    // Pastikan thread UI terhubung ke desktop interaktif Windows (WinSta0\Default)
                    EnsureInteractiveDesktop();
                    try { SetCurrentProcessExplicitAppUserModelID(AppUserModelId); } catch {}

                    // Inisialisasi visual styles Windows Forms untuk Tray
                    Application.SetHighDpiMode(HighDpiMode.SystemAware);
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);

                    // Jalankan message loop Windows Forms dengan TrayApplicationContext
                    var trayContext = new TrayApplicationContext();
                    Application.Run(trayContext);
                });
                uiThread.SetApartmentState(ApartmentState.STA);
                uiThread.IsBackground = false;
                uiThread.Start();
                uiThread.Join();
            }
            finally
            {
                _singleInstanceMutex?.ReleaseMutex();
                _singleInstanceMutex?.Dispose();
            }
        }
    }
}
