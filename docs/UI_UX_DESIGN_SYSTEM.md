# UI/UX ve Tasarım Sistemi

> Durum: v0.5 · Son güncelleme: 2026-10-28
> **Tasarımın tek kaynağı Figma'dır (D-063).** Bu belgedeki renk, tipografi, boşluk, bileşen, kısayol ve wireframe değerleri Figma incelenmeden önce yazılmış **ön taslaktır**; Faz 2'de Figma'dan çıkarılan değerlerle değiştirilecek. Figma ile bu belge çeliştiğinde Figma geçerlidir. Figma'da olmayan bir şey bu belgeden "tasarım kararı" olarak alınmaz; önemliyse ürün sahibine sorulur. İlkeler (§1) ve erişilebilirlik hedefleri (§10, WCAG 2.2 AA) geçerliliğini korur; Figma'daki bir öğe bunlarla çelişirse sorulur. Tüm değerler tasarım token'ı olarak tanımlanır; bileşenler sabit renk/ölçü kullanmaz.


## 0. Figma doğrulaması (D-063)

Kaynak: Figma `4:69535` (Foundations), değişkenler `4:69542` (koyu) ve `4:69560` (açık). Faz 2 başında okundu.

| Alan | Figma'daki değer | Bu belgeyle karşılaştırma |
|---|---|---|
| Renkler (koyu + açık) | `background/page`, `surface/default`, `surface/muted`, `border/default`, `text/primary`, `text/secondary`, `action/primary`, `action/on-primary`, `accent/moonlight`, `feedback/success|warning|danger|info` | §2.1–2.2'deki değerlerle **birebir aynı** → doğrulandı |
| Tipografi | Inter; `text/xs 12`, `sm 13`, `base 15`, `lg 17`, `xl 20`, `2xl 26`; ağırlıklar 400 gövde · 500 vurgu · 600 başlık | §3 ile aynı → doğrulandı |
| Boşluk | `space/4, 8, 12, 16, 20, 24, 32, 40` (+48 Ritim panelinde) | §4 ile aynı → doğrulandı |
| Köşe | `radius/sm 6`, `radius/md 10`, 14 (modal) | §4 ile aynı → doğrulandı |
| Ritim | Rahat satır 44 px, sıkı masaüstü 32 px, mobil kontrol ≥ 44 px, liste en fazla 960 px, pano ve takvim tam genişlik, kenar çubuğu 232 px | §4 ve §7 ile aynı; kenar çubuğu genişliği (232 px) Figma'dan eklendi |
| Bileşenler | `4:70582`: Banner, Button (Primary/Secondary/Ghost/Danger), Tab, Chip, Progress, Input, TaskRow, BoardCard, NavItem, BottomNav, Toast/Undo, Skeleton, EmptyState, Sidebar | Uygulamada bu adlarla kurulur |

Ayrıntılar (her bileşenin ölçüleri, ekran düzenleri) ilgili ekran geliştirilirken Figma'dan okunur. §5–§11'deki hareket, durum metni ve kısayol tarifleri, Figma'da karşılığı yoksa D-065 kapsamında kullanılır.

**Uygulama durumu (Faz 2):** Token'lar `src/ui/tokens.css` içinde Figma adlarına karşılık gelen CSS değişkenleri olarak tanımlı; Tailwind yalnızca bunlara bağlı (`src/app/globals.css`). Açık temada Figma'da karşılığı olmayan `palette/support-1` ve `palette/support-2` değerleri D-066 ile eklendi (`#dfe3f6`, `#d6d6cf`). Tema ve yoğunluk Faz 3'ten itibaren kullanıcı tercihidir (§ Kırılım noktaları altındaki not). İkonlar Figma'dan değiştirilmeden indirildi (`public/icons/`). Bileşenler `src/ui/components/` altında; geliştirmede `http://localhost:3000/dev/ui` sayfasında Figma ile karşılaştırılabilir.
## 1. Tasarım ilkeleri
1. **Sakin:** Düşük doygunluklu yüzeyler, tek vurgu rengi; renk yalnızca anlam taşıdığında (öncelik, durum, hata).
2. **Okunabilir:** Gövde metni 15–16 px, satır yüksekliği 1,5; kontrast WCAG AA (metin ≥ 4,5:1, büyük metin ve UI ≥ 3:1).
3. **Yoğunluk seçilebilir:** "Rahat" ve "Sıkı" modlar aynı bileşenlerle, yalnızca token farkıyla.
4. **Tutarlı eylemler:** Aynı eylem her yerde aynı simge, aynı konum, aynı kısayol.
5. **Geri alınabilirlik görünür:** Yıkıcı eylemlerden sonra "Geri al" bildirimi.

