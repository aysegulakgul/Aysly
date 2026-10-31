# Açık Sorular (Karar Bekleyen Konular)

> Durum: v0.7 · Son güncelleme: 2026-10-30 · Sahibi: Ürün sahibi (karar), Claude (hazırlık)

Bu dosya, **ürün sahibinin kararını bekleyen** konuların tek kaynağıdır. Bir konu burada `AÇIK` durumdayken, ona bağlı geliştirme **yapılamaz** ve ilgili belgeler bu kararı kesinleşmiş gibi yazamaz (bkz. [CLAUDE.md](../CLAUDE.md) §5).

## Nasıl kullanılır?

1. Her açık soru: bağlam, seçenekler, etkiler, Claude'un önerisi ve hangi fazı engellediği bilgisini içerir.
2. Ürün sahibi kararını verdiğinde:
   - Soru `KAPANDI` olarak işaretlenir ve verilen karar kısaca yazılır.
   - Karar [DECISIONS.md](DECISIONS.md) dosyasına `D-xxx` kaydı olarak eklenir.
   - Soruyu referans veren iş kuralları ([BUSINESS_RULES.md](BUSINESS_RULES.md)) güncellenir.
3. Yeni bir belirsizlik ortaya çıkarsa yeni bir `OQ-xxx` numarası verilir; numaralar yeniden kullanılmaz.

---

## A. Açık sorular

| ID | Konu | Engellediği faz | Öneri (kısa) | Durum |
|---|---|---|---|---|
| OQ-032 | Yayına alma (hosting, alan adı, e-posta sağlayıcı, hata izleme, yedekleme) | Yayın kararı (MVP sonrası) | Şimdi karar gerekmiyor | AÇIK (ertelendi) |

### OQ-043 — Silme talebinden sonraki 14 günde giriş — KAPANDI (D-092: seçenek A)

**Bağlam.** BR-ACC-005: talepten sonra oturumlar kapanır, bildirimler durur; iptal "14 gün içinde giriş yapılınca sunulan seçenekle" yapılır (USER_FLOWS §3.10). Kullanıcının iptal etmeden uygulamayı kullanmaya devam edip edemeyeceği yazılı değil.

| Seçenek | Sonuç |
|---|---|
| A. Girişte yalnızca "Hesabın silinmek üzere (tarih)" ekranı: [Silmeyi iptal et] [Çıkış yap]. İptal etmeden uygulamaya girilemez. | Silinmek üzere olan hesapta veri değişmez; davranış net. **Önerilen.** |
| B. Uygulama normal açılır, üstte kalıcı uyarı bandı ve iptal düğmesi. | Kullanıcı 14 gün boyunca çalışmaya devam edebilir; silinecek veriye yeni kayıt eklenir. |

**Engellediği:** Faz 8 hesap silme akışı.

### OQ-044 — Ekran okuyucu manuel testi (AC-11, NFR-04) — KAPANDI (D-093: seçenek A)

**Bağlam.** Faz 8 kapsamı "ekran okuyucu manuel testleri" içerir. Claude ekran okuyucu çalıştırıp sesli çıktıyı dinleyemez; otomatik taramaları (axe) ve yalnızca klavyeyle E2E testlerini yapabilir.

| Seçenek | Sonuç |
|---|---|
| A. Claude otomatik denetimi tüm sayfalara genişletir ve kısa bir kontrol listesi hazırlar; ürün sahibi ücretsiz NVDA ile listeyi (~20 dk) uygular, bulguları Claude düzeltir. | AC-11 tam karşılanır. **Önerilen.** |
| B. Yalnızca otomatik denetim; manuel ekran okuyucu testi yayına alma öncesine ertelenir. | Faz 8 daha hızlı kapanır; ekran okuyucu deneyimi doğrulanmamış kalır. |

**Engellediği:** Faz 8 kapanışı (geliştirmeyi engellemez).

### OQ-042 — Not editörü paketi — KAPANDI (D-090: seçenek A)

**Bağlam.** D-042 sade, Markdown tabanlı bir editör ister: başlık, liste, yapılacak listesi, bağlantı, kod. İçerik Markdown olarak saklanır. Paket seçimi plan gereği Faz 7 başında sunulur. Figma Notlar ekranı (`4:67588`) notu biçimlenmiş hâliyle gösterir: başlıklar, madde işaretleri. Ekranda ham Markdown işaretleri görünmez.

