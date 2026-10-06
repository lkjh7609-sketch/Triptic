// 이용 정지 — 운영자가 강제 탈퇴시킬 때 그 이메일을 정지 명단(suspended_accounts, 0095)에 올린다.
// 정지는 이메일(소문자) 기준이고, 같은 이메일로 다시 가입·로그인하면 앱이 check_my_suspension()으로 알아채 막는다.

/** 사유 코드 — 0095 표의 check 제약, 화면 문구(community.json admin.members.remove.reasons·auth 팝업)와 같은 목록 */
export const SUSPENSION_REASONS = ['abuse', 'spam', 'fraud', 'privacy', 'illegal', 'impersonation', 'terms'];

export function isSuspensionReason(value) {
    return typeof value === 'string' && SUSPENSION_REASONS.includes(value);
}

/**
 * 계정을 지우기 *전에* 부른다 — 이메일은 계정이 지워지면 읽을 수 없다. 이미 정지 중인 이메일이면 그대로 두어 다시 불러도 안전하다.
 * 이메일이 없는 계정(전화 로그인 등)은 막을 수 있는 키가 없어 false.
 */
export async function recordSuspension(db, { userId, adminId, reason }) {
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error) throw new Error(`user lookup failed: ${error.message}`);
    const email = data?.user?.email?.trim().toLowerCase();
    if (!email) return false;
    const { data: existing, error: findErr } = await db.from('suspended_accounts').select('id').eq('email', email).is('lifted_at', null).maybeSingle();
    if (findErr) throw new Error(`suspension lookup failed: ${findErr.message}`);
    if (existing) return true;
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    const { error: insertErr } = await db.from('suspended_accounts').insert({ email, display_name: profile?.display_name ?? null, reason, suspended_by: adminId });
    if (insertErr) throw new Error(`suspension insert failed: ${insertErr.message}`);
    return true;
}
