/**
 * 메일 문구(한국어·영어·일본어·번체) — 서비스 이용 안내만. 홍보 문구를 넣으면 수신 동의가 필요해지므로 넣지 않는다.
 * 순수 함수(비밀·네트워크 없음)라 테스트로 4개 언어 모두 확인한다.
 */
export type MailLocale = 'ko' | 'en' | 'ja' | 'zh-TW';
export type MailKind = 'welcome' | 'trip_reminder' | 'account_deleted';

export const SITE = 'https://triptic.my';
export const CONTACT = 'admin@triptic.my';
const BRAND = '#2E4F4F';

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
  /** 본문 아래 안내 — 문의 주소는 여기(본문 밖)로 뺀다 */
  footer: { contactPrefix: string; contactSuffix: string; service: string };
  welcome: { subject: string; headline: string; lead: string[]; tipsTitle: string; tips: string[]; cta: string };
  reminder: {
    subject: (label: string) => string;
    headline: string;
    intro: (title: string, date: string) => string;
    rows: { trip: string; city: string; date: string; dday: string };
    dday: string;
    tips: string[];
    cta: string;
    off: string;
  };
  deleted: { subject: string; headline: string; lines: string[]; ifNotYou: string };
}

const COPY: Record<MailLocale, Copy> = {
  ko: {
    greeting: (n) => `${n}님, 안녕하세요.`,
    footer: { contactPrefix: '궁금한 점은 ', contactSuffix: ' 로 문의해 주세요.', service: '이 메일은 Triptic 서비스 이용과 관련한 안내 메일이에요.' },
    welcome: {
      subject: '[Triptic] 가입해 주셔서 고맙습니다',
      headline: 'Triptic에 오신 것을 환영해요',
      lead: ['가입해 주셔서 고맙습니다.', '이제 여행 준비를 한 곳에서 시작해 보세요.'],
      tipsTitle: '이렇게 시작해 보세요',
      // 폰(390px)에서 한 줄에 들어가는 길이로
      tips: ['항공권·호텔 예약을 올리면 일정이 자동 정리돼요', '공유 링크로 친구와 같은 일정을 함께 편집해요', '여행지별 게시판에서 후기와 동행을 찾아보세요'],
      cta: 'Triptic 열기',
    },
    reminder: {
      subject: (label) => `[Triptic] 출발 3일 전이에요 · ${label}`,
      headline: '여행 출발이 3일 남았어요',
      intro: (title, date) => `'${title}' 여행이 ${date}에 시작해요. 출발 전에 아래 항목을 한 번 더 확인해 보세요.`,
      rows: { trip: '여행', city: '여행지', date: '출발일', dday: '남은 기간' },
      dday: '3일',
      tips: ['항공권·숙소 예약 확인', '여권 유효기간', '환전과 결제 수단', '짐 목록'],
      cta: '내 일정 보기',
      off: '출발 전 리마인더는 설정 > 알림에서 끌 수 있어요.',
    },
    deleted: {
      headline: '회원 탈퇴가 완료되었어요',
      subject: '[Triptic] 회원 탈퇴가 완료되었어요',
      lines: ['계정과 여행·서류·게시글 등 저장된 데이터가 모두 삭제되었어요.', '다시 이용하고 싶으시면 언제든 새로 가입하실 수 있어요. 그동안 Triptic을 이용해 주셔서 고맙습니다.'],
      ifNotYou: '본인이 요청하지 않았다면 아래 주소로 바로 알려 주세요.',
    },
  },
  en: {
    greeting: (n) => `Hi ${n},`,
    footer: { contactPrefix: 'Questions or need help? Contact us at ', contactSuffix: '.', service: 'This is a service message about your Triptic account.' },
    welcome: {
      subject: '[Triptic] Thanks for joining',
      headline: 'Welcome to Triptic',
      lead: ['Thanks for joining.', 'Start planning your trips in one place.'],
      tipsTitle: 'Get started',
      tips: ['Upload flight and hotel bookings and your itinerary is organized for you', 'Share a link to edit the same itinerary with friends', 'Read stories and find travel companions in each destination board'],
      cta: 'Open Triptic',
    },
    reminder: {
      subject: (label) => `[Triptic] 3 days to go · ${label}`,
      headline: 'Your trip starts in 3 days',
      intro: (title, date) => `Your trip “${title}” starts on ${date}. Take a moment to re-check the items below.`,
      rows: { trip: 'Trip', city: 'Destination', date: 'Departure', dday: 'Time left' },
      dday: '3 days',
      tips: ['Flight and hotel bookings', 'Passport validity', 'Currency exchange and payment', 'Packing list'],
      cta: 'View my itinerary',
      off: 'You can turn off pre-departure reminders in Settings > Notifications.',
    },
    deleted: {
      subject: '[Triptic] Your account has been deleted',
      headline: 'Your account has been deleted',
      lines: ['Your account and all saved data, including trips, documents and posts, have been deleted.', 'You’re welcome to sign up again any time. Thank you for using Triptic.'],
      ifNotYou: 'If you did not request this, please let us know at the address below right away.',
    },
  },
  ja: {
    greeting: (n) => `${n}さん、こんにちは。`,
    footer: { contactPrefix: 'ご不明な点やお困りのことがございましたら、', contactSuffix: ' までお問い合わせください。', service: 'このメールはTripticのご利用に関するお知らせです。' },
    welcome: {
      subject: '[Triptic] ご登録ありがとうございます',
      headline: 'Tripticへようこそ',
      lead: ['ご登録ありがとうございます。', '旅行の準備を一か所で始めましょう。'],
      tipsTitle: 'はじめ方',
      tips: ['航空券・ホテルの予約書類をアップロードすると日程が自動で整理されます', '共有リンクで友達と同じ日程を一緒に編集できます', '行き先別の掲示板で体験談を読み、旅の仲間も探せます'],
      cta: 'Tripticを開く',
    },
    reminder: {
      subject: (label) => `[Triptic] 出発まであと3日 · ${label}`,
      headline: '旅行の出発まであと3日です',
      intro: (title, date) => `旅行「${title}」は${date}に出発です。以下の項目をもう一度ご確認ください。`,
      rows: { trip: '旅行', city: '行き先', date: '出発日', dday: '残り' },
      dday: '3日',
      tips: ['航空券・宿泊の予約', 'パスポートの有効期限', '両替・支払い手段', '持ち物リスト'],
      cta: '日程を見る',
      off: '出発前リマインダーは 設定 > 通知 でオフにできます。',
    },
    deleted: {
      subject: '[Triptic] 退会が完了しました',
      headline: '退会が完了しました',
      lines: ['アカウントと、旅行・書類・投稿などの保存データをすべて削除しました。', 'またご利用になりたい場合は、いつでも新規登録いただけます。ご利用ありがとうございました。'],
      ifNotYou: 'ご自身で手続きしていない場合は、下記のアドレスまですぐにご連絡ください。',
    },
  },
  'zh-TW': {
    greeting: (n) => `${n} 您好，`,
    footer: { contactPrefix: '如有疑問或需要協助，請來信 ', contactSuffix: '。', service: '這封信是與 Triptic 服務使用相關的通知。' },
    welcome: {
      subject: '[Triptic] 感謝您的加入',
      headline: '歡迎來到 Triptic',
      lead: ['感謝您的加入。', '現在就在同一個地方開始規劃旅行吧。'],
      tipsTitle: '開始使用',
      tips: ['上傳機票與飯店訂單，行程就會自動整理好', '用分享連結和朋友一起編輯同一份行程', '在各目的地的討論板閱讀心得，也能找旅伴'],
      cta: '開啟 Triptic',
    },
    reminder: {
      subject: (label) => `[Triptic] 距離出發還有 3 天 · ${label}`,
      headline: '旅行還有 3 天就要出發',
      intro: (title, date) => `旅行「${title}」將於 ${date} 出發。請再確認以下項目。`,
      rows: { trip: '旅行', city: '目的地', date: '出發日', dday: '剩餘' },
      dday: '3 天',
      tips: ['機票與住宿訂位', '護照效期', '換匯與付款方式', '行李清單'],
      cta: '查看我的行程',
      off: '出發前提醒可在「設定 > 通知」中關閉。',
    },
    deleted: {
      subject: '[Triptic] 您的帳號已刪除',
      headline: '您的帳號已刪除',
      lines: ['您的帳號與行程、文件、貼文等所有已儲存的資料都已刪除。', '若想再次使用，隨時都可以重新註冊。感謝您使用 Triptic。'],
      ifNotYou: '若這不是您本人的操作，請立即透過下方信箱告訴我們。',
    },
  },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',Arial,sans-serif";
const LOGO_URL = `${SITE}/icon-192.png`;

interface LayoutInput {
  locale: MailLocale;
  name: string;
  headline: string;
  /** 문단 안의 \n은 줄바꿈(<br>)으로 */
  paragraphs: string[];
  /** 요약 표(라벨·값) */
  rows?: Array<[string, string]>;
  /** 제목이 붙은 목록 */
  list?: { title?: string; items: string[] };
  cta?: { label: string; url: string };
  /** 버튼 아래 작은 안내 */
  notes?: string[];
  /** 본문 안 강조 문단(탈퇴: 본인이 아니라면…) */
  callout?: string;
}

function layout(input: LayoutInput): { html: string; text: string } {
  const c = COPY[input.locale];
  const greeting = c.greeting(input.name);
  const e = escapeHtml;
  // 한국어는 낱말 중간에서 줄이 끊기지 않게(일본어·중국어는 글자 단위 줄바꿈이 맞아 그대로)
  const keepAll = input.locale === 'ko' ? 'word-break:keep-all;' : '';

  const rows = input.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;border:1px solid #E5E4DE;border-radius:12px;background:#F7F6F2;border-collapse:separate;">${input.rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:12px 16px;font-size:13px;color:#6B6560;width:34%;${i ? 'border-top:1px solid #E5E4DE;' : ''}">${e(k)}</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1F2427;${i ? 'border-top:1px solid #E5E4DE;' : ''}">${e(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const list = input.list
    ? `<div style="margin:20px 0 4px;">${input.list.title ? `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND};letter-spacing:0.02em;">${e(input.list.title)}</p>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${input.list.items
        .map(
          (item) =>
            `<tr><td valign="top" style="width:20px;padding:4px 0;font-size:13px;line-height:1.55;color:${BRAND};font-weight:700;">&#10003;</td><td style="padding:4px 0;font-size:13px;line-height:1.55;color:#1F2427;">${e(item)}</td></tr>`,
        )
        .join('')}</table></div>`
    : '';
  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:10px;background:${BRAND};"><a href="${e(input.cta.url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${e(input.cta.label)}</a></td></tr></table>`
    : '';
  const notes = (input.notes ?? []).map((n) => `<p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6B6560;">${e(n)}</p>`).join('');
  const callout = input.callout
    ? `<p style="margin:20px 0 0;padding:12px 14px;border-radius:10px;background:#F7F6F2;font-size:13px;line-height:1.5;color:#3A3F42;">${e(input.callout)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="${input.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>@media (max-width:480px){.wrap{padding:16px 6px !important}.pad{padding-left:20px !important;padding-right:20px !important}}</style></head>
<body style="margin:0;padding:0;background:#EFEDE6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEDE6;"><tr><td class="wrap" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT};${keepAll}">
<tr><td class="pad" style="background:#ffffff;border-radius:18px 18px 0 0;padding:32px 32px 8px;text-align:center;">
<a href="${SITE}" style="text-decoration:none;"><img src="${LOGO_URL}" width="72" height="72" alt="Triptic" style="display:inline-block;border:0;border-radius:16px;"></a>
</td></tr>
<tr><td class="pad" style="background:#ffffff;border-radius:0 0 18px 18px;padding:8px 32px 32px;color:#1F2427;font-size:14px;line-height:1.65;">
<h1 style="margin:12px 0 18px;font-size:22px;line-height:1.35;font-weight:800;letter-spacing:-0.01em;color:${BRAND};text-align:center;">${e(input.headline)}</h1>
<p style="margin:0 0 12px;">${e(greeting)}</p>
${input.paragraphs.map((p) => `<p style="margin:0 0 12px;">${e(p).replace(/\n/g, '<br>')}</p>`).join('\n')}
${rows}${list}${cta}${callout}${notes}
</td></tr>
<tr><td style="padding:20px 12px 0;text-align:center;font-size:12px;line-height:1.7;color:#6B6560;">
<p style="margin:0;">${e(c.footer.contactPrefix)}<a href="mailto:${CONTACT}" style="color:${BRAND};font-weight:600;text-decoration:underline;">${CONTACT}</a>${e(c.footer.contactSuffix)}</p>
<p style="margin:6px 0 0;">${e(c.footer.service)}</p>
<p style="margin:10px 0 0;color:#8C8780;">&copy; ${new Date().getUTCFullYear()} Triptic &middot; <a href="${SITE}" style="color:#8C8780;text-decoration:none;">triptic.my</a></p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    input.headline,
    '',
    greeting,
    '',
    ...input.paragraphs,
    ...(input.rows?.length ? ['', ...input.rows.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(input.list ? ['', ...(input.list.title ? [input.list.title] : []), ...input.list.items.map((i) => `- ${i}`)] : []),
    ...(input.cta ? ['', `${input.cta.label}: ${input.cta.url}`] : []),
    ...(input.callout ? ['', input.callout] : []),
    ...(input.notes ?? []).flatMap((n) => ['', n]),
    '',
    '--',
    `${c.footer.contactPrefix}${CONTACT}${c.footer.contactSuffix}`,
    c.footer.service,
    `Triptic · ${SITE}`,
  ].join('\n');
  return { html, text };
}

export function welcomeMail(locale: MailLocale, name: string): Mail {
  const c = COPY[locale].welcome;
  const m = layout({ locale, name, headline: c.headline, paragraphs: [c.lead.join('\n')], list: { title: c.tipsTitle, items: c.tips }, cta: { label: c.cta, url: SITE } });
  return { subject: c.subject, html: m.html, text: m.text };
}

export function tripReminderMail(locale: MailLocale, name: string, trip: { id: string; title: string; city: string; startDate: string }): Mail {
  const c = COPY[locale].reminder;
  const title = trip.title || trip.city;
  const rows: Array<[string, string]> = [[c.rows.trip, title]];
  if (trip.city && trip.city !== title) rows.push([c.rows.city, trip.city]);
  rows.push([c.rows.date, trip.startDate], [c.rows.dday, c.dday]);
  const m = layout({
    locale,
    name,
    headline: c.headline,
    paragraphs: [c.intro(title, trip.startDate)],
    rows,
    list: { items: c.tips },
    cta: { label: c.cta, url: `${SITE}/plan/${trip.id}` },
    notes: [c.off],
  });
  return { subject: c.subject(title), html: m.html, text: m.text };
}

export function accountDeletedMail(locale: MailLocale, name: string): Mail {
  const c = COPY[locale].deleted;
  const m = layout({ locale, name, headline: c.headline, paragraphs: c.lines, callout: c.ifNotYou });
  return { subject: c.subject, html: m.html, text: m.text };
}
