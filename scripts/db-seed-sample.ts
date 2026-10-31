/**
 * Örnek ürün geliştirme verisi (D-105):
 *   pnpm db:seed-sample --email <adres>            → hesaba 3 projelik senaryoyu ekler
 *   pnpm db:seed-sample --email <adres> --remove   → eklediklerini kaldırır
 * Kayıtlar kullanım senaryolarıyla yazılır (iş kuralları uygulanır); arayüzden tek tek de silinebilir. Eklenen
 * kayıtların kimlikleri yerel `backups/` klasöründe (depoya girmez) tutulur; kaldırma yalnızca onlara dokunur.
 * Eklemeden önce veritabanı yedeği alınır.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { createContact } from '../src/modules/contacts/application/contacts';
import { createContactStore } from '../src/modules/contacts/infrastructure/contact-store';
import {
  createGoal,
  deleteGoal,
  setGoalArchived,
  setGoalLinks,
  updateGoal,
} from '../src/modules/goals/application/goals';
import { goalDeps } from '../src/modules/goals/http/goal-handlers';
import {
  createNote,
  deleteNote,
  setNoteFlags,
  setNoteLinks,
} from '../src/modules/notes/application/notes';
import { noteDeps } from '../src/modules/notes/http/note-handlers';
import { createProject, updateProject } from '../src/modules/projects/application/projects';
import { projectDeps } from '../src/modules/projects/http/project-handlers';
import { addComment } from '../src/modules/tasks/application/comments';
import { archiveTask, deleteTask } from '../src/modules/tasks/application/lifecycle';
import { completeTask, createTask, updateTask } from '../src/modules/tasks/application/tasks';
import { createCommentStore } from '../src/modules/tasks/infrastructure/comment-store';
import { taskDeps } from '../src/modules/tasks/http/task-handlers';
import { findPersonalWorkspaceId, resolveWorkspaceScope } from '../src/modules/workspaces';
import { db } from '../src/shared/db/client';
import { systemClock } from '../src/shared/kernel/clock';
import { uuidv7 } from '../src/shared/kernel/id';

const args = process.argv.slice(2);
const email = args[args.indexOf('--email') + 1];
const removing = args.includes('--remove');
if (!email || args.indexOf('--email') < 0) {
  console.error('Kullanım: pnpm db:seed-sample --email <adres> [--remove]');
  process.exit(1);
}
const record = `backups/sample-seed-${email.replace(/[^a-z0-9]+/gi, '_')}.json`;

type Created = {
  workspaceId: string;
  projects: string[];
  tasks: string[];
  contacts: string[];
  notes: string[];
  goals: string[];
  tags: string[];
};

const must = <T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
  what: string,
): T => {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify(result.error)}`);
  return result.value;
};
const DAY = 86_400_000;
const date = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function remove() {
  if (!existsSync(record)) {
    console.error(`Kaldırılacak örnek veri bulunamadı (${record}).`);
    process.exit(1);
  }
  const created = JSON.parse(readFileSync(record, 'utf8')) as Created;
  const ws = created.workspaceId;
  const ids = (list: string[]) => sql`string_to_array(${list.join(',')}, ',')::uuid[]`;
  const database = db();
  await database.transaction(async (tx) => {
    if (created.tasks.length)
      await tx.execute(
        sql`delete from tasks where workspace_id = ${ws} and (id = any(${ids(created.tasks)}) or project_id = any(${ids(created.projects.length ? created.projects : [uuidv7()])}))`,
      );
    if (created.projects.length)
      await tx.execute(
        sql`delete from projects where workspace_id = ${ws} and id = any(${ids(created.projects)})`,
      );
    if (created.notes.length)
      await tx.execute(
        sql`delete from notes where workspace_id = ${ws} and id = any(${ids(created.notes)})`,
      );
    if (created.goals.length)
      await tx.execute(
        sql`delete from goals where workspace_id = ${ws} and id = any(${ids(created.goals)})`,
      );
    if (created.contacts.length)
      await tx.execute(
        sql`delete from contacts where workspace_id = ${ws} and id = any(${ids(created.contacts)})`,
      );
    if (created.tags.length)
      await tx.execute(
        sql`delete from tags where workspace_id = ${ws} and id = any(${ids(created.tags)})`,
      );
  });
  rmSync(record);
  console.log('Örnek veri kaldırıldı.');
}

async function seed() {
  if (existsSync(record)) {
    console.error('Bu hesapta zaten örnek veri var. Önce --remove ile kaldırın.');
    process.exit(1);
  }
  const database = db();
  const [user] = await database.execute<{ id: string }>(
    sql`select id from users where email = ${email}`,
  );
  if (!user) {
    console.error(`Hesap bulunamadı: ${email}`);
    process.exit(1);
  }
  const workspaceId = await findPersonalWorkspaceId(database, user.id);
  const resolved = workspaceId ? await resolveWorkspaceScope(database, user.id, workspaceId) : null;
  if (!resolved) throw new Error('Çalışma alanı bulunamadı');
  const scope = resolved;

  const backup = spawnSync('node', ['scripts/db-backup.mjs'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (backup.status !== 0) throw new Error('Yedek alınamadı; örnek veri eklenmedi.');

  const tagsBefore = new Set(
    (
      await database.execute<{ id: string }>(
        sql`select id from tags where workspace_id = ${scope.workspaceId}`,
      )
    ).map((r) => r.id),
  );
  const created: Created = {
    workspaceId: scope.workspaceId,
    projects: [],
    tasks: [],
    contacts: [],
    notes: [],
    goals: [],
    tags: [],
  };
  // Kısmi ekleme de kaldırılabilsin diye kayıt dosyası her adımda güncellenir.
  mkdirSync('backups', { recursive: true });
  const save = () => writeFileSync(record, JSON.stringify(created, null, 2));

  // Ekip (D-097)
  const contactDeps = { contacts: createContactStore(database), clock: systemClock, newId: uuidv7 };
  const people: Record<string, string> = {};
  for (const [key, name, mail, color] of [
    ['deniz', 'Deniz Aydın', 'deniz@ornek.test', 'violet'],
    ['burak', 'Burak Şahin', 'burak@ornek.test', 'blue'],
    ['selin', 'Selin Koç', 'selin@ornek.test', 'pink'],
    ['emre', 'Emre Yıldız', 'emre@ornek.test', 'teal'],
    ['ilayda', 'İlayda Çelik', 'ilayda@ornek.test', 'orange'],
  ] as const) {
    const contact = must(
      await createContact(contactDeps, scope, { name, email: mail, color }),
      'kişi',
    );
    people[key] = contact.id;
    created.contacts.push(contact.id);
  }
  save();

  // Projeler (D-102: farklı statüler)
  const projects = projectDeps(database);
  const project = async (
    name: string,
    description: string,
    color: string,
    status: 'active' | 'on_hold' | 'not_started',
  ) => {
    const p = must(
      await createProject(projects, scope, { name, description, color: color as never }),
      'proje',
    );
    if (status !== 'not_started')
      must(
        await updateProject(projects, scope, p.id, { version: p.version, status }),
        'proje statüsü',
      );
    created.projects.push(p.id);
    return p.id;
  };
  const mobile = await project(
    'Mobil uygulama v2',
    'iOS ve Android için yeniden tasarlanan mobil uygulama; çevrimdışı mod ve bildirimler.',
    'indigo',
    'active',
  );
  const payments = await project(
    'Ödeme ve abonelik altyapısı',
    'Stripe entegrasyonu, faturalama ve plan yükseltme akışları.',
    'green',
    'active',
  );
  const insights = await project(
    'Analitik panosu',
    'Ürün metrikleri, kohort analizi ve raporlar. Yeni çeyrekte başlayacak.',
    'amber',
    'not_started',
  );
  save();

  // Görevler
  const tasks = taskDeps(database);
  const comments = {
    tasks: tasks.tasks,
    comments: createCommentStore(database),
    clock: systemClock,
    newId: uuidv7,
  };
  type Spec = {
    title: string;
    projectId: string;
    due?: number;
    priority?: 0 | 1 | 2 | 3;
    points?: number;
    who?: string;
    status?: 'in_progress' | 'done';
    tags?: string[];
    description?: string;
    subtasks?: [string, boolean, string?][];
    comments?: string[];
  };
  const byTitle: Record<string, { id: string; version: number }> = {};
  async function task(spec: Spec, parentTaskId?: string) {
    const t = must(
      await createTask(tasks, scope, {
        title: spec.title,
        projectId: spec.projectId,
        parentTaskId: parentTaskId ?? null,
        priority: spec.priority ?? 0,
        storyPoints: spec.points ?? null,
        assigneeId: spec.who ? (people[spec.who] ?? null) : null,
        description: spec.description ?? null,
        tagNames: spec.tags,
        ...(spec.due !== undefined ? { due: { date: date(spec.due) } } : {}),
      }),
      `görev ${spec.title}`,
    );
    created.tasks.push(t.id);
    let version = t.version;
    if (spec.status === 'in_progress')
      version = must(
        await updateTask(tasks, scope, t.id, { version, status: 'in_progress' }),
        'statü',
      ).version;
    for (const [title, done, who] of spec.subtasks ?? []) {
      await task(
        {
          title,
          projectId: spec.projectId,
          ...(who ? { who } : {}),
          ...(done ? { status: 'done' as const } : {}),
        },
        t.id,
      );
    }
    for (const body of spec.comments ?? [])
      must(await addComment(comments, scope, t.id, { body }), 'yorum');
    if (spec.status === 'done')
      version = must(await completeTask(tasks, scope, t.id, { version }), 'tamamla').version;
    byTitle[spec.title] = { id: t.id, version };
    return t.id;
  }

  const specs: Spec[] = [
    // Mobil uygulama v2
    {
      title: 'Yeni gezinme yapısının tasarımı',
      projectId: mobile,
      due: -3,
      priority: 3,
      points: 8,
      who: 'selin',
      status: 'done',
      tags: ['tasarım'],
      subtasks: [
        ['Kullanıcı akışları', true, 'selin'],
        ['Figma prototipi', true, 'selin'],
        ['Kullanılabilirlik testi', true, 'deniz'],
      ],
      comments: ['Prototip 6 kullanıcıyla test edildi; alt menü tercih edildi.'],
    },
    {
      title: 'Çevrimdışı mod: yerel veritabanı',
      projectId: mobile,
      due: 0,
      priority: 3,
      points: 13,
      who: 'burak',
      status: 'in_progress',
      tags: ['backend', 'mobil'],
      description: 'Bağlantı yokken görevler cihazda saklanır, bağlantı gelince eşitlenir.',
      subtasks: [
        ['SQLite şeması', true, 'burak'],
        ['Eşitleme kuyruğu', false, 'burak'],
        ['Çakışma çözümü', false, 'emre'],
      ],
      comments: [
        'Eşitleme kuyruğu için ilk taslak PR açıldı.',
        'Çakışmalarda son yazan kazanır yerine alan bazlı birleştirme önerisi.',
      ],
    },
    {
      title: 'Anlık bildirim altyapısı',
      projectId: mobile,
      due: 2,
      priority: 2,
      points: 8,
      who: 'emre',
      tags: ['backend'],
      subtasks: [
        ['APNs sertifikaları', false, 'emre'],
        ['FCM entegrasyonu', false, 'emre'],
      ],
    },
    {
      title: 'Karanlık tema',
      projectId: mobile,
      due: 5,
      priority: 1,
      points: 5,
      who: 'selin',
      tags: ['tasarım'],
    },
    {
      title: 'App Store ekran görüntüleri',
      projectId: mobile,
      due: 9,
      priority: 1,
      points: 3,
      who: 'ilayda',
      tags: ['pazarlama'],
    },
    {
      title: 'Beta sürümü TestFlight dağıtımı',
      projectId: mobile,
      due: 12,
      priority: 2,
      points: 3,
      who: 'deniz',
      subtasks: [
        ['Sürüm notları', false, 'ilayda'],
        ['Test grubu daveti', false, 'deniz'],
      ],
    },
    {
      title: 'Erişilebilirlik denetimi (VoiceOver)',
      projectId: mobile,
      due: 15,
      priority: 2,
      points: 5,
      who: 'selin',
    },
    {
      title: 'Çökme raporlarını incele',
      projectId: mobile,
      due: -1,
      priority: 3,
      points: 2,
      who: 'burak',
    },
    // Ödeme ve abonelik
    {
      title: 'Stripe ödeme formu',
      projectId: payments,
      due: 1,
      priority: 3,
      points: 13,
      who: 'emre',
      status: 'in_progress',
      tags: ['backend', 'frontend'],
      subtasks: [
        ['Kart bilgisi alanları', true, 'emre'],
        ['3D Secure doğrulaması', false, 'emre'],
        ['Hata mesajları', false, 'selin'],
      ],
      comments: ['Test kartlarıyla ilk ödeme başarılı.'],
    },
    {
      title: 'Plan yükseltme akışı',
      projectId: payments,
      due: 4,
      priority: 2,
      points: 8,
      who: 'deniz',
      subtasks: [
        ['Fiyat karşılaştırma tablosu', false, 'selin'],
        ['Oransal ücretlendirme', false, 'emre'],
      ],
    },
    {
      title: 'Fatura e-postası şablonu',
      projectId: payments,
      due: 7,
      priority: 1,
      points: 3,
      who: 'ilayda',
      tags: ['pazarlama'],
    },
    {
      title: 'İade ve iptal politikası',
      projectId: payments,
      due: -2,
      priority: 2,
      points: 2,
      who: 'deniz',
    },
    {
      title: 'Vergi hesaplama (KDV)',
      projectId: payments,
      due: 10,
      priority: 2,
      points: 5,
      who: 'burak',
    },
    {
      title: 'Ödeme webhook testleri',
      projectId: payments,
      due: -4,
      priority: 2,
      points: 5,
      who: 'emre',
      status: 'done',
    },
    // Analitik panosu
    {
      title: 'Metrik sözlüğü',
      projectId: insights,
      due: 20,
      priority: 2,
      points: 5,
      who: 'deniz',
      subtasks: [
        ['Aktif kullanıcı tanımı', false, 'deniz'],
        ['Elde tutma oranı', false, 'deniz'],
      ],
    },
    {
      title: 'Olay izleme planı',
      projectId: insights,
      due: 25,
      priority: 1,
      points: 8,
      who: 'burak',
    },
    {
      title: 'Pano tasarım taslağı',
      projectId: insights,
      due: 30,
      priority: 1,
      points: 5,
      who: 'selin',
      tags: ['tasarım'],
    },
  ];
  for (const spec of specs) await task(spec);
  save();

  // Tekrarlayan görev (takvim)
  const standup = must(
    await createTask(tasks, scope, {
      title: 'Haftalık sprint toplantısı',
      projectId: mobile,
      due: { date: date(1), time: '10:00', timezone: 'Europe/Istanbul' },
      recurrence: { rule: 'FREQ=WEEKLY', mode: 'fixed_schedule' },
      assigneeId: people.deniz ?? null,
    }),
    'tekrarlayan',
  );
  created.tasks.push(standup.id);

  // Arşiv ve çöp kutusu
  const archived = await task({
    title: 'Eski giriş ekranı tasarımı',
    projectId: mobile,
    points: 3,
    who: 'selin',
    status: 'done',
  });
  must(
    await archiveTask(tasks, scope, archived, {
      version: byTitle['Eski giriş ekranı tasarımı']!.version,
    }),
    'arşiv',
  );
  const trashed = await task({
    title: 'PayPal entegrasyonu (vazgeçildi)',
    projectId: payments,
    points: 8,
    who: 'emre',
  });
  must(await deleteTask(tasks, scope, trashed), 'çöp');
  save();

  // Notlar
  const notes = { ...noteDeps(database), clock: systemClock };
  const note = async (
    title: string,
    body: string,
    links?: { taskIds: string[]; projectIds: string[] },
    tagNames?: string[],
  ) => {
    const n = must(
      await createNote(notes, scope, { title, body, ...(tagNames ? { tagNames } : {}) }),
      'not',
    );
    if (links) must(await setNoteLinks(notes, scope, n.id, links), 'not bağlantısı');
    created.notes.push(n.id);
    return n.id;
  };
  const kickoff = await note(
    'Mobil v2 başlangıç toplantısı',
    '## Kararlar\n\n- Çevrimdışı mod ilk sürümde\n- Karanlık tema ikinci sprintte\n\n## Riskler\n\n- [ ] Eşitleme çakışmaları\n- [x] Tasarım onayı',
    { taskIds: [byTitle['Çevrimdışı mod: yerel veritabanı']!.id], projectIds: [mobile] },
    ['toplantı'],
  );
  must(await setNoteFlags(notes, scope, kickoff, { pinned: true }), 'sabitle');
  await note(
    'Ödeme sağlayıcı karşılaştırması',
    '| Sağlayıcı | Komisyon |\n|---|---|\n| Stripe | %2,9 |\n| iyzico | %2,7 |\n\nKarar: **Stripe**, test ortamıyla başla.',
    { taskIds: [], projectIds: [payments] },
  );
  await note(
    'Analitik için soru listesi',
    '- Haftalık aktif kullanıcı nasıl tanımlanacak?\n- Hangi olaylar zorunlu?',
    { taskIds: [], projectIds: [insights] },
  );
  const oldNote = await note(
    'Eski yol haritası taslağı',
    'Bu taslak yerine Mobil v2 planı kullanılıyor.',
  );
  must(await setNoteFlags(notes, scope, oldNote, { archived: true }), 'not arşiv');
  const draft = await note('Silinecek karalama', 'Geçici not.');
  must(await deleteNote(notes, scope, draft), 'not çöp');
  save();

  // Hedefler
  const goals = { ...goalDeps(database), clock: systemClock };
  const goal = async (
    title: string,
    targetDays: number,
    links?: { taskIds: string[]; projectIds: string[] },
  ) => {
    const g = must(
      await createGoal(goals, scope, { title, targetDate: date(targetDays) }),
      'hedef',
    );
    if (links) must(await setGoalLinks(goals, scope, g.id, links), 'hedef bağlantısı');
    created.goals.push(g.id);
    return g;
  };
  await goal('Mobil v2 betasını yayınla', 14, { taskIds: [], projectIds: [mobile] });
  await goal('Ödeme altyapısını canlıya al', 30, { taskIds: [], projectIds: [payments] });
  const nps = await goal('Müşteri memnuniyetini 50 NPS’e çıkar', 90);
  must(
    await updateGoal(goals, scope, nps.id, {
      version: nps.version,
      progressMode: 'manual',
      manualProgress: 35,
    }),
    'manuel ilerleme',
  );
  const past = await goal('İlk 100 beta kullanıcısına ulaş', -5);
  must(
    await updateGoal(goals, scope, past.id, { version: past.version, status: 'achieved' }),
    'ulaşıldı',
  );
  const oldGoal = await goal('Eski çeyrek hedefi', -40);
  must(await setGoalArchived(goals, scope, oldGoal.id, true), 'hedef arşiv');
  const dropped = await goal('Masaüstü uygulaması (iptal)', 60);
  must(await deleteGoal(goals, scope, dropped.id), 'hedef çöp');

  created.tags = (
    await database.execute<{ id: string }>(
      sql`select id from tags where workspace_id = ${scope.workspaceId}`,
    )
  )
    .map((r) => r.id)
    .filter((id) => !tagsBefore.has(id));
  save();
  console.log(
    `Örnek veri eklendi: ${created.projects.length} proje, ${created.tasks.length} görev, ${created.contacts.length} kişi, ${created.notes.length} not, ${created.goals.length} hedef.`,
  );
}

(removing ? remove() : seed())
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Örnek veri işlemi başarısız:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
