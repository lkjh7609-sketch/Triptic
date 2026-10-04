// Vercel Serverless Function: 검색 로봇·링크 미리보기용 페이지 HTML + sitemap.xml
//
// 이 앱은 모든 주소에 같은 index.html(빈 #root)을 주고 화면은 자바스크립트로 그린다. 네이버
// 로봇(Yeti)은 자바스크립트를 거의 실행하지 않아 여행지·게시글마다 다른 내용을 못 본다.
// vercel.json이 로봇 User-Agent로 온 공개 주소만 여기로 보내고(사람은 그대로 정적 index.html),
// 여기서는 같은 index.html에 그 주소의 제목·설명·canonical·og와 본문 텍스트를 끼워 돌려준다.
// 끼우는 내용은 사람이 로그인 없이 보는 것과 같은 정보다.
// GET /api/seo?route=page&path=/flights | route=sitemap
// 커뮤니티(게시판·글·동행)는 2026-10-05부터 회원 전용이라 로봇용 페이지·사이트맵에 넣지 않는다.

const ORIGIN = 'https://triptic.my';
const SITE = '트립틱';
// 설명(description)은 네이버 권장대로 80자 이내
const DEFAULT_DESC = '예약 서류만 올리면 여행 일정이 자동 완성되는 여행 플래너 트립틱. 지도 동선, 함께 편집, 항공권·호텔 검색, 동행 찾기까지.';

const STATIC_PAGES = {
    '/flights': {
        title: `항공권 검색 · 최저가 비교 | ${SITE}`,
        desc: '출발지·도착지·날짜로 항공권을 검색하고 비교하세요. 찾은 항공편은 트립틱 여행 일정에 바로 담을 수 있어요.',
        body: ['항공권 검색', '왕복·편도 항공권을 날짜별로 검색하고 최저가를 비교합니다. 예약한 항공권 확인서를 올리면 여행 일정에 출국·귀국편이 자동으로 들어갑니다.'],
    },
    '/hotels': {
        title: `호텔 검색 · 숙소 예약 | ${SITE}`,
        desc: '여행지 호텔과 숙소를 검색하고 비교하세요. 예약한 숙소 바우처를 올리면 일정의 숙소가 자동으로 채워져요.',
        body: ['호텔 검색', '여행지별 호텔·숙소를 검색하고 비교합니다. 예약 확인서를 올리면 체크인·체크아웃 날짜에 맞춰 일정에 숙소가 들어갑니다.'],
    },
    '/activities': {
        title: `투어 · 액티비티 · 입장권 | ${SITE}`,
        desc: '여행지 투어, 액티비티, 입장권을 찾아보세요. 마음에 드는 곳은 트립틱 여행 일정에 바로 추가할 수 있어요.',
        body: ['투어·액티비티', '여행지의 투어, 체험, 입장권을 찾아보고 여행 일정에 추가합니다.'],
    },
    '/airports': {
        title: `공항 실시간 출·도착 · 인천공항 | ${SITE}`,
        desc: '인천공항 실시간 출발·도착 전광판을 보세요. 대구·김해·제주 공항도 곧 제공해요.',
        body: ['공항 실시간 정보', '인천국제공항의 출발·도착 항공편을 실시간으로 확인합니다. 대구·김해·제주 공항 정보도 준비 중이에요.'],
    },
};

const SHELL_TTL_MS = 5 * 60 * 1000;
let shellCache = { html: '', at: 0 };

async function loadShell() {
    if (shellCache.html && Date.now() - shellCache.at < SHELL_TTL_MS) return shellCache.html;
    // /index.html은 정적 파일이라 이 함수로 다시 들어오지 않는다
    const res = await fetch(`${ORIGIN}/index.html`, { headers: { 'user-agent': 'triptic-seo-shell' } });
    if (!res.ok) throw new Error(`shell ${res.status}`);
    shellCache = { html: await res.text(), at: Date.now() };
    return shellCache.html;
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** index.html에 주소별 head·본문을 끼운다. 값은 모두 여기서 이스케이프한다. */
export function renderPage(shell, { path, title, desc, heading, paragraphs = [], links = [] }) {
    const url = `${ORIGIN}${path}`;
    const t = escapeHtml(title);
    const d = escapeHtml(desc);
    const head = [
        `<link rel="canonical" href="${escapeHtml(url)}">`,
        `<meta property="og:url" content="${escapeHtml(url)}">`,
    ].join('\n    ');
    const body =
        `<h1>${escapeHtml(heading)}</h1>` +
        paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
        (links.length ? `<ul>${links.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a></li>`).join('')}</ul>` : '');

    // 치환 문자열 대신 함수로 넣는다 — 글 본문에 "$1"·"$&" 같은 글자가 있으면 치환 패턴으로 해석된다
    const wrap = (value) => (_match, before, after) => `${before}${value}${after}`;
    return shell
        .replace(/(<title>)[\s\S]*?(<\/title>)/, wrap(t))
        .replace(/(<meta name="description" content=")[^"]*(")/, wrap(d))
        .replace(/(<meta property="og:title" content=")[^"]*(")/, wrap(t))
        .replace(/(<meta property="og:description" content=")[^"]*(")/, wrap(d))
        .replace(/()(<\/head>)/, wrap(`    ${head}\n  `))
        .replace(/(<div id="seo-intro"[^>]*>)[\s\S]*?(<\/div>\s*<\/div>\s*<\/body>)/, wrap(body));
}

async function renderSitemap() {
    const urls = [
        { loc: '/', priority: '1.0', changefreq: 'weekly' },
        ...Object.keys(STATIC_PAGES).map((p) => ({ loc: p, priority: '0.8', changefreq: 'weekly' })),
    ];
    const items = urls
        .map(
            (u) =>
                `  <url><loc>${escapeHtml(ORIGIN + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
    const route = String(req.query?.route ?? '');

    try {
        if (route === 'sitemap') {
            const xml = await renderSitemap();
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
            return res.status(200).send(xml);
        }

        const shell = await loadShell();
        let html = null;
        if (route === 'page') {
            const path = String(req.query?.path ?? '');
            const page = STATIC_PAGES[path];
            if (page) {
                html = renderPage(shell, { path, title: page.title, desc: page.desc, heading: page.body[0], paragraphs: [page.body[1]] });
            }
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (!html) {
            // 없는 여행지·비공개 글 — 앱 화면은 그대로 주되 로봇에게는 없는 주소로 알린다
            res.setHeader('Cache-Control', 'public, s-maxage=600');
            return res.status(404).send(shell);
        }
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(html);
    } catch (err) {
        console.error('[seo]', err instanceof Error ? err.message : err);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(500).send(`<!doctype html><title>${SITE}</title><p>${escapeHtml(DEFAULT_DESC)}</p>`);
    }
}
