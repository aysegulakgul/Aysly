/**
 * Mimari bağımlılık kuralları (ARCHITECTURE §5, CODING_STANDARDS §11). `pnpm arch` ve `pnpm verify` içinde çalışır.
 * Bir kural ihlal edilirse doğrulama başarısız olur.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Döngüsel bağımlılık yasak.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'Domain saf kalır: diğer katmanlara, veritabanına, çatıya ve ağa bağımlı olamaz.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [
          '^src/modules/[^/]+/(application|infrastructure|http)/',
          '^src/(app|ui|client|i18n)/',
          '^src/shared/(db|http|email|jobs|observability|config|composition)',
          'node_modules/(drizzle-orm|postgres|next|react|pino|nodemailer)/',
        ],
      },
    },
    {
      name: 'application-no-infrastructure',
      severity: 'error',
      comment:
        "Application yalnızca portlara bağımlıdır; somut altyapıya, HTTP katmanına ve UI'ya değil.",
      from: { path: '^src/modules/[^/]+/application/' },
      to: {
        path: [
          '^src/modules/[^/]+/(infrastructure|http)/',
          '^src/(app|ui|client)/',
          '^src/shared/(db/client|email/smtp|jobs/pg-|composition)',
          'node_modules/(drizzle-orm|postgres|next|pino|nodemailer)/',
        ],
      },
    },
    {
      name: 'ui-no-data-access',
      severity: 'error',
      comment: 'Arayüz katmanı veritabanına ve altyapıya doğrudan erişemez (CLAUDE.md §4).',
      from: { path: '^src/(ui|client)/' },
      to: {
        path: [
          '^src/modules/[^/]+/(infrastructure|application)/',
          '^src/shared/(db|email|jobs|composition)',
          'node_modules/(drizzle-orm|postgres)/',
        ],
      },
    },
    {
      name: 'modules-via-public-api',
      severity: 'error',
      comment:
        'Bir modül başka bir modüle yalnızca onun index.ts dosyası üzerinden erişir (ARCHITECTURE §4.2).',
      from: {
        path: '^src/modules/([^/]+)/',
        pathNot: '^src/modules/[^/]+/infrastructure/schema\\.ts$',
      },
      to: { path: '^src/modules/(?!$1/)[^/]+/(?!index\\.ts$)' },
    },
    {
      name: 'schema-to-schema-only',
      severity: 'error',
      comment:
        'İstisna yalnızca tablo tanımları arasındaki yabancı anahtarlar içindir: schema.ts başka bir modülün yalnızca schema.ts dosyasını içe aktarabilir.',
      from: { path: '^src/modules/([^/]+)/infrastructure/schema\\.ts$' },
      to: {
        path: '^src/modules/(?!$1/)[^/]+/',
        pathNot: [
          '^src/modules/[^/]+/infrastructure/schema\\.ts$',
          '^src/modules/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'tests-not-imported',
      severity: 'error',
      comment: 'Üretim kodu test dosyalarını içe aktaramaz.',
      from: { path: '^src/', pathNot: '\\.test\\.ts$' },
      to: { path: ['\\.test\\.ts$', '^tests/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(\\.next|node_modules|drizzle)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
  },
};
