// ロックンロールマップ：検索エンジン向け静的ページ生成スクリプト
//
// index.html の `const bands = [...]` を読み込んで、次のファイルを作り直します。
//   band/<slug>/index.html     … バンドごとのページ（「バンド名 出身地」で検索されたとき用）
//   country/<slug>/index.html  … 国ごとの一覧ページ
//   bands/index.html           … 全バンド一覧ページ
//   sitemap.xml                … 上記すべてのURL
//
// 使い方（リポジトリの一番上のフォルダで）:  node tools/build-pages.mjs
// バンドを追加したら index.html を編集してから、これを実行し直すだけでOK。
// GitHub Actions（.github/workflows/build-pages.yml）が入っていれば、push時に自動で実行されます。

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://mosh696job-lab.github.io/rocknroll-map';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- データ読み込み ----------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/const bands = (\[[\s\S]*?\n\]);/);
if (!m) throw new Error('index.html に const bands = [...] が見つかりません');
const rawBands = vm.runInNewContext(m[1]);

const COUNTRY = {
  UK: ['イギリス', '🇬🇧', 'uk'], USA: ['アメリカ', '🇺🇸', 'usa'], Canada: ['カナダ', '🇨🇦', 'canada'],
  Australia: ['オーストラリア', '🇦🇺', 'australia'], Germany: ['ドイツ', '🇩🇪', 'germany'],
  Sweden: ['スウェーデン', '🇸🇪', 'sweden'], Finland: ['フィンランド', '🇫🇮', 'finland'],
  Ireland: ['アイルランド', '🇮🇪', 'ireland'], Spain: ['スペイン', '🇪🇸', 'spain'], Italy: ['イタリア', '🇮🇹', 'italy'],
  Norway: ['ノルウェー', '🇳🇴', 'norway'], Brazil: ['ブラジル', '🇧🇷', 'brazil'], Japan: ['日本', '🇯🇵', 'japan'],
  France: ['フランス', '🇫🇷', 'france'], UAE: ['アラブ首長国連邦', '🇦🇪', 'uae'], Netherlands: ['オランダ', '🇳🇱', 'netherlands'],
  'New Zealand': ['ニュージーランド', '🇳🇿', 'new-zealand'], Argentina: ['アルゼンチン', '🇦🇷', 'argentina'],
  Mexico: ['メキシコ', '🇲🇽', 'mexico'], 'South Korea': ['韓国', '🇰🇷', 'south-korea'], Taiwan: ['台湾', '🇹🇼', 'taiwan'],
  China: ['中国', '🇨🇳', 'china'], Russia: ['ロシア', '🇷🇺', 'russia'], Belarus: ['ベラルーシ', '🇧🇾', 'belarus'],
  Israel: ['イスラエル', '🇮🇱', 'israel'], India: ['インド', '🇮🇳', 'india'], Iceland: ['アイスランド', '🇮🇸', 'iceland'],
  'South Africa': ['南アフリカ', '🇿🇦', 'south-africa'], Nigeria: ['ナイジェリア', '🇳🇬', 'nigeria'],
  Portugal: ['ポルトガル', '🇵🇹', 'portugal'], Greece: ['ギリシャ', '🇬🇷', 'greece'],
  'Czech Republic': ['チェコ', '🇨🇿', 'czech-republic'], Serbia: ['セルビア', '🇷🇸', 'serbia'],
  Poland: ['ポーランド', '🇵🇱', 'poland'], Austria: ['オーストリア', '🇦🇹', 'austria'],
};
const country = c => {
  const v = COUNTRY[c];
  return v ? { ja: v[0], flag: v[1], slug: v[2] } : { ja: c, flag: '🌍', slug: slugify(c) };
};

const GENRE = {
  'Hard Rock': 'ハードロック', 'Heavy Metal': 'ヘヴィメタル', 'Classic Rock': 'クラシックロック',
  'Punk Rock': 'パンクロック', Alternative: 'オルタナティブ', Grunge: 'グランジ',
  'Progressive Rock': 'プログレ', 'J-Rock': 'J-Rock', Solo: 'ソロアーティスト', 'Nu-Metal': 'ニューメタル',
};
const genreJa = g => GENRE[g] || g;

