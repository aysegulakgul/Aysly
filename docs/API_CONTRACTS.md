# API Sözleşmeleri

> Durum: v0.4 · Son güncelleme: 2026-10-28 · Uygulama durumu: Faz 3 — kayıt (§3), Better Auth kimlik uç noktaları (§3) ve `GET/PATCH /me/preferences` (§4) uygulandı; diğerleri ilgili fazlarda.
> Yaklaşım: Sürümlü REST, JSON (D-013, ONAYLI — D-060). Bu belge, Zod şemaları yazıldıktan sonra şemalarla tutarlı tutulur; ileride OpenAPI belgesi şemalardan otomatik üretilir.

## 1. İçindekiler
1. Genel kurallar (§2)
2. Kimlik doğrulama ve hesap (§3)
3. Çalışma alanı, tercihler (§4)
4. Projeler (§5)
5. Görevler (§6)
6. Etiketler (§7)
7. Hatırlatıcılar (§8)
8. Notlar (§9)
9. Hedefler (§10)
10. Görünümler, arama, dashboard (§11)
11. Bildirimler (§12)
12. Arşiv ve çöp (§13)
13. Dışa aktarma, sağlık (§14)

## 2. Genel kurallar

### 2.1. Temel
- Taban yol: `/api/v1`. Çalışma alanına ait kaynaklar: `/api/v1/workspaces/{workspaceId}/...`.
- İçerik türü: `application/json; charset=utf-8`.
- Kimlik doğrulama: oturum çerezi (SECURITY §4). Durum değiştiren isteklerde `Origin` başlığı kontrol edilir (CSRF, SECURITY §6).
- Alan adları `camelCase`. Tarihler BR-DATE-001'e göre: `date` = `YYYY-MM-DD`, `time` = `HH:mm`, anlık = ISO 8601 UTC.
- Her yanıtta `X-Request-Id` başlığı.

### 2.2. Başarılı yanıt biçimi
```json
{ "data": { ... } }
{ "data": [ ... ], "page": { "nextCursor": "eyJ...", "hasMore": true } }
```

### 2.3. Eşzamanlılık ve idempotency
- Güncelleme (`PATCH`) ve durum değiştiren işlemler gövdede `version` taşır (BR-TASK-010). Uyuşmazlıkta `409 VERSION_CONFLICT` + `current` alanında güncel kayıt.
- Oluşturma (`POST` koleksiyon) istekleri `Idempotency-Key: <uuid>` başlığı **göndermelidir** (BR-TASK-007). Başlık yoksa istek yine işlenir (geriye uyumluluk), ancak web istemcisi her zaman gönderir.

### 2.4. Hata biçimi ve kodları
```json
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Arşivlenmiş projeye görev eklenemez.",
    "rule": "BR-PROJ-004",
    "details": [{ "field": "projectId", "reason": "project_archived" }],
    "requestId": "01J..."
  }
}
```
`message` kullanıcı diline göre çevrilmiş, güvenli bir metindir; iç ayrıntı (SQL, yığın izi) asla içermez.

| HTTP | `code` | Ne zaman |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Şema/alan doğrulaması başarısız (`details[]` alan bazında) |
| 400 | `TOKEN_INVALID` | Süresi geçmiş/kullanılmış doğrulama veya sıfırlama token'ı |
| 401 | `UNAUTHENTICATED` | Oturum yok/geçersiz |
| 403 | `FORBIDDEN` | Kaynak görünür, işlem izni yok |
| 403 | `CSRF_REJECTED` | Origin uyuşmazlığı |
| 404 | `NOT_FOUND` | Kaynak yok **veya** erişim yok (BR-PERM-001) |
| 409 | `VERSION_CONFLICT` | Sürüm uyuşmazlığı |
| 422 | `BUSINESS_RULE_VIOLATION` | İş kuralı ihlali, `rule` alanı dolu |
| 422 | `BULK_OPERATION_REJECTED` | Toplu işlemde en az bir kayıt reddedildi (`failures[]`) |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Aynı anahtar farklı gövdeyle |
| 429 | `RATE_LIMITED` | Hız sınırı; `Retry-After` başlığı |
| 500 | `INTERNAL_ERROR` | Beklenmeyen hata |
| 503 | `SERVICE_UNAVAILABLE` | Bakım/bağımlılık hatası |

