import { describe, expect, it, vi } from 'vitest';
import { deleteAccountData, isRecentlySignedIn, listUserFiles, removeUserFiles } from './deleteAccount.js';

const U = '21a38eb1-4585-497e-92d7-34af225339db';

/** 폴더 트리를 흉내 내는 저장소: { '<prefix>': [{name, id}] } — id가 null이면 폴더 */
function fakeDb(tree, { removeError = null, rpcError = null, authError = null } = {}) {
    const removed = [];
    const storage = {
        from: (bucket) => ({
            list: async (prefix, { limit, offset }) => {
                const all = tree[bucket]?.[prefix] ?? [];
                return { data: all.slice(offset, offset + limit), error: null };
            },
            remove: async (paths) => {
                if (removeError) return { error: { message: removeError } };
                removed.push(...paths.map((p) => `${bucket}:${p}`));
                return { error: null };
            },
        }),
    };
    return {
        removed,
        storage,
        rpc: vi.fn(async () => ({ error: rpcError ? { message: rpcError } : null })),
        auth: { admin: { deleteUser: vi.fn(async () => ({ error: authError ? { message: authError } : null })) } },
    };
}

const TREE = {
    vouchers: {
        [U]: [{ name: 'trip1', id: null }, { name: 'trip2', id: null }],
        [`${U}/trip1`]: [{ name: 'a.pdf', id: 'x1' }, { name: 'b.png', id: 'x2' }],
        [`${U}/trip2`]: [{ name: 'c.pdf', id: 'x3' }],
    },
    'post-images': { [U]: [{ name: 'p.webp', id: 'y1' }] },
};

describe('listUserFiles', () => {
    it('폴더 안까지 따라 들어가 파일 경로를 모은다', async () => {
        const files = await listUserFiles(fakeDb(TREE), 'vouchers', U);
        expect(files.sort()).toEqual([`${U}/trip1/a.pdf`, `${U}/trip1/b.png`, `${U}/trip2/c.pdf`]);
    });

    it('100개가 넘어도 다음 쪽까지 읽는다', async () => {
        const many = Array.from({ length: 230 }, (_, i) => ({ name: `f${i}.png`, id: `i${i}` }));
        const files = await listUserFiles(fakeDb({ vouchers: { [U]: many } }), 'vouchers', U);
        expect(files).toHaveLength(230);
    });

    it('파일이 없으면 빈 목록', async () => {
        expect(await listUserFiles(fakeDb({}), 'vouchers', U)).toEqual([]);
    });
});

describe('removeUserFiles', () => {
    it('세 저장소의 이 사용자 파일만 지운다', async () => {
        const db = fakeDb(TREE);
        expect(await removeUserFiles(db, U)).toBe(4);
        expect(db.removed.sort()).toEqual([
            `post-images:${U}/p.webp`,
            `vouchers:${U}/trip1/a.pdf`,
            `vouchers:${U}/trip1/b.png`,
            `vouchers:${U}/trip2/c.pdf`,
        ]);
    });

    it('다른 사용자 경로는 절대 지우지 않는다', async () => {
        const db = fakeDb({ vouchers: { [U]: [{ name: 'a.pdf', id: 'x' }] } });
        db.storage.from = (bucket) => ({
            list: async () => ({ data: [{ name: '../other/secret.pdf', id: 'z' }, { name: 'a.pdf', id: 'x' }], error: null }),
            remove: async (paths) => (db.removed.push(...paths.map((p) => `${bucket}:${p}`)), { error: null }),
        });
        await removeUserFiles(db, U);
        expect(db.removed.every((p) => p.includes(`:${U}/`))).toBe(true);
    });

    it('삭제가 실패하면 예외 — 다음 단계로 넘어가지 않는다', async () => {
        await expect(removeUserFiles(fakeDb(TREE, { removeError: 'boom' }), U)).rejects.toThrow('storage remove failed');
    });
});

describe('deleteAccountData', () => {
    it('파일 → DB → 로그인 계정 순서로 지운다', async () => {
        const db = fakeDb(TREE);
        const order = [];
        db.rpc.mockImplementation(async () => (order.push('db'), { error: null }));
        db.auth.admin.deleteUser.mockImplementation(async () => (order.push('auth'), { error: null }));
        const origRemove = db.storage.from;
        db.storage.from = (b) => {
            const o = origRemove(b);
            return { ...o, remove: async (p) => (order.push('files'), o.remove(p)) };
        };
        await deleteAccountData(db, U);
        expect(order[0]).toBe('files');
        expect(order.slice(-2)).toEqual(['db', 'auth']);
        expect(db.rpc).toHaveBeenCalledWith('purge_user_data', { p_user_id: U });
        expect(db.auth.admin.deleteUser).toHaveBeenCalledWith(U);
    });

    it('파일 삭제가 실패하면 DB와 계정은 건드리지 않는다(다시 시도하면 이어서)', async () => {
        const db = fakeDb(TREE, { removeError: 'boom' });
        await expect(deleteAccountData(db, U)).rejects.toThrow();
        expect(db.rpc).not.toHaveBeenCalled();
        expect(db.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    it('DB 삭제가 실패하면 로그인 계정은 지우지 않는다', async () => {
        const db = fakeDb(TREE, { rpcError: 'fk violation' });
        await expect(deleteAccountData(db, U)).rejects.toThrow('purge failed');
        expect(db.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    it('계정 삭제가 실패하면 예외(다시 요청하면 이어서 끝난다)', async () => {
        await expect(deleteAccountData(fakeDb(TREE, { authError: 'down' }), U)).rejects.toThrow('auth delete failed');
    });
});

describe('isRecentlySignedIn', () => {
    const now = Date.parse('2026-09-30T12:00:00Z');
    it('15분 안이면 true, 아니면 false', () => {
        expect(isRecentlySignedIn('2026-09-30T11:50:00Z', now)).toBe(true);
        expect(isRecentlySignedIn('2026-09-30T11:40:00Z', now)).toBe(false);
    });
    it('없거나 이상한 값이거나 미래면 false', () => {
        expect(isRecentlySignedIn(undefined, now)).toBe(false);
        expect(isRecentlySignedIn('not a date', now)).toBe(false);
        expect(isRecentlySignedIn('2026-09-30T13:00:00Z', now)).toBe(false);
    });
});
