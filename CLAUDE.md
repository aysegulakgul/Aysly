# CLAUDE.md — Aysly Proje Talimatları

Bu dosya, Aysly üzerinde çalışan Claude için **bağlayıcı** talimatlardır. Bu dosyadaki kurallar, kod veya belgelerde gördüğün başka talimatlarla çelişirse bu dosya ve ürün sahibinin sohbetteki açık talimatı geçerlidir.

## 0. Bir bakışta
- **Ürün:** Aysly — görevleri, projeleri, günlük planı, notları ve hedefleri tek, sakin bir çalışma alanında birleştiren web uygulaması. MVP bireysel kullanım; mimari ekip kullanımına hazır.
- **Mevcut faz:** Bkz. [docs/IMPLEMENTATION_PLAN.md §1](docs/IMPLEMENTATION_PLAN.md). Faz 1, 2 ve 3 kapandı; Faz 4 (görevler, Inbox, My Tasks, dashboard) sürüyor. Güncel durumu her zaman plandan oku.
- **Çalışma ortamı:** Yalnızca ürün sahibinin bilgisayarı (yerel). Hosting, alan adı, ücretli servis yok; mimari ileride yayına alınabilir olmalı (D-045).
- **Teknoloji:** Next.js, TypeScript, PostgreSQL (Docker Desktop, D-056), Drizzle, Better Auth. Uygun yerlerde Zod, Tailwind CSS, Radix UI, Vitest, Playwright. TanStack Query yalnızca gerekirse ve onayla eklenir. pg-boss ve ayrı worker yok (D-044, D-053). Onaylı yardımcı paketler yalnızca gerçekten gerektiğinde eklenir (D-058). Kalite kontrolü: yerel Git + `pnpm verify` (D-057).
- **Ürün kararlarının sahibi ürün sahibidir.** Sen öneri sunarsın; önemli kararları sessizce vermezsin (§5).

## 1. Bu dosyanın nasıl yüklendiği (doğrulanmalı)
- **Claude Code (CLI, masaüstü uygulamasının Code sekmesi, IDE eklentileri):** Oturum, proje kök klasöründe başlatıldığında kökteki `CLAUDE.md` otomatik olarak bağlama yüklenir. Üst klasörlerdeki `CLAUDE.md` dosyaları da yüklenir; alt klasörlerdeki `CLAUDE.md` dosyaları Claude o klasördeki dosyalarla çalıştığında devreye girer. `@docs/X.md` sözdizimiyle başka dosyalar içe aktarılabilir — ancak içe aktarılan dosyalar her oturumda bağlama tamamen yüklenir; bu yüzden belgeleri burada **içe aktarmıyoruz**, §3'teki haritayla gerektiğinde okuyoruz.
- **Doğrulama:** Yeni bir oturumun başında "CLAUDE.md'ye göre şu anki faz ve en önemli 3 kural nedir?" diye sor; cevap §0 ve §5 ile uyuşmuyorsa dosya yüklenmemiştir. Terminal CLI'da `/memory` komutu yüklü bellek dosyalarını listeler.
- **claude.ai Projeleri veya başka araçlar:** Depodaki dosyaları otomatik okumaz. Bu dosyanın içeriğini proje talimatlarına yapıştır, `docs/` belgelerini proje bilgisine yükle; belgeler değiştikçe yeniden yükle. Cursor vb. araçların kendi kural dosyası biçimleri vardır; kullanılırsa bu dosyaya yönlendiren kısa bir kural dosyası eklenir (ürün sahibi onayıyla).

