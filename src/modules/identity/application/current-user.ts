/** Oturumdaki kullanıcı (aktör). Yetkilendirme her istekte sunucuda bundan başlar (BR-PERM-001). */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};
