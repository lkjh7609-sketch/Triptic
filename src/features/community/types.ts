/** 06-community.md §3 스키마와 1:1 대응하는 클라이언트 타입 */
import type { PostCategory } from './postMeta';

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
export type ReportTargetType =
  | 'post'
  | 'comment'
  | 'user'
  | 'image'
  | 'companion_post'
  | 'companion_application'
  | 'companion_message';
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
  /** 영문 이름(도시 채널 제목용, getDestinationBySlug에서만 채움) */
  nameEn?: string;
}

/** 한국어·영어 두 벌로 저장되는 문구(일·번체는 영어로 보여준다) */
export interface LocalizedText {
  ko: string;
  en: string;
}

export type GuidePriceKey = 'coffee' | 'taxi' | 'meal';

/** 물가 예시 한 줄 — 금액은 그 도시 통화 기준, max가 null이면 한 가지 값 */
export interface GuidePrice {
  key: GuidePriceKey;
  /** 식사처럼 도시마다 다른 항목의 이름(없으면 key의 기본 문구) */
  label?: LocalizedText;
  min: number;
  max: number | null;
}

/** 도시 채널의 안내 내용(0075 destination_guides) */
export interface DestinationGuide {
  destination_id: string;
  landmarks: LocalizedText[];
  trip_length: LocalizedText | null;
  best_season: LocalizedText | null;
  prices: GuidePrice[];
}

export interface CommunityProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  /** "관리자" 배지 표시용(community_profiles 뷰, 0041) */
  is_admin: boolean;
  /** 동행 별점 평균/개수(community_profiles 뷰, 0047) — 받은 후기가 없으면 null/0 */
  rating_avg?: number | string | null;
  rating_count?: number | null;
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
  /** 작성자가 "첨부한 일정 복사 허용"을 켰는지(0070) */
  allow_copy?: boolean;
  /** 이 글을 저장(북마크)한 사람 수(0070, get_post_bookmark_counts로 채움) */
  bookmark_count?: number;
  /** 내가 저장했는지 */
  bookmarkedByMe?: boolean;
  /** 글 분류(0077) — 올린 뒤에는 바꿀 수 없다 */
  category: PostCategory;
  /** 태그(최대 3개, 서버가 심사·정리해서 저장) */
  tags: string[];
  /** 조회수(로그인한 사용자만, 글마다 한 번) */
  view_count: number;
  /** 관리자가 도시의 '트립틱 공식 필독 가이드'로 고정한 시각 */
  pinned_at: string | null;
  /** 질문(qna) 글에서 작성자가 채택한 댓글 */
  accepted_comment_id: string | null;
  /** 채택된 댓글(채널 목록 카드용 — 아직 공개 상태인 것만) */
  accepted_comment?: { id: string; body: string; created_at: string; author?: CommunityProfile };
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
  /** 날짜 미정(협의)이면 start_date·end_date 둘 다 null(0072) */
  start_date: string | null;
  end_date: string | null;
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
  /** 원하는 나이대(비어 있으면 무관) — 'COMPANION_AGES' 중 여러 개(0070) */
  pref_ages?: string[];
  /** 원하는 성별(0070) */
  pref_gender?: 'any' | 'female' | 'male';
  /** 태그(최대 3개, 'COMPANION_TAGS'의 키)(0070) */
  tags?: string[];
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
/** 내 동행 목록 항목 — closed인데 아직 후기를 안 남겼으면 needsReview */
export type MyCompanionPost = CompanionPost & { needsReview: boolean };

export interface CompanionMatchMember {
  user_id: string;
  role: 'organizer' | 'member';
  profile?: CommunityProfile;
}

/** 0033: 동행 채팅 — 별도 "방" 테이블 없이 post_id로 바로 묶인다 */
export type CompanionMessageStatus = 'published' | 'hidden' | 'removed';

export interface CompanionMessage {
  id: string;
  post_id: string;
  sender_id: string;
  body: string;
  status: CompanionMessageStatus;
  report_count: number;
  created_at: string;
  sender?: CommunityProfile;
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
