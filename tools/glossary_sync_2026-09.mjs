// 手相DB（ローカル）を正として、Notionの用語集DBを同期する。
//   node tools/glossary_sync_2026-09.mjs            ← ドライラン（差分を出すだけ）
//   node tools/glossary_sync_2026-09.mjs --apply    ← 実際に書き込む
//
// 正本: C:/Users/mayonery/クロード広場/手相DB/terms/*.md
//
// **載せる条件は `公開範囲: 公開可` だけ。**
//   ・`講座限定` … 測り方・判定基準・作図手順・目盛りの数値 → 出さない
//   ・`内部のみ` … 配慮が要る話 → 出さない
//   ・`サイト掲載` は「すでにサイトにあるか」の記録であって、載せるかの判断ではない（README:72）
//
// Notion側にあってローカルに無いページは、消さずに `公開ステータス = 下書き` にして隠す。
// （用語名のゆれで重複しているページが多いため。例：マスカケ / マスカケ線 / ますかけ線）
import { readFileSync, readdirSync } from 'node:fs';

(function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB = '344a43543ec2805e9409e969a3f3f651';
const APPLY = process.argv.includes('--apply');
const TERMS = 'C:/Users/mayonery/クロード広場/手相DB/terms';

const api = async (path, method, body) => {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j;
};

// ---------- ローカルの用語を読む ----------
function parseTerm(file) {
  const s = readFileSync(TERMS + '/' + file, 'utf8').replace(/\r\n/g, '\n');
  if (!s.startsWith('---')) return null;
  const [, fm, body] = s.split(/^---$/m, 3);
  // 値が空の行で `\s*` を使うと改行を食べて次の行を拾う恐れがある。必ず `[ \t]*` にすること
  const g = (k) => (fm.match(new RegExp('^' + k + ':[ \\t]*(.*)$', 'm')) || [])[1]?.trim() || '';
  return {
    name: g('名前'), reading: g('読み'), cat: g('カテゴリー'), slug: g('URLスラッグ'),
    meaning: g('意味'), hill: g('丘のエネルギー'), scope: g('公開範囲'),
    alias: g('別名'), related: g('関連').replace(/^\[|\]$/g, ''),
    body: body.trim(),
  };
}

const local = readdirSync(TERMS).filter((f) => f.endsWith('.md')).map(parseTerm).filter((t) => t && t.scope === '公開可');
console.log('ローカルの公開可:', local.length, '語');

// ---------- 本文から「公開してよい部分」だけを取り出す ----------
//
// 用語ファイルの本文には、読者向けの説明と**内部メモが混在している。**
// そのまま載せると、録画の動画ID＋時刻・型枠の内部事情・未確定の断り書きが公開される。
// 実際に一度公開してしまった（2026-09-28）。以下の3段で止める。

// ① 節ごと落とす（見出しが一致したら、次の ## まで全部捨てる）
const DROP_SECTION = [
  '言ってはいけないこと',  // 講師向けの配慮の指示
  '未確定な点',            // 検証中の断り書き
  '根拠',                  // 録画の出典が並ぶ
  '教材に載せるときの表現案', // 教材制作用
  '講師の考察',            // 内部の考察メモ
];
const DROP_SECTION_RE = /^【本人決定/;  // 「## 【本人決定 2026-09-23】…」など

// ② 行ごと落とす（節は残すが、その行だけ捨てる）
const DROP_LINE = [
  /[A-Za-z0-9_-]{11}@\d{2}:\d{2}/,  // 録画の動画ID＋時刻
  /要確認/, /型枠/, /旧版/, /出典[：:]/, /^由来は/, /講義では触れていない/,
  /\d+回目/,                         // 「38回目」など内部の回次
];

function publicBody(md) {
  const out = [];
  let skip = false;
  for (const line of md.split('\n')) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      const title = h[1].trim();
      skip = DROP_SECTION.includes(title) || DROP_SECTION_RE.test(title);
      if (skip) continue;
    }
    if (skip) continue;
    if (DROP_LINE.some((re) => re.test(line))) continue;
    out.push(line);
  }
  // 見出しだけが残って中身が空になった節を畳む
  const lines = out.join('\n').split('\n');
  const kept = lines.filter((l, i) => {
    if (!/^#{2,3}\s/.test(l)) return true;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{2,3}\s/.test(lines[j])) return false;
      if (lines[j].trim()) return true;
    }
    return false;
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ③ 最後の関門：組み上がったブロックに内部情報が残っていたら、止める
const LEAK = /[A-Za-z0-9_-]{11}@\d{2}:\d{2}/;
function assertClean(name, blocks) {
  for (const b of blocks) {
    const s = (b[b.type]?.rich_text || []).map((t) => t.text.content).join('');
    if (LEAK.test(s)) throw new Error(`[${name}] 出典が残っています: ${s.slice(0, 80)}`);
  }
}

// ---------- Markdown → Notion ブロック ----------
const rich = (s) => {
  const out = [];
  // **太字** と [表示](URL) に対応。関連語は本文側でリンクにしている前提
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  const push = (text, opt) => { if (text) out.push({ type: 'text', text: { content: text, link: opt?.link ? { url: opt.link } : null }, annotations: { bold: !!opt?.bold } }); };
  while ((m = re.exec(s))) {
    push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) push(t.slice(2, -2), { bold: true });
    else { const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/); push(mm[1], { link: mm[2] }); }
    last = m.index + t.length;
  }
  push(s.slice(last));
  return out.length ? out : [{ type: 'text', text: { content: s } }];
};

