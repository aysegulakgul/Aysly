# Kullanıcı Segmentleri ve Personalar

> Durum: v0.3 · Son güncelleme: 2026-10-27
> İlgili: [PRD.md](PRD.md) · [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) · [ONBOARDING_AND_PERSONALIZATION.md](ONBOARDING_AND_PERSONALIZATION.md)

## 1. Beş kavramın ayrımı

Aysly'de karışmaması gereken beş farklı kavram vardır. Her biri farklı bir soruya cevap verir ve kodda farklı bir yerde yaşar.

| Kavram | Cevapladığı soru | Nerede saklanır | Neyi etkiler | Örnek |
|---|---|---|---|---|
| **Kullanıcı segmenti** | "Aysly'yi ne için kullanıyorsun?" | `user_preferences.onboarding.intents` (yalnızca bilgi) | Yalnızca başlangıç düzeni, örnek içerik ve öneriler. **Hiçbir yetkiyi veya özelliği kısıtlamaz.** | Kişisel, İş |
| **Kullanıcı rolü** | "Bu çalışma alanında ne yapabilirsin?" | `workspace_memberships.role` | Yetkiler (sunucuda) | Sahip, Yönetici, Üye, Misafir |
| **Abonelik planı** | "Hangi özellik ve limitlere sahipsin?" | MVP'de yok (D-048); ileride gerekirse çalışma alanı bazlı model değerlendirilir | Limitler, ücretli özellikler | — |
| **Çalışma alanı** | "Bu veri hangi bağlamda?" | `workspaces`; her içerik kaydında `workspace_id` | Veri izolasyonu, paylaşım | "Kişisel", ileride "Ajans Ekibi" |
| **Kullanıcı tercihleri** | "Nasıl görmek istiyorsun?" | `user_preferences` | Yalnızca sunum (tema, dil, tarih biçimi…) | Koyu tema, pazartesi başlangıç |

**Temel kural (ONAYLI, D-002):** Aynı kullanıcı kişisel ve profesyonel işlerini tek hesapta yönetir. Segment bir hesap türü değildir.

## 2. Beş grubun analizi (D-024, ONAYLI — D-060)

| Brief'teki grup | Gerçek niteliği | Gerekçe | Aysly'deki karşılığı |
|---|---|---|---|
| Bireysel kullanıcı | **Segment (kullanım amacı)** | Ürünü neden kullandığını anlatır; yetki farkı yaratmaz. | Onboarding'de "Kişisel hayatım" seçeneği → kişisel başlangıç projeleri. |
| Profesyonel kullanıcı | **Segment (kullanım amacı)** | Aynı kişi hem bireysel hem profesyonel olabilir; bunlar birbirini dışlamaz. | "İşim / projelerim" seçeneği → iş odaklı başlangıç; dashboard'da "Projeler" widget'ı öne çıkar. |
| Yoğun kullanıcı | **Kullanım yoğunluğu (davranış)** | Kimse kendini "yoğun kullanıcı" olarak kaydetmez; zamanla yoğunlaşır. Ayrı segment yapmak gereksiz dallanma yaratır. | Aşamalı açılan özellikler: toplu işlemler, kayıtlı görünümler, klavye kısayolları, sıkı yoğunluk modu. Hepsi herkese açık ama varsayılan olarak öne çıkarılmaz. |
| Ekip kullanıcısı | **Rol bağlamı (ileride)** | Ekip kullanıcılığı, paylaşılan bir çalışma alanında **Üye** olmaktır; kişinin kendi kişisel alanı yine vardır. | Faz 10: paylaşılan çalışma alanı + `member` rolü. |
| Yönetici / çalışma alanı sahibi | **Rol** | Bir kişi bir alanda yönetici, diğerinde üye olabilir; bu hesap özelliği değil üyelik özelliğidir. | `owner` / `admin` rolleri. Kişisel alanda kullanıcı her zaman `owner`. |

Sonuç: **Gerçek segmentler iki tanedir (Kişisel, İş) ve birbirini dışlamaz.** Yoğunluk bir davranıştır; ekip ve yönetici rollerdir.

## 3. Personalar

> Personalar kurgusaldır ve tasarım kararlarını test etmek için kullanılır.

### 3.1. Elif — Kişisel düzen arayan (Segment: Kişisel) — MVP birincil

| | |
|---|---|
| Profil | 29 yaşında, tam zamanlı çalışıyor; ev işleri, faturalar, spor ve kurs planlarını yönetmek istiyor. |
| Hedefler | Unutmamak (faturalar, randevular), rutinleri sürdürmek, kişisel hedeflerine (dil öğrenme, koşu) zaman ayırmak. |
| Acı noktaları | Notlar telefonda, görevler kâğıtta, hedefler aklında. Uygulamalar ya çok basit ya da iş aracı gibi. |
| Kullanım senaryoları | Sabah dashboard'da günü görür; gün içinde mobilde Inbox'a hızlı ekler; akşam Inbox'u boşaltır; haftalık rutinleri tekrarlayan görevlerle yönetir; "B2 İngilizce" hedefine bağlı görevlerin ilerlemesini izler. |
| Temel özellikler | Hızlı ekleme, Bugün, tekrarlayan görevler, hatırlatıcılar, hedefler, notlar. |
| Onboarding ihtiyacı | 1 dakikada hazır olmak; örnek bir "Ev" ve "Sağlık" projesi; hatırlatıcıların uygulama içinde nasıl göründüğünün sade anlatımı (D-037). |
| Başarı sinyali | İlk hafta ≥ 4 gün dashboard açması; ≥ 1 tekrarlayan görev kurması. |

