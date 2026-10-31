# Ekran okuyucu kontrol listesi (NVDA)

> Durum: v1.0 · Son güncelleme: 2026-10-31 · Karar: D-093 · Kapsam: AC-11, NFR-04
>
> Otomatik taramalar (axe) ve klavye testleri `pnpm verify` içinde çalışır. Bu liste, makinenin ölçemediği şeyi,
> yani ekran okuyucunun **ne söylediğini** kontrol eder. Süre: yaklaşık 20 dakika.

## Hazırlık (bir kez)
1. NVDA'yı ücretsiz indir ve kur: <https://www.nvaccess.org/download/>.
2. Uygulamayı başlat (`pnpm dev`) ve Chrome ya da Edge'de `http://localhost:3000` adresini aç.
3. NVDA'yı başlat (`Ctrl + Alt + N`). NVDA tuşu varsayılan olarak `Insert`'tür.
4. Konuşmayı susturmak için `Ctrl`; NVDA'yı kapatmak için `Insert + Q`.

Kullanacağın tuşlar:

| Tuş | Ne yapar |
|---|---|
| `Tab` / `Shift + Tab` | Sonraki / önceki etkileşimli öğe |
| `H` / `Shift + H` | Sonraki / önceki başlık |
| `D` | Sonraki yer işareti (menü, ana içerik) |
| `Insert + F7` | Sayfadaki başlık, bağlantı ve yer işareti listesi |
| `Enter` / `Space` | Etkinleştir |
| `Esc` | Pencereyi kapat |

## Kontroller
Her satırda NVDA'nın söylemesi gerekeni dinle. Sorun varsa "Not" sütununa kısaca yaz (ör. "isimsiz düğme").

| # | Ekran | Yap | Duyman gereken | Sonuç / Not |
|---|---|---|---|---|
| 1 | Giriş | Sayfayı aç, `Tab` ile alanlarda gez | "E-posta, düzenleme alanı", "Şifre, parola düzenleme alanı", "Giriş yap, düğme" | |
| 2 | Giriş | Yanlış şifreyle gönder | Hata mesajı kendiliğinden okunur | |
| 3 | Bugün | `Insert + F7` → Yer işaretleri | "Ana menü" ve ana içerik bölgesi listelenir | |
| 4 | Bugün | `H` ile başlıklarda gez | Sayfa başlığı, sonra Bugün / Geciken / Yaklaşan / Öncelikli bölüm başlıkları | |
| 5 | Kenar çubuğu | `Tab` ile menüde gez | Her bağlantının adı ve Inbox sayacı; bulunduğun sayfa "geçerli sayfa" diye belirtilir | |
| 6 | Inbox | `Q` tuşuna bas, bir görev yaz, `Enter` | Odak "Hızlı ekle" alanına geçer; ekleme sonrası onay okunur | |
| 7 | Inbox | `J` ile bir göreve gel | Görev başlığı, tarihi ve önceliği okunur | |
| 8 | Inbox | Görevin onay kutusuna `Tab` ile gel, `Space` | "Tamamla" düğmesi adıyla okunur; "Görev tamamlandı" ve "Geri al" duyurulur | |
| 9 | Görev detayı | Bir göreve `Enter` | Detay paneli adıyla açılır; alan etiketleri (Başlık, Tarih, Proje, Etiketler) okunur | |
| 10 | Görev detayı | `Esc` | Panel kapanır, odak göreve döner | |
| 11 | Takvim | Sayfayı aç, `Tab` ile gün ve görevlerde gez | Tarihler okunabilir biçimde (ör. "31 Ekim Cumartesi") ve görev adları | |
| 12 | Projeler | Bir projeyi aç, Liste / Pano sekmelerinde gez | Liste ve Pano adlarıyla okunur; hangisinin seçili olduğu belirtilir | |
| 13 | Notlar | "Not oluştur", başlık yaz, içeriğe geç | "Not başlığı" ve "Not içeriği" alanları; biçim düğmeleri adlarıyla (Kalın, Liste…) | |
| 14 | Notlar | Bir saniye bekle | "Kaydedildi" durumu okunur (canlı bölge) | |
| 15 | Hedefler | Bir hedef kartına gel | Hedef adı ve ilerleme ("2/6 · %33") okunur | |
| 16 | Arama | `Ctrl + K`, "isik" yaz, ↓ ile gez | "Her yerde ara" alanı; sonuç grupları (Görevler, Notlar…) ve seçili sonuç okunur | |
| 17 | Bildirimler | Zil düğmesine gel | Düğme adı ve okunmamış sayısı okunur | |
| 18 | Ayarlar | Görünüm → tema seçenekleri | Seçenekler ve seçili olan belirtilir; "Kaydedildi" duyurulur | |
| 19 | Ayarlar | Veri ve gizlilik → "Hesabımı sil" → `Esc` | Onay penceresi başlığı ve açıklaması okunur; `Esc` ile kapanır, odak düğmeye döner | |
| 20 | Klavye kısayolları | `?` | Kısayol rehberi pencere olarak açılır ve okunur | |

## Bitince
Tabloyu doldurup bana gönder (ya da yalnızca sorunlu satırları yaz). Bulguları düzeltip testlerini eklerim; Faz 8
kapanışında bu kontrolün sonucu kaydedilir (D-093).
