# Roller ve Yetkiler

> Durum: v0.3 · Son güncelleme: 2026-10-15 (içerik değişmedi; kararlarla tutarlılığı kontrol edildi)
> Temel ilkeler ONAYLI (D-003, D-004); izin tabanlı model ve MVP (kişisel alan) yetkileri ONAYLI (D-014, D-060). Faz 10 paylaşılan alan matrisi (§6.2) ayrı karar setinde onaylanacak.

## 1. Kimlik doğrulama ≠ yetkilendirme

| | Kimlik doğrulama (Authentication) | Yetkilendirme (Authorization) |
|---|---|---|
| Soru | "Sen kimsin?" | "Bunu yapabilir misin?" |
| Modül | `identity` | `workspaces` (policy) |
| Girdi | Oturum çerezi | Aktör + izin + kaynak |
| Başarısızlık | `401 UNAUTHENTICATED` | `404 NOT_FOUND` (kaynak görünmüyorsa) / `403 FORBIDDEN` (görünüyor ama işlem yasak) |
| Ne zaman | Her istek, en başta | Her use case, işlemden önce |

## 2. Yaklaşım: İzin tabanlı RBAC + kaynak kapsamı (D-014)

1. **Rol** bir çalışma alanındaki üyeliğe aittir (kullanıcıya değil).
2. Her rol sabit bir **izin kümesine** eşlenir (kodda, `modules/workspaces/domain/permissions.ts`).
3. Kod yalnızca **izin** sorar: `authorize(actor, 'project.delete', project)`.
4. Bazı izinler **kaynak koşulu** içerir (ör. Üye yalnızca kendi oluşturduğu projeyi silebilir). Bu koşullar policy fonksiyonunda, tek yerde.
5. Rol adı kontrolü (`if (role === 'admin')`) kod incelemesinde reddedilir.

**Neden bu yaklaşım?** Saf RBAC "rol = yetki" eşlemesini basit tutar; izin katmanı ise rolleri değiştirmeden yeni roller veya plan bazlı kısıtlar eklemeyi sağlar. Tam ABAC/ReBAC (ör. proje bazında paylaşım ağacı) MVP için gereksiz karmaşıklıktır; Faz 10'da misafir erişimi gerektiğinde policy fonksiyonu kaynak bazlı kurallarla genişletilir — çağıran kod değişmez (OCP).

## 3. Roller

| Rol | Tanım | MVP'de var mı? |
|---|---|---|
| **Sahip (owner)** | Çalışma alanının sahibi; her şeyi yönetir; alanı silebilir, sahipliği devredebilir. | Evet — kişisel alanda kullanıcı her zaman sahip. |
| **Yönetici (admin)** | Üyeleri ve ayarları yönetir; tüm ortak içeriği düzenler. Alanı silemez, sahipliği devralamaz. | Hayır (Faz 10) |
| **Üye (member)** | Ortak içeriği görür, oluşturur, düzenler; yıkıcı işlemlerde sınırlı. | Hayır (Faz 10) |
| **Misafir (guest)** | Yalnızca kendisiyle paylaşılan projeleri görür; sınırlı düzenleme. | Hayır (Faz 10+, ihtiyaç doğrulanırsa) |

## 4. Temel kurallar

| Kural | Açıklama | Kaynak |
|---|---|---|
| Sunucu tarafı zorunlu | UI yalnızca gizler/devre dışı bırakır. | D-003, BR-PERM-001 |
| Varlığı ifşa etme | Erişilemeyen kaynak 404 döner. | BR-PERM-001 |
| Alan başına bağımsız | Bir alandaki rol diğerini etkilemez. | BR-PERM-002 |
| Değişiklik anında geçerli | Üyelik kaldırılınca bir sonraki istek reddedilir. | BR-PERM-003 |
| Yönetici ≠ sınırsız erişim | Kişisel alanlar ve paylaşılmamış özel içerik yöneticiye kapalı. | D-004, BR-PERM-004 |
| Kişisel alan paylaşılmaz | Kişisel alana üye eklenemez. | BR-WS-003 |
| Bildirimler kişiseldir | Bir kullanıcının bildirimlerini başka kimse göremez (rol fark etmez). | — |
| Tercihler kişiseldir | Tercihler kullanıcıya aittir; yönetici değiştiremez. | BR-PREF-002 |

## 5. İzin listesi

| İzin | Açıklama |
|---|---|
| `workspace.read` | Alanı ve temel bilgilerini görme |
| `workspace.update` | Ad ve ortak ayarlar |
| `workspace.delete` | Alanı silme |
| `workspace.transfer` | Sahipliği devretme |
| `member.read` | Üye listesini görme |
| `member.invite` / `member.remove` / `member.change_role` | Üye yönetimi |
| `project.read` / `project.create` / `project.update` / `project.archive` / `project.delete` / `project.restore` / `project.purge` | Proje işlemleri |
| `task.read` / `task.create` / `task.update` / `task.complete` / `task.archive` / `task.delete` / `task.restore` / `task.purge` | Görev işlemleri |
| `tag.manage` | Etiket oluşturma/yeniden adlandırma/silme |
| `note.*`, `goal.*` | Görevle aynı alt izinler |
| `view.manage_own` | Kendi kayıtlı görünümleri |
| `trash.empty` | Çöpü boşaltma |
| `share.project` | Projeyi misafirle paylaşma (Faz 10+) |

## 6. Yetki matrisi

Gösterim: ✔ izinli · ✔ᵒ yalnızca kendi oluşturduğu kayıtta · ✔ˢ yalnızca kendisiyle paylaşılan projede · ✖ yasak · — uygulanmaz.

