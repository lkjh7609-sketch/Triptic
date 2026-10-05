/**
 * 메일 문구(한국어·영어·일본어·번체) — 서비스 이용 안내만. 홍보 문구를 넣으면 수신 동의가 필요해지므로 넣지 않는다.
 * 순수 함수(비밀·네트워크 없음)라 테스트로 4개 언어 모두 확인한다.
 */
export type MailLocale = 'ko' | 'en' | 'ja' | 'zh-TW';
export type MailKind = 'welcome' | 'trip_reminder' | 'account_deleted';

export const SITE = 'https://triptic.my';
export const CONTACT = 'admin@triptic.my';
const BRAND = '#274C46';

export function normalizeLocale(value: string | null | undefined): MailLocale {
  const v = (value ?? '').toLowerCase();
  if (v.startsWith('ko')) return 'ko';
  if (v.startsWith('ja')) return 'ja';
  if (v.startsWith('zh')) return 'zh-TW';
  if (v.startsWith('en')) return 'en';
  return 'ko';
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

interface Copy {
  greeting: (name: string) => string;
  footer: string;
  welcome: { subject: string; lines: string[]; cta: string };
  reminder: { subject: (label: string) => string; intro: (title: string, date: string) => string; lines: string[]; cta: string; off: string };
  deleted: { subject: string; lines: string[] };
}

const COPY: Record<MailLocale, Copy> = {
  ko: {
    greeting: (n) => `${n}님, 안녕하세요.`,
    footer: `이 메일은 Triptic 서비스 이용과 관련한 안내예요. 궁금한 점은 ${CONTACT}로 답장해 주세요.`,
    welcome: {
      subject: '[Triptic] 가입해 주셔서 고맙습니다',
      lines: ['Triptic에 가입해 주셔서 고맙습니다.', '항공권·호텔 예약 서류를 올리면 일정이 자동으로 정리되고, 여행지별 게시판에서 다른 여행자의 후기와 동행도 만날 수 있어요.', '첫 여행을 만들어 보세요.'],
      cta: 'Triptic 열기',
    },
    reminder: {
      subject: (label) => `[Triptic] 출발 3일 전이에요 · ${label}`,
      intro: (title, date) => `'${title}' 여행이 ${date}에 시작해요. 3일 남았어요.`,
      lines: ['출발 전에 항공권·숙소 예약, 여권 유효기간, 환전과 짐 목록을 한 번 더 확인해 보세요.'],
      cta: '내 일정 보기',
      off: '출발 전 리마인더는 설정 > 알림에서 끌 수 있어요.',
    },
    deleted: {
      subject: '[Triptic] 회원 탈퇴가 완료되었어요',
      lines: ['회원 탈퇴가 완료되었어요. 계정과 여행·서류·게시글 등 저장된 데이터가 삭제되었어요.', '다시 이용하고 싶으시면 언제든 새로 가입하실 수 있어요. 그동안 Triptic을 이용해 주셔서 고맙습니다.', '본인이 요청하지 않았다면 바로 아래 주소로 알려 주세요.'],
    },
  },
  en: {
    greeting: (n) => `Hi ${n},`,
    footer: `This is a service message about your Triptic account. Questions? Just reply to ${CONTACT}.`,
    welcome: {
      subject: '[Triptic] Thanks for joining',
      lines: ['Thanks for joining Triptic.', 'Upload your flight and hotel bookings and your itinerary is organized for you. You can also read other travelers’ stories and find travel companions in each destination board.', 'Start by creating your first trip.'],
      cta: 'Open Triptic',
    },
    reminder: {
      subject: (label) => `[Triptic] 3 days to go · ${label}`,
      intro: (title, date) => `Your trip “${title}” starts on ${date} — 3 days to go.`,
      lines: ['Take a moment to re-check your flight and hotel bookings, passport validity, currency exchange and packing list.'],
      cta: 'View my itinerary',
      off: 'You can turn off pre-departure reminders in Settings > Notifications.',
    },
    deleted: {
      subject: '[Triptic] Your account has been deleted',
      lines: ['Your account has been deleted, along with your trips, documents, posts and other saved data.', 'You’re welcome to sign up again any time. Thank you for using Triptic.', 'If you did not request this, please let us know at the address below right away.'],
    },
  },
  ja: {
    greeting: (n) => `${n}さん、こんにちは。`,
    footer: `このメールはTripticのご利用に関するお知らせです。ご不明な点は ${CONTACT} までご返信ください。`,
    welcome: {
      subject: '[Triptic] ご登録ありがとうございます',
      lines: ['Tripticにご登録いただきありがとうございます。', '航空券・ホテルの予約書類をアップロードすると日程が自動で整理され、行き先別の掲示板で他の旅行者の体験談や旅の仲間にも出会えます。', 'まずは最初の旅行を作ってみてください。'],
      cta: 'Tripticを開く',
    },
    reminder: {
      subject: (label) => `[Triptic] 出発まであと3日 · ${label}`,
      intro: (title, date) => `旅行「${title}」は${date}に出発です。あと3日です。`,
      lines: ['出発前に、航空券・宿泊の予約、パスポートの有効期限、両替、持ち物リストをもう一度ご確認ください。'],
      cta: '日程を見る',
      off: '出発前リマインダーは 設定 > 通知 でオフにできます。',
    },
    deleted: {
      subject: '[Triptic] 退会が完了しました',
      lines: ['退会が完了しました。アカウントと、旅行・書類・投稿などの保存データを削除しました。', 'またご利用になりたい場合は、いつでも新規登録いただけます。ご利用ありがとうございました。', 'ご自身で手続きしていない場合は、下記のアドレスまですぐにご連絡ください。'],
    },
  },
  'zh-TW': {
    greeting: (n) => `${n} 您好，`,
    footer: `這封信是與 Triptic 服務使用相關的通知。如有疑問，請直接回覆 ${CONTACT}。`,
    welcome: {
      subject: '[Triptic] 感謝您的加入',
      lines: ['感謝您加入 Triptic。', '上傳機票與飯店訂單，行程就會自動整理好；您也可以在各目的地的討論板閱讀其他旅人的心得，並找到旅伴。', '先來建立您的第一趟旅行吧。'],
      cta: '開啟 Triptic',
    },
    reminder: {
      subject: (label) => `[Triptic] 距離出發還有 3 天 · ${label}`,
      intro: (title, date) => `旅行「${title}」將於 ${date} 出發，還有 3 天。`,
      lines: ['出發前，請再確認機票與住宿訂位、護照效期、換匯與行李清單。'],
      cta: '查看我的行程',
      off: '出發前提醒可在「設定 > 通知」中關閉。',
    },
    deleted: {
      subject: '[Triptic] 您的帳號已刪除',
      lines: ['您的帳號已刪除，行程、文件、貼文等已儲存的資料也一併刪除。', '若想再次使用，隨時都可以重新註冊。感謝您使用 Triptic。', '若這不是您本人的操作，請立即透過下方信箱告訴我們。'],
    },
  },
};

function layout(locale: MailLocale, name: string, paragraphs: string[], cta: { label: string; url: string } | null, extra: string[], footerExtra?: string): { html: string; text: string } {
  const c = COPY[locale];
  const greeting = c.greeting(name);
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:0;background:#F7F6F2;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#1F2427;line-height:1.6;">
<div style="font-size:20px;font-weight:700;color:${BRAND};margin-bottom:20px;">Triptic</div>
<div style="background:#ffffff;border:1px solid #E5E4DE;border-radius:16px;padding:24px;">
<p style="margin:0 0 14px;font-size:15px;">${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;">${escapeHtml(p)}</p>`).join('\n')}
${cta ? `<p style="margin:20px 0 4px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px;">${escapeHtml(cta.label)}</a></p>` : ''}
${extra.map((p) => `<p style="margin:14px 0 0;font-size:14px;">${escapeHtml(p)}</p>`).join('\n')}
</div>
<p style="margin:18px 4px 0;font-size:12px;color:#6B6560;">${escapeHtml(c.footer)}${footerExtra ? `<br>${escapeHtml(footerExtra)}` : ''}</p>
</div></body></html>`;
  const text = [greeting, '', ...paragraphs, ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), ...(extra.length ? ['', ...extra] : []), '', c.footer, ...(footerExtra ? [footerExtra] : [])].join('\n');
  return { html, text };
}

export function welcomeMail(locale: MailLocale, name: string): Mail {
  const c = COPY[locale];
  const m = layout(locale, name, c.welcome.lines, { label: c.welcome.cta, url: SITE }, []);
  return { subject: c.welcome.subject, html: m.html, text: m.text };
}

export function tripReminderMail(locale: MailLocale, name: string, trip: { id: string; title: string; city: string; startDate: string }): Mail {
  const c = COPY[locale];
  const title = trip.title || trip.city;
  const m = layout(locale, name, [c.reminder.intro(title, trip.startDate), ...c.reminder.lines], { label: c.reminder.cta, url: `${SITE}/plan/${trip.id}` }, [], c.reminder.off);
  return { subject: c.reminder.subject(title), html: m.html, text: m.text };
}

export function accountDeletedMail(locale: MailLocale, name: string): Mail {
  const c = COPY[locale];
  const m = layout(locale, name, c.deleted.lines, null, [CONTACT]);
  return { subject: c.deleted.subject, html: m.html, text: m.text };
}