| Seçenek | Sonuç |
|---|---|
| A. Tiptap (ProseMirror, MIT) + Markdown dönüştürücü | Yazarken biçim görünür (Figma ile uyumlu). Yapılacak listesi, kısayollar ve yapıştırma hazır. İstemci paketi en büyük seçenek (~150 KB). Markdown'a çeviride bazı biçimler sadeleşebilir. **Önerilen.** |
| B. CodeMirror 6 (Markdown modu) + önizleme | Ham Markdown sözdizimi renklendirmesiyle yazılır, okurken önizleme gösterilir. Figma'daki biçimli görünüm yalnızca önizlemede olur. Orta boy (~90 KB). |
| C. Ek editör paketi yok: düz metin alanı + Markdown önizleme (remark/rehype) | En küçük ve en basit seçenek. Yazarken ham işaretler görünür. Yapılacak listesi kutuları yalnızca önizlemede tıklanır. |

Üç seçenekte de görüntüleme `SafeMarkdown` (remark/rehype + `rehype-sanitize`) ile yapılır (SECURITY §5).

### OQ-038 — Proje rengi ve simgesi — KAPANDI (D-082: seçenek A)

**Bağlam.** FR-PROJ-01 proje için renk ve simge ister; UI_UX §2.4 12 renklik bir palet adlandırır ama tonları yoktur. Figma'daki Projeler (`4:67037`) ve Proje · Pano (`4:67253`) ekranlarında projeler renksizdir (kenar çubuğunda boş daire, başlıkta klasör simgesi); proje oluşturma formu Figma'da yoktur (D-065).

| Seçenek | Sonuç |
|---|---|
| A. Renk var, simge şimdilik yok | 12 rengin tonlarını Claude Figma paletiyle uyumlu belirler ve onaya sunar (D-066 gibi). Renk kenar çubuğundaki dairede ve proje başlığında görünür. Simge kolonu boş kalır; herkes Figma'daki klasör simgesini görür. **Önerilen.** |
| B. Renk ve simge | Ek olarak Figma ikonlarından ~12 simgelik seçim. Daha fazla tasarım kararı ve Figma dışı görünüm. |
| C. İkisi de yok | Figma ile birebir; FR-PROJ-01 güncellenir. Projeler kenar çubuğunda yalnızca adla ayrışır. |

### OQ-039 — Mobilde panoda durum değiştirme — KAPANDI (D-083: seçenek A)

**Bağlam.** FR-VIEW-02 "sürükle-bırak durum değiştirir" der. Figma mobil pano (`4:68533`) sütunları alt alta dizer; dokunmatik ekranda sütunlar arası sürükleme uzun kaydırma gerektirir. Takvim için benzer karar D-047'dir (mobilde tarih seçici).

| Seçenek | Sonuç |
|---|---|
| A. Mobilde kart menüsünden "Durumu değiştir"; masaüstünde sürükle-bırak + klavye/menü alternatifi | D-047 ile tutarlı, basit, erişilebilir. **Önerilen.** |
| B. Mobilde de basılı tutup sürükleme | Dokunmatik sürükleme ve otomatik kaydırma gerekir; ek paket ve daha fazla test. |

### OQ-040 — Toplu işlemlerin kapsamı — KAPANDI (D-084: seçenek A)

**Bağlam.** BR-TASK-008 toplu işlemin kurallarını (200 sınırı, atomiklik) tanımlar ama hangi işlemlerin toplu yapılabileceğini saymaz.

| Seçenek | Sonuç |
|---|---|
| A. Tamamla, projeye taşı, durum, öncelik, tarih ver, etiket ekle/kaldır, arşivle, çöpe taşı | Tekil işlemlerin tamamı; her biri aynı tekil kurallardan geçer. **Önerilen.** |
| B. Yalnızca tamamla, projeye taşı, çöpe taşı | AC-02 için yeterli; daha az iş, kullanıcı geri kalanları tek tek yapar. |

### OQ-041 — Etiket yönetimi ekranı — KAPANDI (D-085: seçenek A)

**Bağlam.** IMPLEMENTATION_PLAN Faz 4 sonucunda etiket yönetimi (BR-TAG-002) "Faz 5'e kalanlar" arasındadır, ama Faz 5 kapsam satırında yoktur. Ekran Figma'da ve USER_FLOWS §2.14'teki Ayarlar sekmelerinde yoktur.

