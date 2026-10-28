# Karar Kaydı (Decision Log)

> Durum: v0.6 · Son güncelleme: 2026-10-28

Bu dosya Aysly'deki **ürün ve teknik kararların** tarihçesidir. Kararlar silinmez; değiştirilen karar `YERİNE GEÇİLDİ (D-yyy)` olarak işaretlenir ve yeni kayıt açılır.


> **Tarih notu (2026-10-28):** Bu oturumun başında bilgisayarın saati 12 gün 9 saat 51 dakika gerideydi; belgeler ilk olarak 2026-10-15 tarihiyle yazıldı. Saat düzeltildikten sonra tarihler ölçülen farka göre gerçek tarihe çevrildi: saat düzeltilmeden önceki tüm kayıtlar (Faz 1, D-001..D-065) **2026-10-27** gecesine aittir (gece yarısını geçen kayıtlar için ±1 gün). Saat düzeltildikten sonraki kayıtlar doğru tarihlidir. İlk iki git commit'i (`1eaf4c7`, `d05bba2`) de eski saatle kaydedildi; commit geçmişi değiştirilmedi.
## Durum etiketleri

| Etiket | Anlamı | Geliştirmede kullanılabilir mi? |
|---|---|---|
| `ONAYLI` | Ürün sahibi açıkça belirtti veya onayladı. | Evet |
| `ÖNERİ` | Claude'un gerekçeli önerisi; onay bekliyor. | Hayır |
| `AÇIK` | Karar verilmedi; seçenekler [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) içinde. | Hayır |
| `YERİNE GEÇİLDİ (D-yyy)` | Daha yeni bir kararla değiştirildi. | Hayır |
| `REDDEDİLDİ` | Ürün sahibi tarafından kabul edilmedi. | Hayır |

## Kayıt şablonu

```md
## D-0xx — Başlık
- Durum: ÖNERİ | ONAYLI | YERİNE GEÇİLDİ (D-0yy) | REDDEDİLDİ
- Tarih: YYYY-MM-DD  · Karar veren: Ürün sahibi / Claude (öneri)
- Bağlam · Karar · Alternatifler · Sonuçlar (etkilenen belgeler/kurallar)
```

---

## 1. Ürün brief'inden gelen kararlar (ONAYLI, 2026-10-27)

### D-001 — Önce analiz ve dokümantasyon, sonra kod
- Durum: ONAYLI · Karar veren: Ürün sahibi
- Karar: Faz 1'de uygulama kodu yazılmaz. Dokümantasyon tamamlanıp onaylanmadan Faz 2 başlamaz. (2026-10-27 tarihli ikinci mesajda yinelendi.)

### D-002 — Tek hesap, birden fazla kullanım bağlamı
- Durum: ONAYLI
- Karar: Kişisel ve profesyonel işler tek hesapta yönetilir; hesap türü yoktur.

### D-003 — Yetkilendirme sunucu tarafında zorunlu
- Durum: ONAYLI
- Karar: Asıl yetki kontrolü her istekte sunucuda yapılır; kritik bütünlük kuralları ayrıca veritabanı kısıtlarıyla korunur.

### D-004 — Yönetici rolü kişisel verilere sınırsız erişim değildir
- Durum: ONAYLI

### D-005 — İlk sürümde mikroservis ve dağıtık sistem yok
- Durum: ONAYLI (D-044 ile yinelendi)

### D-006 — Ürün kararlarının kontrolü ürün sahibinde
- Durum: ONAYLI

### D-007 — MVP bireysel kullanıma odaklanır, mimari ekip kullanımına hazırdır
- Durum: ONAYLI

---

## 2. Claude önerileri (ilk taslak; 2026-10-27'te D-060 ile toplu onaylandı)

### D-010 — Modüler monolit mimari
- Durum: **ONAYLI** (2026-10-27, D-044 kapsamında: "Tek uygulama içinde modüler, SOLID prensiplerine uygun bir mimari")
- Karar: Tek uygulama, iş alanlarına göre modüller, modül başına katmanlar (domain / application / infrastructure / http). Ayrı bir arka plan sürecinin kullanılıp kullanılmayacağı OQ-024'e bağlıdır.

### D-011 — Teknoloji yığını
- Durum: YERİNE GEÇİLDİ (D-044)

### D-012 — Her içerik çalışma alanına aittir; her kullanıcıya bir kişisel çalışma alanı
- Durum: **ONAYLI** (D-060). D-030 (Inbox "her çalışma alanında") ve D-048 (çalışma alanı bazlı abonelik değerlendirmesi) bu modelle uyumludur.

### D-013 — REST API (`/api/v1`) tek veri yazma yüzeyi
- Durum: **ONAYLI** (D-060)
- Not: D-044 ile TanStack Query varsayılan olarak yok. Bu kararla çelişmez: istemci, API'yi ince bir `fetch` istemcisi ve React'in yerleşik iyimser güncelleme aracı (`useOptimistic`) ile kullanır (ARCHITECTURE §3.7).

### D-014 — İzin tabanlı RBAC + kaynak kapsamı
- Durum: **ONAYLI** (D-060)

### D-015 — Kimlikler UUIDv7
- Durum: **ONAYLI** (D-060)

### D-016 — Tarih/saat modeli
- Durum: **ONAYLI** (D-060)

### D-017 — Silme yaşam döngüsü: Aktif → Arşiv → Çöp → Kalıcı silme
- Durum: **ONAYLI** (2026-10-27; D-031, D-035, D-043 ile)
- Karar: Arşiv ve çöp ayrı kavramlardır. Silme önce çöpe taşımadır; kalıcı silme çöpten elle veya 30 gün sonunda otomatik yapılır. Arşivli kayıtlar salt okunurdur.

### D-018 — İyimser eşzamanlılık (`version`)
- Durum: **ONAYLI** (D-060)

### D-019 — Oluşturma isteklerinde idempotency anahtarı
- Durum: **ONAYLI** (D-060)

### D-020 — MVP'de çevrimdışı mod yok, veri kaybı koruması var
- Durum: **ONAYLI** (D-060)

