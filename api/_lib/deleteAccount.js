// 회원 탈퇴 즉시 삭제 — 서버에서만 하는 부분(서비스 키).
// 순서: 1) 저장소 파일(예약 서류·게시 이미지·건의 스크린샷) 삭제 → 2) DB(purge_user_data, 0065; 나머지는 CASCADE) → 3) 로그인 계정 삭제.
// 파일부터 지우는 이유: 예약 서류에는 여권번호 등이 들어 있을 수 있어서, 도중에 실패하더라도 파일이 남는 쪽보다 DB 기록이 남는 쪽이 낫다.
// 어느 단계에서 멈춰도 사용자가 다시 요청하면 이어서 끝난다(각 단계가 없는 대상에는 아무 일도 안 한다).

/** 사용자 파일이 들어 있는 저장소 — 경로는 항상 <사용자 id>/… 로 시작한다 */
export const USER_BUCKETS = ['vouchers', 'post-images', 'feedback-screenshots', 'avatars'];
const MAX_DEPTH = 5;
const PAGE = 100;

/** 폴더(id가 null인 항목)까지 따라 들어가며 파일 경로를 모은다 */
export async function listUserFiles(db, bucket, userId) {
    const files = [];
    async function walk(prefix, depth) {
        if (depth > MAX_DEPTH) return;
        for (let offset = 0; ; offset += PAGE) {
            const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE, offset });
            if (error) throw new Error(`storage list failed (${bucket}): ${error.message}`);
            for (const item of data ?? []) {
                const path = `${prefix}/${item.name}`;
                if (item.id === null || item.id === undefined) await walk(path, depth + 1);
                else files.push(path);
            }
            if (!data || data.length < PAGE) break;
        }
    }
    await walk(userId, 0);
    return files;
}

export async function removeUserFiles(db, userId) {
    // 저장소 4곳은 서로 상관이 없어 한꺼번에 — 하나씩 돌면 목록 조회만 4번 줄을 서서 느렸다
    const counts = await Promise.all(
        USER_BUCKETS.map(async (bucket) => {
            const files = await listUserFiles(db, bucket, userId);
            // 안전 확인: 이 사용자 폴더 밖의 경로는 절대 지우지 않는다
            const own = files.filter((p) => p.startsWith(`${userId}/`));
            for (let i = 0; i < own.length; i += PAGE) {
                const { error } = await db.storage.from(bucket).remove(own.slice(i, i + PAGE));
                if (error) throw new Error(`storage remove failed (${bucket}): ${error.message}`);
            }
            return own.length;
        }),
    );
    return counts.reduce((sum, n) => sum + n, 0);
}

/** 재로그인 없이 오래된 세션으로 지우지 못하게 — 방금(15분 안) 로그인한 세션만 */
export const REAUTH_WINDOW_MS = 15 * 60 * 1000;
export function isRecentlySignedIn(lastSignInAt, now = Date.now()) {
    const t = lastSignInAt ? new Date(lastSignInAt).getTime() : NaN;
    return Number.isFinite(t) && now - t >= 0 && now - t < REAUTH_WINDOW_MS;
}

/**
 * `before`: 계정이 지워지기 전에 끝나야 하는 일(예: 이메일을 정지 명단에 올리기). 파일 삭제와 한꺼번에 돌지만,
 * DB 정리(purge)와 로그인 계정 삭제는 둘 다 끝난 뒤에만 시작한다 — 이메일은 계정이 지워지면 읽을 수 없다.
 */
export async function deleteAccountData(db, userId, { before } = {}) {
    const [files] = await Promise.all([removeUserFiles(db, userId), before ? before() : undefined]);
    const { error: purgeErr } = await db.rpc('purge_user_data', { p_user_id: userId });
    if (purgeErr) throw new Error(`purge failed: ${purgeErr.message}`);
    const { error: authErr } = await db.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(`auth delete failed: ${authErr.message}`);
    return { files };
}