### 3.2. Murat — Serbest çalışan profesyonel (Segment: İş + Kişisel) — MVP birincil

| | |
|---|---|
| Profil | 35 yaşında serbest yazılımcı; 3–4 müşteri projesi, teslim tarihleri ve kişisel sorumluluklar. |
| Hedefler | Teslim tarihlerini kaçırmamak, müşteri işlerini ayırmak ama günü tek yerde görmek. |
| Acı noktaları | İş için bir araç, kişisel işler için başka araç; günün gerçek yükünü göremiyor. Müşteri toplantı notları dağınık. |
| Kullanım senaryoları | Her müşteri için proje; `#acil`, `#fatura` etiketleri; board görünümünde iş akışı; toplantı notlarını projeye bağlama; hafta görünümünde teslim tarihlerini görme. |
| Temel özellikler | Projeler, board, takvim (hafta), notlar ↔ proje bağlantısı, etiket filtreleri, geciken görevler. |
| Onboarding ihtiyacı | Projeyi hemen oluşturma; varsayılan görünümü board yapabilme; kişisel ve iş projelerini ayırma önerisi. |
| Başarı sinyali | ≥ 2 proje, ≥ 1 bağlı not, haftalık takvim kullanımı. |

### 3.3. Deniz — Yoğun kullanıcı (Davranış: yoğun; Segment: İş)

| | |
|---|---|
| Profil | 41 yaşında ürün yöneticisi; 400+ açık görev, 25 proje; klavye ağırlıklı çalışıyor. |
| Hedefler | Hızlı filtreleme, toplu yeniden planlama, kendi görünümlerini kaydetme. |
| Acı noktaları | Fare ile tek tek işlem; yavaş listeler; filtrelerin her seferinde yeniden kurulması. |
| Kullanım senaryoları | "Bu hafta + yüksek öncelik + #müşteri" kayıtlı görünümü; 30 geciken görevi topluca gelecek haftaya taşıma; `Ctrl+K` ile her şeye erişim. |
| Temel özellikler | Kayıtlı görünümler, toplu işlemler, klavye kısayolları, sıkı yoğunluk, hızlı arama, performans. |
| Onboarding ihtiyacı | Onboarding'i atlayabilmek; kısayol rehberine (`?`) erişim. |
| MVP desteği | Evet, P1 özelliklerle (kayıtlı görünümler, toplu işlemler). İçe aktarma (CSV vb.) P2. |

### 3.4. Selin — Ekip üyesi (Rol: Üye) — SONRA (Faz 10)

| | |
|---|---|
| Profil | Küçük bir ajansta tasarımcı; kendisine atanan işleri ve kişisel işlerini birlikte görmek istiyor. |
| İhtiyaçlar | Atanan görevler, ortak projeler, yorumlar; kişisel alanının ekipten gizli kalması. |
| Aysly karşılığı | Paylaşılan çalışma alanında `member`; My Tasks tüm alanlardaki kendisine atanmış görevleri birleştirir. |

### 3.5. Kerem — Çalışma alanı sahibi (Rol: Sahip/Yönetici) — SONRA (Faz 10)

| | |
|---|---|
| Profil | Ajans kurucusu; üyeleri davet eder, erişimleri yönetir. |
| İhtiyaçlar | Üye ekleme/çıkarma, rol değiştirme, çalışma alanı ayarları; ileride faturalama. |
| Sınır | Üyelerin kişisel çalışma alanlarını **göremez** (D-004). |

## 4. Segmentlere göre tutarlı ama kişiselleştirilebilir deneyim

| Boyut | Herkes için aynı (tutarlılık) | Kişiselleştirilebilir |
|---|---|---|
| Veri davranışı | İş kuralları, silme/arşiv, tarih mantığı | — |
| Navigasyon | Kenar çubuğu yapısı, kısayollar | Kenar çubuğunda sabitlenen projeler/görünümler |
| Dashboard | Widget türleri | Göster/gizle, sıra |
| Görünüm | Liste/board/takvim davranışı | Varsayılan görünüm, yoğunluk, tema |
| Başlangıç | Onboarding adımları | Seçilen amaca göre başlangıç projeleri ve widget sırası |

## 5. MVP'de desteklenen ve sonraya kalan senaryolar

| Senaryo | MVP | Sonra |
|---|---|---|
| Tek kişinin kişisel + iş işlerini tek hesapta yönetmesi | ✔ | |
| Yoğun kullanıcı için toplu işlem ve kayıtlı görünüm | ✔ (P1) | |
| Klavye kısayolları | ✔ (temel set) | Özelleştirilebilir kısayollar |
| Birden fazla kişisel çalışma alanı | ✖ | Değerlendirilmeyecek (proje/etiket yeterli) — ONAYLI (D-063) |
| Paylaşılan çalışma alanı, davet, atama | | Faz 10 |
| Misafir erişimi (tek proje paylaşımı) | | Faz 10+ |
| Veri içe aktarma (CSV, diğer araçlar) | | P2 |
