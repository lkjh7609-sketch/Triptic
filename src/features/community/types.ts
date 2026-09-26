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
export type ReportTargetType = 'post' | 'comment' | 'user' | 'image' | 'companion_post' | 'companion_application';
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

/** 06-community.md 확장(0032) — 동행찾기(모집글/신청/매칭 멤버) */
export type CompanionPostStatus =
  | 'pending_review'
  | 'recruiting'
  | 'matched'
  | 'closed'
  | 'cancelled'
  | 'hidden'
  | 'removed';
export type CompanionApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'removed';

export interface CompanionPost {
  id: string;
  author_id: string;
  destination_id: string | null;
  title: string;
  body: string;
  start_date: string;
  end_date: string;
  group_size: number;
  status: CompanionPostStatus;
  report_count: number;
  matched_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author?: CommunityProfile;
  destination?: Pick<Destination, 'id' | 'slug' | 'name'>;
  /** 내가 이 글에 낸 신청(없으면 아직 지원 안 함) */
  myApplication?: CompanionApplication;
}

export interface CompanionApplication {
  id: string;
  post_id: string;
  applicant_id: string;
  message: string | null;
  status: CompanionApplicationStatus;
  created_at: string;
  updated_at: string;
  applicant?: CommunityProfile;
}

/** 매칭 멤버(주최자 + accepted 신청자) — 별도 테이블 없이 파생 데이터로 조합한다 */
export interface CompanionMatchMember {
  user_id: string;
  role: 'organizer' | 'member';
  profile?: CommunityProfile;
}

/** 신고 사유 순서(표시 이름은 community:report.reason.* 번역 키) */
export const REPORT_REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'illegal',
  'misinformation',
  'impersonation',
  'other',
];
