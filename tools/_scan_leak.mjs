import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const l of env.split(/\r?\n/)) { const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,''); }
const T=process.env.NOTION_API_KEY, DB='344a43543ec2805e9409e969a3f3f651';
const H={Authorization:'Bearer '+T,'Notion-Version':'2022-06-28','Content-Type':'application/json'};
const APPLY = process.argv.includes('--apply');
let cur, rows=[];
do { const r=await fetch(`https://api.notion.com/v1/databases/${DB}/query`,{method:'POST',headers:H,body:JSON.stringify({page_size:100,start_cursor:cur})}).then(r=>r.json());
  rows.push(...r.results); cur=r.has_more?r.next_cursor:null; } while(cur);
const tx=p=>(p?(p.rich_text||p.title||[]).map(x=>x.plain_text).join(''):'');
// 動画IDらしき文字列（11文字の英数＋@時刻）が、どのプロパティにも出ていないか全部見る
const LEAK=/[A-Za-z0-9_-]{11}@\d{2}:\d{2}/;
let n=0;
for (const r of rows) {
  for (const [k,v] of Object.entries(r.properties)) {
    const s = tx(v);
    if (s && LEAK.test(s)) {
      n++;
      console.log(`  ${tx(r.properties['名前']).padEnd(16,'　')} [${k}] ${s.slice(0,70)}`);
      if (APPLY) await fetch(`https://api.notion.com/v1/pages/${r.id}`,{method:'PATCH',headers:H,body:JSON.stringify({properties:{[k]:{rich_text:[]}}})});
    }
  }
  // 本文も見る
  const b=await fetch(`https://api.notion.com/v1/blocks/${r.id}/children?page_size=100`,{headers:H}).then(x=>x.json());
  for (const x of b.results||[]) {
    const s=(x[x.type]?.rich_text||[]).map(t=>t.plain_text).join('');
    if (s && LEAK.test(s)) { n++; console.log(`  ★本文 ${tx(r.properties['名前'])}: ${s.slice(0,70)}`); }
  }
}
console.log(`\n出典が漏れている箇所: ${n} 件` + (APPLY ? '（プロパティは空にしました）' : '（ドライラン）'));
