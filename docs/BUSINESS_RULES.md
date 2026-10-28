# Merkezi İş Kuralları

> Durum: v0.3 · Son güncelleme: 2026-10-27 · Uygulama durumu: Faz 3 kuralları uygulanıyor; hangi kuralın kodda ve testte olduğu `node scripts/br-coverage.mjs` çıktısındadır.
> v0.3: OQ-024..OQ-031 kararları işlendi (D-053..D-060). OQ-030 ile teknik öneriler onaylandı; "gereksiz karmaşıklık" ölçütüyle çıkarılanlar D-061 kaydındadır. OQ-033 kapandı (D-062): BR-ACC-005 için onay e-postası MVP'de yok.

Bu dosya Aysly'deki iş kurallarının **tek gerçek kaynağıdır**. Diğer belgeler kuralları kimlikleriyle referans verir; kuralı yeniden tanımlamaz. Kod içinde bir kuralı uygulayan yer, yorumla kural kimliğini belirtir (ör. `// BR-TASK-004`). Testler kural kimliğini test adında taşır.

## 0. Kullanım

### 0.1. Kural durumu
| Durum | Anlamı |
|---|---|
| `ONAYLI` | Ürün sahibi onayladı; uygulanabilir. |
| `ÖNERİ` | Claude önerisi; onaydan önce uygulanmaz. (v0.3 itibarıyla bu belgede ÖNERİ durumunda kural yok.) |
| `AÇIK (OQ-xxx)` | Karar bekleniyor; "Davranış" alanı seçenekleri değil önerilen davranışı gösterir ve **kesin değildir**. |
| `SONRA` | MVP dışı; mimari hazırlık amacıyla belgelendi. |

### 0.2. Uygulama katmanı
Her kural için "Nerede" alanı, kuralın **hangi katmanda zorunlu** olduğunu gösterir:
- **D** = Domain (saf iş mantığı; `modules/*/domain`)
- **A** = Application (use case; işlem/transaction sınırı, yetki çağrısı)
- **DB** = Veritabanı kısıtı (CHECK, UNIQUE, FK, trigger)
- **UI** = Yalnızca kullanıcı deneyimi (asla tek başına yeterli değil)

### 0.3. Hata kodları
Kuralların ürettiği hata kodları [API_CONTRACTS.md §2.4](API_CONTRACTS.md) içinde tanımlıdır. İş kuralı ihlalleri `422 BUSINESS_RULE_VIOLATION` ile döner ve yanıtta `rule` alanı kural kimliğini içerir.

### 0.4. Kural indeksi
| Alan | Kurallar |
|---|---|
| Çalışma alanı ve sahiplik | BR-WS-001..003 |
| Hesap | BR-ACC-001..006 |
| Yetkilendirme | BR-PERM-001..005 |
| Görevler | BR-TASK-001..010 |
| Alt görevler | BR-SUB-001..005 |
| Tarih ve saat | BR-DATE-001..006 |
| Hatırlatıcılar | BR-REM-001..005 |
| Tekrarlayan görevler | BR-REC-001..007 |
| Projeler | BR-PROJ-001..006 |
| Inbox ve My Tasks | BR-INBOX-001..004 |
| Arşiv, çöp, geri yükleme | BR-DEL-001..007 |
| Etiketler | BR-TAG-001..003 |
| Notlar | BR-NOTE-001..004 |
| Hedefler | BR-GOAL-001..004 |
| Bildirimler | BR-NOTIF-001..004 |
| Tercihler | BR-PREF-001..003 |
| Arama ve görünümler | BR-SRCH-001..002, BR-VIEW-001..002 |
| Dashboard | BR-DASH-001..002 |

---

## 1. Çalışma alanı ve veri sahipliği

