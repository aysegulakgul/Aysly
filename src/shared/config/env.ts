import { z } from 'zod';

/**
 * Ortam değişkenleri tek yerde doğrulanır; eksik veya geçersizse uygulama başlamaz (ARCHITECTURE §12.2).
 * İstemciye açık değişken yoktur; bu modül yalnızca sunucuda kullanılır.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  EMAIL_TRANSPORT: z.enum(['smtp', 'memory']).default('smtp'),
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  EMAIL_FROM: z.string().min(3).default('Aysly <no-reply@aysly.local>'),
  SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ');
    // Değerler değil yalnızca alan adları yazılır (SECURITY §7).
    throw new Error(
      `Geçersiz veya eksik ortam değişkenleri: ${fields}. .env.example dosyasına bakın.`,
    );
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
