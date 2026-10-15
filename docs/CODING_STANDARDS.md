# Kodlama Standartları ve SOLID

> Durum: v0.3 · Son güncelleme: 2026-10-15
> İlgili: [ARCHITECTURE.md](ARCHITECTURE.md) (katmanlar ve klasörler bu belgede tekrar edilmez)

## 1. Genel
- **Dil:** TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. `any` yasak (zorunluysa `unknown` + daraltma). `@ts-ignore` yasak; `@ts-expect-error` yalnızca açıklama ile.
- **Biçim:** Prettier (varsayılanlar + `printWidth: 100`). Lint: ESLint (typescript-eslint strict, react, jsx-a11y, import kuralları).
- **Kod dili:** Kod, tanımlayıcılar, commit mesajları ve kod yorumları **İngilizce**; kullanıcıya görünen metinler çeviri dosyalarında (Türkçe/İngilizce); belgeler Türkçe. (D-060 — gerekçe: kütüphane/ekosistem uyumu, gelecekteki katkıcılar.)
- **İsimlendirme:** Dosyalar `kebab-case.ts`; türler/sınıflar `PascalCase`; fonksiyon/değişken `camelCase`; sabitler `SCREAMING_SNAKE_CASE` yalnızca gerçek sabitlerde. Use case adları fiil: `CompleteTask`, `MoveTaskToProject`.
- **Fonksiyon boyutu:** Bir fonksiyon tek iş yapar; ~40 satırı geçiyorsa bölünmesi değerlendirilir (kesin kural değil).
- **Yorumlar:** "Ne" değil "neden". İş kuralı uygulayan satırda kural kimliği: `// BR-TASK-004`.

## 2. SOLID — Aysly'deki somut karşılıkları

| İlke | Aysly'de anlamı | Örnek | İhlal örneği (yapma) |
|---|---|---|---|
| **S** Tek sorumluluk | Bir use case tek iş akışını yönetir; bir bileşen tek UI işini yapar; domain varlığı yalnızca kendi değişmezlerini korur. | `CompleteTask` tamamlamayı orkestre eder; tekrar hesabı `nextOccurrence()` saf fonksiyonunda. | `TaskService` adlı, her şeyi yapan 1.500 satırlık sınıf; tarih hesabı yapan React bileşeni. |
| **O** Açık/kapalı | Yeni davranış, mevcut kodu değiştirmeden eklenebilir uzantı noktalarıyla. | Yeni bildirim kanalı = yeni `NotificationChannel` uygulaması + kayıt; yeni widget = widget kayıt listesine ekleme. | Her yeni kanal için `switch` ifadesine dal eklemek ve 5 dosyayı değiştirmek. |
| **L** Liskov | Bir portun her uygulaması aynı sözleşmeyi korur. | `InMemoryTaskRepository` (test) ve `DrizzleTaskRepository` aynı sürüm çakışması davranışını gösterir; ikisi de aynı sözleşme test paketinden geçer. | Test sahte nesnesinin çakışmayı hiç algılamaması → testler gerçeği yansıtmaz. |
| **I** Arayüz ayrımı | Portlar kullanıcısının ihtiyacı kadar küçüktür. | `TaskReader` (okuma) ve `TaskWriter` (yazma) ayrı; dashboard yalnızca `TaskReader` alır. | 30 metotlu `ITaskRepository`'yi her yere enjekte etmek. |
| **D** Bağımlılığın tersine çevrilmesi | Application katmanı somut altyapıya değil portlara bağlıdır. | `CompleteTask(deps: { tasks: TaskWriter; clock: Clock; reminders: ReminderScheduler })`. | Use case içinde `import { db } from '@/shared/db'` veya `new Date()`. |

### 2.1. Aşırı mühendislikten kaçınma
- Tek uygulaması olan ve test için de değiştirilmesi gerekmeyen bir şey için arayüz **yazılmaz** (ör. saf yardımcı fonksiyonlar).
- Port yalnızca şu durumlarda: dış sistem (DB, e-posta, saat, rastgelelik, kuyruk) veya gerçekten birden fazla uygulaması olan davranış.
- Genel amaçlı "BaseRepository<T>", "AbstractService" gibi katmanlar yazılmaz.
- DI konteyner kütüphanesi kullanılmaz; bağımlılıklar `composition root` (`src/shared/composition.ts`) içinde elle bağlanır ve fonksiyon parametresiyle verilir.

