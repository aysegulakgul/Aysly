# Aysly

**Yapılacakları değil, düzeni yönet.**

Aysly; görevleri, projeleri, günlük planı, notları ve hedefleri tek, sakin bir çalışma alanında birleştiren web uygulamasıdır. Kişisel ve profesyonel işler tek hesapta yönetilir. İlk sürüm bireysel kullanıma odaklanır; mimari, ileride ekip çalışmasını destekleyecek şekilde tasarlanmıştır.

## Proje durumu

| | |
|---|---|
| Mevcut faz | **Faz 4 — Görevler, Inbox, My Tasks, dashboard** (tamamlandı, kapanış onayı bekliyor) |
| Uygulama kodu | Hesap, onboarding, tercihler ve görev yönetimi çalışıyor (aşağıdaki "Özellikler") |
| Çalışma ortamı | Yalnızca yerel bilgisayar; hosting ve ücretli servis yok |
| Teknoloji | Next.js, TypeScript, PostgreSQL, Drizzle, Better Auth |
| Sonraki adım | Faz 4 kapanış onayı, ardından Faz 5 (projeler ve görünümler) |

Ayrıntılı durum: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Özellikler

Şu an çalışanlar (Faz 1–4):
- **Hesap:** E-posta doğrulamalı kayıt, giriş, şifre sıfırlama, oturum ve cihaz yönetimi, profil.
- **İlk kullanım:** Kullanım amacı ve tercihlere göre kurulum rehberi; "İlk adımlar" listesi.
- **Tercihler:** Dil, saat dilimi, hafta başlangıcı, saat biçimi, tema.
- **Görevler:** Inbox ve hızlı ekleme; tarih/saat (saat dilimi ve yaz saati geçişleri dahil), öncelik, açıklama, etiketler, alt görevler; projeye taşıma; tamamlama ve 5 saniyelik "Geri al".
- **Görünümler:** Bugün (Bugün, Geciken, Yaklaşan, Öncelikli bölümleri; düzenlenebilir), Görevlerim (tarihe göre gruplu), Yaklaşanlar (7 gün), görev detay paneli.
- **Arşiv ve çöp kutusu:** Arşivleme, geri yükleme, 30 gün sonra otomatik kalıcı silme.
- **Klavye kısayolları:** `Q`, `G D/I/M/U`, `J/K`, `T/M/L`, `Ctrl/⌘+Z`, `?` rehberi.

Plan gereği sonraki fazlarda: projeler ve pano görünümü, toplu işlemler, kayıtlı görünümler (Faz 5); hatırlatıcılar, tekrarlayan görevler, takvim (Faz 6); notlar, hedefler, arama (Faz 7).

**Mimari özet:** Modüler monolit (`src/modules/<modül>/{domain,application,infrastructure,http}`), yetkilendirme her istekte sunucuda, Zod ile doğrulama, REST API (`/api/v1`), `pnpm verify` ile 13 adımlı yerel kalite kontrolü (birim, entegrasyon ve Playwright testleri dahil).

## Belgeler