## 2. Marka ve renk (Figma ile doğrulandı — §0, D-063)

Kavram: **"Gece & Ay ışığı"** — "Aysly" adındaki *ay* çağrışımından; derin gece mavisi güven ve odak, sıcak ay ışığı vurgusu ilerleme ve başarı anları için.

Aşağıdaki renk değerleri temanın ilk uygulamasıdır. Faz 2'de token'lar kurulurken kontrast oranları (WCAG AA) ölçülür. Ölçüm sonucu ton ayarı gerekirse, tema korunarak yapılır ve bu belgede güncellenir. Tema kavramını değiştiren bir değişiklik onay gerektirir.

### 2.1. Temel paletler
| Token | Açık tema | Koyu tema | Kullanım |
|---|---|---|---|
| `--color-bg` | `#FAFAF8` | `#111318` | Sayfa zemini (saf beyaz/siyah değil — göz yorgunluğu) |
| `--color-surface` | `#FFFFFF` | `#181B22` | Kart, panel |
| `--color-surface-muted` | `#F2F2EE` | `#1F232C` | Kenar çubuğu, satır hover |
| `--color-border` | `#E3E3DD` | `#2A2F3A` | Ayırıcılar |
| `--color-text` | `#1C1E24` | `#E8E9EC` | Birincil metin |
| `--color-text-muted` | `#5D6270` | `#A0A5B1` | İkincil metin |
| `--color-primary` | `#3346B8` (Gece mavisi) | `#8C9BFF` | Birincil eylem, seçili durum, bağlantı |
| `--color-primary-contrast` | `#FFFFFF` | `#0E1330` | Birincil düğme metni |
| `--color-accent` | `#C98A1B` (Ay ışığı) | `#F0C060` | İlerleme tamamlanma anı, hedef vurgusu (az kullanılır) |
| `--color-focus` | `#3346B8` | `#8C9BFF` | Odak halkası (2 px + 2 px boşluk) |

### 2.2. Anlamsal renkler
| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `--color-success` | `#1F7A4D` | `#5BC48F` | Tamamlandı, başarılı kayıt |
| `--color-warning` | `#9A5B00` | `#E7A94B` | Bugün vadesi gelen |
| `--color-danger` | `#B42318` | `#F27A6E` | Geciken, hata, yıkıcı eylem |
| `--color-info` | `#2563A8` | `#7AB3F0` | Bilgi bantları |

### 2.3. Öncelik ve durum göstergeleri
Renk **tek başına** anlam taşımaz; her zaman simge/metin ile birlikte (erişilebilirlik).

| Öncelik | Gösterim |
|---|---|
| Yüksek (3) | Kırmızı bayrak simgesi + "Yüksek" (ekran okuyucu) |
| Orta (2) | Turuncu bayrak |
| Düşük (1) | Mavi bayrak |
| Yok (0) | Simge yok |

| Durum | Gösterim |
|---|---|
| Yapılacak | Boş daire |
| Devam ediyor | Yarım dolu daire |
| Tamamlandı | Dolu daire + onay işareti; başlık soluk ve üstü çizili (ayar: üstü çizme kapatılabilir — P2) |
| Geciken (tarih) | Tarih metni `--color-danger` + "Gecikti" |
| Bugün | Tarih metni `--color-warning` + "Bugün" |

### 2.4. Proje ve etiket renkleri
Sabit 12 renklik palet (`slate, red, orange, amber, green, teal, cyan, blue, indigo, violet, pink, brown`), her biri açık/koyu tema için kontrast doğrulanmış tonlarla. Kullanıcı serbest HEX giremez (tutarlılık ve kontrast güvencesi).

## 3. Tipografi
- **Yazı tipi:** `Inter` (değişken; Türkçe karakter desteği tam; `font-feature-settings: "cv11", "ss01"` isteğe bağlı) — alternatif: sistem yazı tipi yığını. Kendi sunucumuzdan barındırılır (üçüncü taraf istek yok).
- **Ölçek (rahat mod):**

