/** 작성자 폴더({작성자 id}/…) 안의 경로만 남긴다 — 다른 사람 파일이나 이상한 경로는 절대 지우지 않는다 */
export function ownPaths(authorId: string, paths: readonly string[]): string[] {
  const prefix = `${authorId}/`;
  return paths.filter((p) => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..'));
}

/** 시간 일정한 비교(비밀값 길이 정보만 샌다) */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
