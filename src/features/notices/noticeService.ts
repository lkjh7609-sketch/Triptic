import { getSupabaseClient } from '@/shared/api/supabaseClient';

export type AnnouncementKind = 'notice' | 'update';

/** 공지·업데이트 내역(0088 announcements) — 누구나 읽고(공개된 것만) 운영자만 쓴다 */
export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  /** 업데이트 내역이면 앱 버전(예: 3.1.0) */
  version: string | null;
  pinned: boolean;
  published: boolean;
  published_at: string;
  updated_at: string;
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as Announcement[]) ?? [];
}

/** 운영자 — 공개 전(초안) 것도 함께(RLS가 관리자에게만 보여 준다) */
export async function adminListAnnouncements(): Promise<Announcement[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as Announcement[]) ?? [];
}

export interface AnnouncementInput {
  id?: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  version: string;
  pinned: boolean;
  published: boolean;
}

export async function saveAnnouncement(input: AnnouncementInput, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const row = {
    kind: input.kind,
    title: input.title.trim(),
    body: input.body.trim(),
    version: input.version.trim() || null,
    pinned: input.pinned,
    published: input.published,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from('announcements').update(row).eq('id', input.id)
    : await supabase.from('announcements').insert({ ...row, created_by: userId });
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