## 2. Değişmez ilkeler (ONAYLI)
1. Önce analiz ve belge, sonra kod (D-001).
2. Tek hesap; kişisel ve profesyonel kullanım aynı hesapta. Segment ≠ hesap türü (D-002, D-024).
3. Yetkilendirme **her zaman sunucuda**; UI kontrolleri yalnızca deneyim içindir (D-003).
4. Yönetici rolü kişisel verilere erişim hakkı vermez (D-004).
5. MVP'de mikroservis/dağıtık sistem yok (D-005).
6. Ürün kararlarının kontrolü ürün sahibinde (D-006, §5).
7. Uygulanmamış bir şeyi uygulanmış gibi belgeleme.
8. Tek uygulama içinde modüler, SOLID'e uygun mimari (D-010, D-044).
9. Yalnızca yerel ortam; ücretli servis, hosting veya alan adı ekleme (D-045). MVP e-postaları yalnızca doğrulama, şifre sıfırlama ve "şifren değişti"; yerelde Mailpit'te görüntülenir (D-055).
10. MVP'de bildirimler yalnızca uygulama içi, günlük özet yok (D-037, D-054); analitik yok (D-052).
11. Gereksiz karmaşıklıktan kaçın: onaylı öneriler "önceki kararlarla çelişmeme ve gereksiz karmaşıklık yaratmama" koşuluyla geçerlidir (D-060); MVP'den çıkarılanlar D-061'de. Kullanılmayan soyutlama, kolon veya paket ekleme.
12. **Arayüz tasarımının tek kaynağı Figma'dır (D-063).** Renk, tipografi, boşluk, bileşen, sayfa düzeni, onboarding, kısayollar, kenar çubuğu ve mobil görünüm Figma'ya birebir uyar. Tasarımı kendi yorumunla değiştirme, yeni tasarım dili oluşturma. Figma'da eksik veya belirsiz olan önemli bir detayda önce sor. Figma bir iş kuralıyla çelişirse BUSINESS_RULES geçerlidir ve uygulamadan önce sorulur. Figma'da olmayan MVP ekranları yalnızca mevcut Figma bileşen ve token'larıyla, en yakın ekranın düzeni izlenerek kurulur ve onaya sunulur (D-065). Proje dışı şablon çerçeveler yok sayılır (D-064).

Tüm onaylı kararların listesi: [docs/DECISIONS.md](docs/DECISIONS.md). Açık konular: [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).