| Seçenek | Sonuç |
|---|---|
| A. Faz 5'te Ayarlar · Etiketler sekmesi (yeniden adlandır, renk, kullanım sayısıyla sil) | Kayıtlı görünümlerdeki geçersiz etiket uyarısı (BR-VIEW-001) aynı fazda test edilir. Ekran D-065 ile onaya sunulur. **Önerilen.** |
| B. Faz 7'ye (notlar ve aramayla birlikte) bırak | Faz 5 küçülür; etiketler o zamana kadar yalnızca görevden eklenip çıkarılır. |


### OQ-037 — Onboarding'in zamanlaması — KAPANDI (D-074: seçenek B)

**Bağlam.** Plan onboarding'i Faz 3'e koyuyor (ONBOARDING §2–3). Ancak onboarding'in somut sonuçları sonraki fazlardaki özelliklere bağlı:
- Adım 2 "örnek projeler" (Ev, İş, Sağlık…): proje sayfaları Faz 5'te geliyor; Faz 3'te oluşturulan projeler Faz 5'e kadar hiçbir yerde görünmez.
- Amaca göre dashboard widget sırası: widget'lar Faz 4'te geliyor.
- "İlk adımlar" kontrol listesi ve "60 saniyede ilk görev" hedefi: görevler Faz 4'te geliyor.
- Figma'da onboarding ekranı yok (D-065: Claude kurar, onaya sunulur).

| Seçenek | Sonuç |
|---|---|
| A. Onboarding'i Faz 5 sonuna taşı | Projeler, görevler ve widget'lar çalışırken kurulur; her adımın sonucu hemen görünür. Faz 3 onboarding olmadan kapanır. **Önerilen.** |
| B. Faz 3'te tamamını kur | Yanıtlar ve örnek projeler kaydedilir ama Faz 4–5'e kadar görünmez; "çalışmayan özelliği çalışıyormuş gibi gösterme" talimatıyla çelişme riski. |
| C. Faz 3'te adım 1 ve 3, örnek projeler Faz 5'te | Akış iki parçaya bölünür; daha önce onboarding'i bitirenlere Faz 5'te ek bir soru gerekir. |

### OQ-036 — Kayıtta hesap varlığının gizlenmesi ile "hemen kullanım" arasındaki çelişki — KAPANDI (D-070)

**Bağlam.** İki onaylı karar kayıt ekranında çelişiyor:
- BR-ACC-001 / SECURITY §4.3: Kayıt, mevcut bir e-postada hesabın var olduğunu ifşa etmemeli.
- D-040: Kullanıcı kayıttan hemen sonra uygulamayı kullanabilmeli (kayıt olur olmaz oturum açılır).

Yeni e-postada kullanıcı hemen uygulamaya girer. Mevcut e-postada ise giremez (başkasının hesabına oturum açılamaz). Bu fark, ekrandaki mesaj ne olursa olsun, e-postanın kayıtlı olduğunu dolaylı olarak gösterir. Ayrıca D-062 ile "biri bu adresle kayıt olmaya çalıştı" e-postası MVP'den çıktı.

**Şu anki uygulama (geçici):** Mevcut e-postada kayıt reddedilir ve şu mesaj gösterilir: "Bu e-posta adresiyle yeni hesap açılamıyor. Hesabın varsa giriş yap ya da şifreni sıfırla." Kayıt isteği saatte 5 ile sınırlı.

| Seçenek | Sonuç |
|---|---|
| A. Mevcut davranış (genel mesaj + hız sınırı) | Yaygın yaklaşım; e-posta varlığı dolaylı olarak anlaşılabilir. Yerel, tek kullanıcılı ortamda pratik risk yok. |
| B. Kayıttan sonra e-posta doğrulanmadan uygulamaya girilemez | Hesap varlığı tamamen gizlenir; D-040 değişir (kullanıcı önce e-postasını doğrular). |
| C. A şimdi, yayına alma öncesi B veya D-062'deki bilgi e-postasıyla yeniden değerlendirme | Önerilen |

**Öneri:** C. BR-ACC-001'in "hesap varlığını açıkça söylemez" ifadesi, yayına alma kararına kadar "dolaylı ifşa hız sınırıyla sınırlandırılır" olarak okunur.

### OQ-032 — Yayına alma (ertelendi)

