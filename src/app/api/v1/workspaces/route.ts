import { getCurrentActor } from '@/modules/identity';
import { getWorkspaces } from '@/modules/workspaces';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §4: aktörün çalışma alanları. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getWorkspaces });