### 6.1. Kişisel çalışma alanı (MVP)
Kullanıcı kendi kişisel alanında **sahiptir ve tüm içerik izinlerine sahiptir**. Başka hiç kimsenin erişimi yoktur. Üye yönetimi izinleri kişisel alanda anlamsızdır (BR-WS-003).

### 6.2. Paylaşılan çalışma alanı (Faz 10 — ÖNERİ, onay gerektirir)

| İşlem | Sahip | Yönetici | Üye | Misafir |
|---|---|---|---|---|
| Alanı görüntüleme | ✔ | ✔ | ✔ | ✔ˢ (yalnız paylaşılan projeler) |
| Alan ayarlarını düzenleme | ✔ | ✔ | ✖ | ✖ |
| Alanı silme | ✔ | ✖ | ✖ | ✖ |
| Sahipliği devretme | ✔ | ✖ | ✖ | ✖ |
| Üyeleri görüntüleme | ✔ | ✔ | ✔ | ✖ |
| Üye davet etme | ✔ | ✔ | ✖ | ✖ |
| Üye çıkarma | ✔ | ✔ (sahip hariç) | ✖ | ✖ |
| Rol değiştirme | ✔ | ✔ (sahip/yönetici yapamaz) | ✖ | ✖ |
| Proje görüntüleme | ✔ | ✔ | ✔ | ✔ˢ |
| Proje oluşturma | ✔ | ✔ | ✔ | ✖ |
| Proje düzenleme | ✔ | ✔ | ✔ | ✖ |
| Proje arşivleme | ✔ | ✔ | ✔ᵒ | ✖ |
| Proje silme (çöpe) | ✔ | ✔ | ✔ᵒ | ✖ |
| Proje geri yükleme | ✔ | ✔ | ✔ᵒ | ✖ |
| Proje kalıcı silme | ✔ | ✔ | ✖ | ✖ |
| Projeyi misafirle paylaşma | ✔ | ✔ | ✖ | ✖ |
| Görev görüntüleme | ✔ | ✔ | ✔ | ✔ˢ |
| Görev oluşturma | ✔ | ✔ | ✔ | ✔ˢ |
| Görev düzenleme / tamamlama | ✔ | ✔ | ✔ | ✔ˢ (yalnız kendisine atanmış) |
| Görev arşivleme / silme | ✔ | ✔ | ✔ | ✖ |
| Görev geri yükleme | ✔ | ✔ | ✔ | ✖ |
| Görev kalıcı silme | ✔ | ✔ | ✔ᵒ | ✖ |
| Etiket yönetimi | ✔ | ✔ | ✔ | ✖ |
| Not / hedef (ortak) | ✔ | ✔ | ✔ | ✔ˢ (salt okunur) |
| Çöpü boşaltma | ✔ | ✔ | ✖ | ✖ |
| Kendi kayıtlı görünümleri | ✔ | ✔ | ✔ | ✔ |
| Başka üyenin kişisel alanı | ✖ | ✖ | ✖ | ✖ |

Bu matrisin Faz 10 bölümü **onay gerektirir**; özellikle "Üye başkasının görevini silebilir mi?" ve "Misafir ne düzenleyebilir?" soruları ürün kararıdır ve Faz 10 başlamadan OPEN_QUESTIONS'a eklenmelidir.

## 7. Policy uygulaması (teknik)

```ts
// modules/workspaces/domain/permissions.ts  (taslak — henüz uygulanmadı)
export type Permission = 'task.read' | 'task.create' | /* ... */ 'trash.empty';

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = { /* §6 tablosu */ };

// modules/workspaces/application/authorize.ts
export function authorize(actor: ActorInWorkspace, permission: Permission, resource?: OwnedResource)
  : Result<void, ForbiddenError> { /* rol izni + kaynak koşulu (✔ᵒ, ✔ˢ) */ }
```

- `ActorInWorkspace` = `{ userId, workspaceId, role }`; yalnızca `resolveMembership(actor, workspaceId)` tarafından üretilir. Üyelik yoksa → `NotFoundError` (404).
- Matris ile `ROLE_PERMISSIONS` arasındaki eşleşme bir **tablo tabanlı test** ile doğrulanır: bu belgedeki tablo, testteki beklenen değerlerin kaynağıdır.

## 8. Rol veya üyelik değişikliği

| Olay | Etki |
|---|---|
| Üye çıkarıldı | Üyelik `removed`; açık oturumları sonraki istekte 404 alır; çıkarılan üyenin oluşturduğu içerik alanda kalır; atanmış görevlerinin `assignee_id` değeri `NULL` olur; o alana ait bildirimleri silinir. |
| Rol düşürüldü | Bir sonraki istekte yeni izinler geçerli. |
| Sahiplik devri | Eski sahip yönetici olur; işlem tek transaction ve denetim kaydı. |
| Hesap silindi | Tüm üyelikler silinir; tek sahibi olduğu paylaşılan alan varsa silme engellenir (BR-ACC-005). |

## 9. MVP'de uygulanacaklar / sonraya kalanlar

| Konu | MVP | Sonra |
|---|---|---|
| Kimlik doğrulama, oturum | ✔ | |
| Çalışma alanı + üyelik tabloları, `owner` rolü | ✔ | |
| `authorize()` ve tüm izin kontrolleri (kişisel alan için) | ✔ | |
| Çapraz kullanıcı erişim testleri | ✔ | |
| Admin/member/guest rolleri, davet, üye yönetimi | | Faz 10 |
| Proje bazında misafir paylaşımı | | Faz 10+ |
| PostgreSQL RLS (ek savunma) | | Faz 10'da değerlendirme |
| Denetim kaydının yöneticiye gösterilmesi | | Faz 10 |
