# Aysly — Ürün Gereksinimleri Dokümanı (PRD)

> Durum: v0.3 · Son güncelleme: 2026-10-27 · Uygulama durumu: Kod yok
> v0.2: OQ-001..OQ-023 kararları işlendi (D-030..D-052). Çalışma ortamı şimdilik yalnızca yerel (D-045).
> Etiketler: `ONAYLI` · `ÖNERİ` · `AÇIK (OQ-xxx)` · `SONRA` — anlamları [DECISIONS.md](DECISIONS.md) içinde.

## İçindekiler
1. Ürün vizyonu
2. Problem ve hedef kullanıcılar
3. Değer önerisi ve farklılaşma
4. Ürün ve tasarım ilkeleri
5. Kapsam: MVP ve sonrası
6. Fonksiyonel gereksinimler (modül modül)
7. Fonksiyonel olmayan gereksinimler
8. Başarı kriterleri ve ölçüm
9. Kapsam dışı bırakılanlar ve gerekçeleri
10. Varsayımlar ve riskler
11. Sözlük

---

## 1. Ürün vizyonu

**Aysly, kişisel ve profesyonel yaşamını tek bir sakin çalışma alanında planlamak isteyen insanlar için; görevleri, projeleri, günü, notları ve hedefleri birbirine bağlayan dijital bir düzen aracıdır.**

Kısa ifade: *"Yapılacakları değil, düzeni yönet."*

Aysly bir yapılacaklar listesinden fazlasıdır, ancak karmaşık bir proje yönetim aracı da değildir. Amaç kullanıcının:
- aklındaki her şeyi hızlıca **yakalaması**,
- bunları doğru bağlama (proje, hedef, tarih) **yerleştirmesi**,
- her gün neye odaklanacağını **görmesi**,
- ilerlemesini **takip etmesi**dir.

## 2. Problem ve hedef kullanıcılar

### 2.1. Çözülen problemler

| # | Problem | Bugünkü sonuç |
|---|---|---|
| P1 | Görevler, notlar, takvim ve hedefler farklı araçlara dağılmış. | Bağlam kaybı; "bu notu hangi iş için almıştım?" |
| P2 | Kişisel ve iş sorumlulukları ayrı araçlarda veya ayrı hesaplarda. | Günün gerçek yükü görülemiyor; çift planlama. |
| P3 | Listeler büyüdükçe öncelik kayboluyor. | Her şey acil görünüyor; geciken işler fark edilmiyor. |
| P4 | Hedefler günlük işlerden kopuk. | Hedefler yılbaşı listesinde kalıyor. |
| P5 | Basit araçlar büyüyen ihtiyaçlara yetmiyor; güçlü araçlar başlangıçta bunaltıcı. | Kullanıcı araç değiştiriyor, veri taşımak zorunda kalıyor. |
| P6 | Veri kaybı korkusu (yanlışlıkla silme, kaydedilmemiş not). | Araca güven azalıyor. |

### 2.2. Hedef kullanıcılar

