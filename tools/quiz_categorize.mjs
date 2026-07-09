/**
 * クイズDBに「カテゴリー」(select)を追加し、107問を内容で自動分類する。
 * 実行: node tools/quiz_categorize.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
(function () { try { const t = readFileSync(join(ROOT, '.env'), 'utf8'); for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {} })();
const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_QUIZ_ID || '347a43543ec2805f82f2cbb58642599e';
async function api(p, m, b) { const r = await fetch('https://api.notion.com/v1' + p, { method: m, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j)); return j; }
const rt = (p) => (p?.rich_text?.[0]?.plain_text) || '';

const CATS = ['丘（マウント）', '線（ライン）', '記号・マーク', '手の形・指', '流年・基本'];

// 問題文（＋解説）から分類。優先順に最初にヒットしたもの。
function classify(q, exp) {
  const t = q + ' ' + exp;
  const has = (arr) => arr.some((k) => t.includes(k));
  if (has(['島', '切れ', '切り替わり', 'ほくろ', 'イボ', 'あざ', 'シミ', 'スター', '四角', 'スクエア', '三角', 'トライアングル', '神秘十字', 'マーク', '傷'])) return '記号・マーク';
  if (has(['生命線', '頭脳線', '知能線', '感情線', '運命線', '太陽線', '木星線', '水星線', '影響線', '結婚線', '障害線', '支線', '二重', '開運線', '向上線'])) return '線（ライン）';
  if (has(['火星平原', '金星丘', '月丘', '地丘', '土星丘', '太陽丘', '水星丘', '木星丘', '火星丘', '丘', 'マウント'])) return '丘（マウント）';
  if (has(['長方形', '正方形', '火の手', '水の手', '地の手', '風の手', 'エレメント', '人差し指', '中指', '薬指', '小指', '親指', '指が長', '指が短', '爪'])) return '手の形・指';
  return '流年・基本';
}

// 1) カテゴリープロパティ（select）を作成/更新
await api('/databases/' + DB_ID, 'PATCH', {
  properties: { 'カテゴリー': { select: { options: CATS.map((name) => ({ name })) } } },
});
console.log('カテゴリープロパティを用意しました');

// 2) 全問取得して分類
const quizzes = []; let c;
do { const body = { page_size: 100 }; if (c) body.start_cursor = c; const r = await api(`/databases/${DB_ID}/query`, 'POST', body); for (const p of r.results) quizzes.push({ id: p.id, q: p.properties['問題文']?.title?.[0]?.plain_text || '', exp: rt(p.properties['解説']), cur: p.properties['カテゴリー']?.select?.name || '' }); c = r.has_more ? r.next_cursor : null; } while (c);

const dist = {};
let updated = 0;
for (const z of quizzes) {
  const cat = classify(z.q, z.exp);
  dist[cat] = (dist[cat] || 0) + 1;
  if (z.cur === cat) continue;
  await api('/pages/' + z.id, 'PATCH', { properties: { 'カテゴリー': { select: { name: cat } } } });
  updated++;
}
console.log('総数:', quizzes.length, '/ 更新:', updated);
console.log('分布:', JSON.stringify(dist, null, 0));