function toBlocks(md) {
  const out = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];
    const t = L.trim();
    if (!t) { i++; continue; }
    // 表：Notionの表ブロックは作りが重いので、行ごとの箇条書きに落とす
    if (t.startsWith('|') && (lines[i + 1] || '').trim().startsWith('|-')) {
      const head = t.split('|').slice(1, -1).map((x) => x.trim());
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().split('|').slice(1, -1).map((x) => x.trim());
        const text = cells.map((c, k) => (head[k] && cells.length > 1 ? `${head[k]}：${c}` : c)).filter(Boolean).join(' ／ ');
        out.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rich(text) } });
        i++;
      }
      continue;
    }
    if (t.startsWith('#')) {
      const lv = (t.match(/^#+/) || [''])[0].length;
      const type = lv <= 2 ? 'heading_2' : 'heading_3';
      out.push({ object: 'block', type, [type]: { rich_text: rich(t.replace(/^#+\s*/, '')) } });
      i++; continue;
    }
    if (t.startsWith('> ')) {
      out.push({ object: 'block', type: 'quote', quote: { rich_text: rich(t.slice(2)) } });
      i++; continue;
    }
    if (/^[-*]\s+/.test(t)) {
      out.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rich(t.replace(/^[-*]\s+/, '')) } });
      i++; continue;
    }
    if (/^\d+\.\s+/.test(t)) {
      out.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: rich(t.replace(/^\d+\.\s+/, '')) } });
      i++; continue;
    }
    // 段落（続く行をまとめる）
    const buf = [t]; i++;
    while (i < lines.length && lines[i].trim() && !/^([-*#>|]|\d+\.)/.test(lines[i].trim())) { buf.push(lines[i].trim()); i++; }
    out.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rich(buf.join('')) } });
  }
  return out;
}

// ---------- Notion側を読む ----------
// 空文字でも空配列を返す＝Notion側の値が消える。前の取り込みの残骸を確実に消すために必要
const rt = (s) => (s ? [{ type: 'text', text: { content: s } }] : []);
const plain = (p) => (p ? (p.rich_text || p.title || []).map((x) => x.plain_text).join('') : '');

let cur, rows = [];
do {
  const r = await api('/databases/' + DB + '/query', 'POST', { page_size: 100, start_cursor: cur });
  rows.push(...r.results);
  cur = r.has_more ? r.next_cursor : null;
} while (cur);
console.log('Notionの既存:', rows.length, '件\n');

// 対応づけ：① スラッグ一致 ② 名前完全一致 ③ Notion名「A / B」のどちらかが一致
const bySlug = new Map(rows.map((r) => [plain(r.properties['URLスラッグ']), r]));
const byName = new Map(rows.map((r) => [plain(r.properties['名前']), r]));
const byAlias = new Map();
for (const r of rows) for (const part of plain(r.properties['名前']).split(/\s*[/／]\s*/)) if (part) if (!byAlias.has(part)) byAlias.set(part, r);

const used = new Set();
const match = (t) => {
  for (const cand of [bySlug.get(t.slug), byName.get(t.name), byAlias.get(t.name)]) {
    if (cand && !used.has(cand.id)) { used.add(cand.id); return cand; }
  }
  return null;
};

