# Panduan Integrasi SSO Keycloak OIDC — PT Santos Jaya Abadi

Dokumentasi ini menjelaskan langkah integrasi aplikasi web existing (`dashboard.santos.co.id`, `iPop`, dll.) ke pusat autentikasi **Keycloak IAM (OAuth 2.0 / OpenID Connect)** yang berjalan di server Santos.

---

## 1. Parameter Konfigurasi Keycloak (Server Santos)

Gunakan parameter resmi berikut untuk seluruh aplikasi internal Santos:

| Parameter | Nilai Server Santos | Keterangan |
| :--- | :--- | :--- |
| **OIDC Discovery URL** | `http://10.10.6.13:18080/realms/santos-corp/.well-known/openid-configuration` | Metadata JSON otomatis |
| **Issuer URL** | `http://10.10.6.13:18080/realms/santos-corp` | Identity Provider resmi |
| **Authorization Endpoint** | `http://10.10.6.13:18080/realms/santos-corp/protocol/openid-connect/auth` | Layar login SSO |
| **Token Endpoint** | `http://10.10.6.13:18080/realms/santos-corp/protocol/openid-connect/token` | Tukar kode jadi JWT |
| **Userinfo Endpoint** | `http://10.10.6.13:18080/realms/santos-corp/protocol/openid-connect/userinfo` | Ambil profil user |
| **JWKS Keystore URL** | `http://10.10.6.13:18080/realms/santos-corp/protocol/openid-connect/certs` | Kunci publik verifikasi JWT |
| **Client ID** | `santos-dashboard` (atau daftarkan nama app Anda) | Terdaftar di Keycloak |
| **Client Type** | `Public Client` (PKCE S256) | Tanpa hardcode client secret |

---

## 2. Pilihan 1: Integrasi Web Node.js / React / Next.js

Jika webapp existing dibangun menggunakan stack **Node.js, Express, React, atau Next.js**, berikut langkah integrasinya:

### A. Next.js / React (Frontend)
Gunakan library standar industri: `next-auth` atau `@react-keycloak/web` / `oidc-client-ts`.

Contoh konfigurasi `next-auth` (`pages/api/auth/[...nextauth].ts` atau `app/api/auth/[...nextauth]/route.ts`):
```typescript
import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: "santos-dashboard",
      clientSecret: "", // Kosongkan jika public client dengan PKCE
      issuer: "http://10.10.6.13:18080/realms/santos-corp",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.nik = profile.preferred_username;
        token.siteCode = profile.siteCode || "SPJ";
      }
      return token;
    },
    async session({ session, token }) {
      // Hubungkan NIK/Email ke tabel database existing Dashboard untuk ambil Role & Hak Akses
      const dbUser = await findUserInDashboardDB(token.email || token.nik);
      session.user.role = dbUser?.role || "USER"; // SUPER ADMIN, ADMIN, dll.
      session.user.siteAccess = dbUser?.siteAccess || "Semua Situs";
      session.user.nik = token.nik;
      return session;
    },
  },
};

export default NextAuth(authOptions);
```

### B. Node.js / Express Backend (Verifikasi Token API)
Gunakan middleware verifikasi JWT dari Keycloak:
```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'http://10.10.6.13:18080/realms/santos-corp/protocol/openid-connect/certs'
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function(err, key) {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyKeycloakToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, getKey, { issuer: 'http://10.10.6.13:18080/realms/santos-corp' }, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token tidak valid' });
    req.user = decoded; // Berisi preferred_username (NIK), email, nama lengkap
    next();
  });
}
```

---

## 3. Pilihan 3: Integrasi Web ASP.NET Core C# (.NET 8 / 10)

Jika webapp existing berbasis **ASP.NET Core C#**, Microsoft menyediakan integrasi native OpenID Connect tanpa perlu coding manual banyak:

### A. Install Nuget Package
```bash
dotnet add package Microsoft.AspNetCore.Authentication.OpenIdConnect
```

### B. Konfigurasi `Program.cs`
```csharp
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddCookie(CookieAuthenticationDefaults.AuthenticationScheme)
.AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
{
    // Konfigurasi Server Keycloak Santos
    options.Authority = "http://10.10.6.13:18080/realms/santos-corp";
    options.ClientId = "santos-dashboard";
    options.ResponseType = OpenIdConnectResponseType.Code;
    options.UsePkce = true; // Wajib: Standar keamanan PKCE S256
    options.SaveTokens = true;
    options.RequireHttpsMetadata = false; // Set true jika sudah pasang SSL domain resmi

    options.Scope.Add("openid");
    options.Scope.Add("profile");
    options.Scope.Add("email");

    options.Events = new OpenIdConnectEvents
    {
        OnTokenValidated = async context =>
        {
            // Ambil NIK dan Email yang tervalidasi dari Keycloak
            var email = context.Principal?.FindFirst("email")?.Value;
            var nik = context.Principal?.FindFirst("preferred_username")?.Value;

            // AMBIL ROLE DARI DATABASE EXISTING DASHBOARD
            var dbService = context.HttpContext.RequestServices.GetRequiredService<DashboardDbContext>();
            var localUser = await dbService.Users.FirstOrDefaultAsync(u => u.Email == email || u.Nik == nik);

            if (localUser != null)
            {
                // Inject Role & Site Access ke ClaimsPrincipal lokal
                var claimsIdentity = (ClaimsIdentity)context.Principal.Identity;
                claimsIdentity.AddClaim(new Claim(ClaimTypes.Role, localUser.Role)); // "SUPER ADMIN"
                claimsIdentity.AddClaim(new Claim("SiteAccess", localUser.SiteAccess)); // "Semua Situs"
            }
        }
    };
});

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
```

---

## 4. Cara Kerja RBAC-nya (Model 1.A yang Anda Pilih)

```
[ Karyawan Login di Keycloak ]
               │
               │ (1) Validasi NIK & Password -> Terbitkan ID Token OIDC
               v
[ Web Dashboard Menerima Identitas: email = "bagastyo.indrastoto@kapalapi.co.id" ]
               │
               │ (2) Query Database Dashboard:
               │     SELECT role, site_access FROM users WHERE email = 'bagastyo...'
               v
[ Ditemukan di Database Dashboard ]:
- Role: SUPER ADMIN
- Situs (Akses): Semua Situs
               │
               v
[ Hak Akses Diaktifkan ]: User langsung masuk ke Dashboard dengan otoritas SUPER ADMIN!
```

**Keunggulan Utama**:
1. Halaman **"Manajemen User"** yang ada di screenshot Anda **TIDAK PERLU DIUBAH ATAU DIHAPUS**.
2. Anda tetap bisa menambah admin baru, mengubah role jadi Super Admin, atau membatasi situs ke `SPJ` langsung dari web Dashboard tersebut.
3. Karyawan login menggunakan **NIK & Password yang sama persis** dengan yang dipakai di iDesk & SJA Notifier.
