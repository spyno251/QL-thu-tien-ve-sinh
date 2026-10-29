import * as accessLogs from '@/lib/api-handlers/access-logs';
import * as auth from '@/lib/api-handlers/auth';
import * as backups from '@/lib/api-handlers/backups';
import * as data from '@/lib/api-handlers/data';
import * as logo from '@/lib/api-handlers/logo';
import * as presence from '@/lib/api-handlers/presence';
import * as recordHistory from '@/lib/api-handlers/record-history';
import * as versions from '@/lib/api-handlers/versions';

export const dynamic = 'force-dynamic';

type Handler = (request: Request) => Promise<Response | undefined>;
type HandlerModule = {
  GET?: Handler;
  POST?: Handler;
};

const handlers: Record<string, HandlerModule> = {
  'access-logs': accessLogs,
  auth,
  backups,
  data,
  logo,
  presence,
  'record-history': recordHistory,
  versions,
};

type RouteContext = {
  params: Promise<{ endpoint: string }>;
};

async function dispatch(
  method: keyof HandlerModule,
  request: Request,
  context: RouteContext,
) {
  const { endpoint } = await context.params;
  const route = handlers[endpoint];
  if (!route) return Response.json({ error: 'Không tìm thấy API.' }, { status: 404 });

  const handler = route[method];
  if (!handler) {
    return Response.json(
      { error: 'Phương thức không được hỗ trợ.' },
      { status: 405, headers: { Allow: allowedMethods(route) } },
    );
  }

  return handler(request);
}

function allowedMethods(route: HandlerModule) {
  return (['GET', 'POST'] as const).filter((method) => route[method]).join(', ');
}

export function GET(request: Request, context: RouteContext) {
  return dispatch('GET', request, context);
}

export function POST(request: Request, context: RouteContext) {
  return dispatch('POST', request, context);
}
