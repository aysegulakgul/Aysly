# Figma Envanteri

> Durum: v0.1 · Son güncelleme: 2026-10-15 · Karar: D-063 (arayüzde tek kaynak Figma)
> Dosya: [Aysly (Figma)](https://www.figma.com/design/XciejfKVEdq0ik3dg4jY2O/Aysly) · fileKey `XciejfKVEdq0ik3dg4jY2O` · Sayfa `0:1` ("Page 1")
> Bu belge, Figma'daki çerçevelerin düğüm kimliklerini ve MVP kapsamıyla eşleşmesini tutar. Ayrıntılı değerler (renk, tipografi, boşluk) Faz 2'de Figma'dan okunup UI_UX_DESIGN_SYSTEM.md'ye işlenecek. Figma'da değişiklik yapıldıkça bu belge yeniden üretilir.

## 1. Temel referans çerçeveleri

| Düğüm | Ad | İçerik |
|---|---|---|
| `4:69535` | Foundations / Aysly tasarım referansı | Koyu/açık paletler (`4:69542`, `4:69560`), tipografi ve geometri (`4:69578`), kontroller (`4:69589`), görev desenleri (`4:69643`), navigasyon ve geri bildirim (`4:69673`) |
| `4:70582` | Components / Aysly · Yerel bileşenler | Banner, Button (Primary/Secondary/Ghost/Danger), Tab, Chip, Progress, Input (Normal/Error/Disabled), TaskRow, BoardCard, NavItem, BottomNav, Toast/Undo, Skeleton |
| `4:69174` | States & flows / Ekran durumları | 4 durum karşılaştırması (cihaz örnekleriyle) |
| `4:69293` | States & flows / Akış durumları | Hızlı ekle (varsayılan Inbox `4:69297`, kayıt hatası `4:69319`), projeye taşı `4:69344`, tarih seç `4:69362`, global arama `4:69442`, görevi tamamla `4:69469`, projeyi çöpe taşı `4:69484`, geri alınabilir sonuç `4:69497`, not otomatik kayıt hatası `4:69512`, kayıt durumu dili `4:69528` |

## 2. Ekranlar

| Ekran | Masaüstü (1440) | Mobil (390) | MVP faz |
|---|---|---|---|
| Bugün (dashboard) | `4:66490` | `4:67890` | 4 |
| Inbox | `4:66650` | `4:68036` | 4 |
| Görevlerim (My Tasks) | `4:66732` | `4:68122` | 4 |
| Görev detayı | `4:66875` | `4:68238` | 4 |
| Projeler | `4:67037` | `4:68342` | 5 |
| Proje · Liste | `4:67132` | `4:68426` | 5 |
| Proje · Kanban | `4:67253` | `4:68533` | 5 |
| Takvim | `4:67372` | `4:68640` | 6 |
| Hedefler | `4:67474` | `4:68732` | 7 |
| Notlar | `4:67588` | `4:68882` | 7 |
| Notlar · Liste | — | `4:68829` | 7 |
| Ayarlar · Görünüm | `4:67693` | `4:68939` | 3 |
| Yaklaşanlar · Sonraki 7 gün | `4:67785` | `4:69086` | 4 |
| Menü | — | `4:69022` | 3 |

## 3. Proje dışı çerçeveler (referans alınmaz — D-064)

`1:534` Product detail page, `1:629` About, `1:703` Article, `1:777` Shop, `1:902` Landing page. Adları ve konumları Aysly ekranlarından ayrı; Ürün sahibi bunların Aysly'ye ait olmadığını teyit etti; **referans alınmaz** (D-064).

## 4. MVP kapsamında olup Figma'da bulunmayan ekranlar (D-065: mevcut Figma bileşen ve token'larıyla Claude kurar, her biri onaya sunulur)

| Eksik | İlgili kural/gereksinim | Faz |
|---|---|---|
| Giriş, kayıt, şifremi unuttum, şifre sıfırlama, e-posta doğrulama | FR-AUTH-01..05, D-055 | 3 |
| Onboarding adımları ve başlangıç projeleri | ONBOARDING §2–3, D-063 | 3 |
| Ayarlar: Profil, Tarih ve saat, Bildirimler, Güvenlik (şifre, oturumlar), Veri ve gizlilik (dışa aktarma, hesap silme) | FR-SET, D-036, D-046 | 3, 8 |
| Bildirim merkezi | FR-NOTIF-01 | 6 |
| Arşiv ve Çöp kutusu sayfaları | FR-SET-06/07, BR-DEL-* | 4–5 |
| Hedef detayı (bağlı görev/projeler) | FR-GOAL-02 | 7 |
| Kayıtlı görünüm oluşturma/düzenleme | FR-VIEW-07, D-051 | 5 |
| Desktop "Menü" karşılığı (kenar çubuğu çerçeve içinde olabilir; Faz 3'te ekranlardan doğrulanacak) | — | 3 |