### D-021 — Abonelik altyapısı yok, yetkinlik soyutlaması var
- Durum: "MVP'de ücretlendirme yok" kısmı **ONAYLI** (D-048). `EntitlementService` soyutlaması **REDDEDİLDİ** (D-061: gereksiz karmaşıklık); abonelik değerlendirildiğinde eklenir.

### D-022 — Arama: PostgreSQL tam metin arama
- Durum: **ONAYLI** (D-060)

### D-023 — Arka plan işleri pg-boss ile
- Durum: **REDDEDİLDİ** (2026-10-27, D-044: "pg-boss şimdilik kullanılmasın"). Yerine geçecek yaklaşım: OQ-024.

### D-024 — Kullanıcı segmentleri hesap türü değildir
- Durum: **ONAYLI** (D-060). D-002 ile uyumlu.

---

## 3. Açık soruların kapanışı (ONAYLI, 2026-10-27, karar veren: Ürün sahibi)

### D-030 — Inbox modeli (OQ-001)
- Karar: Her çalışma alanında **silinemeyen** bir Inbox bulunur ve menüde projelerden **ayrı** görünür.
- Uygulama: Teknik olarak `kind='inbox'` olan bir sistem projesi; `tasks.project_id` her zaman doludur.
- Alternatifler: Projesiz görevler (NULL), ayrı "işlenmedi" bayrağı — seçilmedi.
- Sonuçlar: BR-TASK-002, BR-PROJ-006, BR-INBOX-*, DATA_MODEL `projects.kind`. Inbox'ın yeniden adlandırılamaması ve arşivlenememesi D-060 ile onaylandı.

### D-031 — Proje silme (OQ-002)
- Karar: Proje ve içindeki görevler (alt görevler dahil) birlikte çöpe taşınır, birlikte geri yüklenebilir.
- Alternatifler: Görevleri Inbox'a taşımak, dolu projeyi silmeyi engellemek, her seferinde kullanıcıya sormak — seçilmedi.
- Sonuçlar: BR-PROJ-005, BR-DEL-006, AC-06.

### D-032 — Açık alt görevler varken ana görevi tamamlama (OQ-003)
- Karar: Engellenmez. Kullanıcı uyarılır ve alt görevleri de tamamlama seçeneği sunulur.
- Sonuçlar: BR-SUB-003; API `completeSubtasks` parametresi.

### D-033 — Tekrarlayan görevler (OQ-004)
- Karar: İki mod: planlanan tarihe göre (`fixed_schedule`) ve tamamlandıktan sonra (`after_completion`). Sonraki örnek, mevcut görev tamamlandığında oluşturulur.
- Alternatifler: Önceden üretim, sanal örnekler — seçilmedi.
- Sonuçlar: BR-REC-002. Tamamlamanın geri alınması (BR-REC-007) D-060 ile onaylandı.

### D-034 — Hedef ilerlemesi (OQ-005)
- Karar: Her hedef için otomatik veya manuel ilerleme seçilebilir; varsayılan otomatiktir.
- Sonuçlar: BR-GOAL-002.

### D-035 — Çöp kutusu saklama süresi (OQ-006)
- Karar: 30 gün; sonra kalıcı silme.
- Sonuçlar: BR-DEL-003. Otomatik silmenin tetiklenme yöntemi: OQ-024.

### D-036 — Hesap silme (OQ-007)
- Karar: 14 günlük, iptal edilebilir bekleme süresi. Yedeklerdeki verilerin silinme süreci belgelenir.
- Sonuçlar: BR-ACC-005, SECURITY §8.4, LEGAL_AND_PRIVACY_REQUIREMENTS §6. Silme işinin tetiklenmesi: OQ-024.

### D-037 — Bildirim kanalları (OQ-008)
- Karar: MVP'de yalnızca uygulama içi bildirimler. E-posta bildirimleri sonraya kalır. Geliştirme ortamında e-posta için ücretli servis gerekmez.
- Sonuçlar: BR-NOTIF-001, BR-NOTIF-004; `notification_deliveries` tablosu SONRA. Güvenlik/işlem e-postalarının kapsamı: OQ-026. Günlük özet: OQ-025.

### D-038 — Diller (OQ-009)
- Karar: Türkçe ve İngilizce; çeviri altyapısı baştan kurulur.

### D-039 — Giriş yöntemleri (OQ-010)
- Karar: İlk sürümde e-posta + şifre. Google ve diğer yöntemler sonraya.

### D-040 — E-posta doğrulama (OQ-011)
- Karar: Kullanıcı temel özellikleri hemen kullanabilir; e-posta gerektiren işlemlerde doğrulama zorunludur.
- Sonuçlar: BR-ACC-004. Hangi işlemlerin kapsandığı: OQ-026.

### D-041 — Görev durumları (OQ-012)
- Karar: Yapılacak (`todo`), Devam ediyor (`in_progress`), Tamamlandı (`done`).

### D-042 — Not editörü (OQ-013)
- Karar: Başlık, liste, yapılacak listesi, bağlantı ve kod gibi temel özelliklere sahip, sade, Markdown tabanlı editör. İçerik Markdown olarak saklanır.
- Sonuçlar: Editör paketi seçimi Faz 7'de (OQ-029).

### D-043 — Arşiv (OQ-014)
- Karar: Arşivlenen kayıtlar salt okunurdur; düzenlemek için önce arşivden çıkarılır.
- Sonuçlar: BR-DEL-002. Arşivlenmiş projenin görevlerine uygulanması BR-PROJ-004'te netleştirildi ve D-060 ile onaylandı.

### D-044 — Teknoloji yığını (OQ-015)
- Karar:
  - **Kullanılacak:** Next.js, TypeScript, PostgreSQL, Drizzle ORM, Better Auth.
  - **Uygun yerlerde kullanılabilir:** Zod, Tailwind CSS, Radix UI, Vitest, Playwright.
  - **Yalnızca gerekirse:** TanStack Query. İhtiyaç doğarsa gerekçesiyle önerilir ve onaydan sonra eklenir.
  - **Kullanılmayacak (şimdilik):** pg-boss.
  - Tek uygulama içinde modüler, SOLID prensiplerine uygun mimari; mikroservis yok.