Ayrıntılı analiz: [USER_PERSONAS.md](USER_PERSONAS.md). Özet:
- **Birincil (MVP):** Kişisel ve/veya profesyonel işlerini tek yerde düzenlemek isteyen bireyler (öğrenciler, serbest çalışanlar, bilgi çalışanları).
- **İkincil (MVP'de desteklenen kullanım biçimi):** Çok sayıda görev ve projeyle çalışan yoğun kullanıcılar.
- **Gelecek:** Küçük ekipler ve çalışma alanı yöneticileri (Faz 10, ihtiyaç doğrulanırsa).

## 3. Değer önerisi ve farklılaşma

### 3.1. Temel değer önerisi
> "Hayatının tüm sorumluluklarını tek hesapta, tek bakışta gör; bugün neye odaklanacağını bil; hedeflerinin ilerlediğini hisset — ve hiçbir şeyi kaybetme."

### 3.2. Farklılaşma noktaları (ONAYLI — D-063)

| # | Farklılaşma | Somut karşılığı | İlgili modül |
|---|---|---|---|
| F1 | **Bağlı düzen** | Görev ↔ proje ↔ hedef ↔ not ilişkileri her ekranda görünür ("Bu görev *Maraton 2027* hedefine katkı sağlıyor"). | Görevler, Hedefler, Notlar |
| F2 | **Bugün odaklı planlama** | Dashboard'un merkezi "Bugün": geciken + bugün + takvimdeki saatli görevler + seçilmiş odak görevleri. | Dashboard |
| F3 | **Sakin deneyim** | Bildirim yağmuru yok; MVP'de yalnızca açıkça kurulan hatırlatıcılar, uygulama içinde (D-037). Rozet/oyunlaştırma yok. | Bildirimler, Tasarım |
| F4 | **Aşamalı karmaşıklık** | Basit başlar; gelişmiş filtreler, kayıtlı görünümler, toplu işlemler kullanıcı ihtiyaç duyduğunda görünür. | Görünümler, Onboarding |
| F5 | **Güven** | Her silme geri alınabilir; çöp kutusu; otomatik kaydetme; eşzamanlı düzenleme çatışmalarında veri kaybı yok. | Tüm modüller |
| F6 | **Yerel kalite** | Türkçe öncelikli dil, Türkçe karakterlere duyarlı arama (ı/i, ş/s), pazartesi ile başlayan hafta, yerel tarih biçimleri. | Arama, Tercihler |

### 3.3. Neyi yapmayacağız (bilinçli olarak)
- Kurumsal proje yönetimi (Gantt, kaynak planlama, zaman takibi/faturalama) — MVP hedefi değil.
- Sosyal özellikler, oyunlaştırma, puanlama.
- Yapay zekâ özellikleri — MVP kapsamında değil; ileride kullanıcı ihtiyacı doğrulanırsa değerlendirilir (SONRA).

## 4. Ürün ve tasarım ilkeleri

1. **Önce yakalama:** Bir görevi eklemek her ekrandan ≤ 2 saniye ve tek kısayol (`Q` veya `+`) ile mümkün olmalı.
2. **Varsayılan sade, isteğe bağlı güçlü:** Yeni alanlar ve seçenekler varsayılan olarak gizli/katlanmış gelir.
3. **Veri kutsaldır:** Hiçbir kullanıcı eylemi geri alınamaz şekilde veri kaybettirmemeli; kalıcı silme her zaman ayrı ve açık bir onay gerektirir.
4. **Tek gerçek kaynak:** Aynı veri tüm görünümlerde aynıdır; görünüm yalnızca sunumu değiştirir.
5. **Tutarlı davranış:** Aynı eylem (tamamla, arşivle, sil) her modülde aynı şekilde çalışır ve aynı iş kuralına dayanır.
6. **Sakinlik:** Kullanıcının dikkatini yalnızca gerçekten gerektiğinde iste.
7. **Erişilebilir ve klavye dostu:** Tüm temel akışlar klavyeyle yapılabilir; WCAG 2.2 AA.
8. **Gizlilik varsayılandır:** Veri yalnızca sahibine ve açıkça yetkilendirilenlere görünür.

## 5. Kapsam: MVP ve sonrası

### 5.1. Önceliklendirme yöntemi
Her özellik şu üç ölçüte göre değerlendirildi: **(a)** hangi problemi (P1–P6) çözdüğü, **(b)** birincil segment için gerekliliği, **(c)** maliyeti ve mimariye etkisi. Öncelik seviyeleri:
- **P0 (MVP zorunlu):** Olmadan ürünün temel vaadi karşılanmaz.
- **P1 (MVP hedef):** MVP'de olması planlanan; zaman sıkışırsa lansman sonrasına kayabilir.
- **P2 (Sonra):** MVP sonrası, kullanıcı geri bildirimine göre.
- **P3 (Koşullu):** Yalnızca ihtiyaç doğrulanırsa.

### 5.2. Kapsam tablosu

| Modül | Özellik | Öncelik | Gerekçe |
|---|---|---|---|
| Hesap | Kayıt, giriş, çıkış, oturum yönetimi | P0 | Temel |
| Hesap | Şifre sıfırlama, e-posta doğrulama | P0 | Güvenlik, hesap kurtarma |
| Hesap | Profil, şifre değiştirme, aktif oturumları görme/kapatma | P1 | Güvenlik, güven |
| Hesap | Hesap silme | P0 (Faz 8) | KVKK/GDPR, P6 |
| Hesap | Çalışma alanının JSON dışa aktarımı | P0 (Faz 8) — D-046 | KVKK veri taşınabilirliği, güven |
| Hesap | Google ve diğer giriş yöntemleri, passkey | P2 — D-039 | Kolaylık |
| Onboarding | Kullanım amacı sorusu + başlangıç düzeni | P1 | Kişiselleştirilmiş başlangıç |
| Dashboard | Bugün / Geciken / Yaklaşan / Hızlı ekleme | P0 | F2, P3 |
| Dashboard | Proje özeti, hedef ilerlemesi widget'ları | P1 | P4 |
| Dashboard | Widget göster/gizle ve sırala | P1 | F4 |
| Dashboard | Serbest boyutlandırmalı ızgara düzeni | P2 | Maliyet yüksek, değer düşük |
| Görevler | CRUD, tamamlama, açıklama, tarih, öncelik, durum | P0 | Temel |
| Görevler | Etiketler | P0 | P2 (bağlam ayrımı) |
| Görevler | Alt görevler (tek seviye) | P0 | Büyük işleri bölme |
| Görevler | Hatırlatıcılar | P0 (Faz 6) | P3 |
| Görevler | Tekrarlayan görevler | P0 (Faz 6) — D-033 | Günlük rutinler |
| Görevler | Arşiv, çöp kutusu, geri yükleme | P0 | P6 |
| Görevler | Toplu işlemler | P1 | Yoğun kullanıcı |
| Görevler | Görev bağımlılıkları | P3 | Bireysel kullanımda nadir; ekip özellikleriyle değerlendirilir |
| Görevler | Dosya ekleri | P2 | Depolama maliyeti + güvenlik; ihtiyaç doğrulanmalı |
| Inbox / My Tasks | Inbox, My Tasks | P0 | Yakalama (ilke 1) |
| Projeler | CRUD, durum, ilerleme, arşiv/silme | P0 | Temel |
| Projeler | Bölümler (proje içi gruplar) | P2 | Board ve etiketler MVP'de yeterli |
| Görünümler | Liste, Board | P0 | Temel |
| Görünümler | Filtreleme ve sıralama | P0 | P3 |
| Görünümler | Kayıtlı görünümler (filtre + sıralama) | P0 — D-051 | Yoğun kullanıcı |
| Görünümler | Paylaşılan görünümler | P3 (Faz 10) — D-051 | Ekip özelliği |
| Takvim | Ay, hafta, gün görünümü | P0 (Faz 6) | P1 |
| Takvim | Sürükle-bırak (masaüstü hafta ve ay; mobilde tarih seçici) | P0 — D-047 | Hızlı planlama |
| Takvim | Harici takvim senkronizasyonu (Google/Outlook/ICS) | P2 | Karmaşık; doğrulama gerekli |
| Hedefler | CRUD, ilerleme, görev/proje bağlama | P1 (Faz 7) — D-034 | P4, F1 |
| Notlar | CRUD, otomatik kaydetme, bağlama, etiket | P1 (Faz 7) — D-042 | P1, F1 |
| Arama | Global arama (görev, proje, not, hedef) | P0 (Faz 7) | P1 |
| Bildirimler | Uygulama içi bildirim merkezi | P0 (Faz 6) | Hatırlatıcılar için gerekli |
| Bildirimler | E-posta bildirimleri | P2 (SONRA) — D-037 | |
| Bildirimler | Günlük özet | SONRA — D-054 | Dashboard yeterli |
| Analitik | Ürün analitiği | Yok; betada yeniden değerlendirme — D-052 | Gizlilik |
| Bildirimler | Tarayıcı/mobil push | P2 | |
| Ayarlar | Tema, dil, saat dilimi, tarih biçimi, hafta başlangıcı, varsayılan görünüm, bildirimler | P0 | Kişiselleştirme |
| Ekip | Paylaşılan çalışma alanları, davet, atama, yorumlar | P3 (Faz 10) | D-007 |
| Abonelik | Ücretli planlar (ileride çalışma alanı bazlı) | P3 — D-048 | |
| Mobil | Duyarlı (responsive) web | P0 | |
| Mobil | PWA kurulabilirlik | P2 | |
| Mobil | Yerel mobil uygulama | P3 | API (D-013) buna hazırdır |

## 6. Fonksiyonel gereksinimler

Kural kimlikleri [BUSINESS_RULES.md](BUSINESS_RULES.md) dosyasındadır; burada **ne** istendiği, orada **nasıl** uygulanacağı yazılıdır. Bu belge ile iş kuralları çelişirse **BUSINESS_RULES.md geçerlidir** ve çelişki düzeltilir.

### 6.1. Kimlik doğrulama ve hesap yönetimi (FR-AUTH)

| ID | Gereksinim | Öncelik | Kurallar |
|---|---|---|---|
| FR-AUTH-01 | Kullanıcı e-posta, şifre ve adıyla kayıt olur; kayıtta kişisel çalışma alanı ve varsayılan tercihler oluşturulur. | P0 | BR-ACC-001, BR-ACC-002, BR-WS-001, BR-PREF-001 |
| FR-AUTH-02 | Kullanıcı e-posta + şifre ile giriş yapar; başarısız girişler hız sınırlamasına tabidir. | P0 | BR-ACC-006, SECURITY §4 |
| FR-AUTH-03 | E-posta doğrulama bağlantısı gönderilir (yerelde e-posta yakalayıcıya). Temel özellikler doğrulamasız kullanılabilir; e-posta gerektiren işlemler doğrulama ister (D-040, D-055). MVP güvenlik e-postaları: doğrulama, şifre sıfırlama, "şifren değişti" (D-055). | P0 | BR-ACC-004 |
| FR-AUTH-04 | Şifremi unuttum: tek kullanımlık, süreli bağlantı; başarılı sıfırlamada tüm oturumlar kapanır. | P0 | BR-ACC-003 |
| FR-AUTH-05 | Çıkış yap: sunucudaki oturum geçersiz kılınır, çerez temizlenir. | P0 | BR-ACC-006 |
| FR-AUTH-06 | Aktif oturumları görme ve diğer oturumları kapatma. | P1 | BR-ACC-006 |
| FR-AUTH-07 | Profil (ad, avatar), e-posta değiştirme (yeni adres doğrulanır), şifre değiştirme (mevcut şifre gerekir). | P1 | BR-ACC-002 |
| FR-AUTH-08 | Hesap silme talebi; 14 günlük iptal edilebilir bekleme. | P0 (Faz 8) | BR-ACC-005 — D-036 |
| FR-AUTH-09 | Çalışma alanının, profilin ve tercihlerin JSON olarak dışa aktarılması; güvenlik bilgileri hariç; şifreyle yeniden doğrulama (D-055, D-059). CSV ve içe aktarma SONRA. | P0 (Faz 8) | D-046 |

### 6.2. Dashboard (FR-DASH)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-DASH-01 | "Bugün" widget'ı: bugün vadesi gelen görevler + saatli görevler zaman sırasıyla. | P0 |
| FR-DASH-02 | "Geciken" widget'ı: vadesi geçmiş, tamamlanmamış görevler (en eski önce). Tek tıkla "bugüne taşı" / "yarına ertele". | P0 |
| FR-DASH-03 | "Yaklaşan" widget'ı: önümüzdeki 7 gün (gün gün gruplu). | P0 |
| FR-DASH-04 | "Öncelikli" widget'ı: yüksek öncelikli açık görevler (en fazla 10). | P1 |
| FR-DASH-05 | Hızlı görev ekleme alanı (varsayılan hedef: Inbox; tarih/proje/etiket için doğal dil kısayolları P2). | P0 |
| FR-DASH-06 | "Projeler" widget'ı: aktif projeler ve ilerleme yüzdeleri. | P1 |
| FR-DASH-07 | "Hedefler" widget'ı: aktif hedefler ve ilerlemesi. | P1 |
| FR-DASH-08 | Widget'ları göster/gizle ve sırala; düzen kullanıcıya özel saklanır. | P1 |

"Bugün" tanımı kullanıcının **tercih edilen saat dilimindeki** takvim günüdür (BR-DATE-003, BR-DASH-002).

### 6.3. Görev yönetimi (FR-TASK)

#### 6.3.1. Görev alanları

| Alan | Amaç | Zorunlu | Varsayılan | Kural |
|---|---|---|---|---|
| Başlık | İşin kısa tanımı | Evet | — | BR-TASK-001 (1–500 karakter) |
| Açıklama | Ayrıntı, bağlantılar, kontrol listesi | Hayır | boş | Markdown, ≤ 20.000 karakter, sunucuda temizlenir (SECURITY §5) |
| Proje | Görevin bağlamı | Evet (örtük) | Inbox | BR-TASK-002 — D-030 |
| Durum | İş akışındaki yer | Evet | Yapılacak | BR-TASK-003 — D-041 |
| Öncelik | Önem derecesi | Evet | Yok | BR-TASK-005 |
| Başlangıç tarihi | İşe ne zaman başlanacağı | Hayır | — | BR-DATE-002 |
| Son tarih (+ isteğe bağlı saat) | Teslim zamanı | Hayır | — | BR-DATE-001..006 |
| Etiketler | Bağlamlar arası gruplama (ör. `#ev`, `#müşteri-a`) | Hayır | — | BR-TAG-001..003 |
| Alt görevler | İşi bölme | Hayır | — | BR-SUB-001..005 |
| Hatırlatıcılar | Zamanında haberdar olma | Hayır | — | BR-REM-001..005 |
| Tekrar kuralı | Rutin işler | Hayır | — | BR-REC-001..007 |
| Atanan kişi | Ekiplerde sorumlu | Hayır | Oluşturan (kişisel alanda gizli) | SONRA (Faz 10) |
| Bağlı notlar / hedefler | F1 bağlam | Hayır | — | BR-NOTE-003, BR-GOAL-004 |
| Sistem alanları | `created_at`, `updated_at`, `completed_at`, `version` | Sistem | — | BR-TASK-004, BR-TASK-010 |

#### 6.3.2. Görev işlemleri

| ID | Gereksinim | Öncelik | Kurallar |
|---|---|---|---|
| FR-TASK-01 | Oluşturma (hızlı ekleme ve ayrıntılı form). Çift gönderim aynı görevi iki kez oluşturmaz. | P0 | BR-TASK-001, BR-TASK-007 |
| FR-TASK-02 | Düzenleme (satır içi ve detay panelinde). Eşzamanlı düzenleme çatışması algılanır. | P0 | BR-TASK-010 |
| FR-TASK-03 | Tamamlama ve tamamlamayı geri alma (5 sn "Geri al" bildirimi + sonrasında yeniden açma). | P0 | BR-TASK-004, BR-SUB-003, BR-REC-002 |
| FR-TASK-04 | Silme (çöpe) ve çöpten geri yükleme; "Geri al" bildirimi. | P0 | BR-DEL-001..007 |
| FR-TASK-05 | Arşivleme ve arşivden çıkarma. | P0 | BR-DEL-002 |
| FR-TASK-06 | Görev detay ekranı/paneli: tüm alanlar, alt görevler, bağlı notlar/hedefler, etkinlik (oluşturma/tamamlama zamanları). | P0 | — |
| FR-TASK-07 | Alt görev ekleme, sıralama, tamamlama, alt görevi bağımsız göreve dönüştürme. | P0 | BR-SUB-* |
| FR-TASK-08 | Toplu işlemler: tamamla, tarih ata, proje taşı, öncelik/etiket ata, arşivle, sil (en fazla 200 kayıt, atomik). | P1 | BR-TASK-008 |
| FR-TASK-09 | Sürükleyerek sıralama (liste ve board içinde). | P0 | BR-TASK-006 |
| FR-TASK-10 | Görev bağımlılıkları | P3 | BR-TASK-009 |

### 6.4. My Tasks ve Inbox (FR-INBOX)

- **Inbox:** Henüz bir projeye yerleştirilmemiş görevlerin toplandığı yer. Hızlı ekleme varsayılan olarak buraya ekler. Inbox'un hedefi **boşaltılmaktır**: görev bir projeye taşınır, tamamlanır, silinir veya arşivlenir. Her çalışma alanında bir Inbox bulunur, silinemez ve menüde projelerden ayrı gösterilir (D-030).
- **My Tasks:** Kullanıcının erişebildiği tüm projelerdeki (Inbox dahil) açık görevlerin tek listesi. Varsayılan gruplama: *Geciken · Bugün · Yarın · Bu hafta · Daha sonra · Tarihsiz*. Gruplama, sıralama ve filtre değiştirilebilir. Ekip özellikleri geldiğinde My Tasks = "bana atanmış görevler" olur (BR-INBOX-004).

| ID | Gereksinim | Öncelik | Kurallar |
|---|---|---|---|
| FR-INBOX-01 | Inbox listesi, açık görev sayısı rozeti. | P0 | BR-INBOX-003 |
| FR-INBOX-02 | Görevi Inbox'tan projeye taşıma (tekil ve toplu); tüm alanlar korunur. | P0 | BR-INBOX-002 |
| FR-INBOX-03 | My Tasks listesi ve gruplama. | P0 | BR-INBOX-004 |

### 6.5. Projeler (FR-PROJ)

| ID | Gereksinim | Öncelik | Kurallar |
|---|---|---|---|
| FR-PROJ-01 | Proje oluşturma/düzenleme: ad (zorunlu), açıklama, renk, simge. | P0 | BR-PROJ-001 |
| FR-PROJ-02 | Proje durumu: Aktif / Beklemede / Tamamlandı. | P0 | BR-PROJ-002 |
| FR-PROJ-03 | İlerleme göstergesi. | P0 | BR-PROJ-003 |
| FR-PROJ-04 | Proje listesi: filtre (durum), sıralama (ad, son güncelleme, manuel). | P0 | — |
| FR-PROJ-05 | Arşivleme/arşivden çıkarma. | P0 | BR-PROJ-004 |
| FR-PROJ-06 | Silme ve geri yükleme; bağlı görevlerin akıbeti. | P0 | BR-PROJ-005 — D-031 |

### 6.6. Görev görünümleri (FR-VIEW)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-VIEW-01 | Liste görünümü (gruplama: yok/tarih/öncelik/durum/proje). | P0 |
| FR-VIEW-02 | Board görünümü (sütunlar = durumlar; sürükle-bırak durum değiştirir). | P0 |
| FR-VIEW-03 | Takvim görünümü (bkz. 6.7). | P0 |
| FR-VIEW-04 | Ortak filtreler: durum, öncelik, etiket, proje, tarih aralığı, tarihsiz, arşivlenmiş dahil. | P0 |
| FR-VIEW-05 | Sıralama: manuel, son tarih, öncelik, oluşturma, başlık. | P0 |
| FR-VIEW-06 | Görünüm geçişinde filtreler ve seçili kayıt korunur. | P0 |
| FR-VIEW-07 | Kayıtlı görünümler: filtre ve sıralama ayarlarını ad vererek kaydetme; paylaşım SONRA. | P0 — D-051 |
| FR-VIEW-08 | Varsayılan görünüm ayarı (kullanıcı tercihi; proje bazında son kullanılan hatırlanır). | P1 |

Kural: Görünümler yalnızca **sunum** katmanıdır; aynı sorgu servisini ve aynı filtre tanımını (`TaskFilter` şeması) kullanır (BR-VIEW-002).

### 6.7. Takvim ve zaman yönetimi (FR-CAL)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-CAL-01 | Ay / hafta / gün görünümleri; bugün düğmesi; önceki/sonraki. | P0 |
| FR-CAL-02 | Tüm gün görevleri gün başlığında, saatli görevler saat ızgarasında. | P0 |
| FR-CAL-03 | Görev tarihini takvimden değiştirme: masaüstünde hafta ve ay görünümlerinde sürükle-bırak, mobilde tarih seçici (D-047); her durumda klavye/menü alternatifi. | P0 |
| FR-CAL-04 | Tarihsiz görevler takvimde görünmez; masaüstünde açılabilir "Tarihsiz" yan paneli üzerinden takvime sürüklenebilir. | P1 |
| FR-CAL-05 | Tekrarlayan görevlerin gelecek örneği önizlemesi. | P2 — D-033 ile uyumlu |
| FR-CAL-06 | Tüm zamanlar kullanıcının tercih edilen saat diliminde gösterilir. | P0 |

### 6.8. Hedefler (FR-GOAL)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-GOAL-01 | Hedef oluşturma: başlık (zorunlu), açıklama, hedef tarihi (isteğe bağlı). | P1 |
| FR-GOAL-02 | Görev ve projeleri hedefe bağlama (çoktan çoğa). | P1 |
| FR-GOAL-03 | İlerleme: her hedef için otomatik (varsayılan) veya manuel (D-034). | P1 |
| FR-GOAL-04 | Durum: Aktif / Ulaşıldı / Bırakıldı; arşiv ve çöp. | P1 |

### 6.9. Notlar (FR-NOTE)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-NOTE-01 | Not oluşturma/düzenleme; başlık isteğe bağlı (yoksa ilk satırdan türetilir). | P1 |
| FR-NOTE-02 | Otomatik kaydetme + kayıt durumu göstergesi ("Kaydediliyor… / Kaydedildi / Kaydedilemedi"). | P1 |
| FR-NOTE-03 | Düzenleme sırasında veri kaybını önleme (yerel taslak, sayfadan çıkış uyarısı, çatışma kopyası). | P1 |
| FR-NOTE-04 | Görev ve projelere bağlama; görev/proje detayında bağlı notlar. | P1 |
| FR-NOTE-05 | Etiketleme, sabitleme, arşiv, çöp. | P1 |

### 6.10. Arama ve filtreleme (FR-SRCH)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-SRCH-01 | Global arama (`Ctrl/Cmd+K`): görev, proje, not, hedef; türe göre gruplu sonuç. | P0 |
| FR-SRCH-02 | Türkçe karakter duyarsız eşleşme (ı/i, ş/s, ğ/g, ç/c, ö/o, ü/u). | P0 |
| FR-SRCH-03 | Boş sonuçta öneriler: yazımı kontrol et, filtreleri kaldır, "Bu başlıkla görev oluştur". | P0 |
| FR-SRCH-04 | Arşivlenmiş kayıtları dahil etme seçeneği; çöpteki kayıtlar aramada çıkmaz. | P0 |

### 6.11. Bildirimler (FR-NOTIF)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-NOTIF-01 | Uygulama içi bildirim merkezi; okundu/okunmadı; tümünü okundu say. | P0 |
| FR-NOTIF-02 | Hatırlatıcı bildirimleri. | P0 |
| FR-NOTIF-03 | Günlük özet (bugünkü ve geciken görevler). | SONRA — D-054 |
| FR-NOTIF-04 | Bildirim türü bazında tercihler; MVP'de tek kanal uygulama içi (D-037). | P0 |
| FR-NOTIF-05 | Aynı olay için tekrarlanan bildirim gönderilmez. | P0 |
| FR-NOTIF-06 | Görev değişikliği ve atama bildirimleri | SONRA (Faz 10) — tek kullanıcılı alanda kişinin kendi değişikliğini bildirmenin değeri yoktur. |

### 6.12. Ayarlar, arşiv ve çöp kutusu (FR-SET)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-SET-01 | Görünüm: tema (açık/koyu/sistem), dil, yoğunluk (rahat/sıkı). | P0 |
| FR-SET-02 | Tarih ve saat: saat dilimi, tarih biçimi, 12/24 saat, haftanın ilk günü. | P0 |
| FR-SET-03 | Varsayılanlar: varsayılan görev görünümü, açılış sayfası, tüm gün hatırlatıcı saati. | P1 |
| FR-SET-04 | Bildirim tercihleri. | P0 |
| FR-SET-05 | Dashboard düzeni. | P1 |
| FR-SET-06 | Arşiv sayfası (türe göre filtre). | P0 |
| FR-SET-07 | Çöp kutusu: geri yükle, kalıcı sil, çöpü boşalt; kalan gün sayısı. | P0 |
| FR-SET-08 | Hesap ve güvenlik: profil, şifre, oturumlar, dışa aktarma, hesap silme. | P0/P1 |

Arşiv, silme ve geri yükleme kavramları: BR-DEL-001..007.

### 6.13. Ek modül: Etkinlik ve denetim kaydı (FR-AUDIT) — ONAYLI (D-060)
Gerekçe: güvenlik olaylarının (giriş, şifre değişikliği, oturum kapatma, hesap silme) izlenebilirliği ve ileride ekip özelliklerinde "kim ne yaptı?" ihtiyacı. MVP'de yalnızca güvenlik olayları ve yıkıcı işlemler (silme, kalıcı silme, geri yükleme) kaydedilir; kullanıcıya "Hesap güvenliği" sayfasında son güvenlik olayları gösterilir (P1).

## 7. Fonksiyonel olmayan gereksinimler (NFR)

| ID | Kategori | Gereksinim (MVP hedefi, D-060) |
|---|---|---|
| NFR-01 | Performans | API p95 < 300 ms (okuma), < 500 ms (yazma) — 1.000 görevli çalışma alanında. İlk anlamlı içerik (LCP) < 2,5 sn (4G orta segment mobil). |
| NFR-02 | Algılanan hız | Görev tamamlama, oluşturma, sürükleme iyimser (optimistic) güncellenir; hata olursa geri alınır ve bildirilir. |
| NFR-03 | Ölçek | Kullanıcı başına 10.000 görev, 500 proje, 5.000 not sorunsuz çalışır (sayfalama ve indekslerle). |
| NFR-04 | Erişilebilirlik | WCAG 2.2 AA; tüm temel akışlar klavyeyle; ekran okuyucu etiketleri. |
| NFR-05 | Tarayıcı | Chrome, Edge, Firefox, Safari'nin son 2 ana sürümü; iOS Safari 16+, Android Chrome. |
| NFR-06 | Duyarlılık | 360 px genişlikten başlayarak mobil, tablet, masaüstü. |
| NFR-07 | Güvenilirlik | Yerel: veri kaybını önlemek için yedek betiği ve geri yükleme adımları (SECURITY §8.2). Erişilebilirlik süresi ve RPO/RTO hedefleri yayına alma kararına ertelendi (OQ-032). |
| NFR-08 | Güvenlik | [SECURITY.md](SECURITY.md) MVP maddelerinin tamamı. |
| NFR-09 | Gizlilik | KVKK ve GDPR ile uyumlu veri işleme; dışa aktarma ve silme hakkı. |
| NFR-10 | Yerelleştirme | Kodda sabit kullanıcı metni yok; tüm metinler çeviri dosyalarında. |
| NFR-11 | Gözlemlenebilirlik | Her istekte `requestId`; yapılandırılmış log. Hata izleme servisi yayına alma kararında (OQ-032). |
| NFR-12 | Bakım | TS strict, lint ve testler `pnpm verify` içinde zorunlu; iş kuralları test kapsamında. |

## 8. Başarı kriterleri ve ölçüm (hedef değerler beta kararıyla ele alınacak — D-063, D-052)

| Alan | Metrik | Hedef (ÖNERİ; beta başladığında) |
|---|---|---|
| Aktivasyon | Kayıttan sonraki 24 saatte ≥ 3 görev oluşturan kullanıcı oranı | ≥ %60 |
| Değer | Haftalık aktif kullanıcıların haftada ≥ 3 gün Bugün/Dashboard'u açma oranı | ≥ %40 |
| Elde tutma | 7. gün geri dönüş (D7) | ≥ %25 |
| Elde tutma | 30. gün geri dönüş (D30) | ≥ %15 |
| Düzen | Inbox'a eklenen görevlerin 7 gün içinde işlenme oranı | ≥ %50 |
| Güven | Kullanıcı kaynaklı veri kaybı olayı | 0 |
| Kalite | Sunucu hata oranı (5xx) | < %0,5 istek |
| Erişilebilirlik | Temel akışlarda otomatik axe ihlali | 0 kritik/ciddi |

D-052 gereği şimdilik analitik kurulmaz; bu metrikler ölçülmez. Beta aşamasında analitik ihtiyacı yeniden değerlendirilir; kullanılırsa gizlilik odaklı olur ve görev/not içeriği gönderilmez. Kalite ve erişilebilirlik satırları yerelde testlerle ölçülebilir.

## 9. Kapsam dışı bırakılanlar ve gerekçeleri

| Konu | Karar | Gerekçe |
|---|---|---|
| Görev bağımlılıkları | P3 | Bireysel kullanımda nadir; ekiplerde değerlendirilecek. Veri modeli ayrı bağlantı tablosu ile eklenebilir. |
| Dosya ekleri | P2 | Depolama, virüs taraması, kota maliyeti; ihtiyaç doğrulanmalı. |
| Harici takvim senkronizasyonu | P2 | OAuth, çift yönlü eşitleme karmaşıklığı. |
| Çevrimdışı mod | P2 | D-020. |
| Kullanıcı tanımlı durumlar ve alanlar | P2 | MVP durumları D-041; veri modeli hazırlıklı. |
| Zaman takibi | Kapsam dışı | Ürün odağı dışında. |
| Yapay zekâ özellikleri | P3 | İhtiyaç doğrulanmadı. |
| Mikroservisler | Kapsam dışı | D-005. |

## 10. Varsayımlar ve riskler

### 10.1. Varsayımlar (doğrulanmalı)
- A1: Birincil kullanıcılar Türkiye'de ve Türkçe konuşan kişilerdir; ikinci dil İngilizcedir; ikisi de desteklenir (D-038).
- A2: Kullanıcıların büyük kısmı masaüstü + mobil tarayıcıyı birlikte kullanır.
- A3: MVP'de ücretlendirme yoktur (ONAYLI, D-048).
- A4: Şimdilik uygulama yalnızca ürün sahibinin bilgisayarında çalışır (ONAYLI, D-045). Beta ve diğer kullanıcılar yayına alma kararına bağlıdır (OQ-032); beta yapılırsa davetli, sınırlı bir grupla yapılması varsayılır.

### 10.2. Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Kapsam şişmesi (her modülün aynı anda büyümesi) | Yüksek | Yüksek | Faz kapıları (IMPLEMENTATION_PLAN §3), P0/P1 disiplini |
| Tarih/saat dilimi hataları | Orta | Yüksek | D-016, kapsamlı DST testleri |
| Tekrarlayan görev mantığında hata | Orta | Orta | Saf (pure) domain fonksiyonu, özellik tabanlı testler |
| Tek geliştirici + yapay zekâ ile mimari kayma | Orta | Yüksek | CLAUDE.md süreçleri, kod incelemesi, mimari testleri (bağımlılık kuralları) |
| Veri sızıntısı (çapraz çalışma alanı erişimi) | Düşük | Çok yüksek | Zorunlu kapsamlı repository, yetki matrisi testleri |

## 11. Sözlük

| Terim | Tanım |
|---|---|
| Çalışma alanı (Workspace) | Verinin ait olduğu bağlam. Her kullanıcının bir kişisel çalışma alanı vardır; ileride paylaşılan çalışma alanları eklenebilir. |
| Üyelik (Membership) | Bir kullanıcının bir çalışma alanındaki rolünü tanımlayan kayıt. |
| Rol | Üyeliğin izin kümesi: Sahip, Yönetici, Üye, Misafir. |
| Segment | Ürünün hangi amaçla kullanıldığı (bireysel/profesyonel). Hesap türü değildir. |
| Inbox | İşlenmemiş görevlerin toplandığı, her çalışma alanında bir tane bulunan, silinemeyen yer (D-030). |
| My Tasks | Kullanıcının tüm açık görevlerinin tek listesi. |
| Arşiv | Aktif görünümlerden kaldırılmış ama saklanan kayıtlar. |
| Çöp kutusu | Silinmiş, saklama süresi boyunca geri yüklenebilir kayıtlar. |
| Kalıcı silme | Kaydın veritabanından geri dönülmez şekilde kaldırılması. |
| Tüm gün görevi | Yalnızca tarihi olan (saati olmayan) görev. |
| Saatli görev | Tarih + saat + saat dilimi olan görev. |
| Seri (recurrence series) | Aynı tekrar kuralından türeyen görev örneklerinin grubu. |
| Silme grubu (deleted batch) | Tek bir kullanıcı eylemiyle birlikte silinen kayıtların ortak kimliği; birlikte geri yüklenir. |
