import { describe, expect, it, vi } from 'vitest';
import { isSuspensionReason, normalizeReasonText, recordSuspension, SUSPENSION_REASONS } from './suspension.js';

function makeDb({ email = 'Foo@Bar.com', existing = null, insertError = null } = {}) {
    const insert = vi.fn().mockResolvedValue({ error: insertError });
    const db = {
        auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email } }, error: null }) } },
        from: (table) => {
            if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: '민지' } }) }) }) };
            return { select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }) }), insert };
        },
    };
    return { db, insert };
}

describe('이용 정지 명단', () => {
    it('사유는 목록 안의 코드만', () => {
        expect(SUSPENSION_REASONS.every(isSuspensionReason)).toBe(true);
        expect(isSuspensionReason('abuse')).toBe(true);
        expect(isSuspensionReason('nope')).toBe(false);
        expect(isSuspensionReason(undefined)).toBe(false);
    });

    it('이메일을 소문자로 바꿔 사유·이름·처리자와 함께 올린다', async () => {
        const { db, insert } = makeDb();
        expect(await recordSuspension(db, { userId: 'u', adminId: 'a', reason: 'fraud' })).toBe(true);
        expect(insert).toHaveBeenCalledWith({ email: 'foo@bar.com', display_name: '민지', reason: 'fraud', suspended_by: 'a', reason_text: null });
    });

    it('이미 정지 중이면 다시 올리지 않는다(재시도 안전)', async () => {
        const { db, insert } = makeDb({ existing: { id: 3 } });
        expect(await recordSuspension(db, { userId: 'u', adminId: 'a', reason: 'spam' })).toBe(true);
        expect(insert).not.toHaveBeenCalled();
    });

    it('이메일이 없는 계정은 올릴 수 없다', async () => {
        const { db, insert } = makeDb({ email: '' });
        expect(await recordSuspension(db, { userId: 'u', adminId: 'a', reason: 'spam' })).toBe(false);
        expect(insert).not.toHaveBeenCalled();
    });

    it('올리기에 실패하면 던진다(탈퇴를 진행하지 않게)', async () => {
        const { db } = makeDb({ insertError: { message: 'x' } });
        await expect(recordSuspension(db, { userId: 'u', adminId: 'a', reason: 'spam' })).rejects.toThrow('suspension insert failed');
    });

    it("직접 입력('custom')은 사유 글을 다듬어 함께 올린다", async () => {
        const { db, insert } = makeDb();
        await recordSuspension(db, { userId: 'u', adminId: 'a', reason: 'custom', reasonText: '같은 글 반복' });
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'custom', reason_text: '같은 글 반복' }));
    });

    it("직접 입력이 아니면 글은 버린다", async () => {
        const { db, insert } = makeDb();
        await recordSuspension(db, { userId: 'u', adminId: 'a', reason: 'spam', reasonText: '무시' });
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'spam', reason_text: null }));
    });

    it('직접 입력 글은 1~200자(앞뒤 공백 제외)여야 한다', () => {
        expect(normalizeReasonText('spam', 'x')).toBeNull();
        expect(normalizeReasonText('custom', '  이유  ')).toBe('이유');
        expect(normalizeReasonText('custom', '   ')).toBeUndefined();
        expect(normalizeReasonText('custom', undefined)).toBeUndefined();
        expect(normalizeReasonText('custom', 'a'.repeat(200))).toHaveLength(200);
        expect(normalizeReasonText('custom', 'a'.repeat(201))).toBeUndefined();
    });
});
