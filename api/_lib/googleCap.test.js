import { describe, expect, it } from 'vitest';
import { capFor, DEFAULT_GOOGLE_CAPS, GoogleCapError, takeGoogleCall } from './googleCap.js';

const fakeDb = (row, error = null) => ({ rpc: async () => ({ data: row ? [row] : null, error }) });

describe('googleCap', () => {
    it('기본 한도, 환경 변수로 바꾼 한도(0 포함), 모르는 종류는 0', () => {
        expect(capFor('places_nearby', {})).toBe(DEFAULT_GOOGLE_CAPS.places_nearby);
        expect(capFor('places_nearby', { GOOGLE_CAP_PLACES_NEARBY: '100' })).toBe(100);
        expect(capFor('vision', { GOOGLE_CAP_VISION: '0' })).toBe(0);
        expect(capFor('vision', { GOOGLE_CAP_VISION: 'abc' })).toBe(DEFAULT_GOOGLE_CAPS.vision);
        expect(capFor('unknown_kind', {})).toBe(0);
    });

    it('한도 안이면 통과', async () => {
        expect(await takeGoogleCall(fakeDb({ allowed: true, used: 7 }), 'vision')).toMatchObject({ used: 7 });
    });

    it('한도를 넘으면 GoogleCapError', async () => {
        await expect(takeGoogleCall(fakeDb({ allowed: false, used: 5000 }), 'vision')).rejects.toBeInstanceOf(GoogleCapError);
    });

    it('DB가 없거나 확인이 안 되면 통과시키지 않는다(닫힌 쪽)', async () => {
        await expect(takeGoogleCall(null, 'vision')).rejects.toThrow('unavailable');
        await expect(takeGoogleCall(fakeDb(null, { message: 'x' }), 'vision')).rejects.toThrow('unavailable');
    });
});
