/** 푸시 문구 — 받는 사람의 언어(profiles.locale)로. 글·댓글 내용은 잠금 화면에 보이지 않게 담지 않는다 */
export type PushLocale = 'ko' | 'en' | 'ja' | 'zh-TW';

export function normalizeLocale(value: string | null | undefined): PushLocale {
  if (!value) return 'ko';
  if (value.startsWith('ko')) return 'ko';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('zh')) return 'zh-TW';
  return 'en';
}

const COMMENT: Record<PushLocale, (name: string) => { title: string; body: string }> = {
  ko: (n) => ({ title: '새 댓글', body: `${n}님이 내 글에 댓글을 남겼어요` }),
  en: (n) => ({ title: 'New comment', body: `${n} commented on your post` }),
  ja: (n) => ({ title: '新しいコメント', body: `${n}さんがあなたの投稿にコメントしました` }),
  'zh-TW': (n) => ({ title: '新留言', body: `${n} 在你的貼文留言了` }),
};

const REPLY: Record<PushLocale, (name: string) => { title: string; body: string }> = {
  ko: (n) => ({ title: '새 답글', body: `${n}님이 내 댓글에 답글을 남겼어요` }),
  en: (n) => ({ title: 'New reply', body: `${n} replied to your comment` }),
  ja: (n) => ({ title: '新しい返信', body: `${n}さんがあなたのコメントに返信しました` }),
  'zh-TW': (n) => ({ title: '新回覆', body: `${n} 回覆了你的留言` }),
};

const TRIP: Record<PushLocale, (title: string) => { title: string; body: string }> = {
  ko: (t) => ({ title: '3일 뒤 출발이에요', body: `${t} — 출발 전 체크리스트를 확인해 보세요` }),
  en: (t) => ({ title: 'Leaving in 3 days', body: `${t} — check your pre-trip checklist` }),
  ja: (t) => ({ title: '3日後に出発です', body: `${t} — 出発前のチェックリストを確認しましょう` }),
  'zh-TW': (t) => ({ title: '3 天後出發', body: `${t} — 看看出發前的檢查清單吧` }),
};

export function commentMessage(locale: PushLocale, actorName: string) {
  return COMMENT[locale](actorName);
}
export function replyMessage(locale: PushLocale, actorName: string) {
  return REPLY[locale](actorName);
}
export function tripReminderMessage(locale: PushLocale, tripTitle: string) {
  return TRIP[locale](tripTitle);
}
