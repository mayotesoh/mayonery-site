/**
 * A: 各用語ページの本文に実際に登場する「他の用語」を、末尾に
 *    「関連用語」セクションとして内部リンクで追加する（捏造なし）。
 * 既存の「関連用語」があれば作り直す（重複解消・改名後のリンク張り直しに対応）。
 * 別名（「頭脳線 / 知能線」）は基底名・別名の両方でマッチ。
 * 実行: node tools/glossary_crosslink.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
(function () { try { const t = readFileSync(join(ROOT, '.env'), 'utf8'); for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {} })();
const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_GLOSSARY_ID || '344a43543ec2805e9409e969a3f3f651';
const SITE = 'https://mayonery.jp';
const MAX_RELATED = 6;

async function api(p, m, b) { const r = await fetch('https://api.notion.com/v1' + p, { method: m, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j)); return j; }
const blockText = (b) => { const rt = b[b.type]?.rich_text; return Array.isArray(rt) ? rt.map((t) => t.plain_text).join('') : ''; };

// 全ページ取得
const pages = []; let c;
do { const body = { page_size: 100 }; if (c) body.start_cursor = c; const r = await api(`/databases/${DB_ID}/query`, 'POST', body);
  for (const p of r.results) {
    const name = p.properties['名前']?.title?.[0]?.plain_text || '';
    // 別名対応: 「A / B」→ 照合語 [A, B]
    const matchNames = name.split(/[／/]/).map((s) => s.replace(/\s+/g, '').trim()).filter((s) => s.length >= 2);
    pages.push({ id: p.id, name, matchNames, slug: p.properties['URLスラッグ']?.rich_text?.[0]?.plain_text || p.id, meaning: (p.properties['意味']?.rich_text || []).map((t) => t.plain_text).join('') });
  }
  c = r.has_more ? r.next_cursor : null;
} while (c);
console.log('用語ページ数: ' + pages.length);

let updated = 0, none = 0;
for (const p of pages) {
  try {
    const ch = await api(`/blocks/${p.id}/children?page_size=100`, 'GET');
    const kids = ch.results || [];
    // 既存の「関連用語」セクション（見出し＋直後の段落）を削除対象に
    const relIdx = kids.findIndex((b) => (b.type === 'heading_3' || b.type === 'heading_2') && blockText(b) === '関連用語');
    const toDelete = [];
    if (relIdx !== -1) {
      toDelete.push(kids[relIdx]);
      if (kids[relIdx + 1] && kids[relIdx + 1].type === 'paragraph') toDelete.push(kids[relIdx + 1]);
    }
    const contentKids = kids.filter((b) => !toDelete.includes(b));
    const text = p.meaning + ' ' + contentKids.map(blockText).join(' ');

    const related = [];
    const usedId = new Set([p.id]);
    for (const d of pages) {
      if (usedId.has(d.id)) continue;
      if (d.matchNames.some((mn) => text.includes(mn))) { related.push(d); usedId.add(d.id); }
      if (related.length >= MAX_RELATED) break;
    }

    // 旧セクション削除
    for (const b of toDelete) await api('/blocks/' + b.id, 'DELETE');
    if (related.length === 0) { none++; continue; }

    const linkParts = [];
    related.forEach((r, i) => {
      if (i > 0) linkParts.push({ type: 'text', text: { content: '、' } });
      linkParts.push({ type: 'text', text: { content: r.name, link: { url: `${SITE}/glossary/${r.slug}/` } } });
    });
    await api(`/blocks/${p.id}/children`, 'PATCH', {
      children: [
        { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '関連用語' } }] } },
        { object: 'block', type: 'paragraph', paragraph: { rich_text: linkParts } },
      ],
    });
    updated++;
    console.log('リンク: ' + p.name + ' → ' + related.map((r) => r.name).join('・'));
  } catch (e) { console.error('失敗: ' + p.name + ' -> ' + (e.message || e)); }
}
console.log(`\n=== 完了 === 追加/更新${updated} / 関連なし${none}`);
