/* i18n-exempt-file: 한국어 예약 문서의 개인정보 가림 정규식 */
/**
 * 🔒 마스킹 (04-document-ai.md §5, "가장 중요")
 * LLM 호출 직전에 무조건 실행한다. 이 함수를 통과하지 않으면 다음 단계로
 * 넘어갈 수 없다(파이프라인 §2 C단계). 여권번호·카드번호·주민등록번호·
 * 생년월일·이메일·전화번호·회원번호를 제거한다.
 *
 * ⚠️ 이 파일은 Deno(Supabase Edge Function, supabase/functions/parse-booking/)
 * 와 Vitest(src/, Node) 양쪽에서 그대로 임포트된다 — Deno 전용 API(Deno.*)나
 * Node 전용 API를 쓰지 않는다. 외부 의존성도 없다(순수 함수).
 */

const RULES: Array<[RegExp, string]> = [
  // 여권번호 (한국 M12345678, 일반 2글자+7~8자리)
  [/\b[A-Z]{1,2}\d{7,8}\b/g, '[PASSPORT]'],
  // 신용카드 (13~19자리, 구분자 허용)
  [/\b(?:\d[ -]*?){13,19}\b/g, '[CARD]'],
  // 주민등록번호
  [/\b\d{6}[-\s]?[1-4]\d{6}\b/g, '[NATIONAL_ID]'],
  // 생년월일 라벨 뒤 값
  [/\b(DOB|Date of Birth|생년월일|出生日期)\s*[:：]?\s*\S+/gi, '$1: [DOB]'],
  // 이메일
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]'],
  // 전화번호 (국제/국내)
  [/\+?\d{1,3}[-\s]?\(?\d{2,4}\)?[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[PHONE]'],
  // 마일리지·회원번호
  [/\b(FFP|Membership|회원번호|마일리지)\s*[:：]?\s*\S+/gi, '$1: [MEMBER_NO]'],
];

export interface RedactResult {
  text: string;
  /** 어떤 종류가 가려졌는지(마스킹 태그 목록) — 원문 값은 절대 포함하지 않는다 */
  hits: string[];
}

export function redact(text: string): RedactResult {
  const hits: string[] = [];
  let out = text;
  for (const [re, rep] of RULES) {
    out = out.replace(re, (_m, ...args: unknown[]) => {
      hits.push(rep.replace(/\$\d/g, ''));
      const g0 = args[0];
      return typeof g0 === 'string' && rep.includes('$1') ? rep.replace('$1', g0) : rep;
    });
  }
  return { text: out, hits };
}