| Token | Boyut / satır | Kullanım |
|---|---|---|
| `--text-xs` | 12 / 16 | Rozet, meta |
| `--text-sm` | 13 / 20 | İkincil metin, etiket |
| `--text-base` | 15 / 22 | Gövde, görev başlığı |
| `--text-lg` | 17 / 26 | Panel başlığı |
| `--text-xl` | 20 / 28 | Sayfa başlığı |
| `--text-2xl` | 26 / 34 | Dashboard selamlama |

- Ağırlıklar: 400 (gövde), 500 (vurgu, düğme), 600 (başlık). 700+ kullanılmaz.
- Rakamlar listelerde `tabular-nums`.

## 4. Boşluk, ızgara, köşe, gölge
- **Boşluk ölçeği (4 px tabanlı):** `--space-1: 4px`, `2: 8`, `3: 12`, `4: 16`, `5: 20`, `6: 24`, `8: 32`, `10: 40`, `12: 48`.
- **Satır yüksekliği (görev satırı):** Rahat 44 px, Sıkı 32 px (dokunmatik cihazlarda her zaman ≥ 44 px dokunma alanı).
- **Köşe yarıçapı:** `--radius-sm: 6px` (giriş, çip), `--radius-md: 10px` (kart, düğme), `--radius-lg: 14px` (modal).
- **Gölge:** Yalnızca katman ayrımı için: `--shadow-popover`, `--shadow-modal`. Kartlar varsayılan olarak gölgesiz, kenarlıklı.
- **Kırılım noktaları:** `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Kenar çubuğu `lg` ve üstünde sabit; altında Figma'daki mobil düzen: alt navigasyon ve Menü ekranı (D-071).
- **Tema ve yoğunluk (uygulandı, Faz 3):** `<html data-theme="light|dark|system" data-density="comfortable|compact">` kullanıcı tercihinden gelir; oturum yokken `system`. Satır yüksekliği `--row-height` (Tailwind `h-row`): rahat 44 px, sıkı yalnızca `lg` ve üstünde 32 px.
- **İçerik genişliği:** Liste sayfalarında en fazla 960 px; takvim ve board tam genişlik.

## 5. Hareket
- Süreler: 120 ms (hover/durum), 200 ms (panel açılması), 300 ms üstü yok.
- `prefers-reduced-motion` etkinse tüm geçişler anında; tamamlama animasyonu kapalı.
- Görev tamamlamada kısa onay animasyonu (≤ 300 ms); konfeti/oyunlaştırma yok (F3).

## 6. Bileşenler

| Bileşen | Varyantlar | Kurallar |
|---|---|---|
| **Button** | `primary`, `secondary`, `ghost`, `danger`; boyut `sm/md` | Ekranda en fazla bir `primary`. Yükleniyorken genişlik sabit, içerik spinner. Yalnızca simgeli düğmede `aria-label` zorunlu. |
| **Input / Textarea** | Normal, hata, devre dışı | Etiket her zaman görünür (yalnızca placeholder yasak). Hata metni alanın altında, `aria-describedby`. |
| **Select / Combobox** | Tekli, çoklu (etiketler), oluşturulabilir | Radix tabanlı; klavye ile arama. |
| **DatePicker** | Tarih, tarih + saat, hızlı seçenekler (Bugün, Yarın, Gelecek hafta, Tarihi kaldır) | Haftanın ilk günü tercihi; saat dilimi gösterimi. |
| **Checkbox (görev tamamlama)** | 3 durum görünümü | 24 px görsel, 44 px dokunma alanı; `role="checkbox"`, `aria-checked`. |
| **Card** | Düz, etkileşimli | Kenarlık + `--radius-md`. |
| **Modal (Dialog)** | Onay, form | Odak tuzağı, `Esc` kapatır, açıldığında ilk odak anlamlı alanda; yıkıcı onaylarda varsayılan odak "Vazgeç". |
| **Popover / Menu** | Bağlam menüsü, "…" menü | Klavye gezinme; sağ tık menüsü masaüstünde ek kısayol. |
| **Toast** | Bilgi, başarı, hata, "Geri al" eylemli | Ekranın alt-ortası (mobil) / alt-sol (masaüstü); 5 sn (eylemli olanlar 8 sn); `role="status"`; aynı anda en fazla 3. |
| **Banner** | Bilgi, uyarı, çevrimdışı, arşivli kayıt | Sayfa üstü, kapatılabilir (çevrimdışı hariç). |
| **Badge / Chip** | Sayı, etiket, durum | |
| **TaskRow** | Liste satırı | Sol: tamamlama; orta: başlık + meta (proje, tarih, etiketler, alt görev sayısı, tekrar simgesi); sağ (hover): hızlı eylemler. Seçim modu: çoklu seçim kutusu. |
| **BoardCard** | Board kartı | Başlık, tarih, öncelik, etiketler (en fazla 3 + "+2"). |
| **EmptyState** | Sayfa, widget | Kısa başlık + tek cümle + tek eylem. İllüstrasyon isteğe bağlı, sade çizgi. |
| **Skeleton** | Liste, kart | 300 ms'den kısa yüklemede gösterilmez. |
| **ProgressBar** | Proje, hedef | Değer metniyle birlikte (`3/9 · %33`); `role="progressbar"`. |
| **CommandPalette** | Global arama | Bkz. USER_FLOWS §2.11. |

## 7. Görev listeleri ve tablolar
- Liste, varsayılan görünümdür; tablolar yalnızca Arşiv/Çöp gibi yönetim ekranlarında.
- Gruplar katlanabilir; grup başlığında sayı.
- 200+ satırda sanallaştırma.
- Sürükleme tutamağı hover'da görünür; klavye ile `Alt+↑/↓` taşıma.
- Seçim: `Shift+tık` aralık, `Ctrl/Cmd+tık` tekil; seçim varken alt kısımda toplu işlem çubuğu.

## 8. Durum ekranları
| Durum | İlke | Örnek metin |
|---|---|---|
| Yükleniyor | İskelet; tam ekran spinner yok | — |
| Boş (ilk kullanım) | Ne olduğunu + ilk eylemi anlat | "Inbox boş. Aklına gelen her şeyi buraya yaz, sonra düzenle." |
| Boş (filtre sonucu) | Filtreleri temizleme eylemi | "Bu filtrelere uyan görev yok. [Filtreleri temizle]" |
| Boş (her şey bitti) | Kısa olumlu geri bildirim | "Bugün için her şey tamam." |
| Hata | Ne oldu + ne yapabilirim, teknik ayrıntı yok | "Görevler yüklenemedi. [Tekrar dene]" |
| Çevrimdışı | Kalıcı bant | "Bağlantı yok. Değişikliklerin kaydedilemeyebilir." |
| Yetkisiz/yok | 404 sayfası | "Aradığın sayfa bulunamadı ya da erişimin yok." |

Tüm metinler çeviri dosyasındadır; ton: samimi, kısa, suçlamayan ("Hatalı giriş yaptın" değil, "Bu tarih biçimini anlayamadık").

## 9. Metinsel wireframe'ler

### 9.1. Dashboard (masaüstü)
```
┌─────────────┬──────────────────────────────────────────────────────────┐
│ Kenar çubuğu│ Günaydın, Elif                         Çarşamba, 15 Ekim │
│             │ ┌──────────────────────────────────────────────────────┐ │
│             │ │ + Ne yapmak istiyorsun?             [Tarih][Proje]   │ │
│             │ └──────────────────────────────────────────────────────┘ │
│             │ ┌──── Bugün (5) ─────────────┐ ┌── Geciken (2) ───────┐ │
│             │ │ ○ 09:30 Ekip görüşmesi  İş │ │ ○ Fatura öde  12 Eki │ │
│             │ │ ○ Kira ödemesi   ⚑  Ev     │ │   [Bugüne] [Yarına]  │ │
│             │ │ ○ 30 dk koşu  ↻   Sağlık   │ │ ○ Rapor taslağı      │ │
│             │ └────────────────────────────┘ └──────────────────────┘ │
│             │ ┌──── Yaklaşan (7 gün) ──────┐ ┌── Hedefler ──────────┐ │
│             │ │ Per 16  ○ Sunum hazırlığı  │ │ B2 İngilizce ▓▓▓░ 60%│ │
│             │ │ Cum 17  ○ Diş randevusu    │ │ Maraton      ▓░░░ 25%│ │
│             │ └────────────────────────────┘ └──────────────────────┘ │
│             │                                        [Düzeni düzenle]  │
└─────────────┴──────────────────────────────────────────────────────────┘
```

### 9.2. Proje — Liste görünümü + görev detay paneli
```
┌──────────┬──────────────────────────────────┬───────────────────────────┐
│ Kenar    │ ● Müşteri A — Web  Aktif  12/30  │ ☐ Ana sayfa tasarımı   ✕  │
│ çubuğu   │ [Liste][Board][Takvim]  Filtre ▾ │ Proje: Müşteri A  ▾       │
│          │ ─────────────────────────────────│ Durum: Devam ediyor ▾     │
│          │ ▾ Bu hafta (4)                   │ Öncelik: ⚑ Yüksek         │
│          │  ○ Ana sayfa tasarımı ⚑  Cum  2/5│ Son tarih: 17 Eki, 14:00  │
│          │  ○ İçerik toplama        Per     │ Hatırlatıcı: 1 saat önce  │
│          │ ▾ Daha sonra (8)                 │ Etiketler: #tasarım       │
│          │  ○ SEO kontrolü                  │ ─ Açıklama ─────────────  │
│          │ ▾ Tarihsiz (3)                   │ ...                       │
│          │ + Görev ekle                     │ ─ Alt görevler (2/5) ───  │
│          │                                  │ ☑ Renk seçimi  ☐ Hero ... │
│          │                                  │ ─ Bağlı notlar ─────────  │
│          │                                  │ 📝 Toplantı 10 Eki        │
└──────────┴──────────────────────────────────┴───────────────────────────┘
```

### 9.3. Board
```
 Yapılacak (8)          Devam ediyor (3)        Tamamlandı (12)
