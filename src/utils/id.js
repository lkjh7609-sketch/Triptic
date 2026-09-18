/**
 * 짧은 무작위 ID 생성 유틸리티
 * 공유 코드, 임시 식별자 등에 사용. crypto.getRandomValues 기반으로 예측 불가능하며
 * Math.random() 기반 생성기(V8의 xorshift128+ 등)와 달리 내부 상태를 관측으로
 * 역산할 수 없다.
 *
 * @param {number} len - 생성할 ID 길이 (기본 10)
 * @returns {string}
 */
export function generateShortId(len = 10) {
    // 혼동되는 문자(0/O, 1/l/I) 제외
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    // 256을 chars.length로 나눈 나머지만큼의 상위 바이트 구간을 버려 모듈로 편향을 제거
    const max = 256 - (256 % chars.length);
    const bytes = new Uint8Array(len * 2);
    crypto.getRandomValues(bytes);

    let id = '';
    for (let i = 0; id.length < len && i < bytes.length; i++) {
        if (bytes[i] < max) id += chars[bytes[i] % chars.length];
    }
    return id.length === len ? id : generateShortId(len);
}

export default generateShortId;