- Yerine geçtiği karar: D-011. Reddedilen: D-023.
- Sonuçlar: ARCHITECTURE §3, §10; yardımcı kütüphaneler OQ-029; zamanlanmış işler OQ-024.

### D-045 — Barındırma (OQ-016)
- Karar: Şimdilik yalnızca ürün sahibinin bilgisayarında, yerel ortamda çalışır. Hosting, alan adı veya ücretli servis kullanılmaz. Mimari ileride yayına alınabilecek şekilde tasarlanır.
- Sonuçlar: ARCHITECTURE §12 (yalnızca `local` ve `test` ortamları), hata izleme servisi çıkarıldı, yayına alma kararları OQ-032'ye ertelendi.

### D-046 — Veri dışa aktarma (OQ-017)
- Karar: MVP'de çalışma alanı JSON olarak dışa aktarılır. CSV ve içe aktarma sonraya kalır.
- Uygulama: Yerel ortamda arka plan işi ve dosya deposu olmadığından, dışa aktarım doğrudan indirme olarak üretilir (D-060 ile onaylandı).
- Sonuçlar: FR-AUTH-09, API §14. Kapsam: OQ-031.

### D-047 — Takvim sürükle-bırak (OQ-018)
- Karar: Masaüstünde hafta ve ay görünümlerinde sürükle-bırak; mobilde tarih seçici.

### D-048 — Abonelik (OQ-019)
- Karar: MVP'de ücretlendirme yok. İleride ihtiyaç olursa çalışma alanı bazlı abonelik modeli değerlendirilir.

### D-049 — Yasal metinler (OQ-020)
- Karar: KVKK, gizlilik ve kullanım koşulları için gereksinimler belgelenir. Hukuki metinler lansmandan önce uygun şekilde hazırlanır ve gözden geçirilir.
- Sonuçlar: Yeni belge [LEGAL_AND_PRIVACY_REQUIREMENTS.md](LEGAL_AND_PRIVACY_REQUIREMENTS.md).

### D-050 — Marka kimliği (OQ-021) — kısmen YERİNE GEÇİLDİ (D-063)
- Karar: Şimdilik "Gece & Ay ışığı" teması. Sade, modern, göz yormayan tasarım; renkler merkezi olarak (token) tanımlanır.

### D-051 — Kayıtlı görünümler (OQ-022)
- Karar: MVP'de filtre ve sıralama ayarlarını kaydetme; paylaşılan görünümler sonraya.

### D-052 — Analitik (OQ-023)
- Karar: Şimdilik analitik kurulmaz. Beta aşamasında ihtiyaç yeniden değerlendirilir; kullanılırsa gizlilik odaklı olur ve görev veya not içerikleri gönderilmez.
- Sonuçlar: PRD §8'deki başarı metrikleri şimdilik ölçülmez; hedef değerler ÖNERİ olarak kalır (beta kararıyla birlikte ele alınır).

---

## 4. İkinci tur kararlar (ONAYLI, 2026-10-27, karar veren: Ürün sahibi)

### D-053 — Zamanlanmış işler (OQ-024)
- Karar: Ayrı worker yok. Hatırlatıcılar uygulama açıkken işlenir. 30 günlük çöp ve 14 günlük hesap silme kontrolleri uygulama çalışırken yapılır. Uygulama kapalıyken arka plan işlemi çalışması gerekmez.
- Uygulama: İşler use case olarak yazılır ve `Scheduler` arayüzü üzerinden tetiklenir. Hatırlatıcılar istemcinin bildirim sayacı yoklamasıyla (~60 sn), bakım işleri uygulama sunucusu açılışta ve saatte bir çalıştırılır; aynı anda tek çalışma için veritabanı kilidi kullanılır.
- Alternatifler: Ayrı `pnpm worker` süreci, elle çalıştırılan bakım komutu — seçilmedi.
- Sonuçlar: BR-REM-005, BR-DEL-003, BR-ACC-005, ARCHITECTURE §10, ERROR_HANDLING E18/E36/E37.

### D-054 — Günlük özet (OQ-025)
- Karar: MVP'de yok; dashboard yeterli.
- Sonuçlar: FR-NOTIF-03 SONRA; BR-NOTIF-001.

### D-055 — Güvenlik e-postaları ve yeniden doğrulama (OQ-026)
- Karar: MVP'de şu e-postalar vardır: e-posta doğrulama, şifre sıfırlama, şifre değişikliği güvenlik bildirimi. Yerel ortamda dışarı gönderilmez; yerel e-posta yakalayıcıda görüntülenir. Veri dışa aktarma ve hesap silmede e-posta yerine şifreyle yeniden doğrulama yapılır.
- Yorum (Claude): "E-posta doğrulama", e-posta adresi değiştirildiğinde yeni adresin doğrulanmasını da kapsar; bu, mevcut doğrulama e-postasının aynısıdır.
- Kararda listelenmeyen iki e-posta (kayıt denemesi bildirimi, hesap silme talebi onayı): MVP'de yok (D-062).
- Sonuçlar: BR-ACC-003, BR-ACC-004, BR-ACC-005, API §3, §14, SECURITY §4.

### D-056 — Yerel PostgreSQL (OQ-027)
- Karar: Docker Desktop; veritabanı yerelde çalışır.
- Uygulama: Docker Compose ile PostgreSQL + Mailpit (yerel e-posta yakalayıcı). Entegrasyon testleri gerçek PostgreSQL ile çalışır.
- Sonuçlar: README, ARCHITECTURE §12, TESTING_STRATEGY §8.

### D-057 — Git ve CI (OQ-028)
- Karar: Şimdilik yerel Git ve `pnpm verify`. GitHub Actions daha sonra değerlendirilebilir.
- Sonuçlar: TESTING_STRATEGY §8, CODING_STANDARDS §10, ARCHITECTURE §12.5.