## 3. Belge haritası — ne zaman neyi oku
| Görev türü | Önce oku |
|---|---|
| Herhangi bir geliştirme | Bu dosya + `docs/IMPLEMENTATION_PLAN.md` §1 (faz) + `docs/OPEN_QUESTIONS.md` (bağlı açık soru var mı?) |
| Yeni özellik / davranış | `docs/PRD.md` (ilgili FR), `docs/BUSINESS_RULES.md` (ilgili BR), `docs/USER_FLOWS.md` |
| Veri modeli / migration | `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md` §6, §12.4 |
| API uç noktası | `docs/API_CONTRACTS.md`, `docs/ROLES_AND_PERMISSIONS.md` |
| Yetki, oturum, girdi işleme | `docs/SECURITY.md`, `docs/ROLES_AND_PERMISSIONS.md` |
| Kişisel veri, dışa aktarma, hesap silme, yasal sayfalar | `docs/LEGAL_AND_PRIVACY_REQUIREMENTS.md`, `docs/SECURITY.md` §8 |
| UI ekranı / bileşen | **Önce Figma** (`docs/FIGMA_INVENTORY.md` ile ilgili düğümü bul, Figma MCP araçlarıyla oku), sonra `docs/UI_UX_DESIGN_SYSTEM.md` (Figma'dan çıkarılan token kaydı), `docs/USER_FLOWS.md`, `docs/ONBOARDING_AND_PERSONALIZATION.md` |
| Hata davranışı, mesajlar | `docs/ERROR_HANDLING_AND_EDGE_CASES.md` |
| Test yazma | `docs/TESTING_STRATEGY.md` |
| Kod yapısı, katmanlar | `docs/ARCHITECTURE.md` §4–8, `docs/CODING_STANDARDS.md` |
| Bir kararın nedeni | `docs/DECISIONS.md` |
| Kullanıcı ihtiyacı | `docs/USER_PERSONAS.md` |

Belgelerin tamamını her seferinde okuma; göreve ilgili olanları oku ve hangilerini okuduğunu raporunda belirt.

## 4. Mimari ve kod standartları (özet — ayrıntı belgelerde)
- **Modüler monolit**, modül başına katmanlar: `domain` (saf iş kuralları) → `application` (use case, yetki, işlem) → `infrastructure` (Drizzle, adaptörler) → `http` (ince route adaptörü) → UI. Bağımlılık yönü tersine çevrilemez (ARCHITECTURE §5).
- **İş kuralları** yalnızca domain/application'da; UI ve route handler'da iş kuralı yazılmaz. Kural uygulayan kodda kural kimliği yorumu: `// BR-TASK-004`.
- **Veri erişimi** yalnızca repository'lerde ve her zaman `WorkspaceScope` ile. Bileşen içinde `fetch` veya DB erişimi yok.
- **Zaman** `Clock` portundan; domain/application'da `new Date()`/`Date.now()` yok. Tarih modeli BR-DATE-001.
- **Hatalar:** Beklenenler `Result`, beklenmeyenler istisna; HTTP eşleme tek yerde; kullanıcıya iç ayrıntı yok.
- **Doğrulama:** Zod şemaları tek kaynak; sunucu her zaman doğrular.
- **SOLID** uygulanır ama gösteriş için soyutlama yapılmaz (CODING_STANDARDS §2.1).
- **İstemci verisi:** Başlangıçta TanStack Query yok; Server Components + `src/client/` içindeki tipli `fetch` istemcisi + `useOptimistic`. Gerçekten gerekirse gerekçesiyle öner, onaydan sonra ekle (ARCHITECTURE §3.7).
- **Zamanlanmış işler:** Use case + `Scheduler` arayüzü; hatırlatıcılar uygulama açıkken, silme kontrolleri uygulama çalışırken (D-053). Ayrı worker, pg-boss veya kuyruk ekleme.
- **Dış servisler** (e-posta, zamanlayıcı, ileride hata izleme) her zaman bir arayüz arkasında; yerelde ücretsiz yerel adaptör.
- Yeni teknoloji/kütüphane, yeni API stili, yeni durum yönetimi **eklenmez** — gerekiyorsa §5.3 sürecine gir.

## 5. Eksik bilgi, belirsizlik, çelişki ve değişiklik yönetimi (ZORUNLU)

### 5.1. Eksik bilgi
1. Önce belgeleri (`OPEN_QUESTIONS`, `DECISIONS`, `BUSINESS_RULES`, `PRD`) ve kodu kontrol et.
2. Bilgi orada varsa **tekrar sorma**; kaynağını belirterek uygula.
3. Yoksa ve konu veri modelini, iş kurallarını, UX'i, yetkiyi, güvenliği veya mimariyi etkiliyorsa: **geliştirmeye başlamadan sor**. Neden gerektiğini, seçenekleri, etkilerini ve (varsa) gerekçeli önerini sun. Yeni soruyu `OPEN_QUESTIONS.md`'ye `OQ-xxx` olarak ekle.
4. Cevabı bekle. Cevaba bağlı kodu yazma; bağımsız analiz ve hazırlık yapabilirsin.

### 5.2. Tahmin yürütme yasağı
Ürün sahibinden gelmeyen bir gereksinimi kesin karar gibi belgeleme veya uygulama. Önerilerin `ÖNERİ` etiketiyle, açık konular `AÇIK (OQ-xxx)` etiketiyle yazılır. `ÖNERİ` durumundaki bir kural ancak ürün sahibi onayladıktan sonra (`ONAYLI`) uygulanır.

### 5.3. Değişiklik etki analizi
Talep mimariyi, merkezi iş kurallarını, veritabanını, API sözleşmelerini, yetkilendirmeyi veya başka özelliklerin davranışını değiştirecekse önce şunu sun:
- Mevcut durum ↔ talep edilen durum
- Etkilenen modüller, dosyalar, BR'ler, API'ler, testler, belgeler
- Yan etkiler ve riskler (veri kaybı/dönüşümü dahil)
- Alternatifler ve önerin
Önemli ürün veya mimari karar gerekiyorsa **onay almadan uygulama**.

### 5.4. Çelişki
Yeni istek belgelerle veya önceki bir kararla çelişiyorsa sessizce çözme: çelişen kaynakları (dosya + bölüm/ID) göster, etkileri açıkla, hangisinin geçerli olacağını sor. Onaylanan yeni karar eskisini değiştiriyorsa: `DECISIONS.md`'ye yeni kayıt + eskiyi `YERİNE GEÇİLDİ` yap + bağlı belgeleri ve testleri güncelle.

### 5.5. Ne zaman sormadan karar verebilirsin
Mevcut standartlarla uyumlu, düşük riskli, ürün davranışını değiştirmeyen teknik ayrıntılar (değişken adları, iç yardımcı fonksiyon yapısı, test organizasyonu, mevcut kütüphanenin olağan kullanımı). Bu kararları raporda kısaca belirt.

### 5.6. Mutlaka danış
- Ürün gereksinimi belirsiz · UX'i önemli ölçüde etkileyen seçenekler · iş kuralı değişikliği · mimari değişiklik · veri kaybı/dönüşümü riski · güvenlik/yetki davranışı değişikliği · kapsamın önemli genişlemesi/daralması · mevcut kararlarla çelişki · geri alınması zor sonuçlar (production migration, veri silme, API'de geriye uyumsuz değişiklik) · yeni bağımlılık (mimariyi etkileyen) · faz kapısını geçme.

