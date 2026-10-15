# Hata Durumları ve Uç Senaryolar

> Durum: v0.3 · Son güncelleme: 2026-10-15
> Her senaryo: beklenen sistem davranışı, kullanıcı mesajı (Türkçe ana metin; çeviri anahtarı uygulamada), gerekli testler. Kural kimlikleri BUSINESS_RULES'a referanstır.

## 1. Kullanıcı mesajı ilkeleri
- Ne oldu + ne yapabilirsin. Teknik ayrıntı, hata kodu (requestId hariç, "Ayrıntılar" altında) gösterilmez.
- Suçlamayan, kısa. Kullanıcının girdisi **asla** silinmez.
- Kalıcı olmayan hatalar toast; ekranı engelleyen hatalar sayfa içi hata durumu.

## 2. Senaryolar

| # | Senaryo | Beklenen davranış | Kullanıcı mesajı | Testler | Kural |
|---|---|---|---|---|---|
| E01 | Aynı görevin çift gönderimi (çift tıklama, ağ tekrarı) | Idempotency anahtarı ile tek kayıt; düğme gönderim süresince devre dışı | — (görünür etki yok) | API: aynı anahtarla eşzamanlı 2 istek → 1 kayıt; E2E: hızlı çift Enter → 1 görev | BR-TASK-007 |
| E02 | Kullanıcı bilinçli olarak aynı başlıkla ikinci görev ekler | İzin verilir | — | Birim: başlık benzersizliği yok | BR-TASK-007 |
| E03 | İnternet bağlantısı kesilir | Çevrimdışı bandı; yeni değişiklikler gönderilmez ve girdi korunur; hızlı ekleme ve not taslağı yerelde saklanır; bağlantı gelince "Kaydedilmemiş 2 değişiklik var — Gönder" | "Bağlantı yok. Değişikliklerin bağlantı gelince kaydedilmek üzere bu cihazda tutuluyor." | E2E: ağ kesme simülasyonu → not taslağı korunur, bağlantı sonrası kaydedilir | D-020 |
| E04 | Kaydetme hatası (5xx/zaman aşımı) | İyimser değişiklik geri alınır, alan eski değerine döner; 3 kez otomatik yeniden deneme yalnızca idempotent işlemlerde | "Değişiklik kaydedilemedi. [Tekrar dene]" | Birim (istemci): mutation hata → geri alma; API: 500'de iç ayrıntı yok | NFR-02 |
| E05 | Eşzamanlı düzenleme | 409 + güncel kayıt; farklı alanlar otomatik birleşir; aynı alan → kullanıcıya seçim | "Bu görev başka bir yerde değiştirildi." + seçenekler | API: eski `version` → 409; E2E: iki sekme | BR-TASK-010, BR-NOTE-002 |
| E06 | Yetkisiz erişim denemesi (başka kullanıcının ID'si) | 404; denetim kaydına şüpheli erişim olayı (yoğunluk eşiğinde uyarı) | "Aradığın sayfa bulunamadı ya da erişimin yok." | Her uç nokta için çapraz kullanıcı testi | BR-PERM-001 |
| E07 | Oturum süresi dolmuş | 401 → giriş sayfasına yönlendirme, dönüş adresi saklanır; açık formdaki girdi yerel taslakta | "Oturumun sona erdi. Kaldığın yerden devam etmek için tekrar giriş yap." | E2E: çerez silme → yönlendirme + dönüş | BR-ACC-006 |
| E08 | Arşivlenmiş kayda erişim / düzenleme | Salt okunur gösterim; düzenleme 422 | "Bu görev arşivde. Düzenlemek için arşivden çıkar." | API: arşivli görev PATCH → 422 BR-DEL-002 | BR-DEL-002, BR-DEL-007 |
| E09 | Çöpteki kayda bağlantıyla erişim | "Çöp kutusunda" ekranı + geri yükle | "Bu görev çöp kutusunda. [Geri yükle]" | E2E | BR-DEL-007 |
| E10 | Kalıcı silinmiş kayda erişim | 404 | "Bu kayıt artık mevcut değil." | API | BR-DEL-007 |
| E11 | Proje silindiğinde bağlı görevler | Proje ve görevleri birlikte çöpe gider, birlikte geri yüklenir (D-031) | Onay: "Bu proje ve içindeki 23 görev çöp kutusuna taşınacak…" | Entegrasyon: proje sil → tüm görevler aynı batch; geri yükle → hepsi döner | BR-PROJ-005 |
| E12 | Projesi kalıcı silinmiş görevin geri yüklenmesi | Inbox'a geri yüklenir | "Görev Inbox'a geri yüklendi çünkü projesi artık yok." | Entegrasyon | BR-DEL-004 |
| E13 | Yaz saati geçişi (DST) | Var olmayan saat ileri kaydırılır; çift saat ilk gerçekleşme; tekrarlar yerel saatte kalır | Görev detayında düzeltilen saat gösterilir | Birim: `America/New_York`, `Europe/Berlin` geçiş tarihleri | BR-DATE-006 |
| E14 | Kullanıcı saat dilimini değiştirir / seyahat eder | Tüm gün tarihleri sabit; saatli görevlerin anı sabit; tarayıcı farkı için bir kez öneri | "Saat dilimin değişmiş görünüyor (Berlin). Güncelleyelim mi?" | Birim + E2E (tarayıcı saat dilimi emülasyonu) | BR-DATE-005 |
| E15 | Geçersiz tarih aralığı (başlangıç > son tarih) | 400; arayüz başlangıcı kaydırmayı önerir | "Başlangıç tarihi son tarihten sonra olamaz." | Birim, API, DB CHECK | BR-DATE-002 |
| E16 | Geçmiş tarihli hatırlatıcı | 422 | "Hatırlatıcı zamanı gelecekte olmalı." | API | BR-REM-002 |
| E17 | Tekrarlanan bildirim riski (iki istek/bakım çalışması aynı hatırlatıcıyı aynı anda işler) | Koşullu güncelleme + `dedupe_key` → tek bildirim | — | Entegrasyon: aynı hatırlatıcıyı paralel iki iş → 1 bildirim | BR-REM-005, BR-NOTIF-002 |
| E18 | Uygulama kapalıyken zamanı geçen hatırlatıcılar (yerel ortamda olağan durum) | Uygulama açılınca ≤ 24 saat gecikmeliler "gecikmeli" etiketiyle bildirime dönüşür; daha eskiler atlanır (D-053) | Bildirimde "(gecikmeli)" | Entegrasyon (sahte saat) | BR-REM-005 |
| E19 | Boş arama sonucu | Öneriler + "görev oluştur" | "‘xyz’ için sonuç bulunamadı." | E2E | FR-SRCH-03 |
| E20 | Eksik/hatalı veri (ör. JSONB tercih bozuk, eski şema) | Varsayılana düşülür, loglanır, kullanıcı etkilenmez | — | Birim: bozuk JSON → varsayılan | DATA_MODEL §3.5 |
| E21 | API'ye bilinmeyen alan / hatalı tür | 400, alan bazında ayrıntı | Form alanında hata | API | API §2.6 |
| E22 | Hesap silme talebi sonrası giriş | İptal seçeneği | "Hesabın 9 gün sonra silinecek. [Silmeyi iptal et]" | E2E | BR-ACC-005 |
| E23 | Hesap silme işinin yarıda kalması | İş idempotent; yeniden çalıştığında kaldığı yerden devam eder | — | Entegrasyon: iş ortasında hata → yeniden çalıştırma → tam silme | BR-ACC-005 |
| E24 | Çalışma alanından çıkarılan kullanıcının açık ekranı (Faz 10) | Sonraki istek 404; arayüz alanı kapatır, kişisel alana yönlendirir | "Bu çalışma alanına erişimin kaldırıldı." | Yetki testleri | BR-PERM-003 |
| E25 | Migration hatası (yerel veritabanında) | Migration işlem içinde geri alınır; uygulama başlatılmaz ve hata açıkça gösterilir; geri alınamayan durumda migration öncesi alınan yedekten dönülür (`pnpm db:restore`) | Terminalde: "Veritabanı güncellemesi başarısız oldu; veriler değiştirilmedi. Ayrıntı: …" | `pnpm verify`: migration'ı boş veritabanına uygulama; yedek/geri yükleme betiği testi | ARCHITECTURE §12.4, SECURITY §8.2 |
| E26 | Toplu işlemde kısmi yetkisiz kayıt | Hiçbiri uygulanmaz; reddedilenler listelenir | "Seçili görevlerden 1'i güncellenemedi; değişiklik yapılmadı." | API | BR-TASK-008 |
| E27 | Not otomatik kaydında çatışma | Çatışma kopyası oluşturulur | "Not başka bir yerde değiştirildi. Senin sürümün ayrı bir not olarak kaydedildi." | E2E iki sekme | BR-NOTE-002 |
| E28 | Kaydedilmemiş not varken sekmeyi kapatma | Tarayıcı uyarısı; yerel taslak | Tarayıcının standart uyarısı | E2E | BR-NOTE-001 |
| E29 | Ay sonu tekrar (31'i) | Ayın son günü | — | Birim | BR-REC-005 |
| E30 | Tekrarlayan görev tamamlamasının geri alınması | Değişmemiş sonraki örnek silinir | "Tamamlama geri alındı." | Entegrasyon | BR-REC-007 |
| E31 | Hız sınırı aşımı | 429 + bekleme | "Çok fazla deneme yaptın. Lütfen 2 dakika sonra tekrar dene." | API | SECURITY §4.4 |
| E32 | Etiket adı çakışması (`İş` vs `iş`) | 422 + mevcut etiket önerilir | "Bu adla bir etiket zaten var. Onu kullan?" | Birim (Türkçe normalize) | BR-TAG-001 |
| E33 | Çok uzun içerik (sınır aşımı) | 400; arayüz sayaç gösterir | "Başlık en fazla 500 karakter olabilir." | Birim, API | BR-TASK-001 |
| E34 | Arşivli projeye görev ekleme | 422 | "Bu proje arşivde. Görev eklemek için önce arşivden çıkar." | API | BR-PROJ-004 |
| E35 | Inbox'ı silme/arşivleme girişimi | 422/403; arayüzde seçenek yok | — | API | BR-PROJ-006 |

## 3. Beklenmeyen hata akışı
1. Merkezi işleyici → `500 INTERNAL_ERROR` + `requestId`.
2. Log (error seviyesi) + hata izleme olayı (PII'siz).
3. Arayüz: "Beklenmeyen bir sorun oluştu. Tekrar dene; sorun sürerse bize şu kodu ilet: 01J…".
4. Aynı hata türü 5 dk'da > 10 kez → uyarı (Faz 8).

## 4. Yerel ortama özgü senaryolar (D-045)

| # | Senaryo | Beklenen davranış | Kullanıcı mesajı | Testler | Kural |
|---|---|---|---|---|---|
| E36 | Uygulama günlerce kapalı kaldı; çöpte 30 günü dolan kayıtlar var | Açılışta bakım işi süresi dolanları kalıcı siler; işlem tamamlanana kadar bu kayıtlar geri yüklenemez | — | Entegrasyon (sahte saat) | BR-DEL-003, D-053 |
| E37 | Hesap silme bekleme süresi uygulama kapalıyken doldu | Açılışta silme işi çalışır; hesap ve veriler kalıcı silinir | — | Entegrasyon | BR-ACC-005, D-053 |
| E38 | PostgreSQL çalışmıyor | `/api/health/ready` 503; arayüz "Veritabanına ulaşılamıyor" sayfası; README'deki başlatma adımına yönlendirme | "Veritabanına bağlanılamadı. Veritabanı servisinin çalıştığından emin ol." | Manuel + API | ARCHITECTURE §11 |
| E39 | E-posta yakalayıcı (Mailpit) çalışmıyor | Güvenlik e-postası gönderimi hata verir; işlem (ör. kayıt) yine tamamlanır, e-posta yeniden gönderilebilir; hata loglanır | "Doğrulama e-postası gönderilemedi. [Tekrar gönder]" | Entegrasyon (sahte e-posta adaptörü hata verir) | BR-ACC-004 |