┌──────────────────┐   ┌──────────────────┐    ┌──────────────────┐
│ İçerik toplama   │   │ Ana sayfa tasarım│    │ ✓ Logo teslimi   │
│ Per · #içerik    │   │ ⚑ Cum · 2/5      │    │                  │
└──────────────────┘   └──────────────────┘    └──────────────────┘
 + Ekle                 + Ekle                  (son 20, "Tümünü gör")
```

### 9.4. Mobil — Bugün
```
┌─────────────────────────┐
│ Bugün · 15 Eki      🔔  │
│ ┌─────────────────────┐ │
│ │ Geciken (2)       ▸ │ │
│ └─────────────────────┘ │
│ ○ 09:30 Ekip görüşmesi  │
│ ○ Kira ödemesi      ⚑   │
│ ○ 30 dk koşu        ↻   │
│                         │
├─────────────────────────┤
│ Bugün Inbox (+) Takvim ☰│
└─────────────────────────┘
```

## 10. Erişilebilirlik (WCAG 2.2 AA)
- Tüm etkileşimler klavyeyle; görünür odak halkası; odak sırası görsel sırayla aynı.
- Sürükle-bırak'ın her zaman klavye/menü alternatifi (WCAG 2.5.7).
- Dokunma hedefleri ≥ 24×24 CSS px (WCAG 2.5.8), birincil kontroller 44 px.
- Canlı bölgeler: toast'lar `role="status"`, hata özetleri `role="alert"`.
- Formlar: etiket, hata açıklaması, zorunlu alan işareti hem görsel hem `aria-required`.
- Renk tek bilgi taşıyıcısı değildir (öncelik, durum, gecikme).
- Metin %200 büyütmede yatay kaydırma olmadan çalışır.
- Ekran okuyucu testleri: NVDA + Firefox, VoiceOver + Safari (Faz 8 denetimi).
- Dil özniteliği (`lang="tr"`) ve Türkçe ekran okuyucu telaffuzu için doğru metin.

## 11. Klavye kısayolları (MVP temel seti)
| Kısayol | Eylem |
|---|---|
| `Q` | Hızlı ekleme |
| `Ctrl/Cmd + K` | Arama / komut paleti |
| `G` sonra `D/I/M/C/P` | Dashboard / Inbox / My Tasks / Takvim / Projeler |
| `J` / `K` veya `↓` / `↑` | Listede gezinme |
| `Enter` | Görevi aç |
| `Ctrl/Cmd + Enter` | Tamamla |
| `T` | Tarih ata |
| `M` | Projeye taşı |
| `L` | Etiket |
| `Del` | Çöpe at |
| `Ctrl/Cmd + Z` | Son eylemi geri al (toast süresi içinde) |
| `?` | Kısayol rehberi |

Metin alanı odaktayken tek harfli kısayollar devre dışıdır.

## 12. Uygulama notları
- Token'lar `src/ui/tokens.css` içinde CSS değişkenleri; Tailwind yapılandırması yalnızca bu değişkenlere başvurur.
- Bileşenler `src/ui/` altında; her bileşenin Storybook benzeri bir örnek sayfası Faz 2'de değerlendirilir (D-060: başlangıçta basit bir `/dev/ui` sayfası, yalnızca geliştirme ortamında).
- Yeni bileşen eklemeden önce mevcut bileşen genişletilebilir mi kontrol edilir.
