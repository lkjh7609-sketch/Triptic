import { beforeEach, describe, expect, it } from 'vitest';
import {
  dismissNotification,
  markNotificationsRead,
  readNotificationState,
} from './notificationStore';

beforeEach(() => localStorage.clear());

describe('notificationStore', () => {
  it('읽음·지우기를 사용자별로 저장하고, 지운 것은 읽은 것으로도 센다', () => {
    markNotificationsRead('u1', ['a:week']);
    dismissNotification('u1', 'b:today');
    expect(readNotificationState('u1')).toEqual({
      read: ['a:week', 'b:today'],
      dismissed: ['b:today'],
    });
    expect(readNotificationState('u2')).toEqual({ read: [], dismissed: [] });
  });

  it('같은 값은 같은 참조로 돌려주고, 깨진 저장값은 빈 기록으로 본다', () => {
    markNotificationsRead('u1', ['a:week']);
    expect(readNotificationState('u1')).toBe(readNotificationState('u1'));
    localStorage.setItem('triptic-notifications:u3', '{oops');
    expect(readNotificationState('u3')).toEqual({ read: [], dismissed: [] });
  });
});