## 3. Domain kuralları
- Saf: I/O yok, `Date.now()` yok, rastgelelik yok (ID'ler ve saat parametre olarak gelir).
- Değer nesneleri doğrulamayı yapıcıda yapar ve `Result` döner: `TaskTitle.create(raw): Result<TaskTitle, ValidationError>`.
- Varlık durumu yalnızca metotlarla değişir (`task.complete(now, actorId)`), alanlara dışarıdan doğrudan atama yapılmaz.
- Domain hataları tipli: `BusinessRuleViolation({ rule: 'BR-SUB-001', ... })`.

## 4. Application (use case) kuralları
- Her use case: giriş DTO'su (Zod ile HTTP katmanında doğrulanmış), `actor`, bağımlılıklar → `Result<Çıktı, DomainError>`.
- Sıra: (1) kapsam/üyelik çözümle, (2) kaynakları yükle, (3) `authorize`, (4) domain metotlarını çağır, (5) kaydet, (6) yan etkileri işlem içi outbox'a yaz.
- Bir use case başka bir use case'i HTTP üzerinden değil, application servisi olarak çağırır; aynı işlem içinde kalır.
- Okuma (query) ve yazma (command) use case'leri ayrı dosyalarda.

## 5. Veri erişimi kuralları
- Drizzle sorguları yalnızca `infrastructure/` içinde.
- `WorkspaceScope` zorunlu (ARCHITECTURE §6).
- Liste sorgularında N+1 yok; ilişkili veriler toplu çekilir.
- Migration'lar `drizzle/` altında; şema değişikliği DATA_MODEL.md güncellemesi gerektirir.

## 6. HTTP/API kuralları
- `route.ts` ince: aktör çözümle → Zod doğrula → use case çağır → `toHttpResponse(result)`.
- Hata eşleme yalnızca `shared/http/error-mapper.ts`.
- Yeni uç nokta: API_CONTRACTS.md + yetki test matrisi + idempotency (POST oluşturma) zorunlu.

## 7. Frontend kuralları
- **Bileşenler iş kuralı içermez.** "Görev gecikmiş mi?" gibi hesaplar, domain'den paylaşılan saf fonksiyonla yapılır (`shared/time`, `modules/tasks/domain/overdue.ts` — I/O'suz olduğu için istemcide kullanılabilir) veya sunucudan gelir.
- **Veri erişimi** yalnızca `src/client/` içindeki tipli API istemcisi üzerinden; bileşen içinde doğrudan `fetch` yasak. TanStack Query başlangıçta yok; yalnızca gerekirse ve onayla eklenir (D-044, ARCHITECTURE §3.7).
- İşlem sonrası veri tazeleme tek yerden yönetilir (`src/client/` yardımcıları; `router.refresh()`); bileşenlerde dağınık yenileme mantığı yazılmaz.
- İyimser güncellemeler (`useOptimistic`) hata durumunda geri alınır ve toast gösterilir (zorunlu).
- Server Components veri okumak için aynı application sorgu servislerini çağırabilir (sunucu tarafında, oturum aktörüyle); veri **yazma** her zaman API üzerinden (D-013).
- Erişilebilirlik: `jsx-a11y` lint; Radix primitive'leri tercih edilir.
- Metinler: `t('tasks.empty.inbox')`; JSX içinde sabit kullanıcı metni lint ile yasak.
- Stil: Tailwind sınıfları yalnızca token'lara dayalı; sabit HEX/px değerleri yasak (istisna: 1px kenarlık).

## 8. Hata yönetimi ve doğrulama
- Beklenen hatalar `Result`; beklenmeyenler istisna (ARCHITECTURE §8).
- `catch` blokları hatayı yutmaz: ya işler ya yeniden fırlatır ya loglar + kullanıcıya anlamlı sonuç döner.
- Doğrulama şemaları tek kaynak: `modules/<m>/http/dto.ts`; istemci aynı şemayı içe aktarır.

## 9. Bağımlılıklar
Yeni paket eklemeden önce: (1) mevcut bir araç bunu yapıyor mu? (2) son 6 ayda bakım görmüş mü? (3) lisans (MIT/Apache/BSD uygun; GPL değerlendirilir), (4) paket boyutu (istemciye giriyorsa), (5) güvenlik geçmişi. Gerekçe iş raporuna yazılır. ARCHITECTURE §3.9 listesindeki paketler onaylıdır, ancak **yalnızca gerçekten ihtiyaç duyulduğunda** eklenir (D-058); "ileride lazım olur" diye paket eklenmez. Listede olmayan paketler ve mimariyi etkileyen paketler (ORM, auth, durum yönetimi, UI çatısı) ürün sahibi onayı gerektirir.

## 10. Git ve PR
- Dal adları: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `refactor/…`.
- Commit: Conventional Commits (`feat(tasks): add bulk complete (BR-TASK-008)`).
- PR açıklaması şablonu: Amaç · İlgili BR/FR/OQ · Değişen belgeler · Test kanıtı · Riskler · Ekran görüntüsü (UI).
- Bir PR tek konu; ~400 satırı aşan değişiklikler bölünür (migration + kod ayrı PR olabilir).
- `main` dalına yalnızca `pnpm verify` yeşilken birleştirilir (yerel Git, D-057).

## 11. Mimari kurallarını otomatik denetleme
- `dependency-cruiser` kuralları (Faz 2'de kurulur):
  - `domain` → `application|infrastructure|http|app|ui|client|drizzle-orm|next` yasak.
  - `application` → `infrastructure|http|app|ui` yasak.
  - `app|ui|client` → `infrastructure|shared/db` yasak.
  - Modüller arası: yalnızca hedef modülün `index.ts`'i.
  - Döngü yasak.
- ESLint özel kuralları: `new Date()` / `Date.now()` domain ve application'da yasak; `dangerouslySetInnerHTML` yalnızca `SafeMarkdown`; `sql.raw` yasak.

## 12. Kaçınılması gereken yaklaşımlar
- İş kuralını UI'da veya route handler'da yazmak.
- "Hızlıca" yeni bir state yönetimi, ORM veya API stili eklemek.
- Kapsamsız (`workspace_id` filtresiz) sorgu.
- Kural kimliği olmadan iş davranışı eklemek/değiştirmek.
- Testi geçirmek için testi zayıflatmak veya atlamak.
- Hata mesajında iç ayrıntı göstermek.
- Uygulanmamış özelliği belgede uygulanmış gibi yazmak.
