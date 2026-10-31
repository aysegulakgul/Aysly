/** Oturumdaki kullanıcı (aktör). Yetkilendirme her istekte sunucuda bundan başlar (BR-PERM-001). */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** BR-ACC-005: silme talebi varsa zamanı; D-092 gereği uygulamaya yalnızca iptal ekranı açılır. */
  deletionRequestedAt: Date | null;
};
