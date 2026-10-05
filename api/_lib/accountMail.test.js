import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAccountDeletedMail } from './accountMail.js';

beforeEach(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});
afterEach(() => vi.unstubAllGlobals());

describe('sendAccountDeletedMail', () => {
    it('service_role 키로 send-email을 불러 탈퇴 완료 메일을 요청한다', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        expect(await sendAccountDeletedMail({ email: 'a@b.co', locale: 'en', name: 'Min' })).toBe(true);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://x.supabase.co/functions/v1/send-email');
        expect(init.headers.Authorization).toBe('Bearer service-key');
        expect(JSON.parse(init.body)).toEqual({ kind: 'account_deleted', to: 'a@b.co', locale: 'en', name: 'Min' });
    });

    it('네트워크가 실패해도 던지지 않고 false', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
        expect(await sendAccountDeletedMail({ email: 'a@b.co' })).toBe(false);
    });

    it('주소가 없으면 호출하지 않는다', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        expect(await sendAccountDeletedMail({ email: '' })).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