### 2.5. Sayfalama, filtre, sıralama
- İmleç tabanlı: `?limit=50&cursor=...` (limit ≤ 200).
- Filtreler `TaskFilter` şemasına göre sorgu parametreleri olarak (§6.2).
- Sıralama: `?sort=dueDate:asc,priority:desc`.

### 2.6. Ortak doğrulama
- Bilinmeyen alanlar reddedilir (Zod `strict`) — yanlış yazılmış alanların sessizce yok sayılmasını önler.
- Kimlikler UUID biçiminde olmalı; değilse `400`.
- Metin alanları kırpılır; kontrol karakterleri reddedilir.

### 2.7. Her uç nokta için zorunlu testler
1. Başarılı senaryo, 2. doğrulama hatası, 3. oturumsuz istek (401), 4. başka kullanıcının kaynağı (404), 5. ilgili iş kuralı ihlalleri, 6. sürüm çakışması (güncellemelerde), 7. idempotency (oluşturmalarda). Ayrıntı: TESTING_STRATEGY §5.

---

## 3. Kimlik doğrulama ve hesap

Kimlik doğrulama kütüphanesi kendi uç noktalarını `/api/auth/*` altında sunar; aşağıdaki sözleşme uygulamanın **dışa vaat ettiği davranıştır**. Kesin yollar Faz 3'te kütüphaneye göre bu belgede güncellenir.

| Metot | Yol | Amaç | Gövde | Yanıt | Kurallar | Hız sınırı |
|---|---|---|---|---|---|---|
| POST | `/auth/sign-up` | Kayıt | `{ email, password, name, locale?, timezone? }` | `201 { data: { user } }` + oturum çerezi | BR-ACC-001/002, BR-WS-001, BR-PREF-001 | 5/saat/IP |
| POST | `/auth/sign-in` | Giriş | `{ email, password }` | `200` + çerez | BR-ACC-006 | 10/15 dk/IP+e-posta |
| POST | `/auth/sign-out` | Çıkış | — | `204` | BR-ACC-006 | — |
| POST | `/auth/verify-email` | E-posta doğrulama | `{ token }` | `200` | BR-ACC-004 | 10/saat |
| POST | `/auth/verify-email/resend` | Yeniden gönder | — | `202` | BR-ACC-004 | 3/saat/kullanıcı |
| POST | `/auth/password/forgot` | Sıfırlama talebi | `{ email }` | **Her zaman** `202` | BR-ACC-003 | 3/saat/e-posta, 10/saat/IP |
| POST | `/auth/password/reset` | Yeni şifre | `{ token, newPassword }` | `200`; tüm oturumlar kapanır; "Şifren değişti" e-postası (D-055) | BR-ACC-003 | 10/saat/IP |
| GET | `/me` | Aktör + tercihler + çalışma alanları | — | `{ user, preferences, workspaces[] }` | — | — |
| PATCH | `/me` | Profil | `{ name? }` | `200` | — | — |
| POST | `/me/password` | Şifre değiştirme | `{ currentPassword, newPassword }` | `204`; diğer oturumlar kapanır; "Şifren değişti" e-postası (D-055) | BR-ACC-002, BR-ACC-003, BR-ACC-006 | 5/saat |
| POST | `/me/email` | E-posta değiştirme talebi | `{ newEmail, currentPassword }` | `202` | BR-ACC-004 | 3/saat |
| GET | `/me/sessions` | Aktif oturumlar | — | `[{ id, createdAt, lastSeenAt, userAgent, current }]` | — | — |
| DELETE | `/me/sessions/{id}` | Oturum kapatma | — | `204` | — | — |
| DELETE | `/me/sessions?others=true` | Diğer tüm oturumları kapat | — | `204` | — | — |
| POST | `/me/deletion` | Hesap silme talebi | `{ currentPassword }` | `202 { scheduledFor }` | BR-ACC-005 (D-036) | 3/gün |
| DELETE | `/me/deletion` | Silme talebini iptal | — | `204` | BR-ACC-005 | — |