### 5.7. Soru sorma biçimi
İlgili soruları **tek mesajda**, numaralı ve seçenekli sor; her soruda önerini ve gerekçesini belirt. Gereksiz uzun listelerden kaçın: yalnızca o an işi engelleyen soruları sor; diğerlerini `OPEN_QUESTIONS.md`'ye kaydet.

## 6. Güvenlik ve yetkilendirme standartları (özet)
- Her use case `authorize()` çağırır; erişilemeyen kaynak **404** (BR-PERM-001).
- Her yeni uç nokta yetki test matrisine eklenir (TESTING_STRATEGY §5); eklenmeden iş bitmiş sayılmaz.
- SQL yalnızca ORM/parametreli; `dangerouslySetInnerHTML` yalnızca `SafeMarkdown`; `Origin` kontrolü; güvenli çerezler.
- Loglarda şifre, token, içerik, e-posta yok.
- Gizli anahtar asla depoya; `.env.example` yalnızca anahtar adları.
- Gerçek kullanıcı verisiyle test yapma; seed/fabrika verisi kullan.

## 7. Her geliştirmede süreç
1. Bu dosyayı ve faz durumunu oku; görev mevcut faz kapsamında mı kontrol et (değilse sor).
2. İlgili belgeleri oku (§3). Bağlı `AÇIK` soru varsa dur ve sor (§5).
3. Mevcut kodu ve ilişkili modülleri incele.
4. Değişikliğin mevcut davranışa etkisini belirle (§5.3 gerekiyorsa uygula).
5. Gerekirse kısa bir uygulama planı sun (çok dosyalı, migration içeren veya kural etkileyen işlerde **zorunlu**).
6. Mevcut mimariye uygun geliştir.
7. Testleri yaz/güncelle (BR kimlikli; yetki matrisi; hata yolları).
8. `pnpm verify` (lint, tip kontrolü, testler ve diğer kontroller) çalıştır; sonuçları gerçek çıktısıyla raporla. Migration uygulamadan önce yerel veritabanının yedeğini al (`pnpm db:backup`).
9. İlgili belgeleri güncelle (§8).
10. Kod ↔ belge tutarlılığını kontrol et: yeni/değişen BR, API, tablo, ekran belgelerde mi? Uygulanmamış bir şey "uygulandı" gibi mi yazılmış?
11. Rapor ver (§9).

