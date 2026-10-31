/**
 * Demo verisi (D-101): `pnpm db:seed-demo`. Ayrı bir demo hesabı (demo@aysly.local) oluşturur ve tüm ekranları
 * dolduracak örnek veriyle doldurur; hesap varsa önce onu ve verisini siler. Başka hesaplara dokunmaz.
 * Veriler kullanım senaryolarıyla yazılır (iş kuralları ve doğrulamalar uygulanır).
 */
import { hashPassword } from 'better-auth/crypto';
import { sql } from 'drizzle-orm';
import { createContactStore } from '../src/modules/contacts/infrastructure/contact-store';
import { createContact } from '../src/modules/contacts/application/contacts';
import { createGoal, setGoalLinks, updateGoal } from '../src/modules/goals/application/goals';
import { goalDeps } from '../src/modules/goals/http/goal-handlers';
import { registerUser } from '../src/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '../src/modules/identity/infrastructure/drizzle-registration-store';
import { createNote, setNoteLinks } from '../src/modules/notes/application/notes';
import { noteDeps } from '../src/modules/notes/http/note-handlers';
import { createProject, updateProject } from '../src/modules/projects/application/projects';
import { projectDeps } from '../src/modules/projects/http/project-handlers';
import { addComment } from '../src/modules/tasks/application/comments';
import { completeTask, createTask, updateTask } from '../src/modules/tasks/application/tasks';
import { createCommentStore } from '../src/modules/tasks/infrastructure/comment-store';
import { taskDeps } from '../src/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope } from '../src/modules/workspaces';
import { db } from '../src/shared/db/client';
import { systemClock } from '../src/shared/kernel/clock';
import { uuidv7 } from '../src/shared/kernel/id';

export const DEMO_EMAIL = 'demo@aysly.local';
export const DEMO_PASSWORD = 'aysly demo 2026';