### D-058 — Yardımcı kütüphaneler (OQ-029)
- Karar: OQ-029 listesindeki ücretsiz paketler onaylıdır, ancak **otomatik olarak eklenmez**. Bir paket yalnızca onu gerçekten gerektiren özellik geliştirilirken eklenir; gereksiz bağımlılıktan kaçınılır.
- Uygulama: Paketi ekleyen iş, raporunda hangi ihtiyaç için eklendiğini belirtir. Listede olmayan bir paket hâlâ CODING_STANDARDS §9 sürecine ve onaya tabidir.
- Sonuçlar: ARCHITECTURE §3.9, CODING_STANDARDS §9.

### D-059 — Dışa aktarma kapsamı (OQ-031)
- Karar: JSON dışa aktarma; çalışma alanı içeriğine ek olarak profil ve kullanıcı tercihlerini de içerir. Şifreler, gizli anahtarlar ve güvenlik bilgileri dışa aktarılmaz.
- Uygulama: Hariç tutulanlar: şifre hash'i, oturumlar ve oturum token'ları, doğrulama/sıfırlama token'ları, idempotency kayıtları, denetim kayıtları ve IP/user-agent bilgileri.
- Sonuçlar: API §14, SECURITY §8.3, LEGAL §6.

### D-060 — Kalan teknik önerilerin toplu onayı (OQ-030)
- Karar: Önceki kararlarla çelişmeyen ve gereksiz karmaşıklık yaratmayan teknik öneriler onaylandı: D-012..D-024'teki öneriler (D-021'deki soyutlama hariç), REST API, tarih modeli, sınır değerleri, tüm `ÖNERİ` iş kuralları ve PRD §5.2 öncelikleri. BR-PROJ-004 gibi önceki kararları etkileyen kurallar netleştirildi.
- Koşulun uygulanması: Gereksiz karmaşıklık ölçütüne uymayanlar D-061'de listelenmiş ve MVP'den çıkarılmıştır.
- Kapsam dışı olan ürün/UX ayrıntıları sonradan D-063 ile onaylandı.

### D-061 — "Gereksiz karmaşıklık" ölçütüyle MVP'den çıkarılanlar
- Karar veren: Claude, D-060'taki ölçütü uygulayarak. Her madde geri alınabilir; ürün sahibi itiraz ederse eski haline döner.
- Çıkarılanlar:
  1. **`EntitlementService` soyutlaması** (D-021, BR-PERM-005): Ücretlendirme olmadan her zaman "izin ver" diyen servis gereksiz soyutlamadır. → Abonelik değerlendirildiğinde.
  2. **`tasks.assignee_id` kolonu:** MVP'de kullanılmayan kolon. → Faz 10 migration'ı.
  3. **Genel API hız sınırları** (okuma/yazma/arama): Tek kullanıcılı yerel ortamda değeri yok. MVP'de yalnızca kimlik doğrulama uç noktalarında (giriş, kayıt, şifre sıfırlama, doğrulama e-postası, dışa aktarma, hesap silme) kalır. → Yayına alma öncesi.
  4. **`legal_acceptances` tablosu ve yasal sayfa altyapısı:** Yalnızca başka kullanıcılar kayıt olduğunda gerekir. → Yayına alma öncesi (LEGAL §9).
  5. **Yedekten geri yüklemede silinmiş hesapları yeniden silme listesi:** Yerel, tek kullanıcılı ortamda gerekmez. → Yayına alma öncesi.
  6. **Alt görev kuralları için veritabanı trigger'ı** (BR-SUB-001/002): Uygulama katmanı + testler yeterli; CHECK kısıtları korunur.
  7. **Bağlamsal ipucu tetikleyicileri** (ONBOARDING §5: "aynı filtreyi 3 kez kurdun" vb.): İzleme mantığı gerektirir; "İlk adımlar" listesi yeterli. → P2.

## 4b. Üçüncü tur kararlar (ONAYLI, 2026-10-27, karar veren: Ürün sahibi)

### D-062 — Ek e-postalar (OQ-033)
- Durum: ONAYLI · Tarih: 2026-10-27 · Karar veren: Ürün sahibi
- Karar: "Biri bu adresle kayıt olmaya çalıştı" bildirimi ve hesap silme talebi onay e-postası MVP'de yoktur. Uygulama yayına alınmadan önce yeniden değerlendirilir (OQ-032).
- Sonuçlar: BR-ACC-005, SECURITY §4.3, API §3, USER_FLOWS §3.10. MVP'de gönderilen e-postalar yalnızca D-055'tekilerdir.

### D-063 — Ürün/UX ayrıntıları ve Figma'nın tek tasarım kaynağı olması (OQ-034)
- Durum: ONAYLI · Tarih: 2026-10-27 · Karar veren: Ürün sahibi
- Karar:
  1. OQ-034'teki genel ürün/UX önerileri onaylandı: onboarding yaklaşımı, başlangıç projeleri, navigasyon yapısı, farklılaşma noktaları, tek kişisel çalışma alanı. PRD §8 hedefleri beta kararıyla ele alınır.
  2. **Arayüz tasarımının tek ve temel kaynağı Figma'dır.** Onboarding, başlangıç projeleri, tipografi, renkler, boşluklar, bileşenler, sayfa düzenleri, klavye kısayolları, kenar çubuğu ve mobil navigasyon dahil tüm arayüz, Figma'daki tasarımlara birebir sadık kalınarak geliştirilir.
  3. Claude tasarımı kendi yorumuyla değiştirmez ve yeni bir tasarım dili oluşturmaz.
  4. Figma'da eksik veya belirsiz bir detay varsa, önemli bir kararı etkiliyorsa önce ürün sahibine sorulur.
- Öncelik kuralı:
  - Görsel tasarım, düzen ve etkileşim biçiminde **Figma**, UI_UX_DESIGN_SYSTEM.md, ONBOARDING ve USER_FLOWS'taki tasarım tariflerinin önündedir. Bu belgeler, Figma'dan çıkarılan değerlerle güncellenir.
  - İş kuralları, yetki ve veri davranışında **BUSINESS_RULES.md** geçerlidir. Bir Figma ekranı onaylı bir iş kuralıyla çelişen bir davranış gösteriyorsa (ör. arşivli görevi düzenlenebilir göstermek), uygulamadan önce ürün sahibine sorulur (CLAUDE.md §5.4).
  - Figma'da hiç tasarlanmamış bir ekran veya durum (ör. hata, boş durum, yükleniyor) için mevcut Figma bileşenleri ve token'ları kullanılır; yeni görsel dil üretilmez. Ekranın yapısı önemli bir karar gerektiriyorsa sorulur.