### BR-WS-001 — Her kullanıcının tam olarak bir kişisel çalışma alanı vardır
- **Durum:** ONAYLI (D-012, D-060)
- **Açıklama:** Kayıt işlemiyle aynı veritabanı işleminde (transaction) kullanıcıya `type='personal'` bir çalışma alanı ve `owner` üyeliği oluşturulur.
- **Gerekçe:** Tüm verinin bir çalışma alanına ait olması (BR-WS-002) için; ekip özelliklerine veri taşımasız geçiş.
- **Davranış:** Kişisel alan silinemez, devredilemez, yeniden adlandırılabilir (varsayılan ad: "Kişisel"). Yalnızca hesap silindiğinde (BR-ACC-005) silinir.
- **İstisnalar:** Yok.
- **Hata:** Silme/devir girişimi → `403 FORBIDDEN`.
- **Nerede:** A (kayıt use case'i), DB (`UNIQUE (owner_user_id) WHERE type='personal'`).
- **Kabul kriterleri:**
  - Given yeni bir kullanıcı kayıt olduğunda, When kayıt tamamlanır, Then tam olarak bir kişisel çalışma alanı ve bir `owner` üyeliği vardır.
  - Given kayıt sırasında çalışma alanı oluşturma başarısız olursa, Then kullanıcı kaydı da geri alınır (yarım hesap kalmaz).
- **Etkilenen:** accounts, workspaces · `POST /auth/sign-up`

### BR-WS-002 — Her içerik kaydı tek bir çalışma alanına aittir; çalışma alanları arası ilişki kurulamaz
- **Durum:** ONAYLI (D-060)
- **Açıklama:** Görev, proje, etiket, not, hedef, kayıtlı görünüm, hatırlatıcı ve bildirim kayıtları `workspace_id` taşır. Birbirine bağlanan iki kayıt aynı çalışma alanında olmalıdır (görev↔proje, görev↔etiket, not↔görev, hedef↔proje…).
- **Gerekçe:** Veri izolasyonu; çapraz sızıntının yapısal olarak engellenmesi.
- **Davranış:** Bağlantı kurulurken her iki kaydın `workspace_id` değeri eşleşmezse işlem reddedilir. Görevi başka çalışma alanına taşıma MVP'de yoktur (SONRA: "kopyala/taşı" özelliği ayrı use case olarak).
- **Hata:** `404 NOT_FOUND` (diğer alandaki kaydın varlığı ifşa edilmez).
- **Nerede:** A (zorunlu), DB (bileşik FK: `(workspace_id, project_id) → projects(workspace_id, id)`).
- **Kabul kriterleri:** Given A alanındaki görev ve B alanındaki proje, When görev B projesine taşınmak istenir, Then 404 döner ve görev değişmez.
- **Etkilenen:** Tüm içerik modülleri.

### BR-WS-003 — Kişisel çalışma alanına başka üye eklenemez
- **Durum:** ONAYLI (D-060)
- **Davranış:** `type='personal'` alanlarda yalnızca sahibin üyeliği bulunur. Paylaşım ihtiyacı paylaşılan çalışma alanıyla karşılanır (Faz 10).
- **Hata:** `422 BUSINESS_RULE_VIOLATION`.
- **Nerede:** A, DB (trigger veya uygulama kontrolü + test).
- **Kabul:** Given kişisel alan, When davet oluşturulmak istenir, Then reddedilir.

---

## 2. Hesap

### BR-ACC-001 — E-posta benzersizdir ve büyük/küçük harfe duyarsızdır
- **Durum:** ONAYLI (D-060)
- **Davranış:** E-posta kırpılır ve küçük harfe çevrilerek saklanır/karşılaştırılır (Türkçe yerel ayardan bağımsız `toLowerCase` — `İ` sorunu için `en-US` kuralları). Kayıtta mevcut e-posta ile çakışma, hesap varlığını ifşa etmeyecek şekilde ele alınır (SECURITY §4.3).
- **Nerede:** D (normalize), DB (`UNIQUE` on normalized email).
- **Kabul:** Given `Ali@Example.com` kayıtlı, When `ali@example.com` ile kayıt denenir, Then yeni hesap oluşmaz ve yanıt hesap varlığını açıkça söylemez.
- **Not (D-070):** Kayıttan hemen sonra kullanım (D-040) nedeniyle e-postanın kayıtlı olduğu dolaylı olarak anlaşılabilir; bu, yayına alma kararına kadar kayıt hız sınırıyla (saatte 5) sınırlandırılır.

### BR-ACC-002 — Şifre politikası
- **Durum:** ONAYLI (D-060)
- **Davranış:** En az 10, en fazla 128 karakter; karakter türü zorunluluğu yok (NIST 800-63B yaklaşımı); sık kullanılan/sızdırılmış şifreler listesine karşı kontrol (yerel liste, MVP). Şifre değişiminde mevcut şifre istenir. Şifreler yalnızca güçlü, tuzlu hash olarak saklanır (SECURITY §4.1).
- **Hata:** `400 VALIDATION_FAILED` (`field: password`, `reason: too_short | too_common`).
- **Nerede:** A + kimlik doğrulama kütüphanesi yapılandırması.
- **Kabul:** Given 9 karakterlik şifre, When kayıt, Then reddedilir ve gerekçe gösterilir.

### BR-ACC-003 — Şifre sıfırlama
- **Durum:** ONAYLI (D-055, D-060)
- **Davranış:** Tek kullanımlık, 30 dakika geçerli, tahmin edilemez token. Yanıt her zaman "E-posta kayıtlıysa bağlantı gönderildi" der. Başarılı sıfırlamada kullanıcının **tüm oturumları** sonlandırılır ve güvenlik olayı kaydedilir. Şifre sıfırlandığında **ve** şifre değiştirildiğinde (BR-ACC-002) kullanıcıya "Şifren değişti" güvenlik e-postası gönderilir (D-055). Yerel ortamda e-postalar dışarı gönderilmez, yerel e-posta yakalayıcıda (Mailpit) görüntülenir (D-055, D-056).
- **Hata:** Süresi geçmiş/kullanılmış token → `400 TOKEN_INVALID`.
- **Kabul:** Given kullanılmış token, When tekrar kullanılır, Then reddedilir. Given başarılı sıfırlama, Then önceki tüm oturum çerezleri 401 alır.

### BR-ACC-004 — E-posta doğrulama
- **Durum:** ONAYLI (D-040, D-055, D-060)
- **Davranış:** Kullanıcı kayıttan hemen sonra temel özellikleri kullanabilir. Doğrulama bağlantısı 24 saat geçerlidir, yeniden gönderilebilir (hız sınırlı). E-posta değiştirildiğinde yeni adres doğrulanana kadar eski adres geçerli kalır.
- **Doğrulanmış e-posta gerektiren işlemler (D-055):** MVP'de yalnızca e-posta adresi değiştirme (yeni adresin doğrulanması). İleride e-posta bildirimleri ve davetler eklenirse bunlar da doğrulama ister.
- **Doğrulanmış e-posta gerektirmeyen, şifreyle yeniden doğrulama isteyen işlemler (D-055):** veri dışa aktarma (API_CONTRACTS §14) ve hesap silme (BR-ACC-005).
- **Kabul:** Given doğrulanmamış hesap, When görev, proje, not oluşturur, Then işlem başarılıdır. Given doğrulanmamış hesap, When doğrulama gerektiren bir işlem denenir, Then `422` (`rule: BR-ACC-004`) ve "Önce e-posta adresini doğrula" mesajı.

### BR-ACC-005 — Hesap silme
- **Durum:** ONAYLI (D-036, D-053, D-055, D-060), D-062 — hesap silme talebi onay e-postası MVP'de yok; yayına alma öncesi yeniden değerlendirilir
- **Tetikleme (D-053):** 14 günün dolup dolmadığı uygulama çalışırken kontrol edilir (açılışta ve periyodik). Uygulama kapalıyken arka plan işi çalışmaz; süre dolmuşsa silme, uygulama bir sonraki çalıştığında yapılır ve o ana kadar hesap kullanılamaz durumda kalır.
- **Davranış (ONAYLI):** Silme talebinden sonra 14 gün beklenir; bu süre içinde kullanıcı talebi iptal edebilir; süre dolunca hesap ve verileri kalıcı olarak silinir. Yedeklerdeki verinin akıbeti SECURITY §8.4 ve LEGAL_AND_PRIVACY_REQUIREMENTS §6'da belgelidir.
- **Davranış (ONAYLI, D-060):** Talep şifreyle yeniden doğrulama gerektirir → hesap `deletion_requested_at` ile işaretlenir, tüm oturumlar kapanır, bildirimler durur. İptal, 14 gün içinde giriş yapılınca sunulan seçenekle yapılır. Süre dolunca silme işi kişisel çalışma alanını ve tüm içeriği, üyelikleri, oturumları, bildirimleri kalıcı olarak siler; denetim kaydında yalnızca anonim "hesap silindi" olayı kalır. İş idempotenttir: yarıda kalırsa kaldığı yerden devam eder. Kullanıcı ileride paylaşılan bir alanın **tek sahibi** ise silme, sahiplik devredilene kadar engellenir (Faz 10).
- **Kabul:** Given silme talebi + 14 gün, When temizlik işi çalışır, Then kullanıcının hiçbir içerik kaydı veritabanında kalmaz (test: kullanıcı kimliğiyle tüm tablolarda sayım = 0).

### BR-ACC-006 — Oturum yönetimi
- **Durum:** ONAYLI (D-060)
- **Davranış:** Sunucu tarafında saklanan oturum; `HttpOnly`, `Secure`, `SameSite=Lax` çerez. Kayan süre: 30 gün hareketsizlikte sona erer, mutlak üst sınır 90 gün. Şifre değişiminde diğer tüm oturumlar kapatılır. Çıkışta oturum sunucuda silinir. Kullanıcı aktif oturumlarını görüp tek tek kapatabilir.
- **Nerede:** Kimlik doğrulama altyapısı + A.
- **Kabul:** Given çıkış yapılmış oturum çerezi, When API'ye istek, Then 401.

---

## 3. Yetkilendirme

Ayrıntılı matris: [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md).

### BR-PERM-001 — Her istek sunucuda yetkilendirilir; yetkisiz kaynak "yok" sayılır
- **Durum:** ONAYLI (D-003) — 404 politikası ONAYLI (D-060)
- **Davranış:** Her use case, işlemden önce `authorize(actor, permission, resource)` çağırır. Kaynak, aktörün üye olduğu bir çalışma alanında değilse `404 NOT_FOUND` döner (varlık ifşa edilmez). Kaynak görünür ama işlem yetkisi yoksa `403 FORBIDDEN`. Tüm okuma sorguları çalışma alanı kapsamıyla filtrelenir (kapsam dışı sorgu yazılamaz; ARCHITECTURE §6).
- **Nerede:** A (zorunlu), UI (yalnızca düğmeleri gizlemek için).
- **Kabul:** Given B kullanıcısının görev kimliği, When A kullanıcısı `GET/PATCH/DELETE /tasks/{id}` çağırır, Then 404 ve veri değişmez. (Her uç nokta için otomatik test: TESTING_STRATEGY §5.)

### BR-PERM-002 — Yetkiler çalışma alanı başına bağımsızdır
- **Durum:** ONAYLI
- **Davranış:** Aktörün rolü her istekte ilgili çalışma alanındaki **aktif** üyeliğinden okunur. Bir alandaki rol diğerini etkilemez. Kod rol adını değil izni kontrol eder (D-014).
- **Kabul:** Given X alanında admin, Y alanında member olan kullanıcı, When Y'de admin izni gerektiren işlem, Then 403.

### BR-PERM-003 — Üyelik veya rol değişikliği hemen etkili olur
- **Durum:** ONAYLI (ilke) / SONRA (uygulama, Faz 10)
- **Davranış:** Rol ve üyelik oturumda önbelleğe alınmaz; her istekte okunur (veya en fazla 60 sn'lik, değişiklikte geçersiz kılınan önbellek). Çıkarılan üyenin bir sonraki isteği 404 alır; açık ekranı "Bu çalışma alanına erişimin kaldırıldı" mesajıyla kapanır. Çıkarılan üyenin oluşturduğu içerik çalışma alanında kalır.
- **Kabul:** Given üyelik kaldırıldı, When eski üye herhangi bir alan kaynağına istek atar, Then 404.

### BR-PERM-004 — Yöneticiler kişisel alanlara ve paylaşılmamış içeriğe erişemez
- **Durum:** ONAYLI (D-004)
- **Davranış:** Hiçbir rol, başka bir kullanıcının kişisel çalışma alanına erişim izni vermez. Destek/operasyon personeli için "üretim verisine erişim" ayrı, denetlenen bir süreçtir (SECURITY §9) ve uygulama rolü değildir.
- **Kabul:** Given paylaşılan alanın sahibi, When bir üyenin kişisel alanındaki görevi ister, Then 404.

### BR-PERM-005 — Limit kontrolleri yetkinlik servisinden geçer
- **Durum:** SONRA (D-061 — MVP'de gereksiz soyutlama)
- **Davranış:** MVP'de ücretlendirme yok (D-048), bu yüzden `EntitlementService` **yazılmaz**; her zaman "izin ver" diyen bir servis gereksiz soyutlama olurdu (CODING_STANDARDS §2.1). Abonelik değerlendirildiğinde plan limitleri, yetkiden (izin) ayrı bir kavram olarak bu kuralla eklenir.

---

## 4. Görevler

### BR-TASK-001 — Görev başlığı zorunludur
- **Durum:** ONAYLI (D-060)
- **Davranış:** Başlık baştaki/sondaki boşluklardan arındırılır; sonuç 1–500 karakter olmalıdır. Satır sonu karakterleri boşluğa çevrilir. Başlık düz metindir (Markdown yorumlanmaz).
- **Hata:** `400 VALIDATION_FAILED` (`field: title`).
- **Nerede:** D (değer nesnesi `TaskTitle`), DB (`CHECK (char_length(title) BETWEEN 1 AND 500)`), UI (anlık uyarı).
- **Kabul:** Given başlık `"   "`, When oluşturma, Then 400 ve görev oluşmaz.

### BR-TASK-002 — Her görev bir projeye aittir; varsayılan proje Inbox'tır
- **Durum:** ONAYLI (D-030)
- **Davranış:** Her çalışma alanında bir Inbox vardır ve teknik olarak sistem projesidir; bu nedenle `project_id` zorunludur. Proje belirtilmezse görev, çalışma alanının Inbox'ına eklenir. Alt görevin projesi her zaman ebeveyninkidir (BR-SUB-002).
- **Kabul:** Given proje belirtilmeden oluşturulan görev, Then `project_id` = Inbox.

### BR-TASK-003 — Görev durumları ve geçişler
- **Durum:** ONAYLI (D-041) — durum seti · geçiş kuralı ONAYLI (D-060)
- **Davranış:** Durumlar: `todo` (Yapılacak), `in_progress` (Devam ediyor), `done` (Tamamlandı). (D-060) Tüm geçişlere izin verilir; `done` durumuna geçiş yalnızca tamamlama işlemiyle yapılır (BR-TASK-004). Arşiv ve çöp **durum değildir**; ayrı alanlardır (BR-DEL-001). `done` dışındaki durumlar "açık" sayılır.
- **Nerede:** D (enum), DB (`CHECK status IN (...)`).

### BR-TASK-004 — Tamamlanma tutarlılığı
- **Durum:** ONAYLI (D-060)
- **Davranış:** `status = 'done'` ⇔ `completed_at IS NOT NULL`. Tamamlamada `completed_at = now()`, `completed_by = aktör`. Yeniden açmada (`done` → başka durum) `completed_at` ve `completed_by` temizlenir. Tamamlanmış görevin hatırlatıcıları iptal edilir (BR-REM-003); tekrar kuralı varsa sonraki örnek üretilir (BR-REC-002). Arayüzde 5 sn'lik "Geri al" sunulur; geri al = yeniden açma (BR-REC-007 dahil).
- **Nerede:** D, DB (`CHECK ((status='done') = (completed_at IS NOT NULL))`).
- **Kabul:** Given açık görev, When tamamlanır, Then `completed_at` dolu; When yeniden açılır, Then `completed_at` boş ve iptal edilmiş gelecek hatırlatıcılar yeniden `pending` olur.

### BR-TASK-005 — Öncelik
- **Durum:** ONAYLI (D-060)
- **Davranış:** `0 = Yok` (varsayılan), `1 = Düşük`, `2 = Orta`, `3 = Yüksek`. Sıralamada yüksek önce; "Yok" en sonda.
- **Nerede:** D, DB (`CHECK priority BETWEEN 0 AND 3`).

### BR-TASK-006 — Manuel sıralama
- **Durum:** ONAYLI (D-060)
- **Davranış:** Görevler proje içinde (ve alt görevler ebeveyn içinde) `position` alanıyla sıralanır. `position` kesirli sıralama anahtarıdır (fractional index, metin); bir taşıma yalnızca taşınan kaydı günceller. Board'da sütunlar arası taşıma durumu ve `position` değerini birlikte günceller (tek işlem).
- **Gerekçe:** Tüm listeyi yeniden numaralandırmadan O(1) taşıma; eşzamanlı düzenlemede daha az çakışma.
- **Kabul:** Given A,B,C sırası, When C, A ile B arasına taşınır, Then yalnızca C'nin `position` değeri değişir ve sıra A,C,B olur.

### BR-TASK-007 — Aynı başlıklı görevler serbesttir; çift gönderim engellenir
- **Durum:** ONAYLI (D-060)
- **Açıklama:** Kullanıcının "Market alışverişi" adında iki görevi olması meşrudur; bu yüzden başlık benzersizliği **yoktur**. Asıl risk teknik çift gönderimdir (çift tıklama, ağ tekrarı).
- **Davranış:** İstemci her oluşturma isteğinde benzersiz `Idempotency-Key` gönderir (D-019). Sunucu aynı kullanıcı + anahtar için 24 saat içinde ilk yanıtı aynen döndürür; anahtar aynı ama gövde farklıysa `422 IDEMPOTENCY_KEY_REUSED`. Arayüz, gönderim sırasında gönder düğmesini devre dışı bırakır.
- **Kabul:** Given aynı anahtarla iki eşzamanlı istek, Then tek görev oluşur ve iki yanıt aynı `id`'yi içerir.

### BR-TASK-008 — Toplu işlemler
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tek istekte en fazla 200 görev. İşlem **atomiktir**: bir görev yetki veya kural nedeniyle reddedilirse hiçbiri uygulanmaz ve yanıt reddedilen kimlikleri ve nedenleri listeler. Her görev için aynı tekil kurallar uygulanır (toplu işlem kuralları atlatamaz). Toplu silme tek bir `deleted_batch_id` ile yapılır ve tek "Geri al" ile geri alınır.
- **Hata:** `422 BULK_OPERATION_REJECTED` + `failures[]`.
- **Kabul:** Given 10 görevden 1'i başka alanda, When toplu tamamlama, Then 0 görev değişir; yanıt 1 hata içerir.

### BR-TASK-009 — Görev bağımlılıkları
- **Durum:** SONRA (P3)
- **Not:** Eklendiğinde ayrı `task_dependencies` tablosu, döngü engelleme ve aynı çalışma alanı kuralı gerekir. MVP'de veri modeli bunu engelleyecek bir şey içermez.

### BR-TASK-010 — Eşzamanlı düzenleme
- **Durum:** ONAYLI (D-018, D-060)
- **Davranış:** Her güncelleme isteği `version` gönderir. Sunucudaki sürüm farklıysa `409 VERSION_CONFLICT` döner ve yanıt güncel kaydı içerir. Arayüz: değişen alanlar çakışmıyorsa kullanıcının değişikliğini güncel kayda otomatik yeniden uygular ve tekrar dener; çakışıyorsa "Bu görev başka bir yerde değiştirildi" uyarısı ile iki seçenek sunar (benimkini uygula / güncel olanı al). Hiçbir durumda kullanıcı girişi sessizce kaybolmaz.
- **Kabul:** Given iki sekmede açık görev, When ikisi de başlığı değiştirir, Then ikinci kayıt 409 alır ve kullanıcıya seçim sunulur.

---

## 5. Alt görevler

### BR-SUB-001 — Alt görevler tek seviyedir
- **Durum:** ONAYLI (D-060)
- **Davranış:** Alt görevin alt görevi olamaz (`parent_task_id` dolu olan bir görev ebeveyn olamaz).
- **Gerekçe:** Bireysel kullanımda derin hiyerarşi nadiren gerekir; arayüz, ilerleme hesabı ve sorgular sadeleşir.
- **Nerede:** D, A (uygulama + testler). DB trigger kullanılmaz — gereksiz karmaşıklık (D-061).
- **Hata:** `422 BUSINESS_RULE_VIOLATION` (`rule: BR-SUB-001`).

### BR-SUB-002 — Alt görev ebeveyniyle aynı projededir
- **Durum:** ONAYLI (D-060)
- **Davranış:** Alt görev oluşturulurken `project_id` ebeveynden alınır; alt görev tek başına başka projeye taşınamaz. Ebeveyn taşınırsa tüm alt görevler aynı işlemde taşınır. Alt görev "bağımsız göreve dönüştür" ile ayrılabilir (sonra taşınabilir).
- **Kabul:** Given 3 alt görevli görev, When başka projeye taşınır, Then 4 kaydın da `project_id` değeri yenidir.

### BR-SUB-003 — Açık alt görevler varken ebeveyni tamamlama
- **Durum:** ONAYLI (D-032) — engellememe, uyarı ve seçenek · API varsayılanı ve otomatik tamamlama yokluğu ONAYLI (D-060)
- **Davranış (ONAYLI):** Açık alt görevler ana görevin tamamlanmasını engellemez. Arayüz uyarır ve seçenek sunar: "Alt görevleri de tamamla" / "Yalnızca ana görevi tamamla" / "Vazgeç".
- **Davranış (ONAYLI, D-060):** API varsayılanı yalnızca ana görevi tamamlar; `completeSubtasks=true` ile tümü aynı işlemde tamamlanır. Tüm alt görevlerin tamamlanması ebeveyni **otomatik tamamlamaz**.
- **Kabul:** Given 2 açık alt görevli görev, When "Alt görevleri de tamamla" seçilir, Then 3 görev de tamamlanır; When "Yalnızca ana görevi" seçilir, Then alt görevler açık kalır.

### BR-SUB-004 — Ebeveynin arşivlenmesi/silinmesi alt görevleri kapsar
- **Durum:** ONAYLI (D-060)
- **Davranış:** Ebeveyn arşivlenince/silinince alt görevler de aynı işlemde, aynı `deleted_batch_id` ile arşivlenir/silinir. Ebeveyn geri yüklenince aynı gruptaki alt görevler de döner. Alt görev tek başına silinip geri yüklenebilir; ebeveyni çöpteyse alt görev geri yüklenirken ebeveyn de geri yüklenir (onayla).

### BR-SUB-005 — Alt görev sayısı sınırı
- **Durum:** ONAYLI (D-060)
- **Davranış:** Görev başına en fazla 100 alt görev (performans ve kullanılabilirlik koruması).

---

## 6. Tarih ve saat

### BR-DATE-001 — Tarih/saat saklama modeli
- **Durum:** ONAYLI (D-016, D-060)
- **Davranış:**
  - **Tüm gün tarihleri** (`start_date`, `due_date`): `DATE`, saat dilimsiz. "15 Ekim" her saat diliminde 15 Ekim'dir (yüzen tarih).
  - **Saatli son tarih:** `due_date` + `due_time` (yerel) + `timezone` (IANA, ör. `Europe/Istanbul`) birlikte saklanır; ayrıca sorgu ve hatırlatıcı için hesaplanmış `due_at timestamptz` (UTC) tutulur. `due_at`, yerel değerlerden domain fonksiyonuyla hesaplanır; elle yazılmaz.
  - **Anlık olaylar** (`created_at`, `completed_at`, `remind_at`…): `timestamptz` (UTC).
  - API'de tarihler `YYYY-MM-DD`, saatler `HH:mm`, anlık zamanlar ISO 8601 UTC (`2026-10-15T09:00:00Z`).
- **Gerekçe:** "Doğum günü" gibi gün bazlı işler kullanıcı seyahat ettiğinde kaymamalı; "Saat 14:00 toplantı" ise mutlak bir anı göstermeli.
- **Nerede:** D (`DueDate` değer nesnesi), DB (`CHECK (due_time IS NULL OR (due_date IS NOT NULL AND timezone IS NOT NULL AND due_at IS NOT NULL))`).

### BR-DATE-002 — Başlangıç tarihi son tarihten sonra olamaz
- **Durum:** ONAYLI (D-060)
- **Davranış:** İkisi de doluysa `start_date <= due_date`. Saat yalnızca son tarih için vardır (MVP). Son tarih başlangıçtan önceye çekilirse istek reddedilir; arayüz başlangıç tarihini de kaydırmayı önerir.
- **Hata:** `400 VALIDATION_FAILED` (`field: startDate`, `reason: after_due_date`).
- **Nerede:** D, DB `CHECK`.

### BR-DATE-003 — "Bugün", "geciken" ve "yaklaşan" tanımları
- **Durum:** ONAYLI (D-060)
- **Davranış:** "Bugün", kullanıcının tercih ettiği saat dilimindeki takvim günüdür. Tüm gün görev: `due_date < bugün` ise gecikmiş. Saatli görev: `due_at < şimdi` ise gecikmiş. Yaklaşan: bugünden sonraki 7 gün. Tamamlanmış, arşivlenmiş ve çöpteki görevler hiçbir zaman gecikmiş sayılmaz.
- **Kabul:** Given `Europe/Istanbul` kullanıcısı, `due_date = 2026-10-15` tüm gün görev, When saat 2026-10-15 23:30 (İstanbul), Then görev gecikmiş değil; 2026-10-16 00:01'de gecikmiş.

### BR-DATE-004 — Tarihsiz görevler
- **Durum:** ONAYLI (D-060)
- **Davranış:** Takvim görünümünde gösterilmez; My Tasks'ta "Tarihsiz" grubunda; dashboard "Bugün"de yer almaz. Tarihsiz görevin göreli hatırlatıcısı ve tekrar kuralı olamaz (BR-REM-001, BR-REC-001).

### BR-DATE-005 — Saat dilimi değişikliği
- **Durum:** ONAYLI (D-060)
- **Davranış:** Kullanıcı tercih ettiği saat dilimini değiştirirse: tüm gün tarihleri değişmez; saatli görevlerin **mutlak anı** (`due_at`) değişmez, gösterim yeni saat diliminde yapılır (görevin kendi `timezone` değeri detayda belirtilir: "14:00 (İstanbul)"). Tarayıcı saat dilimi tercihten farklıysa arayüz bir kez "Saat dilimin değişmiş görünüyor, güncelleyelim mi?" sorar.

### BR-DATE-006 — Yaz saati (DST) geçişleri
- **Durum:** ONAYLI (D-060)
- **Davranış:** Yerel saatten `due_at` hesaplanırken: var olmayan yerel saat (ileri alma) → bir sonraki geçerli dakikaya kaydırılır; iki kez yaşanan yerel saat (geri alma) → ilk gerçekleşme seçilir. Tekrarlayan seriler, serinin kendi saat diliminde hesaplanır (her gün 09:00 yerel saatte kalır).
- **Kabul:** `America/New_York` için 2026-03-08 02:30 → 03:00'e; 2026-11-01 01:30 → ilk (EDT) gerçekleşme. (Not: Türkiye 2016'dan beri DST uygulamıyor; testler DST'li bölgelerle yapılır.)

---

## 7. Hatırlatıcılar

### BR-REM-001 — Hatırlatıcı türleri
- **Durum:** ONAYLI (D-060)
- **Davranış:**
  - **Mutlak:** Belirli bir an (`remind_at`). Görevin tarihi olmasa da kurulabilir.
  - **Göreli:** Son tarihe göre ofset (ör. 30 dk önce, 1 gün önce). Yalnızca son tarihi olan görevlerde. Tüm gün görevlerde referans an, kullanıcının "tüm gün hatırlatıcı saati" tercihidir (varsayılan 09:00, kullanıcı saat diliminde).
- **Hata:** Tarihsiz görevde göreli hatırlatıcı → `422` (`rule: BR-REM-001`).

### BR-REM-002 — Hatırlatıcı sınırları
- **Durum:** ONAYLI (D-060)
- **Davranış:** Görev başına en fazla 5 hatırlatıcı. Oluşturma anında `remind_at` gelecekte olmalı (en az 1 dakika sonra). Aynı görevde aynı `remind_at` için ikinci hatırlatıcı oluşturulamaz.
- **Nerede:** D, DB (`UNIQUE (task_id, remind_at)`).

### BR-REM-003 — Görev yaşam döngüsüyle eşzamanlılık
- **Durum:** ONAYLI (D-060)
- **Davranış:** Görev tamamlanınca, arşivlenince, çöpe gidince veya projesi arşivlenince bekleyen hatırlatıcılar `canceled` olur. Görev yeniden açılınca/geri yüklenince, `remind_at` değeri hâlâ gelecekte olanlar `pending` olur; geçmişte kalanlar iptal kalır (geçmiş hatırlatıcı gönderilmez).

### BR-REM-004 — Tarih değişince göreli hatırlatıcılar yeniden hesaplanır
- **Durum:** ONAYLI (D-060)
- **Davranış:** Son tarih değişince göreli hatırlatıcıların `remind_at` değeri aynı işlemde yeniden hesaplanır. Son tarih kaldırılırsa göreli hatırlatıcılar silinir (arayüz uyarır). Mutlak hatırlatıcılar etkilenmez.

### BR-REM-005 — Hatırlatıcı en fazla bir kez gönderilir
- **Durum:** ONAYLI (D-053, D-060)
- **Tetikleme (D-053):** Hatırlatıcılar yalnızca uygulama açıkken işlenir: istemci, bildirim sayacını yoklarken (~60 sn) kullanıcının zamanı gelmiş hatırlatıcıları bildirime dönüştürülür. Ayrı worker yoktur.
- **Davranış:** Zamanı gelen hatırlatıcıyı bildirime dönüştüren işlem, hatırlatıcıyı `pending → sent` olarak koşullu günceller (`UPDATE … WHERE status='pending'`); güncellemeyi başaran işlem uygulama içi bildirimi oluşturur (D-037). Bildirim tablosundaki `dedupe_key` ek koruma sağlar (BR-NOTIF-002). İşleme 15 dakikadan fazla gecikmişse (ör. uygulama kapalıydı) bildirim yine oluşturulur ancak "gecikmeli" olarak işaretlenir; 24 saatten eski olanlar oluşturulmaz, `skipped` olur.

---

## 8. Tekrarlayan görevler

### BR-REC-001 — Tekrar kuralı son tarih gerektirir
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tekrar kuralı yalnızca `due_date` dolu görevlere eklenebilir. Alt görevler tekrar kuralı taşıyamaz (ebeveynin kuralı onları da kopyalar, BR-REC-004).

### BR-REC-002 — Sonraki örneğin oluşturulma yöntemi
- **Durum:** ONAYLI (D-033) — iki mod ve tamamlanınca üretim · geçmiş tarih atlama ve varsayılan mod ONAYLI (D-060)
- **Davranış (ONAYLI):** Görev tamamlandığında serinin bir sonraki örneği oluşturulur. İki mod: `fixed_schedule` (planlanan tarihe göre — sonraki tarih tamamlanan örneğin **planlanan** tarihinden hesaplanır) ve `after_completion` (tamamlandıktan sonra — sonraki tarih **tamamlanma tarihinden** hesaplanır).
- **Davranış (ONAYLI, D-060):** Sonraki örnek tamamlama ile **aynı veritabanı işleminde** oluşturulur (arka plan işi gerekmez). `fixed_schedule` modunda geçmişte kalan tarihler atlanır ve bugüne veya sonrasına en yakın tarih seçilir. Varsayılan mod `fixed_schedule`. Seri bitiş koşulu sağlanmışsa yeni örnek oluşturulmaz.
- **Kabul:** Given her pazartesi tekrarlanan, 2026-10-12 tarihli görev, When 2026-10-15'te tamamlanır, Then yeni örnek 2026-10-19 tarihli olur (`fixed_schedule`).

### BR-REC-003 — Desteklenen kalıplar
- **Durum:** ONAYLI (D-060)
- **Davranış:** Günlük (her N günde), haftalık (her N haftada; seçili günler), aylık (ayın N. günü veya ayın N. haftasının X günü, ör. "ayın son cuması"), yıllık. Bitiş: hiçbir zaman / tarihte / N tekrardan sonra. Kural RFC 5545 RRULE alt kümesi olarak saklanır; desteklenmeyen RRULE bileşenleri doğrulamada reddedilir.

### BR-REC-004 — Yeni örneğe kopyalanan alanlar
- **Durum:** ONAYLI (D-060)
- **Davranış:** Kopyalanan: başlık, açıklama, öncelik, proje, etiketler, saat (varsa) ve saat dilimi, göreli hatırlatıcılar, alt görevler (tamamlanmamış olarak), hedef bağlantıları. Kopyalanmayan: durum (her zaman `todo`), tamamlanma bilgisi, mutlak hatırlatıcılar, not bağlantıları (notlar seriye değil örneğe bağlıdır). Başlangıç tarihi varsa son tarihle arasındaki fark korunur.

### BR-REC-005 — Ay sonu taşması
- **Durum:** ONAYLI (D-060)
- **Davranış:** "Her ayın 31'i" gibi kurallarda ilgili ayda o gün yoksa ayın son günü kullanılır. 29 Şubat yıllık kuralı artık olmayan yıllarda 28 Şubat'a düşer.

### BR-REC-006 — Seri üzerinde düzenleme ve silme
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tekrarlayan görev düzenlenirken veya silinirken: "Yalnızca bu örnek" (örnek seriden ayrılmaz, yalnızca bu kayıt değişir) / "Bu ve sonraki örnekler" (kural güncellenir; bir sonraki örnek yeni kuralla üretilir). Seriyi durdurma = kuralı kaldırma; mevcut görev normal görev olarak kalır. Tamamlanmış geçmiş örnekler hiçbir durumda değiştirilmez.

### BR-REC-007 — Tamamlamanın geri alınması
- **Durum:** ONAYLI (D-060; D-033 ile uyumlu)
- **Davranış:** Tekrarlayan bir örneğin tamamlanması geri alınırsa: o tamamlamayla üretilen sonraki örnek **hiç değiştirilmemişse** (version = 1) kalıcı olarak silinir; değiştirilmişse korunur ve kullanıcı bilgilendirilir. Böylece çift örnek oluşmaz, kullanıcı emeği de kaybolmaz.

---

## 9. Projeler

### BR-PROJ-001 — Proje adı zorunludur
- **Durum:** ONAYLI (D-060)
- **Davranış:** 1–120 karakter, kırpılmış. Aynı alanda aynı adlı projelere izin verilir (arayüz, aynı adlı aktif proje varsa uyarı gösterir). Açıklama ≤ 5.000 karakter Markdown.

### BR-PROJ-002 — Proje durumu arşivden ayrıdır
- **Durum:** ONAYLI (D-060)
- **Davranış:** `active` (Aktif), `on_hold` (Beklemede), `completed` (Tamamlandı). Projeyi "Tamamlandı" yapmak görevlerini **değiştirmez**; açık görev varsa arayüz "12 açık görev var: hepsini tamamla / olduğu gibi bırak / vazgeç" sorar. Durum, projenin görünürlüğünü değiştirmez; arşiv değiştirir.

### BR-PROJ-003 — Proje ilerlemesi
- **Durum:** ONAYLI (D-060)
- **Davranış:** İlerleme = tamamlanmış üst düzey görev sayısı / (arşivlenmemiş ve çöpte olmayan) üst düzey görev sayısı. Alt görevler hesaba katılmaz. Hiç görev yoksa ilerleme gösterilmez ("—"). Hesap sorgu anında yapılır (saklanmaz).

### BR-PROJ-004 — Proje arşivleme
- **Durum:** ONAYLI (D-043, D-060) — içerik D-043 ile tutarlı olacak şekilde netleştirildi
- **Gerekçe:** D-043 "arşivlenen kayıtlar salt okunur" der. Arşivlenmiş bir projenin görevleri düzenlenebilir kalsaydı, kullanıcı "dondurulmuş" bir projede değişiklik yapabilir ve bu görevlerin hatırlatıcıları tetiklenebilirdi; bu D-043 ile çelişirdi.
- **Davranış (netleştirilmiş):**
  1. Proje arşivlenince projenin kendisi ve **içindeki tüm görevler** (alt görevler dahil) salt okunur olur. Görevlerin kendi `archived_at` alanı değişmez; salt okunurluk projeden gelir (görev ayrı ayrı arşivlenmiş sayılmaz).
  2. Bu görevler My Tasks, dashboard, takvim ve aramada varsayılan olarak görünmez; Arşiv sayfasında proje altında ve "arşivi dahil et" filtresiyle görünür.
  3. Bekleyen hatırlatıcılar iptal edilir (BR-REM-003).
  4. Arşivlenmiş projeye görev eklenemez; bu projeye görev taşınamaz; bu projeden görev dışarı taşınamaz (önce arşivden çıkarılır).
  5. Arşivlenmiş projedeki bir görev tek başına çöpe atılamaz; proje bütünüyle silinebilir (BR-PROJ-005: proje ve görevleri birlikte çöpe).
  6. Proje arşivden çıkınca görevler görünür ve düzenlenebilir olur; `remind_at` değeri hâlâ gelecekte olan hatırlatıcılar yeniden etkinleşir.
  7. Projeden önce ayrıca arşivlenmiş görevler, proje arşivden çıkınca arşivli kalır.
- **Hata:** Arşivli projedeki görevi düzenleme, ekleme, taşıma veya tek başına silme → `422` (`rule: BR-PROJ-004`); arayüz "Bu proje arşivde. Değişiklik için projeyi arşivden çıkar." gösterir.
- **Kabul:** Given arşivlenmiş proje ve içindeki görev, When görevin başlığı değiştirilmek istenir, Then reddedilir; When proje arşivden çıkarılır ve tekrar denenir, Then başarılı olur. Given proje arşivlenmeden önce ayrıca arşivlenmiş görev, When proje arşivden çıkarılır, Then o görev arşivli kalır.

### BR-PROJ-005 — Proje silme ve bağlı görevler
- **Durum:** ONAYLI (D-031) — birlikte çöpe, birlikte geri yükleme · ayrıntılar ONAYLI (D-060)
- **Davranış (ONAYLI):** Proje ve içindeki tüm görevler (alt görevler dahil) birlikte çöp kutusuna taşınır ve birlikte geri yüklenebilir.
- **Davranış (ONAYLI, D-060):** Bunlar aynı `deleted_batch_id` ile işaretlenir. Onay penceresi etkilenecek görev sayısını gösterir. Proje silinmeden önce ayrı ayrı silinmiş görevler (farklı grup) kendi gruplarıyla kalır. Notlar ve hedefler silinmez; yalnızca bağlantılar pasifleşir (kayıt çöpteyken bağlantı gizli kalır, geri yüklenince görünür).

### BR-PROJ-006 — Inbox projesinin korunması
- **Durum:** ONAYLI (D-030) — silinemez, her çalışma alanında bir tane, menüde ayrı · diğer korumalar ONAYLI (D-060)
- **Davranış (ONAYLI):** Inbox silinemez; her çalışma alanında tam olarak bir tane bulunur; menüde projeler listesinden ayrı gösterilir ve proje listesinde/proje sayımlarında yer almaz.
- **Davranış (ONAYLI, D-060):** Inbox ayrıca arşivlenemez, yeniden adlandırılamaz ve durumu değiştirilemez.
- **Nerede:** A, DB (`UNIQUE (workspace_id) WHERE kind='inbox'`).

---

## 10. Inbox ve My Tasks

### BR-INBOX-001 — Hızlı ekleme varsayılanı
- **Durum:** ONAYLI (D-060)
- **Davranış:** Bağlamı olmayan hızlı ekleme (dashboard, global kısayol) Inbox'a ekler. Bir proje sayfasında yapılan hızlı ekleme o projeye ekler.

### BR-INBOX-002 — Inbox'tan taşıma veri kaybettirmez
- **Durum:** ONAYLI (D-060)
- **Davranış:** Taşıma yalnızca `project_id` (ve hedef projedeki `position`) değerini değiştirir; başlık, açıklama, tarihler, etiketler, alt görevler, hatırlatıcılar, bağlantılar korunur. Alt görevler ebeveynle birlikte taşınır (BR-SUB-002). Toplu taşıma atomiktir (BR-TASK-008). Hedef proje arşivliyse reddedilir.

### BR-INBOX-003 — Inbox rozeti
- **Durum:** ONAYLI (D-060)
- **Davranış:** Rozet = Inbox'taki açık, arşivlenmemiş, çöpte olmayan **üst düzey** görev sayısı. 99'dan fazlası "99+".

### BR-INBOX-004 — My Tasks kapsamı
- **Durum:** ONAYLI (D-060)
- **Davranış:** MVP'de: kullanıcının kişisel çalışma alanındaki, arşivlenmemiş projelerdeki açık görevler (alt görevler ebeveynin altında gösterilir). Faz 10'da: kişisel alandaki görevler + paylaşılan alanlarda kullanıcıya atanmış görevler.

---

## 11. Arşiv, çöp kutusu ve geri yükleme

### BR-DEL-001 — Üç yaşam durumu
- **Durum:** ONAYLI (D-017) — alan adları ONAYLI (D-060)

| Durum | Alan | Görünürlük | Düzenlenebilir | Geri dönüş |
|---|---|---|---|---|
| Aktif | `archived_at IS NULL AND deleted_at IS NULL` | Her yerde | Evet | — |
| Arşivli | `archived_at IS NOT NULL` | Yalnızca Arşiv sayfası ve "arşivi dahil et" filtresi | Hayır (D-043) | Arşivden çıkar |
| Çöpte | `deleted_at IS NOT NULL` | Yalnızca Çöp kutusu | Hayır | Geri yükle (30 gün içinde, D-035) |
| Kalıcı silinmiş | Kayıt yok | — | — | Yok |

Bir kayıt hem arşivli hem çöpte olabilir; geri yüklenince arşivli durumuna döner.

### BR-DEL-002 — Arşivlenmiş kayıtlar
- **Durum:** ONAYLI (D-043) — salt okunurluk · hata kodu ve hatırlatıcı iptali ONAYLI (D-060)
- **Davranış (ONAYLI):** Arşivlenen kayıtlar salt okunurdur; düzenlemek için önce arşivden çıkarılır.
- **Davranış (ONAYLI, D-060):** Düzenleme denemesi `422` (`rule: BR-DEL-002`) döner; arayüz "Düzenlemek için arşivden çıkar" düğmesi gösterir. Arşivleme hatırlatıcıları iptal eder.
- **Kabul:** Given arşivli görev, When başlık değiştirilmek istenir, Then değişiklik reddedilir; When arşivden çıkarılıp tekrar denenir, Then başarılı olur.

### BR-DEL-003 — Çöp kutusu saklama süresi
- **Durum:** ONAYLI (D-035, D-053, D-060)
- **Tetikleme (D-053):** Süre kontrolü uygulama çalışırken yapılır (açılışta ve periyodik); uygulama kapalıyken arka plan işi çalışmaz.
- **Davranış (ONAYLI):** Çöpteki kayıtlar 30 gün saklanır, sonra kalıcı olarak silinir.
- **Davranış (ONAYLI, D-060):** Süre, silme grubunun `deleted_at` anından itibaren sayılır. Periyodik ve idempotent bir bakım işi süresi dolan grupları kalıcı olarak siler. Uygulama bir süre kapalı kaldıysa süresi dolmuş kayıtlar bir sonraki çalıştırmada silinir ve o zamana kadar çöp kutusunda "silinmek üzere" görünür, geri yüklenemez. Çöp kutusu her grup için kalan gün sayısını gösterir.

### BR-DEL-004 — Geri yükleme hedefi
- **Durum:** ONAYLI (D-060)
- **Davranış:** Kayıt orijinal yerine döner. Görevin projesi artık yoksa (kalıcı silinmiş) görev Inbox'a geri yüklenir ve kullanıcı bilgilendirilir. Projesi hâlâ çöpteyse kullanıcıya "Projeyi de geri yükle / Inbox'a geri yükle" seçimi sunulur. Geri yükleme `version` değerini artırır.

### BR-DEL-005 — Kalıcı silme
- **Durum:** ONAYLI (D-060)
- **Davranış:** Yalnızca çöpteki kayıtlar kalıcı silinebilir. Açık bir onay gerekir ("Bu işlem geri alınamaz"). "Çöpü boşalt" tüm grupları siler. Kalıcı silme ilişkili alt kayıtları da siler (alt görevler, hatırlatıcılar, etiket bağlantıları, not/hedef bağlantıları); etiketlerin, notların, hedeflerin kendisi silinmez.
- **Nerede:** A, DB (`ON DELETE CASCADE` yalnızca bağlantı ve alt kayıt tablolarında).

### BR-DEL-006 — Silme grupları
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tek kullanıcı eylemiyle silinen tüm kayıtlar aynı `deleted_batch_id` değerini alır (ör. ebeveyn + alt görevler; proje + görevler; toplu silme). Geri yükleme ve kalıcı silme grup bazında yapılabilir; grup içinden tekil geri yükleme de mümkündür (BR-SUB-004 bağımlılıklarına uyarak).

### BR-DEL-007 — Silinmiş/arşivlenmiş kayda doğrudan erişim
- **Durum:** ONAYLI (D-060)
- **Davranış:** URL ile arşivli kayda gidilirse kayıt salt okunur bantla gösterilir ("Bu görev arşivde"). Çöpteki kayda gidilirse "Bu görev çöp kutusunda" ekranı ve "Geri yükle" düğmesi gösterilir (API: `GET` çöpteki kaydı `?includeDeleted=true` olmadan 404 döner; arayüz ikinci istekle durumu sorgular). Kalıcı silinmiş kayıt → 404 ekranı.

---

## 12. Etiketler

### BR-TAG-001 — Etiket adı
- **Durum:** ONAYLI (D-060)
- **Davranış:** 1–50 karakter; boşluk içerebilir; çalışma alanında büyük/küçük harf ve Türkçe karakter duyarsız benzersiz (`İş` = `iş`; karşılaştırma `tr` yerel ayarıyla küçük harfe çevrilerek). Etiket görev/not oluştururken yazılırsa yoksa oluşturulur.
- **Nerede:** D, DB (`UNIQUE (workspace_id, name_normalized)`).

### BR-TAG-002 — Etiket silme
- **Durum:** ONAYLI (D-060)
- **Davranış:** Etiket silme kalıcıdır (çöpe gitmez), onay penceresi kullanım sayısını gösterir; görevler/notlar silinmez, yalnızca bağlantılar kaldırılır. Kayıtlı görünümlerdeki referanslar geçersiz olur (BR-VIEW-001).

### BR-TAG-003 — Kayıt başına etiket sınırı
- **Durum:** ONAYLI (D-060)
- **Davranış:** Görev veya not başına en fazla 20 etiket; çalışma alanı başına en fazla 500 etiket.

---

## 13. Notlar

### BR-NOTE-001 — Otomatik kaydetme
- **Durum:** ONAYLI (D-060)
- **Davranış:** Düzenleme durduktan 1 sn sonra ve editörden çıkışta kaydedilir. Kaydedilmemiş içerik, sunucu onayına kadar tarayıcıda yerel taslak olarak tutulur. Kaydedilmemiş değişiklik varken sayfadan çıkışta tarayıcı uyarısı. Kayıt durumu her zaman görünür.

### BR-NOTE-002 — Not çatışmaları içerik kaybettirmez
- **Durum:** ONAYLI (D-060)
- **Davranış:** Otomatik kayıt `version` ile gönderilir. `409` gelirse ve kullanıcı aynı notu başka yerde değiştirdiyse: kullanıcının sürümü "Başlık (çatışma kopyası – 15.10.2026 14:32)" adıyla yeni not olarak kaydedilir ve kullanıcı bilgilendirilir. Gerçek zamanlı ortak düzenleme SONRA.

### BR-NOTE-003 — Not bağlantıları
- **Durum:** ONAYLI (D-060)
- **Davranış:** Not, aynı çalışma alanındaki birden çok görev ve projeye bağlanabilir (çoktan çoğa). Bağlı kayıt çöpe gidince bağlantı gizlenir; kalıcı silinince bağlantı silinir; not etkilenmez.

### BR-NOTE-004 — Boş notlar
- **Durum:** ONAYLI (D-060)
- **Davranış:** Başlığı ve gövdesi boş olan not sunucuda oluşturulmaz; editör boş kapatılırsa (daha önce oluşturulmuşsa) kalıcı olarak silinir. Not gövdesi ≤ 200.000 karakter.

---

## 14. Hedefler

### BR-GOAL-001 — Hedef alanları
- **Durum:** ONAYLI (D-060)
- **Davranış:** Başlık 1–200 karakter zorunlu; açıklama ≤ 5.000; hedef tarihi isteğe bağlı (`DATE`); durum `active | achieved | abandoned`.

### BR-GOAL-002 — İlerleme hesabı
- **Durum:** ONAYLI (D-034) — hedef başına otomatik/manuel seçim, varsayılan otomatik · hesaplama formülü ONAYLI (D-060)
- **Davranış:** `progress_mode`:
  - `auto` (varsayılan, ONAYLI). Hesaplama (D-060): (doğrudan bağlı görevler ∪ bağlı projelerin üst düzey görevleri) içinde arşivlenmemiş/çöpte olmayanların tamamlanma oranı; aynı görev iki kez sayılmaz. Bağlı kayıt yoksa ilerleme yok ("—").
  - `manual` (ONAYLI): kullanıcı ilerlemeyi kendisi girer (0–100 tamsayı, D-060).
  - (D-060) Mod değişince önceki manuel değer saklanır (geri dönülebilir).

### BR-GOAL-003 — Hedefe ulaşma
- **Durum:** ONAYLI (D-060)
- **Davranış:** Otomatik ilerleme %100'e ulaşınca hedef **otomatik olarak** "Ulaşıldı" yapılmaz; kullanıcıya öneri gösterilir. "Ulaşıldı" işaretlemek bağlı kayıtları değiştirmez. Ulaşılan/bırakılan hedefler dashboard'dan kalkar.

### BR-GOAL-004 — Hedef bağlantıları
- **Durum:** ONAYLI (D-060)
- **Davranış:** Aynı çalışma alanı (BR-WS-002). Bağlı kayıt çöpteyse hesaptan çıkar; geri yüklenince döner. Hedef silinince bağlantılar silinir (hedef çöpteyken gizlenir).

---

## 15. Bildirimler

### BR-NOTIF-001 — MVP bildirim türleri ve kanalları
- **Durum:** ONAYLI (D-037, D-054)
- **Davranış:** MVP'de tek kanal `in_app`, tek tür `reminder` (hatırlatıcı). Günlük özet MVP'de yok (D-054). E-posta bildirimleri SONRA. Görev değişiklik/atama bildirimleri Faz 10.
- **Not:** Güvenlik e-postaları (doğrulama, şifre sıfırlama, "şifren değişti") bildirim sayılmaz (D-055).

### BR-NOTIF-002 — Tekrarlanan bildirim engeli
- **Durum:** ONAYLI (D-060)
- **Davranış:** Her bildirim deterministik bir `dedupe_key` taşır (ör. `reminder:{reminderId}`, `digest:{userId}:{YYYY-MM-DD}`). `UNIQUE (user_id, dedupe_key)`; çakışmada yeni bildirim oluşturulmaz. (SONRA, e-posta kanalı eklendiğinde: teslim, bildirim başına kanal kaydıyla en fazla bir kez yapılır; yeniden deneme yalnızca başarısız teslimde, en fazla 3 kez.)

### BR-NOTIF-003 — Okundu durumu ve saklama
- **Durum:** ONAYLI (D-060)
- **Davranış:** Bildirimler okundu/okunmadı olarak işaretlenebilir; "tümünü okundu say". Bildirime tıklamak onu okundu yapar ve ilgili kayda gider (kayıt silinmişse BR-DEL-007). Bildirimler 90 gün sonra silinir.

### BR-NOTIF-004 — Bildirim tercihleri
- **Durum:** ONAYLI (D-060)
- **Davranış:** MVP'de kullanıcı bildirim türlerini (uygulama içi) açıp kapatabilir; hatırlatıcılar varsayılan olarak açıktır. E-posta kanalı eklendiğinde tercih tür × kanal bazında olur (SONRA). Hesap silme talebi olan kullanıcı için bildirim oluşturulmaz.

---

## 16. Kullanıcı tercihleri

### BR-PREF-001 — Varsayılan tercihler
- **Durum:** ONAYLI (D-060)
- **Davranış:** Desteklenen diller Türkçe ve İngilizce (ONAYLI, D-038). Kayıtta tarayıcıdan: dil (`tr` veya `en`, desteklenmiyorsa `tr`), saat dilimi (IANA; geçersizse `Europe/Istanbul`). Dil `tr` ise: hafta pazartesi başlar, tarih `GG.AA.YYYY`, saat 24 saat. Tema: sistem. Varsayılan görünüm: liste. Tüm gün hatırlatıcı saati 09:00.

### BR-PREF-002 — Tercihler kullanıcıya özeldir
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tercihler kullanıcı düzeyindedir, çalışma alanından bağımsızdır. (İleride çalışma alanı düzeyi varsayılanlar eklenirse kullanıcı tercihi önceliklidir.)

### BR-PREF-003 — Tercihler veriyi değil sunumu değiştirir
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tarih biçimi, hafta başlangıcı, dil, tema değişikliği saklanan veriyi değiştirmez. İstisna: saat dilimi "bugün" hesabını ve tüm gün hatırlatıcı saatini etkiler (BR-DATE-003, BR-REM-001); saklanan görev verisi değişmez.

---

## 17. Arama ve görünümler

### BR-SRCH-001 — Arama kapsamı
- **Durum:** ONAYLI (D-060)
- **Davranış:** Arama yalnızca aktörün erişebildiği çalışma alanlarında yapılır (BR-PERM-001). Çöpteki kayıtlar hiçbir zaman dönmez. Arşivli kayıtlar yalnızca `includeArchived=true` ile. Eşleşme: başlık (yüksek ağırlık), açıklama/gövde, etiket adı. Türkçe aksan/harf duyarsız.

### BR-SRCH-002 — Arama sorgusu ve sonuçlar
- **Durum:** ONAYLI (D-060)
- **Davranış:** En az 2, en fazla 200 karakter. Türe göre en fazla 20 sonuç, alaka + yakınlık (son güncelleme) sırasıyla. Boş sonuç kuralı: FR-SRCH-03.

### BR-VIEW-001 — Kayıtlı görünüm tanımı
- **Durum:** ONAYLI (D-051) — filtre ve sıralama kaydı MVP'de, paylaşım SONRA · ayrıntılar ONAYLI (D-060)
- **Davranış (ONAYLI):** Kullanıcı filtre ve sıralama ayarlarını ad vererek kaydedebilir. Kayıtlı görünümler kişiseldir; paylaşılan görünümler SONRA.
- **Davranış (ONAYLI, D-060):** Kayıtlı görünüm; ad (1–60), görünüm türü, filtre ve sıralama tanımını saklar, sonuç listesini saklamaz. Filtre tanımı sürümlü bir şemadır (`TaskFilter v1`). Silinmiş etikete/projeye referans varsa o koşul yok sayılır ve görünümde "Bazı filtreler artık geçerli değil" uyarısı gösterilir. Kullanıcı başına en fazla 50 kayıtlı görünüm.

### BR-VIEW-002 — Görünümler aynı veriyi gösterir
- **Durum:** ONAYLI (D-060)
- **Davranış:** Liste, board ve takvim aynı `TaskFilter` ile aynı sorgu servisini kullanır. Görünüm değiştirildiğinde etkin filtre korunur. Bir görünümde yapılan değişiklik (ör. board'da durum) diğerlerine anında yansır (istemci tarafında tek veri kaynağı; yöntem ARCHITECTURE §3.7).

---

## 18. Dashboard

### BR-DASH-001 — Widget düzeni
- **Durum:** ONAYLI (D-060)
- **Davranış:** Widget türleri sabit listedir (FR-DASH). Kullanıcı göster/gizle ve sıralama yapabilir; düzen `user_preferences.dashboard_layout` içinde saklanır. Bilinmeyen widget kimlikleri (ör. kaldırılmış widget) yok sayılır; yeni eklenen widget'lar listenin sonuna gizli olarak eklenir.

### BR-DASH-002 — Dashboard "bugün"ü
- **Durum:** ONAYLI (D-060)
- **Davranış:** Tüm dashboard hesapları BR-DATE-003 tanımlarını kullanır; sunucu "bugün"ü kullanıcının tercih ettiği saat dilimine göre hesaplar (istemci saati esas alınmaz).

---

## 19. Değişiklik kaydı

| Tarih | Kural | Değişiklik | Karar |
|---|---|---|---|
| 2026-10-27 | Tümü | İlk taslak | Faz 1 |
| 2026-10-27 | BR-TASK-002/003, BR-SUB-003, BR-REC-002, BR-PROJ-005/006, BR-DEL-001/002/003, BR-GOAL-002, BR-NOTIF-001, BR-VIEW-001, BR-ACC-004/005 | Onaylı kısımlar `ONAYLI` yapıldı | D-017, D-030..D-043, D-051 |
| 2026-10-27 | BR-NOTIF-002/004 | E-posta kanalı SONRA'ya taşındı | D-037 |
| 2026-10-27 | BR-REM-005, BR-DEL-003, BR-ACC-005 | Tetikleme yöntemi pg-boss'tan bağımsızlaştırıldı | D-044 |
| 2026-10-27 | BR-PROJ-004 | Arşivli projenin görevlerinin salt okunurluğu eklendi | D-043'ten türetildi |
| 2026-10-27 | Tüm `ÖNERİ` kurallar | `ONAYLI` yapıldı | D-060 (OQ-030) |
| 2026-10-27 | BR-PROJ-004 | İçerik netleştirildi: arşivli projenin görevleri salt okunur; taşıma/tekil silme kuralları eklendi | D-043, D-060 |
| 2026-10-27 | BR-REM-005, BR-DEL-003, BR-ACC-005 | Tetikleme: yalnızca uygulama açık/çalışırken; worker yok | D-053 |
| 2026-10-27 | BR-ACC-003, BR-ACC-004 | Güvenlik e-postaları ve doğrulama gerektiren işlemler kesinleşti | D-055 |
| 2026-10-27 | BR-NOTIF-001 | Günlük özet MVP dışı | D-054 |
| 2026-10-27 | BR-PERM-005 | SONRA'ya alındı (EntitlementService yazılmayacak) | D-061 |
| 2026-10-27 | BR-SUB-001 | DB trigger kaldırıldı; uygulama + test yeterli | D-061 |
