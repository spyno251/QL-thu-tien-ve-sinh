import { getSessionUser } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });
  const user = await getSessionUser(db, request);
  if (!user || user.role !== 'admin')
    return Response.json({ error: 'Chỉ Admin được tải logo lên.' }, { status: 403 });

  try {
    const { dataUrl } = (await request.json()) as { dataUrl?: string };
    const match = String(dataUrl ?? '').match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || !MIME_TYPES.has(match[1]))
      return Response.json({ error: 'Tệp logo không hợp lệ.' }, { status: 400 });
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024)
      return Response.json({ error: 'Logo cần nhỏ hơn 2 MB.' }, { status: 400 });
    const extension = match[1].split('/')[1] === 'jpeg' ? 'jpg' : match[1].split('/')[1];
    const path = `logos/${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage.from('app-assets').upload(path, bytes, {
      contentType: match[1],
      upsert: false,
    });
    if (error) throw error;
    const { data } = db.storage.from('app-assets').getPublicUrl(path);
    return Response.json({ url: data.publicUrl });
  } catch {
    return Response.json({ error: 'Chưa thể tải logo lên.' }, { status: 503 });
  }
}
