# Aysly

**Yapılacakları değil, düzeni yönet.**

Aysly; görevleri, projeleri, günlük planı, notları ve hedefleri tek, sakin bir çalışma alanında birleştiren web uygulamasıdır. Kişisel ve profesyonel işler tek hesapta yönetilir. İlk sürüm bireysel kullanıma odaklanır; mimari, ileride ekip çalışmasını destekleyecek şekilde tasarlanmıştır.

## Proje durumu

| | |
|---|---|
| Mevcut faz | **Faz 1 — Ürün analizi ve dokümantasyon** |
| Uygulama kodu | **Henüz yok** |
| Çalışma ortamı | Yalnızca yerel bilgisayar; hosting ve ücretli servis yok |
| Teknoloji | Next.js, TypeScript, PostgreSQL, Drizzle, Better Auth |
| Sonraki adım | [OQ-033 ve OQ-034](docs/OPEN_QUESTIONS.md) yanıtı ve Faz 1 kapanış onayı |

Ayrıntılı durum: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

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

> ⚠️ **Henüz uygulanmadı.** Aşağıdaki adımlar Faz 2'de geçerli olacak **hedef** adımlardır. Uygulama yalnızca yerel bilgisayarda çalışır; hosting veya ücretli servis gerekmez. PostgreSQL ve yerel e-posta yakalayıcı (Mailpit) Docker Desktop üzerinde çalışır (D-056).

Gereksinimler (planlanan): Node.js LTS, pnpm, Docker Desktop (PostgreSQL ve Mailpit konteynerleri, D-056).

Planlanan adımlar: bağımlılıkları kur (`pnpm install`) → `docker compose up -d` (PostgreSQL + Mailpit) → `.env.example` dosyasını `.env` olarak kopyala → `pnpm db:migrate` → (isteğe bağlı) `pnpm db:seed` → `pnpm dev` → `http://localhost:3000`.

Planlanan komutlar: `pnpm verify` (tüm kontroller), `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm db:backup`, `pnpm db:restore`.

Gerçek verini içeren veritabanına migration uygulamadan önce mutlaka `pnpm db:backup` çalıştır.

## Geliştirme süreci
Her geliştirme [CLAUDE.md §7](CLAUDE.md) sürecini izler: belgeleri oku → etkiyi değerlendir → gerekirse onay al → geliştir → test et → belgeleri güncelle → raporla. Fazlar arası geçiş [faz kapısı](docs/IMPLEMENTATION_PLAN.md) kontrolüne tabidir.
