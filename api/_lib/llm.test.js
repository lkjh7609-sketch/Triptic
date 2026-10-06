import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion, MIN_ATTEMPT_MS } from './llm.js';

const ok = (provider) => ({ ok: true, json: async () => ({ model: provider, choices: [{ message: { content: '{"a":1}' } }] }) });

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('DEEPSEEK_API_KEY', 'd');
    vi.stubEnv('OPENROUTER_API_KEY', 'o');
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

/** 요청이 abort될 때까지 멈춰 있는 fetch — 느린 공급자 */
function hangingFetch() {
    return (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
}

describe('chatCompletion 시간 예산', () => {
    it('첫 공급자가 성공하면 그대로 돌려준다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok('deepseek-flash')));
        const r = await chatCompletion({ system: 's', user: 'u', timeoutMs: 16000, budgetMs: 22000 });
        expect(r.provider).toBe('DeepSeek');
    });

    it('첫 공급자가 곳당 제한까지 걸려도, 남은 시간 안에서 대체 공급자를 시도한다(전체 22초를 넘지 않음)', async () => {
        const fetchMock = vi.fn((url, init) => (String(url).includes('deepseek.com') ? hangingFetch()(url, init) : Promise.resolve(ok('deepseek/deepseek-chat'))));
        vi.stubGlobal('fetch', fetchMock);
        const p = chatCompletion({ system: 's', user: 'u', timeoutMs: 16000, budgetMs: 22000 });
        await vi.advanceTimersByTimeAsync(16000);
        const r = await p;
        expect(r.provider).toBe('OpenRouter');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('둘 다 느려도 전체 예산을 넘겨 기다리지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn(hangingFetch()));
        const p = chatCompletion({ system: 's', user: 'u', timeoutMs: 16000, budgetMs: 22000 });
        const settled = p.then(() => 'ok', (e) => e.message);
        await vi.advanceTimersByTimeAsync(22000);
        expect(await settled).toBe('aborted');
    });

    it('남은 시간이 너무 적으면 대체 공급자를 시도하지 않는다', async () => {
        const fetchMock = vi.fn(hangingFetch());
        vi.stubGlobal('fetch', fetchMock);
        const budget = 16000 + MIN_ATTEMPT_MS - 1;
        const p = chatCompletion({ system: 's', user: 'u', timeoutMs: 16000, budgetMs: budget });
        const settled = p.then(() => 'ok', (e) => e.message);
        await vi.advanceTimersByTimeAsync(16000);
        expect(await settled).toBe('aborted');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('DeepSeek 직접 호출은 추론(thinking)을 끄고, OpenRouter에는 보내지 않는다', async () => {
        const bodies = [];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            bodies.push([String(url), JSON.parse(init.body)]);
            if (String(url).includes('deepseek.com')) throw new Error('down');
            return ok('deepseek/deepseek-chat');
        }));
        await chatCompletion({ system: 's', user: 'u', budgetMs: 22000 });
        const deepseek = bodies.find(([u]) => u.includes('deepseek.com'))[1];
        const openrouter = bodies.find(([u]) => u.includes('openrouter.ai'))[1];
        expect(deepseek.thinking).toEqual({ type: 'disabled' });
        expect(openrouter.thinking).toBeUndefined();
    });
});
