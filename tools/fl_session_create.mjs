// FL講座DBに「鑑定攻略セッション」の行を作る（無ければ作る／あれば何もしない）。
//   node tools/fl_session_create.mjs           ← ドライラン
//   node tools/fl_session_create.mjs --apply   ← 作成
// 本文は kouza_detail_2026-09.mjs が入れるので、ここではプロパティだけ作る。
import { readFileSync } from 'node:fs';
const t = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const T = process.env.NOTION_FL_TOKEN, DB = '9e653e0af59e47ebb3c1c9d443339e48';
const APPLY = process.argv.includes('--apply');
const H = { Authorization: 'Bearer ' + T, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const NAME = '鑑定攻略セッション（手相鑑定の添削・壁打ち）';
const INSTRUCTOR = '39576a17-0aae-803d-a513-d7c2ad942c9d'; // 手相のマヨネリ（フル講座と同じ）

const qr = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, { method: 'POST', headers: H, body: JSON.stringify({ page_size: 100 }) });
const q = await qr.json();
const tx = p => (p ? (p.rich_text || p.title || []).map(x => x.plain_text).join('') : '');
if (q.results.some(r => tx(r.properties['講座名']).includes('鑑定攻略'))) { console.log('すでにあります。何もしません'); process.exit(0); }

const rt = s => [{ type: 'text', text: { content: s } }];
const props = {
  '講座名': { title: rt(NAME) },
  'コース名': { rich_text: rt('手相 鑑定攻略（オンラインセッション）') },
  '説明': { rich_text: rt('読めない手、組み立てられない鑑定を、講師と1対1で攻略します。詰まった1件を持ち込み、次に同じ手が来たときの手順まで持ち帰ります。オンライン・録画つき。60分 ¥5,500／120分 ¥9,900／5回券 ¥24,000（1年有効）。') },
  '補足': { rich_text: rt('受講前提：手相講座　手相学編。事前に手の写真・相談内容・自分の読み・詰まった点をお送りいただきます。延長なし。月の受付枠に上限があります。キャンセルは前日まで全額返金・当日は返金なし。') },
  '提供方法': { rich_text: rt('オンライン（1対1・録画つき）') },
  '期間・時間': { rich_text: rt('60分 ／ 120分 ／ 5回券（1回60分・有効期限1年）') },
  '非会員価格(税抜き)': { number: 5000 }, // 5,000 × 1.1 = 5,500（税込・60分の価格）
  'カテゴリ': { multi_select: [{ name: '手相・鑑定スキル' }] },
  '種別': { select: { name: 'セッション' } },
  '占術': { multi_select: [{ name: '手相' }] },
  '担当講師': { relation: [{ id: INSTRUCTOR }] },
  '表示順': { number: 12 },
  '公開': { checkbox: true },
  '決済対象': { checkbox: false },
};
console.log('作成する行:');
for (const [k, v] of Object.entries(props)) console.log('   ' + k + ' = ' + JSON.stringify(Object.values(v)[0]).slice(0, 110));
if (!APPLY) { console.log('\nドライラン。--apply で作成します'); process.exit(0); }
const res = await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: H, body: JSON.stringify({ parent: { database_id: DB }, properties: props }) });
const j = await res.json();
if (!res.ok) { console.log('失敗', res.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
console.log('\n作成しました:', j.id);
