/** 지금 쓰는 기기를 "Chrome · macOS"처럼 짧게 — 설정의 '로그인 세션' 카드에 보여 준다(서버가 세션 목록을 주지 않아 현재 기기만) */
export function describeDevice(userAgent: string): { browser: string; os: string } {
  const ua = userAgent || '';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { browser, os };
}

export function currentDeviceLabel(): string {
  const { browser, os } = describeDevice(typeof navigator === 'undefined' ? '' : navigator.userAgent);
  return `${browser} · ${os}`;
}