let created = 0, updated = 0, hidden = 0;
for (const t of local.sort((a, b) => a.name.localeCompare(b.name, 'ja'))) {
  const row = match(t);
  const props = {
    '名前': { title: rt(t.name) },
    '読み': { rich_text: rt(t.reading) },
    '意味': { rich_text: rt(t.meaning) },
    'URLスラッグ': { rich_text: rt(t.slug) },
    '丘のエネルギー': { rich_text: rt(t.hill) },
    'カテゴリー': t.cat ? { select: { name: t.cat } } : undefined,
    '公開ステータス': { status: { name: '公開' } },
  };
  for (const k of Object.keys(props)) if (props[k] === undefined) delete props[k];

  const blocks = toBlocks(publicBody(t.body));
  assertClean(t.name, blocks);
  if (row) {
    updated++;
    const oldName = plain(row.properties['名前']);
    console.log(`  更新 ${t.name}${oldName !== t.name ? `（旧「${oldName}」）` : ''}  本文 ${blocks.length}ブロック`);
    if (APPLY) {
      await api('/pages/' + row.id, 'PATCH', { properties: props });
      const old = await api('/blocks/' + row.id + '/children?page_size=100');
      for (const b of old.results || []) await api('/blocks/' + b.id, 'PATCH', { archived: true });
      for (let i = 0; i < blocks.length; i += 100) await api('/blocks/' + row.id + '/children', 'PATCH', { children: blocks.slice(i, i + 100) });
    }
  } else {
    created++;
    console.log(`  新規 ${t.name}  本文 ${blocks.length}ブロック`);
    if (APPLY) {
      const page = await api('/pages', 'POST', { parent: { database_id: DB }, properties: props });
      for (let i = 0; i < blocks.length; i += 100) await api('/blocks/' + page.id + '/children', 'PATCH', { children: blocks.slice(i, i + 100) });
    }
  }
}

// ---------- 隠すページは名指しだけ ----------
// **既定は「残す」。** ローカルDBに無いというだけで隠すと、有効な語が消える。
const HIDE = {
  // 流年の技術名。方針として、測り方・目盛り・作図手順は公開しない。
  // 「西谷式」は他の手相家の名前でもある（広報方針でも名指しはしない）
  'nishitani-ryunen': '流年の技術名／他の手相家の名前',
  'vertical-ryunen': '流年の技術名',
  'mayonery-ryunen': '流年の技術名',
  'life-line-ryunen': '流年の技術名',
  'finger-basis-method': '流年の基準の取り方',
  'three-division-method': '流年の基準の取り方',
  'ryuunenhou': '流年の技術名（ローカルDBでも講座限定）',
  // 同じ語が二重に登録されているもの。本体に統合して、こちらを隠す
  'masukakesen': '「マスカケ」に統合',
  'henkeimasukakesen': '「変形マスカケ」に統合',
  'henkei-masukake-line': '「変形マスカケ」に統合',
  'triangle-sankaku': '「トライアングル」に統合',
  'square-shikaku': '「スクエア」に統合',
  'hoshi': '「スター」に統合',
  'wart': '「ほくろ / イボ」に統合',
};

console.log('\n── 隠すページ（名指しのみ）──');
for (const r of rows) {
  const slug = plain(r.properties['URLスラッグ']);
  if (used.has(r.id) || !HIDE[slug]) continue;
  const st = r.properties['公開ステータス']?.status?.name || '';
  if (st === '下書き') continue;
  hidden++;
  console.log('  隠す ' + plain(r.properties['名前']).padEnd(20, '　') + ' ← ' + HIDE[slug]);
  if (APPLY) await api('/pages/' + r.id, 'PATCH', { properties: { '公開ステータス': { status: { name: '下書き' } } } });
}

const keep = rows.filter((r) => !used.has(r.id) && !HIDE[plain(r.properties['URLスラッグ'])]);
console.log('\n── そのまま残すページ（ローカルDBに無いが有効な語）:', keep.length, '件 ──');
console.log('  ' + keep.map((r) => plain(r.properties['名前'])).join(' / '));
console.log('  ※ いずれローカルDBに起こすと、本文を厚くできる');

console.log(`\n${APPLY ? '書き込みました' : 'ドライラン（書き込みなし）'}: 新規 ${created} ／ 更新 ${updated} ／ 非表示 ${hidden}`);
if (!APPLY) console.log('実際に反映するには --apply を付けて実行してください');
