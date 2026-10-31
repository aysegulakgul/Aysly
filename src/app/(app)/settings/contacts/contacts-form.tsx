'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiDelete, apiPatch, apiPost } from '@/client/api';
import type { ContactView } from '@/modules/contacts';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { PROJECT_COLOR_NAMES } from '../../projects/project-color';
import { Avatar } from '../../tasks/pills';
import { useFormFeedback } from '../form-feedback';

/** D-097: ekip arkadaşları; görevlere atanır ve Paylaş penceresinde davet edilir. */
export function ContactsForm({
  contacts,
  workspaceId,
}: {
  contacts: ContactView[];
  workspaceId: string;
}) {
  const t = useTranslations('contacts');
  const tColors = useTranslations('projects.color');
  const router = useRouter();
  const toFeedback = useFormFeedback();
  const base = `/api/v1/workspaces/${workspaceId}/contacts` as const;
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [deleting, setDeleting] = useState<ContactView | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await apiPost(base, {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? '') || null,
      color: PROJECT_COLOR_NAMES[contacts.length % PROJECT_COLOR_NAMES.length],
    });
    if (!result.ok) {
      const feedback = toFeedback(result);
      setFields(feedback.fields);
      setMessage(feedback.message);
      return;
    }
    setFields({});
    setMessage(undefined);
    form.reset();
    router.refresh();
  }

  async function save(contact: ContactView, body: Record<string, string | null>) {
    const result = await apiPatch(`${base}/${contact.id}`, body);
    setMessage(result.ok ? undefined : t('failed'));
    router.refresh();
  }

  async function remove() {
    const contact = deleting;
    setDeleting(null);
    if (!contact) return;
    const result = await apiDelete(`${base}/${contact.id}`);
    if (!result.ok) setMessage(t('failed'));
    router.refresh();
  }

  return (
    <>
      <Panel>
        <SectionHeading>{t('addTitle')}</SectionHeading>
        <p className="text-sm text-text-secondary">{t('addDescription')}</p>
        {message ? <Banner>{message}</Banner> : null}
        <form onSubmit={add} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input name="name" label={t('name')} error={fields.name} autoComplete="off" />
          </div>
          <div className="flex-1">
            <Input
              name="email"
              type="email"
              label={t('email')}
              error={fields.email}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary" className="sm:mt-7">
            {t('add')}
          </Button>
        </form>
      </Panel>
      <Panel>
        <SectionHeading>{t('listTitle', { count: contacts.length })}</SectionHeading>
        {contacts.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col">
            {contacts.map((c) => (
              <li
                key={`${c.id}-${c.name}-${c.email}-${c.color}`}
                data-contact-row
                className="flex flex-wrap items-center gap-3 border-b border-border py-2"
              >
                <Avatar name={c.name} color={c.color} />
                <input
                  defaultValue={c.name}
                  aria-label={t('nameOf', { name: c.name })}
                  maxLength={100}
                  onBlur={(e) =>
                    e.target.value.trim() !== c.name && void save(c, { name: e.target.value })
                  }
                  className="min-h-9 min-w-0 flex-1 rounded-sm bg-transparent px-2 text-sm text-text hover:bg-surface-muted"
                />
                <input
                  defaultValue={c.email ?? ''}
                  type="email"
                  aria-label={t('emailOf', { name: c.name })}
                  placeholder={t('email')}
                  onBlur={(e) =>
                    e.target.value.trim() !== (c.email ?? '') &&
                    void save(c, { email: e.target.value || null })
                  }
                  className="min-h-9 min-w-0 flex-1 rounded-sm bg-transparent px-2 text-sm text-text placeholder:text-text-secondary hover:bg-surface-muted"
                />
                <select
                  value={c.color}
                  aria-label={t('colorOf', { name: c.name })}
                  onChange={(e) => void save(c, { color: e.target.value })}
                  className="min-h-9 rounded-sm border border-border bg-surface px-2 text-sm text-text"
                >
                  {PROJECT_COLOR_NAMES.map((color) => (
                    <option key={color} value={color}>
                      {tColors(color)}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" onClick={() => setDeleting(c)}>
                  {t('delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle', { name: deleting?.name ?? '' })}
        description={t('deleteBody')}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => void remove()}>
            {t('delete')}
          </Button>
          <Button onClick={() => setDeleting(null)}>{t('cancel')}</Button>
        </div>
      </Dialog>
    </>
  );
}