const must = <T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
  what: string,
): T => {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify(result.error)}`);
  return result.value;
};
const DAY = 86_400_000;
const date = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function main() {
  const database = db();
  // Önceki demo hesabı ve tüm verisi (yabancı anahtar zinciriyle) silinir.
  await database.execute(sql`delete from users where email = ${DEMO_EMAIL}`);

  const account = must(
    await registerUser(
      {
        store: createDrizzleRegistrationStore(database),
        hasher: { hash: hashPassword },
        clock: systemClock,
        newId: uuidv7,
      },
      {
        name: 'Ayşegül Demir',
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        locale: 'tr',
        timezone: 'Europe/Istanbul',
      },
    ),
    'kayıt',
  );
  const scope = (await resolveWorkspaceScope(database, account.userId, account.workspaceId))!;
  await database.execute(sql`update users set email_verified = true where id = ${account.userId}`);
  await database.execute(sql`
    update user_preferences
    set onboarding = ${JSON.stringify({
      v: 1,
      status: 'completed',
      intents: ['personal', 'work'],
      skips: 0,
      completedAt: new Date().toISOString(),
      samplesCreated: true,
      checklist: { dismissed: true, shortcutsSeen: true },
    })}::jsonb
    where user_id = ${account.userId}`);

  // Kişiler (D-097)
  const contactDeps = { contacts: createContactStore(database), clock: systemClock, newId: uuidv7 };
  const people = {} as Record<string, string>;
  for (const [key, name, email, color] of [
    ['elif', 'Elif Yılmaz', 'elif@ornek.test', 'pink'],
    ['mert', 'Mert Kaya', 'mert@ornek.test', 'blue'],
    ['zeynep', 'Zeynep Arslan', 'zeynep@ornek.test', 'teal'],
    ['can', 'Can Öztürk', null, 'orange'],
  ] as const) {
    people[key] = must(await createContact(contactDeps, scope, { name, email, color }), 'kişi').id;
  }

  // Projeler
  const projects = projectDeps(database);
  const project = async (
    name: string,
    description: string,
    color: string,
    status?: 'on_hold' | 'completed',
  ) => {
    const created = must(
      await createProject(projects, scope, { name, description, color: color as never }),
      'proje',
    );
    if (status)
      must(
        await updateProject(projects, scope, created.id, { version: created.version, status }),
        'proje durumu',
      );
    return created.id;
  };
  const billing = await project(
    'Ödeme altyapısı',
    'Self-servis faturalama ve abonelik yükseltme.',
    'violet',
  );
  const onboarding = await project(
    'Kullanıcı ilk deneyimi',
    'Uygulama içi rehber ve kontrol listesi.',
    'green',
  );
  const search = await project(
    'Yapay zekâ destekli arama',
    'Doğal dille görev ve not arama.',
    'cyan',
  );
  const rbac = await project(
    'Rol tabanlı erişim',
    'Ekip alanları için yetki modeli.',
    'indigo',
    'on_hold',
  );
  const analytics = await project(
    'Kullanım analitiği panosu',
    'Ürün metrikleri ve raporlar.',
    'amber',
    'on_hold',
  );
  const website = await project(
    'Web sitesi yenileme',
    'Yeni tanıtım sayfası ve blog.',
    'pink',
    'completed',
  );
  const home = await project('Ev', 'Ev işleri ve alışveriş.', 'orange');

  // Görevler, alt görevler, yorumlar
  const tasks = taskDeps(database);
  const comments = {
    tasks: tasks.tasks,
    comments: createCommentStore(database),
    clock: systemClock,
    newId: uuidv7,
  };
  type Spec = {
    title: string;
    projectId?: string | undefined;
    due?: number;
    priority?: 0 | 1 | 2 | 3;
    points?: number;
    assignee?: string;
    status?: 'in_progress' | 'done';
    tags?: string[];
    description?: string;
    subtasks?: [string, boolean][];
    comments?: string[];
  };
  const ids: Record<string, string> = {};
  async function task(spec: Spec, parentTaskId?: string) {
    const created = must(
      await createTask(tasks, scope, {
        title: spec.title,
        projectId: spec.projectId ?? null,
        parentTaskId: parentTaskId ?? null,
        priority: spec.priority ?? 0,
        storyPoints: spec.points ?? null,
        assigneeId: spec.assignee ? people[spec.assignee] : null,
        description: spec.description ?? null,
        tagNames: spec.tags,
        ...(spec.due !== undefined ? { due: { date: date(spec.due) } } : {}),
      }),
      `görev ${spec.title}`,
    );
    ids[spec.title] = created.id;
    let version = created.version;
    if (spec.status === 'in_progress') {
      version = must(
        await updateTask(tasks, scope, created.id, { version, status: 'in_progress' }),
        'statü',
      ).version;
    }
    for (const [title, done] of spec.subtasks ?? []) {
      await task(
        { title, projectId: spec.projectId, ...(done ? { status: 'done' as const } : {}) },
        created.id,
      );
    }
    for (const body of spec.comments ?? [])
      must(await addComment(comments, scope, created.id, { body }), 'yorum');
    if (spec.status === 'done')
      must(await completeTask(tasks, scope, created.id, { version }), 'tamamla');
    return created.id;
  }

  const specs: Spec[] = [
    {
      title: 'Self-servis faturalama sayfası',
      projectId: billing,
      due: 0,
      priority: 3,
      points: 21,
      assignee: 'elif',
      status: 'in_progress',
      tags: ['frontend'],
      description: 'Kullanıcı planını kendisi yükseltebilmeli.',
      subtasks: [
        ['Fiyat tablosu tasarımı', true],
        ['Ödeme formu', false],
        ['Fatura e-postası', false],
      ],
      comments: [
        'Tasarım taslağı hazır, yarın gözden geçirelim.',
        'Ödeme sağlayıcısının test anahtarları geldi.',
      ],
    },
    {
      title: 'Abonelik yükseltme akışı',
      projectId: billing,
      due: 3,
      priority: 2,
      points: 13,
      assignee: 'mert',
    },
    {
      title: 'İade politikası metni',
      projectId: billing,
      due: -2,
      priority: 1,
      points: 3,
      assignee: 'zeynep',
    },
    {
      title: 'Faturalama testleri',
      projectId: billing,
      status: 'done',
      points: 5,
      assignee: 'mert',
    },
    {
      title: 'Uygulama içi kontrol listesi',
      projectId: onboarding,
      due: 1,
      priority: 3,
      points: 13,
      assignee: 'zeynep',
      status: 'in_progress',
      subtasks: [
        ['İlk görev adımı', true],
        ['Proje oluşturma adımı', true],
        ['Kısayol rehberi adımı', false],
      ],
      comments: ['İlk iki adım yayında.'],
    },
    {
      title: 'Karşılama e-postası taslağı',
      projectId: onboarding,
      due: 5,
      priority: 1,
      points: 2,
      assignee: 'can',
    },
    { title: 'Boş ekran mesajları', projectId: onboarding, status: 'done', points: 3 },
    {
      title: 'Arama dizini tasarımı',
      projectId: search,
      due: 7,
      priority: 2,
      points: 34,
      assignee: 'mert',
      subtasks: [
        ['Vektör veritabanı seçimi', false],
        ['Türkçe kök bulma', false],
      ],
    },
    { title: 'Arama sonuç ekranı', projectId: search, due: 10, priority: 2, points: 8 },
    {
      title: 'Rol matrisi taslağı',
      projectId: rbac,
      due: 30,
      priority: 2,
      points: 21,
      assignee: 'elif',
    },
    { title: 'Davet akışı', projectId: rbac, due: 45, points: 13 },
    {
      title: 'Metrik tanımları',
      projectId: analytics,
      due: 60,
      priority: 1,
      points: 13,
      assignee: 'zeynep',
    },
    {
      title: 'Ana sayfa metinleri',
      projectId: website,
      status: 'done',
      points: 5,
      assignee: 'can',
    },
    { title: 'Blog altyapısı', projectId: website, status: 'done', points: 8 },
    {
      title: 'Market alışverişi',
      projectId: home,
      due: 0,
      priority: 1,
      tags: ['ev'],
      subtasks: [
        ['Süt', false],
        ['Ekmek', true],
        ['Meyve', false],
      ],
    },
    { title: 'Faturayı öde', projectId: home, due: -1, priority: 3, tags: ['ev'] },
    { title: 'Kombi bakımı randevusu', projectId: home, due: 4 },
    { title: 'Toplantı notlarını düzenle', due: 0, priority: 2, points: 1 },
    { title: 'Kitap önerilerini listele', due: 2 },
    { title: 'Yeni fikirleri gözden geçir', points: 2 },
    { title: 'Haftalık planlama', due: 1, priority: 2 },
  ];
  for (const spec of specs) await task(spec);
  // Haftalık tekrarlayan görev (BR-REC)
  must(
    await createTask(tasks, scope, {
      title: 'Haftalık ekip toplantısı',
      projectId: billing,
      due: { date: date(2) },
      recurrence: { rule: 'FREQ=WEEKLY', mode: 'fixed_schedule' },
      assigneeId: people.elif ?? null,
    }),
    'tekrarlayan',
  );

  // Notlar
  const notes = { ...noteDeps(database), clock: systemClock };
  const note1 = must(
    await createNote(notes, scope, {
      title: 'Faturalama toplantısı',
      body: '## Kararlar\n\n- Yıllık planda %20 indirim\n- Ödeme sağlayıcısı: test ortamıyla başla\n\n## Yapılacaklar\n\n- [x] Fiyat tablosu\n- [ ] Fatura e-postası',
      tagNames: ['toplantı'],
    }),
    'not',
  );
  must(
    await setNoteLinks(notes, scope, note1.id, {
      taskIds: [ids['Self-servis faturalama sayfası']!],
      projectIds: [billing],
    }),
    'not bağlantısı',
  );
  must(
    await createNote(notes, scope, {
      title: 'Arama için fikirler',
      body: 'Kullanıcılar **doğal dille** sorabilmeli: "geçen hafta tamamladıklarım".',
    }),
    'not',
  );
  must(
    await createNote(notes, scope, {
      title: 'Okuma listesi',
      body: '- Atomik Alışkanlıklar\n- Derin Çalışma\n- Shape Up',
    }),
    'not',
  );

  // Hedefler
  const goals = { ...goalDeps(database), clock: systemClock };
  const launch = must(
    await createGoal(goals, scope, { title: 'Ödeme altyapısını yayına al', targetDate: date(30) }),
    'hedef',
  );
  must(
    await setGoalLinks(goals, scope, launch.id, { taskIds: [], projectIds: [billing] }),
    'hedef bağlantısı',
  );
  const read = must(
    await createGoal(goals, scope, {
      title: 'Ayda iki kitap oku',
      description: 'Okuma listesinden.',
    }),
    'hedef',
  );
  must(
    await updateGoal(goals, scope, read.id, {
      version: read.version,
      progressMode: 'manual',
      manualProgress: 60,
    }),
    'hedef ilerleme',
  );
  must(
    await createGoal(goals, scope, { title: 'İlk deneyimi iyileştir', targetDate: date(45) }),
    'hedef',
  );

  // Bildirimler
  for (const [i, title] of [
    'Self-servis faturalama sayfası',
    'Faturayı öde',
    'Uygulama içi kontrol listesi',
  ].entries()) {
    await database.execute(sql`
      insert into notifications (id, user_id, workspace_id, type, entity_type, entity_id, payload, dedupe_key, read_at, created_at)
      values (${uuidv7()}, ${account.userId}, ${account.workspaceId}, 'reminder', 'task', ${ids[title]!},
        ${JSON.stringify({ taskId: ids[title], title, remindAt: new Date(Date.now() - i * 3_600_000).toISOString(), late: false })}::jsonb,
        ${`demo:${i}`}, ${i === 2 ? new Date().toISOString() : null}, ${new Date(Date.now() - i * 3_600_000).toISOString()})`);
  }

  console.log(`Demo hesabı hazır. E-posta: ${DEMO_EMAIL} · Şifre: ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('Demo verisi oluşturulamadı:', error instanceof Error ? error.message : error);
  process.exit(1);
});
