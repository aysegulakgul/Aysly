import { getCurrentActor } from '@/modules/identity';
import { postProject } from '@/modules/projects';
import { getProjects } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: proje listesi (ilerlemeyle) ve oluşturma (BR-PROJ-001). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getProjects });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postProject });