D-045 gereği şimdilik yalnızca yerel ortam kullanılıyor. Yayına alma kararı verildiğinde şu konular birlikte ele alınacak:
- Barındırma sağlayıcısı ve veri bölgesi (KVKK yurt dışına aktarım, LEGAL §5), alan adı.
- E-posta sağlayıcısı, hata izleme, yedekleme ve geri yükleme tatbikatı.
- HTTPS ve güvenlik başlıkları.
- Harici zamanlayıcı ihtiyacı (D-053 yerel çözümdür).
- CI/CD (D-057).
- Oturum token'larının veritabanında özetlenerek saklanması ve 90 günlük mutlak oturum sınırı (SECURITY §4.2 uygulama notları).
- Kayıtta hesap varlığının dolaylı ifşası (D-070): e-posta doğrulanmadan girişi engelleme veya bilgi e-postası.
- D-061 ile yayına ertelenen maddeler (genel hız sınırları, `legal_acceptances`, silinen hesap listesi) ve D-062 e-postaları.
- LEGAL §9 kontrol listesi.

**Şu an karar gerekmiyor.**

---

## B. Kapanan sorular

| ID | Konu | Karar (özet) | Kayıt |
|---|---|---|---|
| OQ-001 | Inbox modeli | Her çalışma alanında silinemeyen bir Inbox; menüde projelerden ayrı görünür. | D-030 |
| OQ-002 | Proje silme | Proje ve görevleri birlikte çöpe gider, birlikte geri yüklenebilir. | D-031 |
| OQ-003 | Açık alt görevler | Engellemez; uyarı + alt görevleri de tamamlama seçeneği. | D-032 |
| OQ-004 | Tekrarlayan görevler | Planlanan tarihe göre ve tamamlandıktan sonra modları; sonraki örnek, mevcut görev tamamlanınca oluşturulur. | D-033 |
| OQ-005 | Hedef ilerlemesi | Hedef başına otomatik/manuel; varsayılan otomatik. | D-034 |
| OQ-006 | Çöp kutusu | 30 gün sakla, sonra kalıcı sil. | D-035 |
| OQ-007 | Hesap silme | 14 günlük, iptal edilebilir bekleme; yedeklerden silinme belgelenir. | D-036 |
| OQ-008 | Bildirim kanalları | MVP'de yalnızca uygulama içi; e-posta bildirimleri sonraya; geliştirmede ücretli e-posta servisi yok. | D-037 |
| OQ-009 | Diller | Türkçe + İngilizce; çeviri altyapısı baştan. | D-038 |
| OQ-010 | Giriş yöntemleri | MVP: e-posta + şifre; Google vb. sonraya. | D-039 |
| OQ-011 | E-posta doğrulama | Temel özellikler hemen kullanılabilir; e-posta gerektiren işlemler doğrulama ister (kapsam: OQ-026). | D-040 |
| OQ-012 | Görev durumları | Yapılacak, Devam ediyor, Tamamlandı. | D-041 |
| OQ-013 | Not editörü | Başlık, liste, yapılacak listesi, bağlantı ve kod destekleyen sade Markdown editör. | D-042 |
| OQ-014 | Arşiv | Arşivlenen kayıtlar salt okunur; düzenlemek için arşivden çıkarılır. | D-043 |
| OQ-015 | Teknoloji | Next.js, TS, PostgreSQL, Drizzle, Better Auth; Zod, Tailwind, Radix, Vitest, Playwright uygun yerlerde; TanStack Query yalnızca gerekirse; pg-boss yok; modüler monolit, SOLID, mikroservis yok. | D-044 |
| OQ-016 | Barındırma | Yalnızca yerel ortam; hosting, alan adı, ücretli servis yok; yayına alınabilir tasarım. | D-045 |
| OQ-017 | Dışa aktarma | MVP'de çalışma alanının JSON olarak dışa aktarımı; CSV ve içe aktarma sonra (kapsam: OQ-031). | D-046 |
| OQ-018 | Takvim sürükle-bırak | Masaüstünde hafta ve ay görünümlerinde; mobilde tarih seçici. | D-047 |
| OQ-019 | Abonelik | MVP'de ücretlendirme yok; ileride çalışma alanı bazlı model değerlendirilir. | D-048 |
| OQ-020 | Yasal metinler | Gereksinimler belgelenir; hukuki metinler lansmandan önce hazırlanıp gözden geçirilir. | D-049 |
| OQ-021 | Marka kimliği | "Gece & Ay ışığı" teması; sade, modern, göz yormayan; renkler merkezi token'larda. | D-050 |
| OQ-022 | Kayıtlı görünümler | MVP'de filtre ve sıralama kaydı; paylaşılan görünümler sonra. | D-051 |
| OQ-023 | Analitik | Şimdilik yok; beta aşamasında yeniden değerlendirilir; kullanılırsa gizlilik odaklı ve içerik gönderilmez. | D-052 |
| OQ-024 | Zamanlanmış işler | Ayrı worker yok; hatırlatıcılar uygulama açıkken, 30/14 günlük silmeler uygulama çalışırken işlenir; kapalıyken arka plan işi yok. | D-053 |
| OQ-025 | Günlük özet | MVP'de yok; dashboard yeterli. | D-054 |
| OQ-026 | E-posta kapsamı | MVP: doğrulama, şifre sıfırlama, şifre değişikliği güvenlik e-postaları; yerelde yakalayıcıda görüntülenir. Dışa aktarma ve hesap silmede şifreyle yeniden doğrulama. | D-055 |
| OQ-027 | Yerel PostgreSQL | Docker Desktop. | D-056 |
| OQ-028 | Git ve CI | Yerel Git + `pnpm verify`; GitHub Actions sonra değerlendirilir. | D-057 |
| OQ-029 | Yardımcı kütüphaneler | Ücretsiz paketler onaylı; yalnızca gerçekten ihtiyaç duyulduğunda eklenir. | D-058 |
| OQ-030 | Kalan teknik öneriler | Önceki kararlarla çelişmeyen ve gereksiz karmaşıklık yaratmayan öneriler onaylandı; BR-PROJ-004 netleştirildi. | D-060, D-061 |
| OQ-031 | Dışa aktarma kapsamı | Profil ve tercihler dahil; şifreler, gizli anahtarlar ve güvenlik bilgileri hariç. | D-059 |
| OQ-033 | Ek e-postalar | Kayıt denemesi bildirimi ve hesap silme onay e-postası MVP'de yok; yayına alma öncesi yeniden değerlendirilir. | D-062 |
| OQ-034 | Ürün/UX ayrıntıları | Genel öneriler onaylandı; arayüz tasarımında tek kaynak Figma; eksik/belirsiz detayda önce ürün sahibine sorulur. | D-063 |
| OQ-035 | Açık temada eksik iki Figma rengi | Claude temaya uygun belirledi: support-1 `#dfe3f6`, support-2 `#d6d6cf`. | D-066 |
| OQ-036 | Kayıtta hesap varlığının gizlenmesi | Şimdilik genel mesaj + hız sınırı; kayıttan hemen sonra kullanım korunur; yayına alma öncesi yeniden değerlendirilir. | D-070 |
| OQ-037 | Onboarding zamanlaması | Faz 3'te tamamıyla; örnek projeler Faz 5'te görünür hale gelir. | D-074 |
| OQ-038 | Proje rengi ve simgesi | 12 renkli paletten renk; simge MVP'de yok. | D-082 |
| OQ-039 | Mobil panoda durum | Masaüstünde sürükle-bırak, mobilde kart menüsü. | D-083 |
| OQ-040 | Toplu işlem kapsamı | Tamamla, taşı, durum, öncelik, tarih, etiket, arşivle, çöpe taşı. | D-084 |
| OQ-041 | Etiket yönetimi | Faz 5'te Ayarlar · Etiketler. | D-085 |
| OQ-042 | Not editörü paketi | Tiptap; içerik Markdown olarak saklanır. | D-090 |
| OQ-043 | Silme talebinden sonraki 14 günde giriş | Girişte yalnızca "Silmeyi iptal et / Çıkış yap" ekranı; iptal etmeden uygulamaya girilemez. | D-092 |
| OQ-044 | Ekran okuyucu manuel testi | Claude otomatik denetim + kontrol listesi; ürün sahibi NVDA ile uygular. | D-093 |
| OQ-045 | Ekip özellikleri (paylaş, davet, atama) | Yerelde "Kişiler" listesi; görevlere kişi atanır; Paylaş bağlantıyı kopyalar ve e-posta taslağı açar. Gerçek davet yayına almayla. | D-097 |
| OQ-046 | Inbox sayfası | Kaldırıldı; görevler Görevlerim'e eklenir, projesiz görevler "Projesiz" grubunda. | D-098 |
| OQ-047 | Yeni görev alanları | Story point (bölüm toplamıyla), yorumlar; statü üç değerde kalır. | D-099 |
| OQ-048 | Tasarım kaynağı | Figma + ürün sahibinin ekran görüntüleri; renkli rozet paleti. | D-100 |
| OQ-049 | Örnek veri | Ayrı demo hesabı, tek komut; mevcut veriye dokunulmaz. | D-101 |

Kapanan soruların değerlendirilen seçenekleri DECISIONS.md'deki ilgili kaydın "Alternatifler" alanında özetlenmiştir.
