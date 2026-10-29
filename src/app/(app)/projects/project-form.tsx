'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import type { ProjectView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';
import { cn } from '@/ui/cn';
import { PROJECT_COLOR_NAMES, PROJECT_COLOR_VALUES, type ProjectColorName } from './project-color';

const NAME_MAX = 120; // BR-PROJ-001
const DESCRIPTION_MAX = 5000;

/**
 * Proje oluşturma ve düzenleme penceresi (FR-PROJ-01). Figma'da form yok (D-065): mevcut UI/Panel, UI/Input ve
 * düğmelerle kuruldu. Renk 12 renklik paletten seçilir; simge yok (D-082). BR-PROJ-001: aynı adlı aktif proje
 * varsa uyarı gösterilir ama oluşturma engellenmez. Oluşturmada idempotency anahtarı (BR-TASK-007 ile aynı).
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  workspaceId,
  project,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Verilirse düzenleme, verilmezse oluşturma. */
  project?: Pick<ProjectView, 'id' | 'name' | 'description' | 'color' | 'version'>;
  existingNames: readonly string[];
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const colorLegend = useId();
  const descriptionId = useId();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState<ProjectColorName>(
    (project?.color as ProjectColorName) ?? 'indigo',
  );
  const [error, setError] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const key = useRef(crypto.randomUUID());

  const trimmed = name.trim();
  const sameName =
    trimmed.length > 0 &&
    trimmed.toLocaleLowerCase('tr') !== project?.name.toLocaleLowerCase('tr') &&
    existingNames.some((n) => n.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return setError(t('form.nameRequired'));
    if (trimmed.length > NAME_MAX) return setError(t('form.nameTooLong'));
    if (description.length > DESCRIPTION_MAX) return setError(t('form.descriptionTooLong'));
    setError(undefined);
    setFailed(false);
    setPending(true);
    const body = { name: trimmed, description: description.trim() ? description : null, color };
    const base = `/api/v1/workspaces/${workspaceId}/projects` as const;
    const result = project
      ? await apiPatch<ProjectView>(`${base}/${project.id}`, { version: project.version, ...body })
      : await apiPost<ProjectView>(base, body, { 'Idempotency-Key': key.current });
    setPending(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    key.current = crypto.randomUUID();
    onOpenChange(false);
    if (project) router.refresh();
    else router.push(`/projects/${result.data.id}` as Route);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? t('form.editTitle') : t('form.createTitle')}
    >
      <form onSubmit={submit} className="flex w-full flex-col gap-4" noValidate>
        {failed ? <Banner>{t('form.failed')}</Banner> : null}
        <Input
          label={t('form.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX + 20}
          error={error}
          autoFocus
          required
        />
        {sameName ? <p className="text-sm text-warning">{t('form.sameName')}</p> : null}
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={descriptionId} className="text-sm text-text-secondary">
            {t('form.description')}
          </label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-sm border border-border bg-page p-3 text-base text-text"
          />
        </div>
        <fieldset className="flex flex-col gap-2" aria-labelledby={colorLegend}>
          <legend id={colorLegend} className="text-sm text-text-secondary">
            {t('form.color')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLOR_NAMES.map((c) => (
              <label
                key={c}
                title={t(`color.${c}`)}
                className={cn(
                  'flex size-11 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                  color === c ? 'border-2 border-primary' : 'border border-border',
                )}
              >
                <input
                  type="radio"
                  name="project-color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="sr-only"
                  aria-label={t(`color.${c}`)}
                />
                <span
                  aria-hidden="true"
                  className="size-5 rounded-full"
                  style={{ backgroundColor: PROJECT_COLOR_VALUES[c] }}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={pending}>
            {project ? t('form.save') : t('form.create')}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
