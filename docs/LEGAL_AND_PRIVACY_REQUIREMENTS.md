# Yasal ve Gizlilik Gereksinimleri (KVKK, Gizlilik, Kullanım Koşulları)

> Durum: v0.2 · Son güncelleme: 2026-10-27 · Karar: D-049 (kapsam D-059, D-061)
> **Bu belge hukuki görüş değildir.** Ürünün yasal metinler ve gizlilik yükümlülükleri açısından ihtiyaç duyduğu **ürün ve teknik gereksinimleri** listeler. Hukuki metinler (aydınlatma metni, gizlilik politikası, kullanım koşulları, çerez politikası) lansmandan önce hukuk alanında yetkin bir kişi tarafından hazırlanır ve gözden geçirilir (D-049). "⚖️ Hukuki teyit" işaretli maddeler, uzman doğrulaması olmadan kesin kabul edilmez.

## 1. Kapsam ve zamanlama

| Durum | Yükümlülükler |
|---|---|
| **Şimdi (D-045: yalnızca yerel ortam, kullanıcı ürün sahibi)** | Üçüncü kişilerin verisi işlenmediği sürece yasal metinlerin yayımlanması gerekmez. Ancak aşağıdaki **teknik altyapı** (dışa aktarma, silme, saklama süreleri, kayıt altına alma) MVP içinde kurulur ki lansman, yeniden yazım gerektirmesin. |
| **Lansman öncesi (başka kullanıcılar kayıt olmadan önce)** | §3–§8'deki tüm metinler hazırlanmış, gözden geçirilmiş ve uygulamaya yerleştirilmiş olmalı; §9 kontrol listesi tamamlanmalı. |

## 2. Uygulanabilecek düzenlemeler (⚖️ Hukuki teyit)

| Düzenleme | Ne zaman | Not |
|---|---|---|
| 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ikincil düzenlemeler | Türkiye'deki kullanıcılar için | Birincil çerçeve |
| KVK Kurulu çerez rehberi | Çerez kullanımı | Aysly yalnızca zorunlu (oturum) çerezleri kullanmayı hedefler |
| AB Genel Veri Koruma Tüzüğü (GDPR) | AB'de bulunan kullanıcılara hizmet sunulursa | Hedef kitle kararına bağlı |
| 6563 sayılı Elektronik Ticaret Kanunu (ticari elektronik ileti) | Pazarlama e-postası gönderilirse | MVP'de pazarlama iletisi yok; hesap güvenliği e-postaları ticari ileti değildir ⚖️ |
| Tüketici mevzuatı | Ücretli plan gelirse (D-048) | Şimdilik kapsam dışı |

## 3. Aydınlatma yükümlülüğü (KVKK md.10)

**Ürün gereksinimleri:**
- REQ-LGL-01: Kayıt formunda, kayıt düğmesinin yakınında **Aydınlatma Metni** bağlantısı bulunur. Aydınlatma bir **bilgilendirmedir**; onay kutusuyla "kabul ettiriliyormuş" gibi sunulmaz ve açık rıza ile aynı metne/kutuya birleştirilmez ⚖️.
- REQ-LGL-02: Aydınlatma metni en az şunları içerir ⚖️: veri sorumlusunun kimliği, işleme amaçları, aktarılan taraflar ve amaçları, toplama yöntemi ve hukuki sebep, ilgili kişinin hakları (md.11).
- REQ-LGL-03: Metinler uygulama içinde herkese açık sayfalarda (`/legal/privacy`, `/legal/terms`, `/legal/kvkk`) Türkçe ve İngilizce yayımlanır (D-038); sürüm numarası ve yürürlük tarihi taşır.

**Teknik girdi (metni yazacak kişi için):** İşlenen veri kategorileri ve amaçları SECURITY §8.1 veri envanterindedir. Veri işleme, büyük ölçüde hizmet sözleşmesinin kurulması ve ifası kapsamındadır; açık rıza gerektiren bir işleme (ör. pazarlama, analitik) MVP'de **planlanmamıştır** (D-052) ⚖️.

## 4. Kullanım Koşulları

**Ürün gereksinimleri:**
- REQ-LGL-04: Kayıt sırasında kullanıcı Kullanım Koşulları'nı kabul eder (işaretlenmemiş onay kutusu veya "Kayıt olarak koşulları kabul ediyorum" ifadesi — biçim ⚖️).
- REQ-LGL-05: Kabul edilen koşulların **sürümü ve zamanı** kaydedilir (`legal_acceptances` tablosu, DATA_MODEL §3.16; yayına alma öncesi, D-061).
- REQ-LGL-06: Koşullar önemli ölçüde değişirse kullanıcı bir sonraki girişte bilgilendirilir ve yeni sürümü kabul etmesi istenir; kabul etmezse hesabını dışa aktarıp silebilir.

**Metinde ele alınması gereken konular** (içerik hukukçu tarafından yazılır): hizmetin tanımı ve "olduğu gibi" sunulması, hesap güvenliğinden kullanıcının sorumluluğu, kabul edilebilir kullanım, kullanıcı içeriğinin mülkiyeti (içerik kullanıcıya aittir), hizmetin değiştirilmesi/sonlandırılması, hesabın kapatılması ve veri silme (BR-ACC-005, D-036), sorumluluğun sınırlandırılması, uygulanacak hukuk ve yetkili mahkeme, iletişim.

## 5. Yurt dışına aktarım (KVKK md.9) ⚖️

