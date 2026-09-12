import { getSessionUser } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_8iGNAP63ibPNdGtkE9zWnj1wN9rO';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? 'team_UPNw767CyDxHdQ4dWt0wqsSB';

const APP_VERSIONS = [
  {
    id: 'v1.0.0-stable',
    name: 'v1.0.0-stable',
    commit: 'c35552f8b4a792934ec000762a075488fbc325d1',
    description: 'Bản ổn định đã rà soát quyền truy cập và sao lưu.',
  },
] as const;

type Deployment = {
  uid: string;
  state?: string;
  readyState?: string;
  readySubstate?: string;
  isRollbackCandidate?: boolean;
  createdAt?: number;
  ready?: number;
  meta?: Record<string, unknown>;
};

function vercelHeaders() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function deploymentCommit(deployment: Deployment) {
  const value = deployment.meta?.githubCommitSha;
  return typeof value === 'string' ? value : '';
}

async function getVersionDeployments(headers: Record<string, string>) {
  const params = new URLSearchParams({
    projectId: VERCEL_PROJECT_ID,
    teamId: VERCEL_TEAM_ID,
    target: 'production',
    state: 'READY',
    limit: '100',
  });
  const response = await fetch(`https://api.vercel.com/v7/deployments?${params}`, {
    headers,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Vercel deployment lookup failed');
  const payload = (await response.json()) as { deployments?: Deployment[] };
  return payload.deployments ?? [];
}

function toVersion(version: (typeof APP_VERSIONS)[number], deployments: Deployment[]) {
  const deployment = deployments.find((item) => deploymentCommit(item) === version.commit);
  const ready = deployment?.state === 'READY' || deployment?.readyState === 'READY';
  return {
    ...version,
    available: Boolean(ready && deployment?.isRollbackCandidate),
    deploymentFound: Boolean(deployment),
    deployedAt: deployment?.ready ?? deployment?.createdAt ?? null,
  };
}

async function requireAdmin(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return { error: Response.json({ error: configurationError() }, { status: 503 }) };
  const user = await getSessionUser(db, request);
  if (!user || user.role !== 'admin' || user.impersonatedBy)
    return { error: Response.json({ error: 'Chỉ Admin được quản lý phiên bản ứng dụng.' }, { status: 403 }) };
  return { db };
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ('error' in access) return access.error;
  const headers = vercelHeaders();
  if (!headers)
    return Response.json({ error: 'Chưa cấu hình quyền khôi phục phiên bản.' }, { status: 503 });
  try {
    const deployments = await getVersionDeployments(headers);
    return Response.json({ versions: APP_VERSIONS.map((version) => toVersion(version, deployments)) });
  } catch {
    return Response.json({ error: 'Chưa thể tải danh sách phiên bản.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if ('error' in access) return access.error;
  const headers = vercelHeaders();
  if (!headers)
    return Response.json({ error: 'Chưa cấu hình quyền khôi phục phiên bản.' }, { status: 503 });
  try {
    const body = (await request.json()) as { versionId?: string };
    const version = APP_VERSIONS.find((item) => item.id === body.versionId);
    if (!version) return Response.json({ error: 'Phiên bản không hợp lệ.' }, { status: 400 });

    const deployments = await getVersionDeployments(headers);
    const deployment = deployments.find(
      (item) => deploymentCommit(item) === version.commit
        && (item.state === 'READY' || item.readyState === 'READY')
        && item.isRollbackCandidate,
    );
    if (!deployment)
      return Response.json({ error: 'Phiên bản này hiện chưa đủ điều kiện khôi phục trên Vercel.' }, { status: 409 });

    const params = new URLSearchParams({
      teamId: VERCEL_TEAM_ID,
      description: `Khôi phục ${version.name} từ Tùy chỉnh ứng dụng`,
    });
    const response = await fetch(
      `https://api.vercel.com/v1/projects/${VERCEL_PROJECT_ID}/rollback/${deployment.uid}?${params}`,
      { method: 'POST', headers, cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Vercel rollback failed');
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Chưa thể khôi phục phiên bản ứng dụng.' }, { status: 503 });
  }
}
