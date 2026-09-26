/** 06-community.md §3 스키마와 1:1 대응하는 클라이언트 타입 */

export type PostStatus = 'published' | 'pending_review' | 'hidden' | 'removed';
export type CommentStatus = 'published' | 'hidden' | 'removed';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'illegal'
  | 'misinformation'
  | 'impersonation'
  | 'other';
export type ReportTargetType = 'post' | 'comment' | 'user' | 'image';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type Locale = 'ko' | 'en' | 'zh-TW' | 'ja';

export interface Destination {
  id: string;
  slug: string;
  country_code: string;
  lat: number;
  lng: number;
  timezone: string;
  currency: string | null;
  cover_url: string | null;
  is_featured: boolean;
  sort_order: number;
  post_count: number;
  /** 현재 로케일 이름(조인 결과, 없으면 slug로 폴백) */
  name: string;
}

export interface CommunityProfile {
  id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface PostImage {
  id: string;
  post_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  position: number;
  status: 'published' | 'pending_review' | 'removed';
}

export interface Post {
  id: string;
  destination_id: string | null;
  author_id: string;
  body: string;
  language: string | null;
  trip_id: string | null;
  status: PostStatus;
  like_count: number;
  comment_count: number;
  report_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author?: CommunityProfile;
  destination?: Pick<Destination, 'id' | 'slug' | 'name'>;
  images?: PostImage[];
  /** 내가 좋아요를 눌렀는지(클라이언트에서 reactions 별도 조회 후 채움) */
  likedByMe?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  status: CommentStatus;
  created_at: string;
  deleted_at: string | null;
  author?: CommunityProfile;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  resolved_at: string | null;
  resolver_id: string | null;
  created_at: string;
}

export interface ModerationEvent {
  id: string;
  target_type: string;
  target_id: string;
  action: string;
  source: string;
  score: number | null;
  categories: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: '스팸/광고',
  harassment: '괴롭힘',
  hate: '혐오 발언',
  sexual: '성적인 콘텐츠',
  violence: '폭력적인 콘텐츠',
  illegal: '불법 행위',
  misinformation: '허위 정보',
  impersonation: '사칭',
  other: '기타',
};