**Uygulanan yollar (Faz 3, D-067):** Kayıt `POST /api/v1/auth/sign-up` (gövde: `{ name, email, password, timezone? }`; dil, çerezden veya tarayıcı dilinden). Giriş, çıkış, sıfırlama ve doğrulama Better Auth uç noktalarıdır: `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`, `GET /api/auth/get-session`, `POST /api/auth/request-password-reset`, `GET /api/auth/reset-password/:token`, `POST /api/auth/reset-password`, `GET /api/auth/verify-email`, `POST /api/auth/send-verification-email`. Profil, şifre, e-posta ve oturum işlemleri yukarıdaki tablodaki kendi `/api/v1/me*` uç noktalarımızdır (uygulandı: `PATCH /me`, `POST /me/password`, `POST /me/email`, `GET /me/sessions`, `DELETE /me/sessions?others=true`, `DELETE /me/sessions/{id}`; D-073). Better Auth'un kayıt, kullanıcı güncelleme, şifre değiştirme, şifre doğrulama, e-posta değiştirme, oturum listeleme/kapatma ve kullanıcı silme yolları dışarıya kapalıdır (404). Yanlış mevcut şifre `400 VALIDATION_FAILED` (`field: currentPassword, reason: incorrect`); doğrulanmamış hesapta e-posta değiştirme `422` (`rule: BR-ACC-004`). Hata gövdeleri Better Auth biçimindedir (`{ code, message }`); kendi uç noktalarımız §2.4 biçimini kullanır.

Hesap varlığını ifşa etmeme: `sign-up` mevcut e-postada da kullanıcıya genel bir yanıt verir ve hesap varlığını ifşa etmez (SECURITY §4.3). Mevcut hesap sahibine bilgi e-postası MVP'de gönderilmez; yayına alma öncesi yeniden değerlendirilir (D-062). Mevcut e-postada genel mesaj verilir; dolaylı ifşa hız sınırıyla sınırlandırılır (D-070). Geliştirme ortamında tüm e-postalar yerel yakalayıcıda kalır (D-037, D-045).

## 4. Çalışma alanı ve tercihler

| Metot | Yol | Amaç | Not |
|---|---|---|---|
| GET | `/workspaces` | Aktörün üye olduğu alanlar | MVP: yalnızca kişisel |
| GET | `/workspaces/{ws}` | Alan bilgisi + aktörün rolü | 404 kuralı |
| PATCH | `/workspaces/{ws}` | Ad değiştirme | `workspace.update` |
| GET | `/me/preferences` | Tercihler | |
| PATCH | `/me/preferences` | Kısmi güncelleme | `version` zorunlu; JSON alanları Zod şemalı; geçersiz saat dilimi → 400. **Uygulandı (Faz 3):** alanlar `locale, timezone, theme, density, dateFormat, timeFormat, weekStart`; diğer alanlar ilgili fazlarda eklenir. Yanıt `{ data: { …tercihler, version } }`; `locale` değişince `aysly_locale` çerezi de güncellenir. |
| POST | `/me/onboarding` | Onboarding yanıtı | `{ intents: ('personal'|'work')[], createSamples: boolean }` → başlangıç projeleri (ONBOARDING §3) |
| POST | `/me/onboarding/skip` | Atla | Atlama sayısını artırır (ONBOARDING §2) |
| POST | `/me/onboarding/restart` | Ayarlar'dan yeniden başlatma | Örnek projeler yeniden oluşturulmaz (D-074) |

**Uygulandı (Faz 3):** `POST /me/onboarding` (`intents` boş olabilir: varsayılan düzen), `/skip`, `/restart`; yanıt `{ data: onboardingDurumu }`.

