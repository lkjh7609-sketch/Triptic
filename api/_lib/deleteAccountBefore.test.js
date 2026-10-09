import { describe, expect, it, vi } from 'vitest';
import { deleteAccountData, removeUserFiles } from './deleteAccount.js';

/** 저장소·rpc·로그인 계정 삭제 호출 순서를 기록하는 가짜 DB */
function fakeDb(log, { listDelay = 0 } = {}) {
    return {
        storage: {
            from: (bucket) => ({
                list: async () => {
                    log.push(`list:${bucket}:start`);
                    if (listDelay) await new Promise((r) => setTimeout(r, listDelay));
                    log.push(`list:${bucket}:end`);
                    return { data: [], error: null };
                },
                remove: async () => ({ error: null }),
            }),
        },
        rpc: async (name) => {
            log.push(`rpc:${name}`);
            return { error: null };
        },
        auth: {
            admin: {
                deleteUser: async () => {
                    log.push('auth:deleteUser');
                    return { error: null };
                },
            },
        },
    };
}

describe('deleteAccountData — before(이메일을 정지 명단에 올리기)', () => {
    it('before는 purge·계정 삭제보다 먼저 끝난다(이메일은 계정이 지워지면 읽을 수 없다)', async () => {
        const log = [];
        const before = vi.fn(async () => {
            log.push('before:start');
            await new Promise((r) => setTimeout(r, 15));
            log.push('before:end');
        });
        await deleteAccountData(fakeDb(log), 'u1', { before });
        expect(log.indexOf('before:end')).toBeLessThan(log.indexOf('rpc:purge_user_data'));
        expect(log.indexOf('before:end')).toBeLessThan(log.indexOf('auth:deleteUser'));
    });

    it('before가 실패하면 purge·계정 삭제를 시작하지 않는다', async () => {
        const log = [];
        await expect(deleteAccountData(fakeDb(log), 'u1', { before: async () => Promise.reject(new Error('insert failed')) })).rejects.toThrow('insert failed');
        expect(log).not.toContain('rpc:purge_user_data');
        expect(log).not.toContain('auth:deleteUser');
    });

    it('before가 없으면 예전처럼 파일 → purge → 계정 삭제', async () => {
        const log = [];
        await deleteAccountData(fakeDb(log), 'u1');
        expect(log.indexOf('rpc:purge_user_data')).toBeLessThan(log.indexOf('auth:deleteUser'));
    });
});

describe('removeUserFiles — 저장소를 한꺼번에', () => {
    it('저장소 4곳의 목록 조회가 겹쳐서 돈다(하나씩 기다리지 않는다)', async () => {
        const log = [];
        await removeUserFiles(fakeDb(log, { listDelay: 10 }), 'u1');
        const firstEnd = log.findIndex((l) => l.endsWith(':end'));
        const startsBeforeFirstEnd = log.slice(0, firstEnd).filter((l) => l.endsWith(':start')).length;
        expect(startsBeforeFirstEnd).toBe(4);
    });
});
