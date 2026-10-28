/** Görev bileşenlerinin ihtiyaç duyduğu sunum bağlamı: çalışma alanı, projeler ve kullanıcının tarih tercihleri. */
export type TaskUiContext = {
  workspaceId: string;
  timezone: string;
  weekStart: number;
  timeFormat: '24h' | '12h';
  /** BR-DATE-003: kullanıcının saat dilimindeki bugün (`YYYY-MM-DD`). */
  today: string;
  /** Taşıma ve proje seçimi için etkin projeler; Inbox ilk sırada. */
  projects: { id: string; name: string; kind: 'inbox' | 'standard' }[];
};
