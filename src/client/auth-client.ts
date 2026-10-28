'use client';

import { createAuthClient } from 'better-auth/react';

/** Better Auth uç noktalarına (/api/auth/*) giden tipli istemci. Bileşenler veri erişimini yalnızca src/client üzerinden yapar. */
export const authClient = createAuthClient({ basePath: '/api/auth' });
