// 탈퇴 완료 안내 메일 — 메일 문구·발송은 Edge Function send-email(Resend)이 한다. 여기서는 service_role 키로 불러 주기만 한다.
// 계정이 이미 지워진 뒤라 받는 주소·언어·이름은 지우기 전에 잡아 둔 값을 넘긴다. 실패해도 탈퇴 결과는 바뀌지 않는다(호출부는 결과를 쓰지 않는다).

export async function sendAccountDeletedMail({ email, locale, name }) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || typeof email !== 'string' || !email) return false;
    try {
        const res = await fetch(`${url}/functions/v1/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ kind: 'account_deleted', to: email, locale: locale || 'ko', name: name || '' }),
            signal: AbortSignal.timeout(6000),
        });
        return res.ok;
    } catch {
        return false;
    }
}