// ---------- ユーティリティ ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function slugify(s) {
  // アクセント付きラテン文字だけ記号を外す（日本語の濁点・長音は残す）
  const out = String(s)
    .normalize('NFKC')
    .replace(/[À-ɏ]/g, ch => ch.normalize('NFD').replace(/\p{M}/gu, ''))
    .replace(/ˉ/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}ー]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return out || 'artist';
}
// 「○○で結成」の場所表記：City（国）、日本は都市名のみ
const placeText = l => l.country === 'Japan' ? `${l.city}` : `${l.city}（${country(l.country).ja}）`;

// ---------- 同名の重複をまとめる ----------
const byName = new Map();
for (const b of rawBands) {
  if (!byName.has(b.name)) byName.set(b.name, []);
  byName.get(b.name).push(b);
}
const used = new Set();
const artists = [...byName.entries()].map(([name, list]) => {
  const locs = [];
  for (const b of list) if (!locs.some(l => l.city === b.city && l.country === b.country)) locs.push(b);
  const genres = [...new Set(list.map(b => b.genre))];
  const members = list.map(b => b.members).sort((a, b) => b.length - a.length)[0];
  let slug = slugify(name), n = 2;
  while (used.has(slug)) slug = `${slugify(name)}-${n++}`;
  used.add(slug);
  return { name, slug, locs, genres, formed: Math.min(...list.map(b => b.formed)), members, solo: genres.every(g => g === 'Solo') };
});
artists.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
const TOTAL = artists.length;
const TOTAL_LABEL = `${Math.floor(TOTAL / 100) * 100}組以上`;

// ---------- グループ化（国ごと、多い順） ----------
const countryGroups = {};
{
  const tmp = {};
  for (const a of artists) for (const c of new Set(a.locs.map(l => l.country))) (tmp[c] ||= []).push(a);
  for (const c of Object.keys(tmp).sort((x, y) => tmp[y].length - tmp[x].length)) countryGroups[c] = tmp[c];
}