- Yerine geçtiği karar: D-050 kısmen — "Gece & Ay ışığı" adı ve renk değerleri artık Figma'daki değerlere tabidir.
- Sonuçlar: UI_UX_DESIGN_SYSTEM, ONBOARDING_AND_PERSONALIZATION, USER_FLOWS, CLAUDE.md §2–3.


### D-064 — Figma'daki proje dışı çerçeveler
- Durum: ONAYLI · Tarih: 2026-10-27 · Karar veren: Ürün sahibi
- Karar: Figma dosyasındaki Product detail page (`1:534`), About (`1:629`), Article (`1:703`), Shop (`1:777`) ve Landing page (`1:902`) çerçeveleri Aysly'ye ait değildir ve referans alınmaz.
- Sonuçlar: FIGMA_INVENTORY §3.

### D-065 — Figma'da bulunmayan MVP ekranları
- Durum: ONAYLI · Tarih: 2026-10-27 · Karar veren: Ürün sahibi
- Karar: Figma'da tasarımı olmayan MVP ekranları (giriş, kayıt, şifre sıfırlama, e-posta doğrulama, onboarding, Ayarlar'ın diğer sekmeleri, bildirim merkezi, arşiv, çöp kutusu, hedef detayı, kayıtlı görünüm oluşturma) Claude tarafından kurulur. Koşullar:
  1. Yalnızca Figma'daki mevcut bileşenler (`4:70582`) ve temel referanstaki token'lar (`4:69535`) kullanılır.
  2. Düzen, en yakın Figma ekranının yapısını izler (ör. Ayarlar sekmeleri `Ayarlar · Görünüm` düzenini, Arşiv/Çöp `Inbox` liste düzenini).
  3. Yeni bileşen, renk, yazı tipi veya tasarım dili üretilmez. Mevcut bileşenlerle karşılanamayan bir ihtiyaç doğarsa önce sorulur.
  4. Her ekran tamamlandığında masaüstü ve mobil ekran görüntüsüyle ürün sahibinin onayına sunulur. Onaylanana kadar "geçici tasarım" sayılır.
  5. Ürün sahibi bir ekranı sonradan Figma'ya eklerse Figma geçerli olur ve uygulama ona uyarlanır.
- Alternatif: Ekranların önce Figma'ya eklenmesi — Faz 3'ü bekleteceği için seçilmedi.
- Sonuçlar: FIGMA_INVENTORY §4, IMPLEMENTATION_PLAN Faz 3–8.

## 4c. Faz 2–3 sırasında alınan kararlar (2026-10-28)

### D-066 — Açık temadaki eksik iki renk (OQ-035)
- Durum: ONAYLI · Tarih: 2026-10-28 · Karar veren: Ürün sahibi ("eksik rengi temaya uygun şekilde sen ekle")
- Karar: Figma'da açık tema karşılığı olmayan iki değişken, temaya uygun olarak Claude tarafından belirlendi. Bu, D-063'ün (Figma tek kaynak) ürün sahibinin açık izniyle yapılan tek istisnasıdır.
  - `palette/support-1` (açık) = `#dfe3f6` — koyu temadaki ilişkiyi korur: yüzeyden ayrışma 1,28 (koyuda 1,29); üzerindeki birincil metnin kontrastı 6,07 (AA).
  - `palette/support-2` (açık) = `#d6d6cf` — açık paletin sıcak gri tonunda, kenarlık renginden bir ton koyu; beyaz panelde görünür (1,46). Ay ışığı dolgusuyla kontrastı 2,0'dır; ilerleme çubuğu her zaman yazılı etiketle (ör. "2/6 · %33") gösterildiği için bilgi yalnızca renkle verilmez.
- Öneri: Figma'nın tek kaynak kalması için bu iki değer Figma'daki açık temaya da eklenebilir.
- Sonuçlar: `src/ui/tokens.css`, UI_UX_DESIGN_SYSTEM §0; tema tercihi Faz 3'te etkinleşir.

