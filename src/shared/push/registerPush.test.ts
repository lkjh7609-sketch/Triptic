import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (payload: unknown) => void;
const listeners: Record<string, Listener> = {};
const addListener = vi.fn(async (event: string, cb: Listener) => {
  listeners[event] = cb;
  return { remove: vi.fn() };
});
const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const register = vi.fn(async () => {});
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { addListener, checkPermissions, requestPermissions, register },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
let native = true;
vi.mock('@/shared/platform', () => ({ isNativeApp: () => native }));
vi.mock('@/shared/monitoring', () => ({ captureError: vi.fn() }));
const savePushToken = vi.fn(async () => {});
const deletePushToken = vi.fn(async () => {});
vi.mock('./pushService', () => ({ savePushToken: (...a: unknown[]) => (savePushToken as (...x: unknown[]) => unknown)(...a), deletePushToken: (...a: unknown[]) => (deletePushToken as (...x: unknown[]) => unknown)(...a) }));

async function load() {
  vi.resetModules();
  return import('./registerPush');
}

describe('푸시 등록', () => {
  beforeEach(() => {
    native = true;
    for (const k of Object.keys(listeners)) delete listeners[k];
    addListener.mockClear();
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    register.mockClear();
    savePushToken.mockClear();
    deletePushToken.mockClear();
    localStorage.clear();
  });

  it('웹에서는 아무것도 하지 않는다', async () => {
    native = false;
    const { registerPushNotifications } = await load();
    expect(await registerPushNotifications('u1')).toBe(false);
    expect(checkPermissions).not.toHaveBeenCalled();
  });

  it('권한이 아직 없으면 묻고, 허용하면 등록해 받은 토큰을 그 회원 것으로 저장한다', async () => {
    checkPermissions.mockResolvedValue({ receive: 'prompt' });
    requestPermissions.mockResolvedValue({ receive: 'granted' });
    const { registerPushNotifications } = await load();
    expect(await registerPushNotifications('u1')).toBe(true);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    listeners.registration({ value: 'TOKEN-1' });
    expect(savePushToken).toHaveBeenCalledWith('u1', 'TOKEN-1', 'ios');
    expect(localStorage.getItem('triptic-push-token')).toBe('TOKEN-1');
  });

  it('이미 허용돼 있으면 다시 묻지 않고, 거부했으면 등록하지 않는다', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' });
    const mod = await load();
    expect(await mod.registerPushNotifications('u1')).toBe(true);
    expect(requestPermissions).not.toHaveBeenCalled();

    checkPermissions.mockResolvedValue({ receive: 'denied' });
    const mod2 = await load();
    register.mockClear();
    expect(await mod2.registerPushNotifications('u1')).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('다시 불러도 듣기를 두 번 달지 않고, 다른 회원으로 로그인하면 새 회원 것으로 저장한다', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' });
    const { registerPushNotifications } = await load();
    await registerPushNotifications('u1');
    await registerPushNotifications('u2');
    expect(addListener.mock.calls.filter((c) => c[0] === 'registration')).toHaveLength(1);
    listeners.registration({ value: 'TOKEN-2' });
    expect(savePushToken).toHaveBeenCalledWith('u2', 'TOKEN-2', 'ios');
  });

  it('로그아웃 직전: 기억해 둔 이 기기 토큰을 서버에서 지우고 잊는다', async () => {
    localStorage.setItem('triptic-push-token', 'TOKEN-1');
    const { unregisterPushForSignOut } = await load();
    await unregisterPushForSignOut('u1');
    expect(deletePushToken).toHaveBeenCalledWith('u1', 'TOKEN-1');
    expect(localStorage.getItem('triptic-push-token')).toBeNull();
    await unregisterPushForSignOut('u1'); // 토큰이 없으면 아무 일도 없다
    expect(deletePushToken).toHaveBeenCalledTimes(1);
  });
});

describe('알림을 눌러 앱 열기', () => {
  beforeEach(() => {
    native = true;
    for (const k of Object.keys(listeners)) delete listeners[k];
  });

  it('앱 안 경로만 연다', async () => {
    const { installPushTapHandler, safeAppPath } = await load();
    const open = vi.fn();
    installPushTapHandler(open);
    await vi.waitFor(() => expect(listeners.pushNotificationActionPerformed).toBeDefined());
    listeners.pushNotificationActionPerformed({ notification: { data: { path: '/community/post/abc#comment-1' } } });
    listeners.pushNotificationActionPerformed({ notification: { data: { path: 'https://evil.com' } } });
    listeners.pushNotificationActionPerformed({ notification: { data: { path: '//evil.com' } } });
    listeners.pushNotificationActionPerformed({ notification: { data: {} } });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('/community/post/abc#comment-1');
    expect(safeAppPath('/plan/1')).toBe('/plan/1');
    expect(safeAppPath(5)).toBeNull();
  });
});