// ---------- 共通HTML ----------
let relRoot = '../../';
function page({ title, description, canonical, body, jsonld = [], extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="ロックンロールマップ">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="${relRoot}assets/pages.css">
${extraHead}${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<header class="site-header">
  <a class="brand" href="${relRoot}"><span class="guitar">🎸</span><span>ロックンロールマップ</span></a>
  <nav><a href="${relRoot}">地図</a><a href="${relRoot}bands/">バンド一覧</a></nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <p><a href="${relRoot}">ロックンロールマップ</a> ― 世界${TOTAL_LABEL}のロックバンド・アーティストの出身地を地図で見られるサイト</p>
  <p class="countries">${Object.keys(countryGroups).map(c => `<a href="${relRoot}country/${country(c).slug}/">${country(c).flag} ${esc(country(c).ja)}</a>`).join(' ')}</p>
</footer>
</body>
</html>
`;
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: it[1] })),
  };
}
function crumbs(items) {
  return `<nav class="crumbs">${items.map((it, i) => i === items.length - 1 ? `<span>${esc(it[0])}</span>` : `<a href="${it[1]}">${esc(it[0])}</a>`).join(' › ')}</nav>`;
}
const artistLink = a => `<li><a href="${relRoot}band/${encodeURIComponent(a.slug)}/">${esc(a.name)}</a><span class="sub">${esc(a.locs[0].city)} ／ ${a.formed}年</span></li>`;

// ---------- 出力先をリセット ----------
for (const d of ['band', 'country', 'bands']) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });
const write = (rel, content) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const urls = [{ loc: `${SITE}/`, priority: '1.0' }];

// ---------- バンドページ ----------
relRoot = '../../';
for (const a of artists) {
  const url = `${SITE}/band/${encodeURIComponent(a.slug)}/`;
  const first = a.locs[0];
  const c0 = country(first.country);
  const places = a.locs.map(placeText).join('、');
  const gj = a.genres.map(genreJa).join('・');
  const kind = a.solo ? 'アーティスト' : 'バンド';

  const title = `${a.name}の出身地は${a.locs.map(l => l.city).join('・')}（${[...new Set(a.locs.map(l => country(l.country).ja))].join('・')}）｜ロックンロールマップ`;
  const description = `${a.name}は${a.formed}年に${places}で${a.solo ? '活動を始めた' : '結成された'}${gj}の${kind}。${a.solo ? '' : `メンバー：${a.members}。`}世界${TOTAL_LABEL}のロックバンドの出身地を地図で見られるロックンロールマップ。`.replace(/\.\.\.。/, '…。');

  const sameCity = artists.filter(o => o !== a && o.locs.some(l => a.locs.some(x => x.city === l.city && x.country === l.country))).slice(0, 12);
  const sameEra = artists.filter(o => o !== a && !sameCity.includes(o) && o.genres.some(g => a.genres.includes(g)) && Math.floor(o.formed / 10) === Math.floor(a.formed / 10)).slice(0, 12);
  const mapLink = `${relRoot}?band=${encodeURIComponent(a.name)}`;

  const body = `
${crumbs([['ロックンロールマップ', relRoot], [`${c0.ja}のロックバンド`, `${relRoot}country/${c0.slug}/`], [a.name, url]])}
<article class="band">
  <h1>${esc(a.name)}<span class="h1-sub">の出身地</span></h1>
  <p class="lead">${c0.flag} <strong>${esc(a.name)}</strong>は${a.formed}年に<strong>${esc(places)}</strong>で${a.solo ? '活動を始めた' : '結成された'}${esc(gj)}の${kind}です。</p>
  <dl class="facts">
    <dt>出身地</dt><dd>${a.locs.map(l => `${esc(l.city)}, ${esc(country(l.country).ja)}`).join('<br>')}</dd>
    <dt>国</dt><dd>${[...new Set(a.locs.map(l => l.country))].map(c => `<a href="${relRoot}country/${country(c).slug}/">${country(c).flag} ${esc(country(c).ja)}</a>`).join('、')}</dd>
    <dt>ジャンル</dt><dd>${esc(gj)}</dd>
    <dt>${a.solo ? '活動開始' : '結成'}</dt><dd>${a.formed}年</dd>
    <dt>${a.solo ? '本人' : 'メンバー'}</dt><dd>${esc(a.members)}</dd>
  </dl>
  <div id="minimap" class="minimap" data-points='${esc(JSON.stringify(a.locs.map(l => [l.lat, l.lng, l.city])))}'></div>
  <a class="cta" href="${mapLink}">🗺️ ロックンロールマップで周辺のバンドも見る →</a>
</article>
${sameCity.length ? `<section><h2>${esc(first.city)}出身のほかのバンド</h2><ul class="list">${sameCity.map(artistLink).join('')}</ul></section>` : ''}
${sameEra.length ? `<section><h2>同じ時代（${Math.floor(a.formed / 10) * 10}年代）の${esc(genreJa(a.genres[0]))}</h2><ul class="list">${sameEra.map(artistLink).join('')}</ul></section>` : ''}
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="${relRoot}assets/minimap.js"></script>`;

  const entity = a.solo
    ? { '@context': 'https://schema.org', '@type': 'Person', name: a.name, homeLocation: { '@type': 'Place', name: `${first.city}, ${first.country}` }, url }
    : {
        '@context': 'https://schema.org', '@type': 'MusicGroup', name: a.name, url,
        genre: a.genres.map(genreJa), foundingDate: String(a.formed),
        foundingLocation: { '@type': 'Place', name: `${first.city}, ${first.country}`, geo: { '@type': 'GeoCoordinates', latitude: first.lat, longitude: first.lng } },
        member: a.members.replace(/\.\.\.$/, '').split(/,\s*/).filter(Boolean).map(n => ({ '@type': 'Person', name: n.trim() })),
      };

  write(`band/${a.slug}/index.html`, page({
    title, description, canonical: url, body,
    extraHead: '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">\n',
    jsonld: [entity, breadcrumbLd([['ロックンロールマップ', `${SITE}/`], [`${c0.ja}のロックバンド`, `${SITE}/country/${c0.slug}/`], [a.name, url]])],
  }));
  urls.push({ loc: url, priority: '0.6' });
}

// ---------- 国ページ ----------
relRoot = '../../';
for (const [c, list] of Object.entries(countryGroups)) {
  const ci = country(c);
  const url = `${SITE}/country/${ci.slug}/`;
  const cities = {};
  for (const a of list) for (const l of a.locs.filter(l => l.country === c)) (cities[l.city] ||= []).push(a);
  const cityEntries = Object.entries(cities).sort((x, y) => y[1].length - x[1].length);
  const topNames = list.slice().sort((x, y) => x.formed - y.formed).slice(0, 4).map(a => a.name).join('、');
  const title = `${ci.ja}出身のロックバンド一覧（${list.length}組）｜出身地マップ - ロックンロールマップ`;
  const description = `${ci.ja}出身のロックバンド・アーティスト${list.length}組を出身都市ごとに一覧で紹介。${topNames}など。出身地を世界地図で確認できます。`;
  const body = `
${crumbs([['ロックンロールマップ', relRoot], [`${ci.ja}のロックバンド`, url]])}
<h1>${ci.flag} ${esc(ci.ja)}出身のロックバンド一覧</h1>
<p class="lead">${esc(ci.ja)}出身のバンド・アーティスト <strong>${list.length}組</strong> を出身都市ごとにまとめました。</p>
${cityEntries.map(([city, as]) => `<section><h2>${esc(city)} <span class="count">${as.length}組</span></h2><ul class="list">${as.map(artistLink).join('')}</ul></section>`).join('\n')}`;
  write(`country/${ci.slug}/index.html`, page({
    title, description, canonical: url, body,
    jsonld: [breadcrumbLd([['ロックンロールマップ', `${SITE}/`], [`${ci.ja}のロックバンド`, url]])],
  }));
  urls.push({ loc: url, priority: '0.7' });
}

// ---------- 全バンド一覧 ----------
relRoot = '../';
{
  const url = `${SITE}/bands/`;
  const groups = {};
  for (const a of artists) {
    const ch = a.name.replace(/^the\s+/i, '').normalize('NFKD').charAt(0).toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : /[0-9]/.test(ch) ? '0-9' : 'その他（日本語など）';
    (groups[key] ||= []).push(a);
  }
  const keys = Object.keys(groups).sort((x, y) => (x.length > 3) - (y.length > 3) || x.localeCompare(y));
  const body = `
${crumbs([['ロックンロールマップ', relRoot], ['バンド一覧', url]])}
<h1>ロックバンド・アーティスト一覧（${TOTAL}組）</h1>
<p class="lead">ロックンロールマップに掲載している全${TOTAL}組です。名前をクリックすると出身地がわかります。</p>
<nav class="az">${keys.map(k => `<a href="#g-${encodeURIComponent(k)}">${esc(k.length > 3 ? 'あ' : k)}</a>`).join('')}</nav>
<h2>国別</h2>
<ul class="list countries-list">${Object.entries(countryGroups).map(([c, l]) => `<li><a href="${relRoot}country/${country(c).slug}/">${country(c).flag} ${esc(country(c).ja)}</a><span class="sub">${l.length}組</span></li>`).join('')}</ul>
${keys.map(k => `<section id="g-${esc(k)}"><h2>${esc(k)}</h2><ul class="list">${groups[k].map(artistLink).join('')}</ul></section>`).join('\n')}`;
  write('bands/index.html', page({
    title: `ロックバンド出身地一覧（${TOTAL}組）｜ロックンロールマップ`,
    description: `世界${TOTAL_LABEL}のロックバンド・アーティストの出身地一覧。バンド名から出身地・結成年・メンバーを調べられます。`,
    canonical: url, body,
    jsonld: [breadcrumbLd([['ロックンロールマップ', `${SITE}/`], ['バンド一覧', url]])],
  }));
  urls.splice(1, 0, { loc: url, priority: '0.8' });
}

// ---------- sitemap.xml ----------
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${TODAY}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`);

console.log(`バンド ${artists.length} ページ / 国 ${Object.keys(countryGroups).length} ページ / 一覧 1 ページ / sitemap ${urls.length} URL を生成しました`);