### D-067 — Kayıt işlemi kendi use case'imizde, oturumlar Better Auth'ta (teknik)
- Durum: ONAYLI (teknik uygulama; onaylı BR-WS-001'i karşılamak için) · Tarih: 2026-10-28 · Karar veren: Claude (CLAUDE.md §5.5)
- Bağlam: Better Auth'un kayıt sonrası kancaları, kullanıcı kaydı veritabanına işlendikten sonra çalışıyor. Bu yüzden "kullanıcı + kişisel alan + Inbox + tercihler tek işlemde" (BR-WS-001) Better Auth'un kendi kayıt uç noktasıyla sağlanamıyor.
- Karar: Kayıt `POST /api/v1/auth/sign-up` üzerinden `registerUser` use case'iyle tek veritabanı işleminde yapılır. Şifre, Better Auth'un özetleme fonksiyonuyla (scrypt) özetlenir. Better Auth'un kayıt uç noktası kapalıdır (`disableSignUp`). Giriş, çıkış, oturumlar, şifre sıfırlama ve e-posta doğrulama Better Auth'tadır (`/api/auth/*`).
- Sonuçlar: Ürün davranışı değişmedi. Entegrasyon testi, işlemin ortasındaki bir hatada hiçbir kaydın kalmadığını kanıtlıyor.

### D-068 — `projects.created_by` kullanıcı silinince boşalır (teknik)
- Durum: ONAYLI (teknik) · Tarih: 2026-10-28 · Karar veren: Claude
- Bağlam: Bu alanın kullanıcıya bağlantısı silmeyi engellediği için hesap silme (BR-ACC-005) çalışamazdı; temizlik sırasında fark edildi.
- Karar: Alan isteğe bağlı oldu ve kullanıcı silinince boşalıyor (`ON DELETE SET NULL`); migration 0002. Kullanıcı silindiğinde tüm verisinin kalktığını kanıtlayan entegrasyon testi eklendi.

### D-069 — Giriş ekranlarının onayı (D-065)
- Durum: ONAYLI · Tarih: 2026-10-28 · Karar veren: Ürün sahibi ("onaylıyorum")
- Karar: Figma bileşenleriyle kurulan giriş, kayıt, şifremi unuttum ve şifre sıfırlama ekranları (masaüstü ve mobil) onaylandı.

### D-070 — Kayıtta hesap varlığının gizlenmesi: şimdilik genel mesaj (OQ-036)
- Durum: ONAYLI · Tarih: 2026-10-28 · Karar veren: Ürün sahibi ("onaylıyorum"; önerilen seçenek C)
- Karar: Mevcut e-postayla kayıtta genel mesaj gösterilir ve kayıt isteği saatte 5 ile sınırlıdır. Kayıttan hemen sonra kullanım (D-040) korunur. BR-ACC-001'deki "hesap varlığını açıkça söylemez" ifadesi, yayına alma kararına kadar "dolaylı ifşa hız sınırıyla sınırlandırılır" olarak okunur.
- Sonuçlar: Yayına alma öncesi (OQ-032) yeniden değerlendirilecek: e-posta doğrulanmadan uygulamaya girmeme veya D-062'deki bilgi e-postası.

### D-071 — Menüde yalnızca çalışan bölümler; mobilde Figma düzeni (teknik/uygulama)
- Durum: ONAYLI (ürün sahibinin "çalışmayan özelliği çalışıyormuş gibi gösterme" talimatının uygulanması) · Tarih: 2026-10-28 · Karar veren: Claude
- Karar: Kenar çubuğu, alt navigasyon, mobil Menü ve ayar kategorilerinde yalnızca çalışan bölümler gösterilir; Inbox, Görevlerim, Takvim, Projeler, Hedefler, Notlar, Bildirimler, arama, "Görev ekle", kayıtlı görünümler, Arşiv ve Çöp kutusu ait oldukları fazda eklenir. Bugün ekranı görevler gelene kadar selamlama, tarih ve dürüst bir boş durum gösterir.
- `lg` (1024 px) altında UI_UX'teki "çekmece" yerine Figma'daki mobil düzen (alt navigasyon + Menü ekranı) uygulanır (D-063: Figma önceliklidir).

### D-072 — Ayarlar · Tarih ve saat ekranı ve çıkış düğmesinin yeri (D-065 ekranları)
- Durum: ONAYLI · Tarih: 2026-10-28 · Karar veren: Ürün sahibi ("onaylıyorum")
- Figma'da olmayan iki öğe Figma bileşenleriyle kuruldu: (1) **Çıkış yap**: masaüstünde kenar çubuğunda kullanıcı adının altında, mobilde Menü ekranında Ayarlar'ın altında, UI/NavItem görünümünde. (2) **Ayarlar · Tarih ve saat**: Görünüm ekranının düzeninde; saat dilimi, tarih biçimi, saat biçimi ve hafta başlangıcı.

### D-073 — Hesap işlemleri kendi /me uç noktalarımızda (teknik, güvenlik)
- Durum: ONAYLI (teknik; onaylı kuralları karşılamak için) · Tarih: 2026-10-28 · Karar veren: Claude (CLAUDE.md §5.5)
- Bağlam: Better Auth'un hazır yolları üç noktada kurallarımızın gerisinde kalıyordu: oturum listesi oturum token'larını tarayıcıya döndürüyor (SECURITY §4.2); şifre değiştirme yaygın şifre listesini uygulamıyor (BR-ACC-002) ve "diğer oturumları kapat" seçimini istemciye bırakıyor (BR-ACC-006); kullanıcı güncelleme ad kuralını uygulamıyor.
- Karar: API_CONTRACTS §3'teki `/api/v1/me*` uç noktaları uygulandı; kurallar identity modülünün application katmanında, kütüphane yalnızca adaptör olarak (`better-auth-credentials.ts`) kullanılıyor. Better Auth'un ilgili yolları HTTP'ye kapatıldı (`disabledPaths`). E-posta değiştirmede yeni adrese doğrulama bağlantısı gider, doğrulanınca adres değişir; eski adrese ek e-posta gönderilmez (D-055, D-062).
- Sonuçlar: Ürün davranışı değişmedi. E2E testi kapalı yolların 404 döndüğünü doğruluyor.

### D-074 — Onboarding Faz 3'te tamamıyla (OQ-037)
- Durum: ONAYLI · Tarih: 2026-10-28 · Karar veren: Ürün sahibi ("B seçeneği ile devam edelim")
- Karar: Üç adımlı onboarding Faz 3'te kuruldu: amaç seçimi, örnek projeler, temel tercihlerin onayı. Yanıtlar, başlangıç dashboard düzeni ve örnek projeler kaydedilir.
- Sonuçlar: Örnek projeler proje sayfaları gelene kadar (Faz 5) görünmez; onboarding bunu kullanıcıya açıkça söyler. Dashboard düzeni Faz 4'teki widget'larla birlikte görünür hale gelir. "İlk adımlar" kontrol listesi görevlerle birlikte Faz 4'te.
- Uygulama ayrıntıları (Claude, §5.5): "Atla" sayısı tutulur; bir kez atlanan rehber yalnızca atlamadan sonra açılan bir oturumda ("sonraki giriş") bir kez daha önerilir, ikinci atlamadan sonra önerilmez. Yeniden başlatma Ayarlar · Profil'deki "Başlangıç rehberi" panelinden yapılır. Örnek projeler bir kez oluşturulur; rehber yeniden başlatılsa da tekrar oluşturulmaz.

### D-075 — Tarayıcı testleri üretim derlemesine karşı; Secure çerez HTTPS adrese bağlı (teknik)
- Durum: ONAYLI (teknik, CLAUDE.md §5.5) · Tarih: 2026-10-28 · Karar veren: Claude
- Bağlam: Faz 3 kapanışında tarayıcı testleri aralıklı olarak toplu başarısız oldu. Geliştirme modunda sayfa saniyede bir yeniden yükleniyor, formlar JavaScript bağlanmadan gönderiliyordu. Proje OneDrive klasöründe olduğundan dosya izleyicisinin tetiklenmesi muhtemel neden; kesin tetikleyici bulunamadı.
- Karar: Playwright uygulamanın üretim derlemesini başlatır (anlık yeniden yükleme yok; testler 2,7 dakikadan yaklaşık 1 dakikaya indi). `useSecureCookies` artık `NODE_ENV` yerine uygulama adresinin HTTPS olmasına bağlı; yayında adres HTTPS olacağından davranış değişmez. `/dev/ui` erişilebilirlik testi "üretimde kapalı" testiyle değiştirildi.

### D-076 — Görev tablosu ve idempotency uygulama ayrıntıları (teknik)
- Durum: ONAYLI (teknik, CLAUDE.md §5.5) · Tarih: 2026-10-28 · Karar veren: Claude
- Kolonlar: Tekrar kolonları (Faz 6) ve arama vektörü (Faz 7) ilgili fazların migration'larıyla eklenir (CLAUDE.md §2.11: kullanılmayan kolon yok). `tasks.created_by`/`completed_by` isteğe bağlı ve `ON DELETE SET NULL` (D-068 ile aynı gerekçe).
- Idempotency (D-019): Anahtar satırı görevle aynı veritabanı işleminde yazılır. Aynı anahtarlı eşzamanlı ikinci istek birincinin bitmesini birincil anahtar kilidinde bekler ve kaydedilmiş yanıtı döner. 2xx olmayan yanıtlar saklanmaz (işlem geri alınır). Başlık zorunludur. Temizlik işi saatlik (D-053).
- Yetkilendirme: `WorkspaceScope` yalnızca üyelik çözümleyicisiyle üretilir; `authorize(scope, izin)` her use case'te çağrılır; MVP'de `owner` tüm izinlere sahiptir (ROLES_AND_PERMISSIONS §6.1, tablo tabanlı test).
- Tarih/saat: ARCHITECTURE §3'teki `date-fns` + `@date-fns/tz` yerine yerleşik `Intl` API kullanıldı; yeni paket gerekmedi, yaz saati kuralları (BR-DATE-006) testlerle doğrulandı. İleride tarih aritmetiği karmaşıklaşırsa (takvim, tekrar) paket önerisi yeniden değerlendirilir.
- Sıralama: `fractional-indexing` paketi eklendi (ARCHITECTURE §3 teknoloji tablosunda onaylı, D-058). Onboarding örnek projelerinin konumları da bu paketle üretilir.

### D-077 — Inbox ve hızlı ekleme uygulama ayrıntıları (teknik/uygulama)
- Durum: ONAYLI (teknik; D-071 ilkesi) · Tarih: 2026-10-28 · Karar veren: Claude
- Inbox ekranı Figma 4:66650 / 4:68036, hızlı ekleme ve tarih seçici Figma akış çerçevelerine (4:69297, 4:69319, 4:69362) göre kuruldu.
- Henüz çalışmayan öğeler gösterilmez (D-071): "Seç" (toplu işlem), satırdaki "Projeye taşı" ve "Tarih ver", hızlı eklemedeki "Etiket" ve proje seçimi Faz 4'ün 3–4. bölümlerinde ve Faz 5'te gelir. O zamana kadar hızlı eklemenin hedefi yalnızca yazı olarak "Inbox"tur. Figma'daki "Tarih vermek görevi Inbox'tan çıkarmaz… projeye taşı" alt notu da taşıma gelince eklenecek.
- Hızlı ekleme kartı odak kaybında kapanmaz (yalnızca Esc veya başarılı eklemeyle). Kapanması altındaki listeyi kaydırıyor, tıklamalar yanlış hedefe düşüyordu.
- Kayıt hatasında "Tekrar dene" aynı idempotency anahtarıyla gönderir (BR-TASK-007): yanıtı kaybolan istek tekrarlansa da tek görev oluşur (E2E ile doğrulandı).
- Açılır pencereler için yığında onaylı Radix UI'dan `@radix-ui/react-popover` eklendi.

### D-078 — Görevlerim, görev detayı, alt görev ve etiket uygulama ayrıntıları (teknik/uygulama)
- Durum: ONAYLI (teknik; D-071 ilkesi) · Tarih: 2026-10-28 · Karar veren: Claude
- Görevlerim (Figma 4:66732): yalnızca "Liste" ve "Son tarih" gruplaması. Pano/Takvim sekmeleri, "Filtrele" ve gruplama seçimi Faz 5–6'da gelir; o zamana kadar gösterilmez. "Görev ekle" Inbox'taki hızlı eklemeyi açar (BR-INBOX-001).
- Görev detayı (Figma 4:66875): `?task=<id>` ile açılan panel; masaüstünde sağda, mobilde tam ekran. Tekrar, hatırlatıcı (Faz 6), bağlı kayıtlar (Faz 7) ve "…" menüsü (arşiv/çöp, 4. bölüm) gösterilmez. Açıklama düz metin olarak saklanır ve gösterilir; Markdown görüntüleme (SafeMarkdown) notlarla birlikte Faz 7'de.
- Etiketler: `PATCH tagNames` kümeyi değiştirir. Normalleştirme uygulamada yapılır (BR-TAG-001). Etiket silme ve yeniden adlandırma (BR-TAG-002) ayrı bir yönetim ekranı gerektirdiğinden Faz 5'teki kayıtlı görünümlerle birlikte ele alınır.
- Alt görevli görev tamamlanırken Figma "Görevi tamamla" (4:69469) penceresi çıkar (BR-SUB-003). İşlem ve alt görevlerin tamamlanması tek veritabanı işleminde; taşımada da alt görevler aynı işlemde taşınır.
- Yeni paket: `@radix-ui/react-dialog` (yığında onaylı Radix). Figma'dan `chevron-down` ikonu indirildi.

### D-079 — Arşiv ve çöp kutusu: Faz 4 kapsamı (teknik/uygulama)
- Durum: ONAYLI (teknik; IMPLEMENTATION_PLAN faz sınırına uyum) · Tarih: 2026-10-28 · Karar veren: Claude
- Plan, toplu işlemleri (BR-TASK-008) ve Arşiv/Çöp kutusu sayfalarını Faz 5'e koyar. Faz 4'te görev arşivleme, çöpe taşıma, geri yükleme, kalıcı silme API'leri ve 30 günlük temizlik işi (`trash.purge`, saatlik ve açılışta, D-053) uygulandı.
- Arayüz (D-065, Figma'da yok): görev detayında "⋯" menüsü (Arşivle / Çöpe taşı). Arşivdeki veya çöpteki göreve gidilince salt okunur bant ve "Arşivden çıkar" / "Geri yükle" (kalan gün ile) gösterilir (BR-DEL-007). Çöpe taşıma sonrası panelde görünen bu bant "geri al" görevini görür.
- Geri yükleme: ebeveyn tek başına geri yüklenince aynı gruptaki alt görevler de döner; ebeveyni çöpteki alt görev ebeveyniyle geri yüklenir (BR-SUB-004). Projesi artık yoksa görev Inbox'a döner; proje çöpü Faz 5'te geldiğinde "projeyi de geri yükle" seçimi eklenecek (BR-DEL-004).
- Çöpe taşıma sürüm kontrolü yapmaz (tüm kaydı hedefler, geri alınabilir); arşivleme yapar.

### D-080 — Bugün bölümleri, Yaklaşanlar, İlk adımlar ve kısayollar: Faz 4 kapsamı (teknik/uygulama)
- Durum: ONAYLI (teknik; plan ve D-071 ilkesi) · Tarih: 2026-10-28 · Karar veren: Claude
- Bugün (Figma 4:66490): Bugün, Geciken (tek tıkla "Bugüne taşı" / "Yarına taşı"), Yaklaşan (ilk 3 + "tümünü gör"), Öncelikli bölümleri; masaüstünde iki sütun. Projeler ve Hedefler bölümleri plan gereği Faz 7'de. "Düzenle" (FR-DASH-08) yalnızca çalışan bölümleri listeler; kayıttaki diğerlerinin yeri korunur. Düzenleme penceresi Figma'da yok (D-065).
- Yaklaşanlar (Figma 4:67785): sonraki 7 gün, gün gün. Filtre çipleri, "Görünümü kaydet", Pano/Takvim sekmeleri kayıtlı görünümlerle (Faz 5).
- İlk adımlar (ONBOARDING §4, Figma'da yok): şimdilik "İlk görevini ekle", "Bir görevi projeye taşı", "Bir göreve tarih ekle", "Klavye kısayollarını keşfet". Hatırlatıcı (Faz 6), tekrarlayan görev (Faz 6), pano (Faz 5) ve hedef (Faz 7) maddeleri ilgili fazlarda eklenir. Durum `user_preferences.onboarding.checklist` içinde.
- Kısayollar (UI_UX §11): Q, G D/I/M/U, J/K ve ↑/↓, Enter, Ctrl/⌘+Enter, T/M/L (detay panelinde ilgili alana odaklanır), Del, Ctrl/⌘+Z (açık "Geri al" bildiriminde), ?. Ctrl/⌘+K (arama, Faz 7) ile G C / G P (Takvim, Projeler) ilgili fazlarda. Rehber penceresi Figma'da yok (D-065).
- "Bugün" sunucuda kullanıcının saat diliminde hesaplanır (BR-DASH-002); kenar çubuğunda Bugün ve Yaklaşanlar sayıları.

### D-081 — Faz 4 sonu değerlendirmeleri: TanStack Query gerekmedi; AC-02 ve test sunucusu (teknik)
- Durum: ONAYLI (teknik, CLAUDE.md §5.5; ARCHITECTURE §3.7 değerlendirmesi) · Tarih: 2026-10-28 · Karar veren: Claude
- TanStack Query: **eklenmedi.** Sunucu bileşenleri + `src/client` tipli istemci + değişiklik sonrası `router.refresh()` ve iyimser yerel durum (tamamlama, gizleme) yeterli; 1.000 görevle liste sorguları p95 ≈ 90 ms (sınır 300 ms). Takvim ve pano sürükle-bırak (Faz 5–6) yeniden değerlendirme noktasıdır.
- AC-02 ("2 görev seçilip Ev'e taşınır"): çoklu seçim ve toplu işlemler (BR-TASK-008) planda Faz 5'te olduğundan Faz 4 kabul testinde iki görev tek tek taşındı; ölçülen sonuç aynı (Inbox sayacı, proje içeriği, korunan tarih ve etiketler). Çoklu seçimli sürüm Faz 5 kabulüne eklendi.
- AC-09: sunucu saati tarayıcı testinde değiştirilemediği için sınır (23:30 / 00:01) domain birim testiyle doğrulandı.
- Test sunucusu `--keepAliveTimeout 70000` ile başlatılır: test istemcisinin kapanmış bağlantıyı yeniden kullanmasından doğan aralıklı `ECONNRESET` giderildi.

---

## 5. Faz kapanış kayıtları

| Faz | Kapanış tarihi | Onaylayan | Not |
|---|---|---|---|
| Faz 1 — Analiz ve dokümantasyon | 2026-10-27 | Ürün sahibi ("Artık geliştirme aşamasına geçelim") | OQ-001..OQ-034 kapandı (D-030..D-063). Açık: yalnızca OQ-032 (yayına alma, ertelendi). |
| Faz 2 — Proje altyapısı | 2026-10-28 | Ürün sahibi ("onaylıyorum") | `pnpm verify` 12/12 yeşil; sapmalar IMPLEMENTATION_PLAN Faz 2 Sonuç bölümünde. `feat/faz-2-altyapi` → `main`. |
| Faz 3 — Kimlik, hesap, tercihler, onboarding | 2026-10-28 | Ürün sahibi ("Faz 3'ü kapatıp 4'e geçelim") | `pnpm verify` 13/13 yeşil. Onboarding ekranı (D-065) ürün sahibinin görsel incelemesine sunuldu; değişiklik istenirse Faz 4 içinde yapılır. `feat/faz-3-kimlik` → `main`. |