- Şu an geçerli değil: veriler yalnızca yerel bilgisayarda (D-045).
- Yayına alma kararında (OQ-032) barındırma ve alt hizmet sağlayıcılarının (veritabanı, e-posta, hata izleme) **ülkesi** belirleyici olur. Türkiye dışında barındırma, md.9'daki aktarım şartlarını (yeterlilik kararı veya uygun güvenceler, ör. standart sözleşme ve Kurul'a bildirim) gerektirebilir.
- REQ-LGL-07: Yayın öncesi, her alt hizmet sağlayıcı için konum, işlenen veri ve aktarım dayanağı bir tabloda belgelenir.

## 6. İlgili kişi hakları ve veri yaşam döngüsü (KVKK md.11, md.7)

| Hak | Aysly'deki karşılığı | Durum |
|---|---|---|
| Bilgi talep etme, işlenen verileri öğrenme | Dışa aktarma — çalışma alanı + profil + tercihler (D-046, D-059) + destek iletişim kanalı | Dışa aktarma MVP; iletişim kanalı lansman öncesi |
| Düzeltme | Profil ve içerik düzenleme | MVP |
| Silme / yok etme | Hesap silme, 14 gün bekleme (D-036, BR-ACC-005); içerik silme ve 30 gün sonra kalıcı silme (D-035) | MVP |
| Aktarılan üçüncü kişileri öğrenme | Aydınlatma metni + REQ-LGL-07 tablosu | Lansman öncesi |
| İtiraz, zararın giderilmesi | Destek iletişim kanalı | Lansman öncesi |

- REQ-LGL-08: Başvurular yasal süre içinde yanıtlanır (KVKK md.13'e göre en geç 30 gün ⚖️). Lansman öncesi bir başvuru kanalı (e-posta adresi veya form) belirlenir.
- REQ-LGL-09: **Saklama ve imha:** Saklama süreleri DATA_MODEL §10'da tek tabloda tutulur. Lansmandan önce bu tablo bir "Kişisel Veri Saklama ve İmha Politikası"na dönüştürülür (gerekliliği VERBİS kaydı yükümlülüğüne bağlıdır ⚖️).

### 6.1. Hesap silme ve yedekler (D-036 gereği)

| Ortam | Yedekte ne olur? |
|---|---|
| **Yerel (şimdi)** | `pnpm db:backup` ile alınan yedek dosyaları ürün sahibinin bilgisayarındadır. Hesap silme, bu dosyalardaki eski kopyaları **silmez**. Yedek betiği yalnızca son 7 yedeği saklar ve eskilerini siler (SECURITY §8.2, D-060); böylece silinen bir hesabın verisi en geç 7 yedek döngüsü sonunda yedeklerden de kalkar. |
| **Yayında (ileride)** | Yedekler sağlayıcının saklama süresi (öneri: 35 gün) dolunca kendiliğinden silinir. Gizlilik politikasında "silinen veriler yedeklerden en geç X gün içinde kalkar" ifadesi yer alır ⚖️. Yedekten geri yükleme yapılırsa, silinmiş hesap kimlikleri listesi (yalnızca kimlik, kişisel veri değil) kullanılarak bu hesaplar yeniden silinir. |

## 7. Veri güvenliği ve ihlal bildirimi (KVKK md.12) ⚖️
- Teknik ve idari tedbirler: SECURITY.md.
- REQ-LGL-10: Lansmandan önce bir veri ihlali müdahale prosedürü yazılır (SECURITY §12). Kurul'a ve ilgili kişilere bildirim süreleri hukuki teyitle belirlenir (Kurul kararlarında 72 saat ifadesi yer alır ⚖️).

## 8. Çerezler
- Aysly MVP'de yalnızca **zorunlu** çerez kullanır: oturum çerezi ve gerekirse tema/dil tercihi.
- Analitik, reklam veya üçüncü taraf çerez yoktur (D-052). Bu nedenle çerez onay bandı gerekmeyebilir; ancak çerez politikası/bilgilendirmesi yine yayımlanır ⚖️.
- REQ-LGL-11: İleride zorunlu olmayan bir çerez veya analitik eklenirse, eklenmeden **önce** onay mekanizması kurulur ve bu belge güncellenir.

## 9. Lansman öncesi kontrol listesi
- [ ] Veri sorumlusu kimliği ve iletişim bilgisi belirlendi
- [ ] Aydınlatma metni, gizlilik politikası, kullanım koşulları, çerez bilgilendirmesi hazırlandı ve hukuken gözden geçirildi (TR + EN)
- [ ] Metinler uygulamada yayımlandı; kayıt akışına bağlandı (REQ-LGL-01..05)
- [ ] Koşul kabul kaydı ve yeniden kabul akışı çalışıyor (REQ-LGL-05, 06)
- [ ] Alt hizmet sağlayıcılar ve yurt dışı aktarım tablosu (REQ-LGL-07)
- [ ] Başvuru kanalı ve yanıt süreci (REQ-LGL-08)
- [ ] Saklama ve imha politikası; VERBİS yükümlülüğü değerlendirildi (REQ-LGL-09)
- [ ] İhlal müdahale prosedürü (REQ-LGL-10)
- [ ] Yaş sınırı ve reşit olmayan kullanıcılar konusu değerlendirildi ⚖️
- [ ] Gizlilik politikasında yedeklerden silinme süresi belirtildi (§6.1)

## 10. Lansman öncesi karar gerektiren konular
Aşağıdakiler yayına alma kararıyla (OQ-032) birlikte ürün sahibine sorulacaktır: veri sorumlusu (kişi/şirket), hedef ülkeler (GDPR kapsamı), minimum kullanıcı yaşı, başvuru kanalı, barındırma ülkesi.