Üye yönetimi uç noktaları (`/workspaces/{ws}/members`, `/invitations`) Faz 10'da tanımlanacak.

## 5. Projeler

| Metot | Yol | İzin | Kurallar |
|---|---|---|---|
| GET | `/workspaces/{ws}/projects?status=&includeArchived=` | `project.read` | Inbox her zaman ilk ve `kind:'inbox'` |
| POST | `/workspaces/{ws}/projects` | `project.create` | BR-PROJ-001 |
| GET | `/workspaces/{ws}/projects/{id}` | `project.read` | BR-DEL-007; yanıtta `progress` (BR-PROJ-003) |
| PATCH | `/workspaces/{ws}/projects/{id}` | `project.update` | BR-PROJ-002, BR-PROJ-006, BR-DEL-002 |
| POST | `/workspaces/{ws}/projects/{id}/complete` | `project.update` | `{ version, completeOpenTasks: boolean }` (BR-PROJ-002) |
| POST | `/workspaces/{ws}/projects/{id}/archive` | `project.archive` | BR-PROJ-004 |
| POST | `/workspaces/{ws}/projects/{id}/unarchive` | `project.archive` | BR-PROJ-004 |
| DELETE | `/workspaces/{ws}/projects/{id}` | `project.delete` | BR-PROJ-005 (D-031); yanıt `{ batchId, affected: { tasks: 23 } }` |
| GET | `/workspaces/{ws}/projects/{id}/delete-preview` | `project.delete` | Onay penceresi için etkilenecek kayıt sayıları |
| POST | `/workspaces/{ws}/projects/reorder` | `project.update` | `{ id, beforeId?, afterId? }` |

**Proje nesnesi:**
```json
{
  "id": "0192...", "kind": "standard", "name": "Müşteri A — Web sitesi",
  "description": null, "color": "indigo", "icon": "briefcase",
  "status": "active", "position": "a0",
  "progress": { "done": 12, "total": 30 },
  "archivedAt": null, "deletedAt": null,
  "version": 3, "createdAt": "2026-10-15T08:00:00Z", "updatedAt": "2026-10-15T09:12:00Z"
}
```

## 6. Görevler

### 6.1. Uç noktalar

| Metot | Yol | Amaç | İzin | Kurallar |
|---|---|---|---|---|
| GET | `/workspaces/{ws}/tasks` | Listele (filtreli) | `task.read` | BR-VIEW-002, BR-DEL-001 |
| GET | `/workspaces/{ws}/my-tasks?groupBy=due` | My Tasks | `task.read` | BR-INBOX-004 |
| POST | `/workspaces/{ws}/tasks` | Oluştur | `task.create` | BR-TASK-001/002/007, BR-DATE-*, BR-PROJ-004 |
| GET | `/workspaces/{ws}/tasks/{id}` | Detay (alt görevler, etiketler, hatırlatıcılar, bağlı notlar/hedefler özetiyle) | `task.read` | BR-DEL-007 |
| PATCH | `/workspaces/{ws}/tasks/{id}` | Güncelle | `task.update` | BR-TASK-010, BR-DATE-*, BR-REM-004, BR-SUB-002, BR-DEL-002, BR-REC-006 |
| POST | `/workspaces/{ws}/tasks/{id}/complete` | Tamamla | `task.complete` | BR-TASK-004, BR-SUB-003, BR-REC-002, BR-REM-003 |
| POST | `/workspaces/{ws}/tasks/{id}/reopen` | Yeniden aç | `task.complete` | BR-TASK-004, BR-REC-007 |
| POST | `/workspaces/{ws}/tasks/{id}/move` | Proje/ebeveyn/sıra değiştir | `task.update` | BR-TASK-006, BR-SUB-002, BR-INBOX-002 |
| POST | `/workspaces/{ws}/tasks/{id}/detach` | Alt görevi bağımsız yap | `task.update` | BR-SUB-002 |
| POST | `/workspaces/{ws}/tasks/{id}/archive` / `unarchive` | Arşiv | `task.archive` | BR-DEL-002, BR-SUB-004 |
| DELETE | `/workspaces/{ws}/tasks/{id}?scope=this|series` | Çöpe at | `task.delete` | BR-DEL-*, BR-SUB-004, BR-REC-006 |
| POST | `/workspaces/{ws}/tasks/bulk` | Toplu işlem | işlem başına izin | BR-TASK-008 |

