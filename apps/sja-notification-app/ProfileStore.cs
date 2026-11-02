using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SJANotificationApp
{
    /// <summary>
    /// Represents a single user profile container (similar to Google Chrome user profiles).
    /// Multiple profiles can exist on a single machine, with individual sessions and optional PIN protection.
    /// </summary>
    public class ProfileItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Name { get; set; } = "Profil 1";
        public string AvatarColorHex { get; set; } = "#2563EB";
        public UserProfileSession? Session { get; set; }
        public string? PinSalt { get; set; }
        public string? PinHash { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastActiveAt { get; set; } = DateTime.UtcNow;

        public bool HasPin => !string.IsNullOrEmpty(PinHash) && !string.IsNullOrEmpty(PinSalt);
        public bool IsLoggedIn => Session != null && !string.IsNullOrWhiteSpace(Session.Token);
    }

    /// <summary>
    /// Root bundle stored encrypted via DPAPI in profiles.dat.
    /// </summary>
    public class ProfileDataBundle
    {
        public string ActiveProfileId { get; set; } = string.Empty;
        public List<ProfileItem> Profiles { get; set; } = new();
    }

    /// <summary>
    /// Thread-safe multi-profile store with DPAPI encryption and PBKDF2 PIN hashing.
    /// </summary>
    public class ProfileStore
    {
        private static ProfileStore? _instance;
        public static ProfileStore Instance => _instance ??= new ProfileStore();

        private static readonly string StorageDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SJANotifier"
        );
        private static readonly string ProfilesPath = Path.Combine(StorageDirectory, "profiles.dat");
        private static readonly string LegacyDevicePath = Path.Combine(StorageDirectory, "device.dat");

        private ProfileDataBundle _data = new();
        private readonly object _lock = new();

        public event Action? ActiveProfileChanged;
        public event Action? ProfilesListChanged;

        public ProfileStore()
        {
            Load();
        }

        public IReadOnlyList<ProfileItem> GetAllProfiles()
        {
            lock (_lock)
            {
                return _data.Profiles.ToList();
            }
        }

        public ProfileItem GetActiveProfile()
        {
            lock (_lock)
            {
                var active = _data.Profiles.FirstOrDefault(p => p.Id == _data.ActiveProfileId);
                if (active == null)
                {
                    if (_data.Profiles.Count == 0)
                    {
                        active = new ProfileItem { Name = "Profil 1", AvatarColorHex = "#2563EB" };
                        _data.Profiles.Add(active);
                    }
                    else
                    {
                        active = _data.Profiles[0];
                    }
                    _data.ActiveProfileId = active.Id;
                    SaveInternal();
                }
                return active;
            }
        }

        public UserProfileSession? GetActiveSession()
        {
            lock (_lock)
            {
                return GetActiveProfile().Session;
            }
        }

        public void SetActiveSession(UserProfileSession? session)
        {
            lock (_lock)
            {
                var active = GetActiveProfile();
                active.Session = session;
                active.LastActiveAt = DateTime.UtcNow;
                if (session != null && !string.IsNullOrWhiteSpace(session.FullName) && active.Name.StartsWith("Profil "))
                {
                    active.Name = session.FullName;
                }
                SaveInternal();
            }
            ActiveProfileChanged?.Invoke();
        }

        public void ClearActiveSession()
        {
            lock (_lock)
            {
                var active = GetActiveProfile();
                active.Session = null;
                active.LastActiveAt = DateTime.UtcNow;
                SaveInternal();
            }
            ActiveProfileChanged?.Invoke();
        }

        public bool SwitchProfile(string profileId, string? pin, out string? errorMessage)
        {
            errorMessage = null;
            lock (_lock)
            {
                var target = _data.Profiles.FirstOrDefault(p => p.Id == profileId);
                if (target == null)
                {
                    errorMessage = "Profil tidak ditemukan.";
                    return false;
                }

                if (target.HasPin)
                {
                    if (string.IsNullOrEmpty(pin) || !VerifyPin(pin, target.PinSalt!, target.PinHash!))
                    {
                        errorMessage = "PIN keamanan profil tidak sesuai.";
                        return false;
                    }
                }

                _data.ActiveProfileId = target.Id;
                target.LastActiveAt = DateTime.UtcNow;
                SaveInternal();
            }

            ActiveProfileChanged?.Invoke();
            return true;
        }

        public ProfileItem AddProfile(string name, string? pin = null)
        {
            ProfileItem item;
            lock (_lock)
            {
                string[] colors = { "#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2" };
                string chosenColor = colors[_data.Profiles.Count % colors.Length];
                item = new ProfileItem
                {
                    Name = string.IsNullOrWhiteSpace(name) ? $"Profil {_data.Profiles.Count + 1}" : name.Trim(),
                    AvatarColorHex = chosenColor
                };

                if (!string.IsNullOrWhiteSpace(pin))
                {
                    var (s, h) = HashPin(pin);
                    item.PinSalt = s;
                    item.PinHash = h;
                }

                _data.Profiles.Add(item);
                _data.ActiveProfileId = item.Id;
                SaveInternal();
            }

            ProfilesListChanged?.Invoke();
            ActiveProfileChanged?.Invoke();
            return item;
        }

        public bool RemoveProfile(string profileId, out string? errorMessage)
        {
            errorMessage = null;
            lock (_lock)
            {
                if (_data.Profiles.Count <= 1)
                {
                    errorMessage = "Tidak dapat menghapus satu-satunya profil yang ada.";
                    return false;
                }

                var target = _data.Profiles.FirstOrDefault(p => p.Id == profileId);
                if (target == null)
                {
                    errorMessage = "Profil tidak ditemukan.";
                    return false;
                }

                _data.Profiles.Remove(target);

                if (_data.ActiveProfileId == profileId)
                {
                    _data.ActiveProfileId = _data.Profiles[0].Id;
                }

                SaveInternal();
            }

            ProfilesListChanged?.Invoke();
            ActiveProfileChanged?.Invoke();
            return true;
        }

        public void SetPin(string profileId, string? pin)
        {
            lock (_lock)
            {
                var target = _data.Profiles.FirstOrDefault(p => p.Id == profileId);
                if (target == null) return;

                if (string.IsNullOrWhiteSpace(pin))
                {
                    target.PinSalt = null;
                    target.PinHash = null;
                }
                else
                {
                    var (s, h) = HashPin(pin);
                    target.PinSalt = s;
                    target.PinHash = h;
                }

                SaveInternal();
            }
            ActiveProfileChanged?.Invoke();
        }

        public static (string Salt, string Hash) HashPin(string pin)
        {
            byte[] salt = RandomNumberGenerator.GetBytes(16);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(pin, salt, 100_000, HashAlgorithmName.SHA256, 32);
            return (Convert.ToBase64String(salt), Convert.ToBase64String(hash));
        }

        public static bool VerifyPin(string pin, string saltBase64, string hashBase64)
        {
            try
            {
                byte[] salt = Convert.FromBase64String(saltBase64);
                byte[] expectedHash = Convert.FromBase64String(hashBase64);
                byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(pin, salt, 100_000, HashAlgorithmName.SHA256, 32);
                return CryptographicOperations.FixedTimeEquals(expectedHash, actualHash);
            }
            catch
            {
                return false;
            }
        }

        public void Load()
        {
            lock (_lock)
            {
                try
                {
                    if (File.Exists(ProfilesPath))
                    {
                        byte[] cipherBytes = File.ReadAllBytes(ProfilesPath);
                        byte[] plainBytes = ProtectedData.Unprotect(cipherBytes, null, DataProtectionScope.CurrentUser);
                        string json = Encoding.UTF8.GetString(plainBytes);
                        _data = JsonSerializer.Deserialize<ProfileDataBundle>(json) ?? new ProfileDataBundle();
                    }
                    else if (File.Exists(LegacyDevicePath))
                    {
                        UserProfileSession? legacySession = null;
                        try
                        {
                            byte[] legacyCipher = File.ReadAllBytes(LegacyDevicePath);
                            byte[] legacyPlain = ProtectedData.Unprotect(legacyCipher, null, DataProtectionScope.CurrentUser);
                            string raw = Encoding.UTF8.GetString(legacyPlain);
                            if (raw.TrimStart().StartsWith("{"))
                            {
                                legacySession = JsonSerializer.Deserialize<UserProfileSession>(raw);
                            }
                            else
                            {
                                legacySession = new UserProfileSession { Token = raw.Trim() };
                            }
                        }
                        catch { }

                        string initialName = !string.IsNullOrWhiteSpace(legacySession?.FullName)
                            ? legacySession.FullName
                            : "Profil 1";

                        var p1 = new ProfileItem
                        {
                            Name = initialName,
                            Session = legacySession,
                            AvatarColorHex = "#2563EB"
                        };

                        _data = new ProfileDataBundle
                        {
                            ActiveProfileId = p1.Id,
                            Profiles = new List<ProfileItem> { p1 }
                        };

                        SaveInternal();
                        AppLogger.Info("[ProfileStore] Berhasil migrasi device.dat legacy ke ProfileStore.");
                    }
                    else
                    {
                        var defaultProfile = new ProfileItem { Name = "Profil 1", AvatarColorHex = "#2563EB" };
                        _data = new ProfileDataBundle
                        {
                            ActiveProfileId = defaultProfile.Id,
                            Profiles = new List<ProfileItem> { defaultProfile }
                        };
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error("Gagal memuat ProfileStore", ex);
                    var fallback = new ProfileItem { Name = "Profil 1", AvatarColorHex = "#2563EB" };
                    _data = new ProfileDataBundle
                    {
                        ActiveProfileId = fallback.Id,
                        Profiles = new List<ProfileItem> { fallback }
                    };
                }
            }
        }

        private void SaveInternal()
        {
            try
            {
                if (!Directory.Exists(StorageDirectory))
                {
                    Directory.CreateDirectory(StorageDirectory);
                }

                string json = JsonSerializer.Serialize(_data, new JsonSerializerOptions { WriteIndented = true });
                byte[] plainBytes = Encoding.UTF8.GetBytes(json);
                byte[] cipherBytes = ProtectedData.Protect(plainBytes, null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(ProfilesPath, cipherBytes);

                // Sync active profile session to legacy device.dat
                var activeSession = GetActiveSession();
                if (activeSession != null)
                {
                    byte[] legacyBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(activeSession));
                    byte[] legacyCipher = ProtectedData.Protect(legacyBytes, null, DataProtectionScope.CurrentUser);
                    File.WriteAllBytes(LegacyDevicePath, legacyCipher);
                }
                else
                {
                    if (File.Exists(LegacyDevicePath))
                    {
                        File.Delete(LegacyDevicePath);
                    }
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error("Gagal menyimpan ProfileStore ke DPAPI", ex);
            }
        }
    }
}
