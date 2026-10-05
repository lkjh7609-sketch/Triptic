import { describe, expect, it } from 'vitest';
import { accountDeletedMail, escapeHtml, normalizeLocale, tripReminderMail, welcomeMail, type MailLocale } from './templates';

const LOCALES: MailLocale[] = ['ko', 'en', 'ja', 'zh-TW'];

describe('send-email 템플릿', () => {
  it('언어 값을 4개 중 하나로 맞춘다(모르면 한국어)', () => {
    expect(normalizeLocale('ko')).toBe('ko');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('ja')).toBe('ja');
    expect(normalizeLocale('zh-TW')).toBe('zh-TW');
    expect(normalizeLocale(null)).toBe('ko');
    expect(normalizeLocale('fr')).toBe('ko');
  });

  it('세 종류 메일이 4개 언어 모두 제목·HTML·텍스트를 가진다', () => {
    for (const l of LOCALES) {
      for (const mail of [
        welcomeMail(l, '민지'),
        tripReminderMail(l, '민지', { id: 't1', title: '도쿄 여행', city: '도쿄', startDate: '2026-10-08' }),
        accountDeletedMail(l, '민지'),
      ]) {
        expect(mail.subject.length).toBeGreaterThan(5);
        expect(mail.html).toContain('민지');
        expect(mail.text).toContain('민지');
        expect(mail.html).toContain('triptic.my'.slice(0, 6));
      }
    }
  });

  it('여행 알림에는 일정으로 가는 링크와 끄는 방법이 있다', () => {
    const m = tripReminderMail('ko', '민지', { id: 't1', title: '도쿄 여행', city: '도쿄', startDate: '2026-10-08' });
    expect(m.subject).toBe('[Triptic] 출발 3일 전이에요 · 도쿄 여행');
    expect(m.html).toContain('https://triptic.my/plan/t1');
    expect(m.text).toContain('설정 > 알림');
    // 요약 표: 여행·여행지·출발일·남은 기간
    expect(m.text).toContain('출발일: 2026-10-08');
    expect(m.text).toContain('남은 기간: 3일');
  });

  it('사용자가 정한 이름·제목은 HTML로 해석되지 않게 이스케이프한다', () => {
    const m = welcomeMail('ko', '<script>alert(1)</script>');
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(escapeHtml(`a&b"c'd<e>`)).toBe('a&amp;b&quot;c&#39;d&lt;e&gt;');
    const r = tripReminderMail('en', 'x', { id: 't', title: '<b>x</b>', city: 'Paris', startDate: '2026-10-08' });
    expect(r.html).not.toContain('<b>x</b>');
  });

  it('문의 주소는 본문이 아니라 맨 아래 안내에 있다(세 종류 모두)', () => {
    for (const m of [welcomeMail('ko', '민지'), accountDeletedMail('ko', '민지')]) {
      expect(m.text.indexOf('admin@triptic.my')).toBeGreaterThan(m.text.indexOf('--'));
      expect(m.html).toContain('mailto:admin@triptic.my');
    }
  });

  it('로고와 브랜드 색이 들어가고, 탈퇴 메일에는 이동 버튼이 없다', () => {
    const w = welcomeMail('ko', '민지');
    expect(w.html).toContain('https://triptic.my/icon-192.png');
    expect(w.html).toContain('#2E4F4F');
    expect(w.html).toContain('Triptic 열기');
    expect(accountDeletedMail('ko', '민지').html).not.toContain('열기');
  });
});