**Uygulandı (Faz 4, 1. bölüm):** `GET/POST /workspaces/{ws}/tasks`, `GET/PATCH /workspaces/{ws}/tasks/{id}`, `POST …/complete`, `POST …/reopen`; ayrıca `GET /workspaces`. Oluşturma gövdesinde şimdilik `title, description, projectId, priority, startDate, due` desteklenir; `parentTaskId`, etiketler, hatırlatıcılar, tekrar ve `position` ilgili bölümlerde eklenir (o zamana kadar bilinmeyen alan olarak 400). Liste şimdilik `projectId` ve `status` filtrelerini destekler; üst düzey, arşivsiz görevler, `position` sırasıyla. `Idempotency-Key` başlığı zorunludur (yoksa 400). Yanıt nesnesinde `tags`, `subtaskCount`, `reminders`, `recurrence` henüz yoktur.

**Uygulandı (Faz 4, 3. bölüm):** Oluşturmada `parentTaskId` ve `tagNames`; `PATCH` gövdesinde `tagNames` (görevin etiket kümesini verilen adlarla **değiştirir**; boş dizi tüm etiketleri kaldırır); `POST …/complete` gövdesinde `completeSubtasks`; `POST …/move` (`{ version, projectId }`, sıra hedefin sonu; sıra içi taşıma Faz 5'te), `POST …/detach`; `GET /workspaces/{ws}/my-tasks` (`[{ group: overdue|today|tomorrow|thisWeek|later|none, tasks }]`); `GET /workspaces/{ws}/projects` (salt okunur ilk sürüm: `{ id, name, kind }`, Inbox ilk); `GET /workspaces/{ws}/tags`. Liste ve detay yanıtlarında `project { id, name, kind }`, `tags`, `subtaskCount { total, done }`; detayda ayrıca `subtasks`. Etiket yönetimi uç noktaları (`POST/PATCH/DELETE /tags`, BR-TAG-002) henüz yok.

**Uygulandı (Faz 4, 4. bölüm):** `POST …/archive`, `POST …/unarchive` (`{ version }`; alt görevler birlikte), `DELETE /workspaces/{ws}/tasks/{id}` (çöpe taşır; `{ data: { batchId, affected } }`), `GET /workspaces/{ws}/tasks/{id}?includeDeleted=true`, `GET /trash`, `POST /trash/restore`, `DELETE /trash/{batchId}` ve `DELETE /trash` (`{ confirm: true }`). Çöp kutusu şimdilik yalnızca görevleri içerir (proje çöpü Faz 5). Toplu işlem (`POST /tasks/bulk`) ve `GET /archive` Faz 5'te.

### 6.2. Liste sorgusu (`TaskFilter` v1)

| Parametre | Tür | Örnek | Not |
|---|---|---|---|
| `projectId` | uuid[] | `projectId=a&projectId=b` | |
| `status` | enum[] | `status=todo&status=in_progress` | Varsayılan: açık durumlar |
| `priority` | int[] | `priority=3` | |
| `tagId` | uuid[] | | `tagMode=any|all` |
| `due` | enum | `overdue|today|tomorrow|next7|none|any` | BR-DATE-003 |
| `dueFrom`, `dueTo` | date | `2026-10-01` | Takvim aralığı |
| `parent` | enum | `top|all` | Varsayılan `top`; alt görev sayısı yanıtta |
| `includeArchived` | bool | | BR-DEL-002 |
| `q` | string | | Basit metin filtresi (tam arama §11) |
| `sort` | string | `position:asc` | |

### 6.3. Görev oluşturma — ayrıntılı örnek

**İstek**
```http
POST /api/v1/workspaces/0192.../tasks
Idempotency-Key: 6f1c2a9e-...
Content-Type: application/json

{
  "title": "Kira ödemesi",
  "description": null,
  "projectId": null,
  "parentTaskId": null,
  "priority": 2,
  "startDate": null,
  "due": { "date": "2026-11-01", "time": "10:00", "timezone": "Europe/Istanbul" },
  "tagIds": ["0192..."],
  "tagNames": ["ev"],
  "reminders": [{ "kind": "relative", "offsetMinutes": 1440 }],
  "recurrence": { "rule": "FREQ=MONTHLY;BYMONTHDAY=1", "mode": "fixed_schedule" },
  "position": { "afterId": null }
}
```

**Doğrulama kuralları**
| Alan | Kural |
|---|---|
| `title` | 1–500 (kırpılmış) — BR-TASK-001 |
| `projectId` | null → Inbox; aynı alan, arşivsiz, çöpte değil — BR-TASK-002, BR-PROJ-004, BR-WS-002 |
| `parentTaskId` | Ebeveyn üst düzey olmalı; proje ebeveynden alınır — BR-SUB-001/002; ebeveynin alt görev sayısı < 100 — BR-SUB-005 |
| `priority` | 0–3 |
| `due.time` | `due.date` olmadan gönderilemez; `timezone` zorunlu ve geçerli IANA |
| `startDate` | ≤ `due.date` — BR-DATE-002 |
| `tagIds` + `tagNames` | toplam ≤ 20; `tagNames` yoksa oluşturulur — BR-TAG-001/003 |
| `reminders` | ≤ 5; göreli için `due` zorunlu; gelecekte olmalı — BR-REM-001/002 |
| `recurrence` | `due.date` zorunlu; alt görevde yasak; desteklenen RRULE alt kümesi — BR-REC-001/003 |

**Yanıt** `201 Created`
```json
{
  "data": {
    "id": "0192...", "workspaceId": "0192...", "projectId": "0192...(inbox)",
    "parentTaskId": null, "title": "Kira ödemesi", "description": null,
    "status": "todo", "priority": 2, "startDate": null,
    "due": { "date": "2026-11-01", "time": "10:00", "timezone": "Europe/Istanbul", "at": "2026-11-01T07:00:00Z" },
    "completedAt": null, "tags": [{ "id": "...", "name": "ev", "color": "green" }],
    "subtaskCount": { "total": 0, "done": 0 },
    "reminders": [{ "id": "...", "kind": "relative", "offsetMinutes": 1440, "remindAt": "2026-10-31T07:00:00Z", "status": "pending" }],
    "recurrence": { "rule": "FREQ=MONTHLY;BYMONTHDAY=1", "mode": "fixed_schedule", "seriesId": "..." },
    "position": "a1", "archivedAt": null, "deletedAt": null,
    "version": 1, "createdAt": "...", "updatedAt": "..."
  }
}
```

**Hatalar:** 400 (doğrulama), 401, 404 (alan/proje/ebeveyn yok veya erişim yok), 422 (`BR-PROJ-004`, `BR-SUB-001`, `BR-REM-001`, `BR-REC-001`, `BR-SUB-005`, `BR-TAG-003`), 422 `IDEMPOTENCY_KEY_REUSED`, 429.

### 6.4. Güncelleme
`PATCH` yalnızca gönderilen alanları değiştirir; `version` zorunludur. `null` alanı temizler (ör. `"due": null` tarihi kaldırır → göreli hatırlatıcılar silinir, BR-REM-004; tekrar kuralı varsa reddedilir, BR-REC-001). Tekrarlayan görevde `recurrenceScope: "this" | "following"` zorunludur (BR-REC-006). `status` ile `done` gönderilirse istek `complete` uç noktasına yönlendirilmez → `400`; tamamlama yalnızca `/complete` ile yapılır (tek yol, tek kural).

### 6.5. Tamamlama
İstek: `{ "version": 3, "completeSubtasks": false }`
Yanıt: `{ data: { task, nextOccurrence: Task | null, completedSubtaskIds: [] } }`

### 6.6. Toplu işlem
```json
{
  "action": "complete | reopen | move | setDue | setPriority | addTags | removeTags | archive | delete",
  "taskIds": ["..."],
  "params": { "projectId": "...", "due": { "date": "2026-10-20" } }
}
```
- En fazla 200 kimlik; atomik (BR-TASK-008). Toplu işlemler sürüm kontrolü yapmaz ("son yazan kazanır", D-060); gerekçe: kullanıcı açıkça toplu değişiklik istiyor.
- Başarı: `{ data: { affected: 37, batchId?: "..." } }`; ret: `422 BULK_OPERATION_REJECTED` + `failures: [{ id, code, rule }]`.

## 7. Etiketler

| Metot | Yol | Kural |
|---|---|---|
| GET | `/workspaces/{ws}/tags` | Kullanım sayılarıyla |
| POST | `/workspaces/{ws}/tags` | BR-TAG-001 (çakışmada `422` + mevcut etiket kimliği) |
| PATCH | `/workspaces/{ws}/tags/{id}` | Ad/renk; BR-TAG-001 |
| DELETE | `/workspaces/{ws}/tags/{id}` | BR-TAG-002 (kalıcı); yanıt `{ removedFrom: { tasks, notes } }` |

## 8. Hatırlatıcılar

| Metot | Yol | Kural |
|---|---|---|
| POST | `/workspaces/{ws}/tasks/{taskId}/reminders` | BR-REM-001/002 |
| DELETE | `/workspaces/{ws}/tasks/{taskId}/reminders/{id}` | — |

Hatırlatıcılar görev detayında döner; ayrı listeleme yoktur.

## 9. Notlar

| Metot | Yol | Kural |
|---|---|---|
| GET | `/workspaces/{ws}/notes?tagId=&linkedTaskId=&linkedProjectId=&includeArchived=&cursor=` | |
| POST | `/workspaces/{ws}/notes` | BR-NOTE-004; `Idempotency-Key` |
| GET | `/workspaces/{ws}/notes/{id}` | BR-DEL-007 |
| PATCH | `/workspaces/{ws}/notes/{id}` | `{ version, title?, body?, pinned? }` — BR-NOTE-001/002; 409'da `current` |
| PUT | `/workspaces/{ws}/notes/{id}/links` | `{ taskIds: [], projectIds: [] }` (tam küme) — BR-NOTE-003 |
| POST | `/workspaces/{ws}/notes/{id}/archive` / `unarchive` | BR-DEL-002 |
| DELETE | `/workspaces/{ws}/notes/{id}` | BR-DEL-* |

Gövde Markdown olarak döner; istemci sanitize edilmiş HTML'e çevirir (SECURITY §5). Sunucu kaydederken tehlikeli HTML'i temizler (savunma derinliği).

## 10. Hedefler

| Metot | Yol | Kural |
|---|---|---|
| GET | `/workspaces/{ws}/goals?status=` | Yanıtta `progress: { mode, value: 0-100 | null }` |
| POST | `/workspaces/{ws}/goals` | BR-GOAL-001 |
| GET / PATCH / DELETE | `/workspaces/{ws}/goals/{id}` | BR-GOAL-002/003 |
| PUT | `/workspaces/{ws}/goals/{id}/links` | `{ taskIds, projectIds }` — BR-GOAL-004 |
| POST | `/workspaces/{ws}/goals/{id}/achieve` / `abandon` / `reactivate` | BR-GOAL-003 |
| POST | `/workspaces/{ws}/goals/{id}/archive` / `unarchive` | BR-DEL-002 |

## 11. Görünümler, arama, dashboard

| Metot | Yol | Açıklama | Kural |
|---|---|---|---|
| GET | `/workspaces/{ws}/views` | Aktörün kayıtlı görünümleri | BR-VIEW-001 |
| POST / PATCH / DELETE | `/workspaces/{ws}/views[/{id}]` | `{ name, viewType, filter (TaskFilter v1), sort, groupBy }` | BR-VIEW-001 |
| GET | `/search?q=&types=task,project,note,goal&includeArchived=` | Global arama; erişilebilir tüm alanlar | BR-SRCH-001/002; hız sınırı yayına alma öncesi (D-061) |
| GET | `/workspaces/{ws}/dashboard` | Tek istekte widget verisi | BR-DASH-001/002 |

Dashboard yanıtı:
```json
{
  "data": {
    "today": { "date": "2026-10-15", "tasks": [ ... ] },
    "overdue": { "count": 4, "tasks": [ ... ] },
    "upcoming": { "days": [{ "date": "2026-10-16", "tasks": [ ... ] }] },
    "priority": [ ... ],
    "projects": [{ "id": "...", "name": "...", "progress": { "done": 3, "total": 9 } }],
    "goals": [{ "id": "...", "title": "...", "progress": { "mode": "auto", "value": 40 } }],
    "inboxCount": 7
  }
}
```
Yalnızca kullanıcının görünür widget'larının verisi döner.

## 12. Bildirimler

| Metot | Yol | Açıklama | Kural |
|---|---|---|---|
| GET | `/notifications?unreadOnly=&cursor=` | Aktörün bildirimleri | BR-NOTIF-003 |
| GET | `/notifications/unread-count` | Rozet | |
| POST | `/notifications/{id}/read` / `unread` | | |
| POST | `/notifications/read-all` | | |

Bildirimler kullanıcıya aittir; başka kullanıcının bildirim kimliği → 404.
MVP'de yalnızca uygulama içi bildirim vardır (D-037). D-053 gereği `unread-count` ve liste istekleri, kullanıcının zamanı gelmiş hatırlatıcılarını önce bildirime dönüştürür (BR-REM-005); istemci bu uç noktayı uygulama açıkken ~60 sn'de bir yoklar.

## 13. Arşiv ve çöp

| Metot | Yol | Açıklama | Kural |
|---|---|---|---|
| GET | `/workspaces/{ws}/archive?type=task,project,note,goal` | Arşivli kayıtlar | BR-DEL-001 |
| GET | `/workspaces/{ws}/trash` | Silme gruplarına göre: `[{ batchId, deletedAt, purgeAt, root: {type,id,title}, counts }]` | BR-DEL-003/006 |
| POST | `/workspaces/{ws}/trash/restore` | `{ batchId }` veya `{ type, id, restoreParent?: boolean }` | BR-DEL-004, BR-SUB-004 |
| DELETE | `/workspaces/{ws}/trash/{batchId}` | Grubu kalıcı sil (`{ confirm: true }` zorunlu) | BR-DEL-005 |
| DELETE | `/workspaces/{ws}/trash` | Çöpü boşalt (`{ confirm: true }`) | BR-DEL-005, `trash.empty` |

## 14. Dışa aktarma ve sağlık

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/me/export` | Çalışma alanını JSON olarak **doğrudan indirme** yanıtı üretir (D-046; `Content-Disposition: attachment`, büyük veride akış). Gövde: `{ currentPassword }` — şifreyle yeniden doğrulama (D-055). Kapsam: çalışma alanı içeriği (çöp kutusu dahil) + profil + tercihler; şifre hash'i, oturumlar, token'lar, idempotency ve denetim kayıtları, IP/user-agent hariç (D-059). Hız sınırı: 5/saat. |
| GET | `/api/health`, `/api/health/ready` | Kimlik doğrulamasız; iç ayrıntı içermez |

## 15. Sürümleme ve uyumluluk
- Geriye uyumlu değişiklikler (yeni isteğe bağlı alan, yeni uç nokta) `v1` içinde yapılır.
- Geriye uyumsuz değişiklik `v2` gerektirir ve ürün sahibi onayı ister (CLAUDE.md §5).
- Kaldırılacak alanlar en az bir sürüm boyunca `deprecated` olarak belgelenir.
