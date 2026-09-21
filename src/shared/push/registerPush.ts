/**
 * 푸시 알림 등록 (02-screens.md §5 "알림" 섹션 배선)
 * 네이티브 셸(iOS/Android)에서만 동작한다 — 웹 푸시(Notification API)는
 * 스코프 밖이다. 실제 발송(APNs/FCM)은 아직 없다(Apple Developer Program
 * 미가입 — 이전 원칙과 동일하게 배선만 해두고 값은 비워둔다). 이 함수는
 * "권한을 받고 토큰을 얻어 서버에 저장"까지만 한다.
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { captureError } from '@/shared/monitoring';
import { isNativeApp } from '@/shared/platform';
import { savePushToken, type PushPlatform } from './pushService';

export async function registerPushNotifications(userId: string): Promise<boolean> {
  if (!isNativeApp()) return false;

  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return false;

  try {
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') return false;

    await PushNotifications.addListener('registration', (token) => {
      void savePushToken(userId, token.value, platform as PushPlatform).catch((err) =>
        captureError(err, { context: 'savePushToken' }),
      );
    });
    await PushNotifications.addListener('registrationError', (err) => {
      captureError(new Error('Push registration failed'), { context: 'pushRegistration', detail: err });
    });

    await PushNotifications.register();
    return true;
  } catch (err) {
    captureError(err, { context: 'registerPushNotifications' });
    return false;
  }
}
