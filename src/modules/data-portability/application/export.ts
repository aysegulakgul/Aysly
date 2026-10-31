import type { Clock } from '@/shared/kernel/clock';
import { validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

/** D-046 / D-059: sürümlü JSON şeması. Alan adları veritabanı kolon adlarıdır (snake_case). */
export const EXPORT_FORMAT = 'aysly-export';
export const EXPORT_VERSION = 1;

type Row = Record<string, unknown>;

/** Dışa aktarılan içerik. Şifre hash'i, oturumlar, token'lar, idempotency ve denetim kayıtları yoktur (D-059). */
export type ExportData = {
  profile: Row;
  preferences: Row | null;
  workspace: Row;
  content: Record<string, Row[]>;
};

export type ExportDocument = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
} & ExportData;

/** Okuma portu: kullanıcının kendi profili ve üyesi olduğu çalışma alanının tüm içeriği (çöp kutusu dahil). */
export type ExportReader = {
  read(userId: string, workspaceId: string): Promise<ExportData>;
};

export type ExportDeps = {
  reader: ExportReader;
  clock: Clock;
  verifyPassword: (password: string) => Promise<boolean>;
};

/** FR-AUTH-09 / D-046 / D-055: şifreyle yeniden doğrulanan kullanıcı çalışma alanını JSON olarak indirir. */
export async function exportAccount(
  deps: ExportDeps,
  actor: { userId: string; workspaceId: string },
  command: { currentPassword: string },
): Promise<Result<ExportDocument, DomainError>> {
  if (!(await deps.verifyPassword(command.currentPassword))) {
    return err(validationError([{ field: 'currentPassword', reason: 'incorrect' }]));
  }
  const data = await deps.reader.read(actor.userId, actor.workspaceId);
  return ok({
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: deps.clock.now().toISOString(),
    ...data,
  });
}
