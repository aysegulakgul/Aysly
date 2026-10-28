# Güvenlik, Gizlilik ve Kalite Standartları

> Durum: v0.4 · Son güncelleme: 2026-10-28 · Uygulama durumu: Kimlik doğrulama, oturum çerezleri, hız sınırları, Origin kontrolü ve güvenlik başlıkları uygulandı (Faz 2–3, §4.2 notları); diğer kontroller ilgili fazlarda.
> Çalışma ortamı şimdilik yalnızca yerel (D-045). "[MVP]" maddeleri yerelde de uygulanır; yalnızca yayında anlamlı olanlar "[YAYIN]" olarak işaretlidir (OQ-032).
> Referans çerçeve: OWASP ASVS 4.x Seviye 2 (hedef), OWASP Top 10. Yasal ve gizlilik gereksinimleri: [LEGAL_AND_PRIVACY_REQUIREMENTS.md](LEGAL_AND_PRIVACY_REQUIREMENTS.md) (D-049).

Her madde **[MVP]** (lansman öncesi zorunlu) veya **[SONRA]** olarak işaretlidir.

## 1. Tehdit modeli (özet)

| Varlık | Tehdit | Önlem (bölüm) |
|---|---|---|
| Kullanıcı içerikleri | Başka kullanıcının verisine erişim (IDOR) | §3 |
| Hesaplar | Kimlik bilgisi doldurma, kaba kuvvet, oturum çalma | §4 |
| Tarayıcı | XSS (not/açıklama Markdown'ı), CSRF | §5, §6 |
| Veritabanı | SQL injection, yedek sızıntısı | §5, §8 |
| Altyapı | Gizli anahtar sızıntısı, bağımlılık açıkları | §7, §10 |
| Gizlilik | Loglarda kişisel veri, gereğinden uzun saklama | §7, §8 |

## 2. Genel ilkeler
- **Varsayılan reddet:** Açıkça izin verilmeyen her şey yasak.
- **Savunma derinliği:** Kritik kurallar uygulama + veritabanı düzeyinde.
- **En az yetki:** Veritabanı kullanıcısı yalnızca gerekli şemaya erişir; migration kullanıcısı ayrı [MVP].
- **Güvenli varsayılanlar:** Yeni uç nokta oturum gerektirir; açıkça `public` işaretlenmedikçe.

## 3. Yetkilendirme [MVP]
- Her use case `authorize()` çağırır (BR-PERM-001); HTTP katmanında "oturum var mı?" kontrolü yetkilendirme yerine geçmez.
- Tüm repository sorguları `WorkspaceScope` ile (ARCHITECTURE §6).
- Erişilemeyen kaynak 404 (varlık ifşası yok).
- Kimlikler UUIDv7 — tahmin zorluğu ek önlemdir, **güvenlik kontrolü değildir**.
- Her uç nokta için otomatik çapraz kullanıcı testi (TESTING_STRATEGY §5) — `pnpm verify` içinde zorunlu.
- Toplu işlemlerde her kimlik ayrı yetkilendirilir (BR-TASK-008).

## 4. Kimlik doğrulama ve oturum [MVP]

### 4.1. Şifreler
- Hash: kütüphanenin güçlü varsayılanı (scrypt) veya Argon2id; parametreler belgelenir. Düz metin şifre loglanmaz ve hiçbir dış servise gönderilmez.
- Politika: BR-ACC-002.

### 4.2. Oturumlar
- Sunucu tarafı oturum, rastgele ≥ 128 bit token; veritabanında yalnızca hash'i.
- Çerez: `HttpOnly; SameSite=Lax; Path=/`; `Secure` ve `__Host-` öneki [YAYIN]da zorunlu. Yerelde `http://localhost` kullanıldığı için bu iki ayar ortama göre yapılandırılır (ARCHITECTURE §12.3).
- Süreler ve geçersiz kılma: BR-ACC-006. Girişte oturum kimliği yenilenir (session fixation önlemi).

**Uygulama notları (Faz 3):**
- Oturum çerezi `aysly.session_token`: HttpOnly, SameSite=Lax, 30 gün kayan süre (BR-ACC-006). Secure ve `__Host-` öneki yalnızca üretimde. E2E testiyle doğrulandı.
- **Bilinen sapma:** Better Auth oturum token'ını veritabanında açık metin olarak saklar; §4.2 ise yalnızca özetinin saklanmasını öngörür. Çerezdeki değer imzalıdır; veritabanına erişen biri oturumları kullanabilir. Yerel, tek kullanıcılı ortamda kabul edilebilir; yayına alma öncesi ele alınacak (OQ-032 listesine eklendi).
- **90 günlük mutlak oturum sınırı** Better Auth'ta yerleşik değil; şu an yalnızca 30 günlük kayan süre uygulanıyor. Yayına alma öncesi ele alınacak.
- Origin kontrolü: Better Auth uç noktalarında kütüphanenin kendi kontrolü (`trustedOrigins`), kayıt uç noktasında `shared/http/origin.ts`.
- Kayıt hız sınırında `X-Forwarded-For` başlığına güvenilmez; yerelde proxy olmadığından tüm istekler tek anahtarı paylaşır.

### 4.3. Hesap numaralandırmayı önleme
- Giriş hatası genel mesaj; şifre sıfırlama her zaman aynı yanıt; kayıt, mevcut e-postada genel yanıt (mevcut sahibe bilgi e-postası MVP'de yok, D-062).
- Yanıt süreleri benzer tutulur (mevcut olmayan kullanıcı için de hash hesaplanır).

### 4.4. Hız sınırlama
| Uç nokta | Sınır |
|---|---|
| Giriş | 10 / 15 dk / (IP + e-posta); 50 / saat / IP |
| Kayıt | 5 / saat / IP |
| Şifre sıfırlama talebi | 3 / saat / e-posta; 10 / saat / IP |
| Doğrulama e-postası | 3 / saat / kullanıcı |
| Dışa aktarma (şifre doğrulamalı) | 5 / saat / kullanıcı |
| Hesap silme talebi (şifre doğrulamalı) | 3 / gün / kullanıcı |
| Şifre değiştirme / e-posta değiştirme | 5 / saat; 3 / saat / kullanıcı |
| [YAYIN] Arama | 30 / dk / kullanıcı |
| [YAYIN] Genel yazma / okuma API'si | 120 / 600 / dk / kullanıcı |

MVP'de yalnızca kimlik doğrulama ve şifre doğrulamalı uç noktalarda sınır uygulanır; "[YAYIN]" satırları tek kullanıcılı yerel ortamda değer üretmediği için yayına alma öncesine ertelendi (D-061). Sayaç PostgreSQL tabanlıdır. Aşımda `429` + `Retry-After`.

### 4.5. Ek
- Şifre değişikliği ve sıfırlama sonrası "Şifren değişti" güvenlik e-postası [MVP, D-055]; yeni cihazdan giriş bildirimi [SONRA].
- İki aşamalı doğrulama (TOTP/passkey) ve Google vb. giriş yöntemleri [SONRA, D-039].
- Başarısız girişlerde hesap kilitleme yerine artan gecikme + hız sınırı (kilitleme DoS'a açıktır).

## 5. Girdi doğrulama ve çıktı kodlama [MVP]
- Tüm girdiler sunucuda Zod ile (`strict`) doğrulanır; uzunluk sınırları BUSINESS_RULES ve DATA_MODEL ile aynıdır.
- **SQL injection:** Yalnızca ORM / parametreli `sql` şablonu; string birleştirme lint kuralıyla yasak.
- **XSS:**
  - React varsayılan kaçışı; `dangerouslySetInnerHTML` yalnızca sanitize edilmiş Markdown çıktısı için tek bir bileşende (`<SafeMarkdown>`), başka yerde lint ile yasak.
  - Markdown → HTML: `rehype-sanitize` izinli liste (script, iframe, style, `on*` öznitelikleri, `javascript:` URL'leri yasak). Bağlantılar `rel="noopener noreferrer nofollow"`, `target="_blank"`.
  - Sunucu, kaydederken de tehlikeli HTML'i temizler.
- **Content Security Policy:** nonce tabanlı `script-src`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`. Üçüncü taraf script yok.
- **Diğer başlıklar:** `Strict-Transport-Security` [YAYIN], `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (kamera/mikrofon/konum kapalı).
- **Yönlendirmeler:** Giriş sonrası `redirect` parametresi yalnızca uygulama içi göreli yollar (açık yönlendirme önlemi).

## 6. CSRF [MVP]
- `SameSite=Lax` çerez + durum değiştiren tüm isteklerde `Origin` (yoksa `Referer`) başlığının izinli kökenle eşleşmesi zorunlu; eşleşmezse `403 CSRF_REJECTED`.
- `GET` istekleri hiçbir zaman durum değiştirmez.
- CORS: Yalnızca kendi kökeni; `Access-Control-Allow-Credentials` başka kökenlere verilmez.

## 7. Gizli bilgiler, loglama ve izlenebilirlik
- Gizli anahtarlar yalnızca ortam değişkeni/sağlayıcının gizli bilgi deposunda; depoda asla. `gitleaks` (veya eşdeğeri) pre-commit'te ve `pnpm verify` içinde [MVP] (D-057).
- Anahtar rotasyonu belgelenir; `AUTH_SECRET` rotasyonunda tüm oturumlar düşer (kabul edilen sonuç) [MVP: prosedür belgesi].
- **Loglar:** Yapılandırılmış JSON. **Loglanmayanlar:** şifre, token, çerez, `Authorization` başlığı, görev/not içeriği, e-posta adresi (gerekirse hash), IP adresinin tamamı (hash'lenmiş veya kısaltılmış). Merkezi bir `redact` listesi [MVP].
- **Hata mesajları:** İstemciye yalnızca `code`, güvenli `message`, `requestId`. Yığın izi yalnızca sunucu logunda [MVP].
- **Denetim kaydı:** Güvenlik olayları ve yıkıcı işlemler `audit_events` tablosunda (DATA_MODEL §3.14) [MVP].
- **Hata izleme:** MVP'de yok; yerelde yalnızca loglar (D-045). [YAYIN]da eklenirse kişisel veri ve istek gövdeleri gönderilmez.

## 8. Kişisel veriler, yedekleme, dışa aktarma ve silme

### 8.1. Veri envanteri (KVKK/GDPR için temel)
| Veri | Amaç | Saklama |
|---|---|---|
| Ad, e-posta | Hesap, iletişim | Hesap süresince |
| Şifre hash'i | Kimlik doğrulama | Hesap süresince |
| İçerik (görev, not, hedef…) | Hizmet | Hesap süresince + çöp süresi |
| IP (hash), user-agent | Güvenlik, oturum listesi | Oturum süresi; denetimde 1 yıl (hash) |
| Tercihler | Hizmet | Hesap süresince |

### 8.2. Yedekleme ve kurtarma
**Yerel ortam (MVP, D-045, D-060):**
- `pnpm db:backup`: `pg_dump` ile zaman damgalı yedek dosyası üretir; yalnızca son 7 yedeği saklar, eskilerini siler (LEGAL §6.1).
- `pnpm db:restore <dosya>`: Yedeği geri yükler; önce mevcut veritabanının yedeğini alır.
- Migration'lardan önce yedek alınması README'de ve CLAUDE.md'de zorunlu adımdır.
- Yedek klasörü `.gitignore`'dadır (gerçek veri depoya girmez).
- Faz 8'de bir kez geri yükleme denemesi yapılır ve sonuç kaydedilir.

**Yayında (ertelendi, OQ-032):** Yönetilen PostgreSQL ile günlük yedek + PITR, yedek saklama 35 gün, şifreli yedekler, düzenli geri yükleme tatbikatı, RPO/RTO hedefleri.

### 8.3. Dışa aktarma [MVP, D-046]
- Çalışma alanının JSON (sürümlü şema) olarak doğrudan indirilmesi; sunucuda dosya saklanmaz. Kapsam: çalışma alanı içeriği + profil + tercihler; şifreler, gizli anahtarlar ve güvenlik bilgileri (şifre hash'i, oturumlar, token'lar, denetim kayıtları, IP/user-agent) hariç (D-059). Şifreyle yeniden doğrulama gerekir (D-055). Hız sınırı: 5/saat.

### 8.4. Hesap silme [MVP, D-036]
- BR-ACC-005: 14 günlük, iptal edilebilir bekleme, ardından kalıcı silme.
- **Yedekler (D-036 gereği belgelenmiştir):** Hesap silme, daha önce alınmış yedeklerdeki kopyaları anında silmez. Yerelde, 7 yedeklik döngü nedeniyle silinen veri en geç 7 yedek sonra yedeklerden de kalkar. Yayında, yedek saklama süresi (öneri 35 gün) dolunca kalkar ve bu süre gizlilik politikasında belirtilir. Yedekten geri yükleme yapılırsa silinmiş hesaplar yeniden silinir (silinen hesap kimliklerinin listesi tutulur — yalnızca kimlik, kişisel veri değil). Bu liste yalnızca yayında gerekir; yerel MVP'de uygulanmaz (D-061). Ayrıntı: LEGAL_AND_PRIVACY_REQUIREMENTS §6.1.

## 9. Operasyonel erişim [MVP]
- [YAYIN] Üretim veritabanına doğrudan erişim yalnızca acil durumda, kayıt altında ve ürün sahibinin bilgisiyle.
- Destek amaçlı kullanıcı verisi görüntüleme özelliği **yoktur** (D-004 ruhu). Gerekirse kullanıcının açık rızasıyla ve denetimli bir süreçle eklenir [SONRA].

## 10. Bağımlılık ve tedarik zinciri güvenliği [MVP]
- `pnpm` kilit dosyası zorunlu; doğrulamada `--frozen-lockfile`.
- Bağımlılık güncellemeleri düzenli (öneri: iki haftada bir) `pnpm outdated` + `pnpm audit` ile gözden geçirilir; uzak depo ve otomatik güncelleme PR'ları ileride değerlendirilir (D-057).
- `pnpm verify` içinde `pnpm audit` (yüksek/kritik açıkta başarısız).
- Yeni bağımlılık eklemek gerekçe gerektirir (CODING_STANDARDS §9): bakım durumu, lisans, boyut, alternatif.
- `postinstall` script'leri olan paketler incelenir; pnpm'in `onlyBuiltDependencies` izin listesi.

## 11. Erişilebilirlik, performans, uyumluluk (kalite)
- Erişilebilirlik: UI_UX §10; otomatik testlerde axe kontrolü [MVP].
- Performans: NFR-01..03; Lighthouse bütçesi (LCP < 2,5 sn, toplam JS < 250 KB gzip ilk yük) [MVP: ölçüm; bütçe uygulaması SONRA].
- Tarayıcı uyumluluğu: NFR-05; Playwright Chromium + Firefox + WebKit [MVP: duman testleri üçünde].

## 12. Güvenlik olayı müdahalesi [MVP: temel prosedür]
1. Tespit (loglar, kullanıcı bildirimi; yayında hata izleme ve uyarılar).
2. Sınırlama (anahtar rotasyonu, oturumları düşürme, özelliği kapatma).
3. Değerlendirme (etkilenen kullanıcılar/veri).
4. Bildirim — KVKK kapsamında Kurul'a ve etkilenenlere yasal süre içinde (LEGAL §7, hukuki teyit gerekli).
5. Olay sonrası inceleme ve DECISIONS.md'ye kayıt.

## 13. MVP / SONRA özeti
| Konu | MVP | SONRA |
|---|---|---|
| Sunucu tarafı yetki + çapraz kullanıcı testleri | ✔ | RLS (Faz 10) |
| Oturum güvenliği, kimlik doğrulama hız sınırı, numaralandırma önlemi | ✔ | Genel API hız sınırları [YAYIN] (D-061) |
| XSS/CSRF/SQLi önlemleri, CSP, güvenlik başlıkları | ✔ | |
| Gizli anahtar taraması, bağımlılık taraması | ✔ | SBOM |
| Yerel yedek + geri yükleme betiği | ✔ | Yönetilen yedek, PITR, tatbikat [YAYIN] |
| Dışa aktarma, hesap silme | ✔ (Faz 8) | CSV, içe aktarma |
| 2FA / passkey | | ✔ |
| Sızma testi (pentest) | — | Yayın öncesi hafif dış inceleme |
| Bug bounty / `security.txt` | — | [YAYIN] `security.txt`; program sonra |
| Yasal metinler | Gereksinimler belgelendi (LEGAL) | Lansman öncesi hazırlık ve hukuki inceleme (D-049) |
