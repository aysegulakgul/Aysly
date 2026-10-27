# Açık Sorular (Karar Bekleyen Konular)

> Durum: v0.5 · Son güncelleme: 2026-10-28 · Sahibi: Ürün sahibi (karar), Claude (hazırlık)

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
| OQ-036 | Kayıtta "bu e-posta kullanımda" bilgisinin gizlenmesi ile kayıttan hemen sonra kullanım (D-040) arasındaki çelişki | Faz 3 (kapanış) | Kayıt ekranında genel bir mesaj; yayına alma öncesi yeniden değerlendir | AÇIK |
| OQ-032 | Yayına alma (hosting, alan adı, e-posta sağlayıcı, hata izleme, yedekleme) | Yayın kararı (MVP sonrası) | Şimdi karar gerekmiyor | AÇIK (ertelendi) |


### OQ-036 — Kayıtta hesap varlığının gizlenmesi ile "hemen kullanım" arasındaki çelişki

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

Kapanan soruların değerlendirilen seçenekleri DECISIONS.md'deki ilgili kaydın "Alternatifler" alanında özetlenmiştir.
