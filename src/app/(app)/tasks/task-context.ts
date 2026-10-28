/** Görev bileşenlerinin ihtiyaç duyduğu sunum bağlamı: çalışma alanı ve kullanıcının tarih tercihleri. */
export type TaskUiContext = {
  workspaceId: string;
  timezone: string;
  weekStart: number;
  timeFormat: '24h' | '12h';
};