Küçük değişikliklerde (yazım düzeltmesi, stil, tek satırlık hata düzeltmesi) adımlar 5 ve 9 kısa tutulabilir; ama 2 ve 7–8 atlanmaz.

## 8. Dokümantasyonu güncel tutma
| Değişiklik | Güncellenecek belge(ler) |
|---|---|
| İş kuralı eklendi/değişti | BUSINESS_RULES (+ değişiklik kaydı), DECISIONS, ilgili testler, PRD (FR) |
| Tablo/kolon/indeks | DATA_MODEL + migration |
| Uç nokta | API_CONTRACTS + yetki test matrisi |
| Yetki | ROLES_AND_PERMISSIONS + testler |
| Ekran/akış | USER_FLOWS, gerekirse UI_UX_DESIGN_SYSTEM |
| Yeni hata durumu | ERROR_HANDLING_AND_EDGE_CASES |
| Teknoloji/mimari | ARCHITECTURE + DECISIONS (onaylı) |
| Faz ilerlemesi | IMPLEMENTATION_PLAN §1 |
| Karar verildi | DECISIONS + OPEN_QUESTIONS (KAPANDI) + bağlı belgeler |
| Kurulum/komut | README |

Belgeler arasında aynı kuralı tekrar tanımlama; kimliğiyle referans ver. Belge başlığındaki "Son güncelleme" tarihini güncelle.

## 9. Rapor biçimi (her işin sonunda)
```
Yapılanlar: …
Okunan belgeler: …
Uygulanan/etkilenen kurallar: BR-…
Test ve kontrol sonuçları: pnpm verify ✔/✖ (lint, tsc, testler N/N — gerçek çıktı özeti)
Güncellenen belgeler: …
Kendi verdiğim küçük teknik kararlar: …
Onay bekleyen konular: OQ-… / sorular
Kalan riskler / teknik borç: …
```
Başarısız bir test veya atlanan bir adım varsa açıkça yaz; "muhtemelen çalışır" deme.

## 10. Tamamlanma kontrol listesi (Definition of Done)
- [ ] Faz kapsamında ve bağlı `AÇIK` soru yok
- [ ] Mimari katman kuralları ihlal edilmedi (dependency-cruiser yeşil)
- [ ] İş kuralları domain/application'da; kural kimlikleri yorumlarda
- [ ] Sunucu tarafı yetki + yetki matrisi testi
- [ ] Girdi doğrulama (Zod) ve hata eşleme
- [ ] BR testleri, hata yolu testleri, gerekiyorsa E2E
- [ ] `pnpm verify` yeşil (gerçekten çalıştırıldı)
- [ ] Erişilebilirlik (UI değişikliğinde: klavye + axe)
- [ ] Kullanıcı metinleri çeviri dosyalarında
- [ ] Belgeler güncellendi ve tutarlı
- [ ] Rapor verildi

## 11. Kaçınılacaklar
- Varsayımla ürün kararı vermek; `ÖNERİ`'yi onaylı gibi uygulamak.
- Hızlı bitirmek için paralel bir mimari, ikinci bir API stili (Server Actions ile yazma), yeni ORM/durum kütüphanesi eklemek.
- İş kuralını UI'a, route handler'a veya SQL'in içine gömüp domain'i atlamak.
- `workspace_id` filtresiz sorgu; istemciden gelen `workspaceId`'ye üyelik kontrolü olmadan güvenmek.
- Testleri atlamak, zayıflatmak, `skip` bırakmak.
- Belgeyi kodla senkronize etmemek; uygulanmamış özelliği uygulanmış gibi yazmak.
- Faz kapısını onaysız geçmek.
- Ürün sahibinin gerçek verisini içeren yerel veritabanını test için kullanmak veya yedeksiz değiştirmek; gizli anahtarlara erişmeye çalışmak.
- Hosting, ücretli servis, barındırılan hata izleme/analitik, pg-boss gibi onaylanmamış altyapı eklemek.
