'use client';

import { Markdown } from '@tiptap/markdown';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { cn } from '@/ui/cn';

/**
 * Not editörü (D-042, D-090): Tiptap; başlık, liste, yapılacak listesi, bağlantı, kod. İçerik Markdown olarak
 * alınır ve verilir. Biçim araç çubuğu Figma'da yok (D-065): Markdown kısayolları (`# `, `- `, `[ ] `, `` ` ``)
 * ve klavye kısayolları birincil yoldur; araç çubuğu düğmeleri ekran okuyucu etiketlidir.
 */
export function NoteEditor({
  markdown,
  onChange,
  onBlur,
  readOnly = false,
  label,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
  onBlur: () => void;
  readOnly?: boolean;
  label: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content: markdown,
    contentType: 'markdown',
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        class:
          'prose-aysly min-h-[240px] w-full rounded-sm p-2 text-base text-text focus:outline-none',
        'data-note-editor': '',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
    onBlur: () => onBlur(),
  });
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className="flex flex-col gap-2">
      {readOnly ? null : <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const t = useTranslations('notes.toolbar');
  if (!editor) return null;
  const buttons: { key: string; glyph: string; active: boolean; run: () => void }[] = [
    {
      key: 'h2',
      glyph: 'H',
      active: editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: 'bold',
      glyph: 'B',
      active: editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      glyph: 'I',
      active: editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'bullet',
      glyph: '•',
      active: editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'ordered',
      glyph: '1.',
      active: editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: 'task',
      glyph: '☐',
      active: editor.isActive('taskList'),
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: 'code',
      glyph: '</>',
      active: editor.isActive('codeBlock'),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      key: 'link',
      glyph: '🔗︎',
      active: editor.isActive('link'),
      run: () => {
        const previous = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt(t('linkPrompt'), previous ?? 'https://');
        if (url === null) return;
        if (url === '' || !/^(https?:|mailto:)/i.test(url))
          editor.chain().focus().unsetLink().run();
        else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      },
    },
  ];
  return (
    <div
      role="toolbar"
      aria-label={t('label')}
      className="flex flex-wrap gap-1 border-b border-border pb-2"
    >
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          aria-label={t(b.key)}
          aria-pressed={b.active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.run}
          className={cn(
            'flex size-11 items-center justify-center rounded-sm text-sm lg:size-8',
            b.active ? 'bg-support-1 text-primary' : 'text-text-secondary',
          )}
        >
          <span aria-hidden="true">{b.glyph}</span>
        </button>
      ))}
    </div>
  );
}