| Belge | İçerik |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude için bağlayıcı geliştirme talimatları ve süreç |
| [docs/PRD.md](docs/PRD.md) | Vizyon, problem, MVP kapsamı, fonksiyonel ve fonksiyonel olmayan gereksinimler, başarı kriterleri |
| [docs/USER_PERSONAS.md](docs/USER_PERSONAS.md) | Segment / rol / plan / çalışma alanı / tercih ayrımı, personalar |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Bilgi mimarisi, ekranlar, kullanıcı akışları |
| [docs/ONBOARDING_AND_PERSONALIZATION.md](docs/ONBOARDING_AND_PERSONALIZATION.md) | İlk kullanım ve kişiselleştirme |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Merkezi iş kuralları (`BR-*`) — tek gerçek kaynak |
| [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) | Roller, izinler, yetki matrisi |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Teknoloji seçimi, katmanlar, modüller, dağıtım |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Tablolar, ilişkiler, kısıtlar, indeksler, yaşam döngüsü |
| [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) | REST API sözleşmeleri ve hata kodları |
| [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | SOLID ve kodlama kuralları |
| [docs/SECURITY.md](docs/SECURITY.md) | Güvenlik, gizlilik, yedekleme |
| [docs/ERROR_HANDLING_AND_EDGE_CASES.md](docs/ERROR_HANDLING_AND_EDGE_CASES.md) | Hata durumları, uç senaryolar, kullanıcı mesajları |
| [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) | Test piramidi, kabul kriterleri, yerel doğrulama (`pnpm verify`) |
| [docs/UI_UX_DESIGN_SYSTEM.md](docs/UI_UX_DESIGN_SYSTEM.md) | Tasarım sistemi, wireframe'ler, erişilebilirlik |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Fazlar, faz kapıları, durum tablosu |
| [docs/FIGMA_INVENTORY.md](docs/FIGMA_INVENTORY.md) | Figma dosyası, ekran ve bileşen düğüm kimlikleri, eksik ekranlar |
| [docs/LEGAL_AND_PRIVACY_REQUIREMENTS.md](docs/LEGAL_AND_PRIVACY_REQUIREMENTS.md) | KVKK, gizlilik ve kullanım koşulları gereksinimleri |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Karar kaydı |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | Karar bekleyen konular |

### Durum etiketleri
Belgelerde her karar/kural bir etiket taşır: `ONAYLI` (ürün sahibi onayladı) · `ÖNERİ` (Claude önerisi, onay bekliyor) · `AÇIK (OQ-xxx)` (karar verilmedi) · `SONRA` (MVP dışı). Yalnızca `ONAYLI` olanlar uygulanır.

## Kurulum ve çalıştırma

Uygulama yalnızca bu bilgisayarda (yerel) çalışır; hosting veya ücretli servis gerekmez (D-045).

**Gereksinimler:** Node.js 22 veya üstü, pnpm 10 (`npm install -g pnpm@10`), Docker Desktop (açık olmalı), Git.

**İlk kurulum** (proje klasöründe, sırayla):
1. `pnpm install` — bağımlılıkları kurar.
2. `docker compose up -d` — PostgreSQL 17 (port 5433) ve Mailpit (e-posta yakalayıcı) başlatılır.
3. `.env.example` dosyasını `.env` adıyla kopyala (yerel değerler hazırdır), ardından `pnpm setup:env` ile oturum imzalama anahtarını (`AUTH_SECRET`) yerelde üret. Anahtar yalnızca `.env` içinde kalır, depoya girmez.
4. `pnpm db:migrate` — veritabanını günceller.
5. `pnpm hooks:install` — commit öncesi hızlı kontrolleri etkinleştirir.
6. `pnpm dev` — uygulama `http://localhost:3000` adresinde açılır.

**Yararlı adresler (geliştirme):**
- `http://localhost:3000/dev/ui` — Figma bileşenlerinin karşılaştırma sayfası (yalnızca geliştirmede).
- `http://localhost:8025` — Mailpit: uygulamanın gönderdiği e-postalar burada görünür, dışarı gönderilmez.
- `http://localhost:3000/api/health/ready` — uygulama ve veritabanı durumu.

**Komutlar:**
| Komut | Ne yapar |
|---|---|
| `pnpm verify` | Tüm kontroller: biçim, lint, tip, mimari, testler (birim, entegrasyon, tarayıcı), derleme, bağımlılık güvenliği |
| `pnpm test` / `pnpm test:integration` / `pnpm test:e2e` | Birim / gerçek veritabanlı entegrasyon / tarayıcı testleri |
| `pnpm db:backup` | Yerel veritabanını `backups/` klasörüne yedekler (son 7 yedek saklanır) |
| `pnpm db:restore backups/<dosya>.dump` | Önce güncel yedeği alır, sonra seçilen yedeği geri yükler |
| `pnpm arch` | Mimari katman kurallarını denetler |

> Gerçek verini içeren veritabanına migration uygulamadan önce mutlaka `pnpm db:backup` çalıştır.
> Entegrasyon testleri kendi geçici veritabanlarını açar; senin verine dokunmaz.

## Geliştirme süreci
Her geliştirme [CLAUDE.md §7](CLAUDE.md) sürecini izler: belgeleri oku → etkiyi değerlendir → gerekirse onay al → geliştir → test et → belgeleri güncelle → raporla. Fazlar arası geçiş [faz kapısı](docs/IMPLEMENTATION_PLAN.md) kontrolüne tabidir.
