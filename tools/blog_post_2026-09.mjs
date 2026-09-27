// ブログ記事を3本まとめて作る（2026-09 の更新お知らせ）。
//   node tools/blog_post_2026-09.mjs            ← ドライラン
//   node tools/blog_post_2026-09.mjs --apply    ← 下書きとして作成
//   node tools/blog_post_2026-09.mjs --apply --publish  ← いきなり公開
//
// 既定は「下書き」。本人が読んでから公開する運用（CLAUDE.md の方針）。
// 同じURLスラッグの記事が既にあれば、本文ごと作り直す（重複を作らない）。
import { readFileSync } from 'node:fs';

(function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const TOKEN = process.env.NOTION_API_KEY;
const DB = '347a43543ec2804d96e9dc5edd3441a5';
const APPLY = process.argv.includes('--apply');
const PUBLISH = process.argv.includes('--publish');
const TODAY = '2026-09-28';

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

// 'h: 見出し' / '- 箇条書き' / '! コールアウト' / 'その他は段落'
// **太字** と [表示](URL) が使える
const rich = (s) => {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  const push = (text, o) => { if (text) out.push({ type: 'text', text: { content: text, link: o?.link ? { url: o.link } : null }, annotations: { bold: !!o?.bold } }); };
  while ((m = re.exec(s))) {
    push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) push(t.slice(2, -2), { bold: true });
    else { const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/); push(mm[1], { link: mm[2] }); }
    last = m.index + t.length;
  }
  push(s.slice(last));
  return out;
};
const block = (line) => {
  if (line.startsWith('h: ')) return { object: 'block', type: 'heading_2', heading_2: { rich_text: rich(line.slice(3)) } };
  if (line.startsWith('- ')) return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rich(line.slice(2)) } };
  if (line.startsWith('! ')) return { object: 'block', type: 'callout', callout: { rich_text: rich(line.slice(2)), icon: { type: 'emoji', emoji: '💡' } } };
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: rich(line) } };
};

const S = 'https://mayonery.jp';

const POSTS = [
  // ───────────────────────────── ① 無料で配っているもの
  {
    slug: 'free-materials-2026',
    title: '手相を「分解して読む」ための無料の道具を、ひととおり置いています',
    cats: ['お知らせ', 'ロジカル手相学'],
    body: [
      '手相を学んでいて、いちばん困るのは「本に載っていない手」が来たときだと思います。線が入り組んでいる。マスカケがある。感情線が何本もある。そこで手が止まる。',
      '止まる理由は、覚えた量が足りないからではありません。**名前と意味をセットで覚える**やり方だと、名前の付いていない形には手が出ないからです。',
      'この考え方を持ち帰ってもらうための道具を、無料でひととおり置いています。どれも登録もお金も要りません（小冊子だけ、公式LINEの登録が要ります）。',

      'h: 手相用語集 ── 122語',
      `線・丘・手の形・指・記号まで、**122語**を収録しています。「どういう意味か」だけでなく、**鑑定でどう使うか**まで書いてあるのが特徴です。`,
      '- たとえば[マスカケ](' + S + '/glossary/masukake-line/)は、「珍しい強運の線」ではなく**感情線と頭脳線が重なって1本に見えている状態**として説明しています',
      '- [生命線](' + S + '/glossary/life-line/)は「健康や寿命の線」としては扱いません。長さも見ません',
      '- 検索と五十音・カテゴリーで引けるので、**鑑定の途中で引く**使い方ができます',
      `👉 [手相用語集を見る](${S}/glossary/)`,

      'h: 手相診断 ── 12問、約2分',
      '自分の手の形を入力すると、そこから何が読めるかを出します。**12問に答えるだけの「かんたん」と、つまみで細かく調整する「くわしく」**の2つの入口があります。',
      '結果は3つに分かれます。**いま何が出ているか（拾う）／それを組み立てるとどうなるか（扱う）／当たっているかを自分で確かめる問い（確かめる）**。3つ目が、ほかの診断にはないところだと思います。',
      `👉 [手相診断をやってみる](${S}/shindan/)`,

      'h: 手相クイズ ── 全107問',
      'カテゴリー別に10問ずつ出題されます。全問に解説がつくので、間違えても「なぜそうなるか」がその場で分かります。用語集と往復すると、正答率がはっきり上がります。',
      `👉 [手相クイズに挑戦する](${S}/quiz/)`,

      'h: 小冊子『手相は、分解して読む』 ── PDF・全53ページ',
      '**公式LINEに登録すると、自動でお届けしています。**図13点つき、全53ページ。',
      '- 占いの3分類の中で、手相はどこにいるのか',
      '- 聖職紋・トライアングルを、実際に分解してみる',
      '- 線はS字にならない ── 変な線を見たとき、まず何を疑うか',
      '- マスカケの正体 ── 特別な線ではなく、何と何が重なっているのか',
      '- 「良い・悪い」を外すと、線が何を言っているかが見えてくる',
      '判定の基準や作図の手順は入っていません。**考え方だけ**を、まとまった形でお渡しするものです。',
      `👉 [公式LINEに登録して受け取る](https://lin.ee/utbXwum)`,

      'h: どれから触ればいいか',
      '- **手相がはじめて** … 手相診断 → 小冊子',
      '- **本や動画で学んだけれど、目の前の手で止まる** … 小冊子 → 用語集',
      '- **ひととおり読める** … クイズで抜けを見つける → 用語集で埋める',
      '! ぜんぶ無料です。気が向いたところから触ってみてください。使ってみて分からないことがあれば、公式LINEにそのまま送っていただいて構いません。',
    ],
  },

  // ───────────────────────────── ② 用語集の更新
  {
    slug: 'glossary-update-2026-09',
    title: '手相用語集を122語に増やし、中身を全面的に書き直しました',
    cats: ['お知らせ', '手相の基本', 'ロジカル手相学'],
    body: [
      '[手相用語集](' + S + '/glossary/)を大きく更新しました。**収録数を122語に増やし、すべての語の説明を書き直しています。**',
      'これまでは「その語が何を指すか」を短く書いたものが中心でしたが、今回から**鑑定でどう使うか**まで入れました。1語あたりの分量が、数倍になっています。',

      'h: 何が変わった？',
      '- **収録数を122語に増量**（線・丘・手の形・指・記号・基本用語）',
      '- **全語の説明を書き直し。** 講義でどう説明しているかを、そのまま反映しました',
      '- **「鑑定での使い方」を追加。** 意味を知るだけでなく、目の前の手にどう当てるかが書いてあります',
      '- **読み方が分かれる語には、その理由まで**書きました',

      'h: たとえば、こんなふうに変わりました',
      `[マスカケ](${S}/glossary/masukake-line/)は、「珍しい強運の線」と説明されることが多い線です。この用語集では、そう書いていません。`,
      '**特別な線が引かれているのではなく、感情線と頭脳線が重なって1本に見えている状態**です。生命線は重なっていません。三大線のうち2本が同じ軸に乗った、それだけのことです。',
      '感情・思考・行動が三権分立でバランスを取っているところ、感情と思考が混ざって（心＋理性）対（体）の二権分立になる。だからブレーキが効きにくく、熱量が一方向に大きく出る。**そこまで書いてあります。**',
      `ほかにも、[生命線](${S}/glossary/life-line/)を「健康や寿命の線」として扱わない理由、[頭脳線](${S}/glossary/head-line/)を長さではなく向きと起点で読む方法など、**一般に言われている説明と違うところは、なぜ違うのかを書きました。**`,

      'h: 引きやすくしています',
      '- **検索**（用語名の一部でも出ます）',
      '- **五十音**（あ行〜わ行）',
      '- **カテゴリー**（丘／線／記号／手の形／指／基本用語）',
      '! 用語集は「読む」より「引く」ものだと思っています。鑑定の途中で分からない線が出てきたとき、その場で開いてください。',

      'h: 手相診断からも引けます',
      `[手相診断](${S}/shindan/)の結果に出てくる線の名前は、そのまま用語集にリンクしています。**自分の手から出た読みを、用語の説明と行き来しながら確かめられます。**`,
      `👉 [手相用語集を見る](${S}/glossary/)`,
    ],
  },

  // ───────────────────────────── ③ 診断の更新
  {
    slug: 'shindan-update-2026-09',
    title: '手相診断をひとつにまとめ、「なぜそう読めるか」まで出るようにしました',
    cats: ['お知らせ', 'ロジカル手相学'],
    body: [
      'これまで「無料手相診断」と「セルフ手相診断機」の2つに分かれていた診断を、**[手相診断](' + S + '/shindan/) ひとつにまとめました。**',
      '2つは、実は同じところを測っていました。分かれていると「どっちをやればいいの？」となるので、**入口は2つのまま、結果を出す仕組みを1つに**しています。',

      'h: 入口は2つ。好きなほうで',
      '- **かんたん** … 12問に答えるだけ。手相を見たことがなくても選べます。約2分',
      '- **くわしく** … つまみを動かすと、手の絵がその場で変わります。自分の手に近づけてください',
      '途中で「つまみで細かく入力する」に切り替えられます。**答えたぶんは引き継がれる**ので、やり直しになりません。',

      'h: 結果が3つに分かれました',
      'ここがいちばん変わったところです。',
      '- **① 拾う** … いま何が出ているかを、**用語で**言います。線の名前を押すと、用語集の説明に飛べます',
      '- **② 扱う** … 拾ったものを組み合わせると、どういう人物像になるか',
      '- **③ 確かめる** … **その読みが当たっているかを、自分で確かめるための問い**',
      '3つ目を入れたのは、手相が当てものではないからです。出た読みを、実際の出来事と照らし合わせて確かめる。合わなければ、読み方のどこかがずれている。**その確かめ方まで含めて、手相だと思っています。**',

      'h: マスカケの人は、専用の説明が出ます',
      '12問目で「頭脳線と感情線が1本につながって見える」を選ぶと、マスカケとして扱います。',
      `そのうえで、**「珍しい強運の線」とは書きません。** [感情線](${S}/glossary/heart-line/)と[頭脳線](${S}/glossary/head-line/)が重なって1本に見えている状態だと説明します。良い悪いではなく、そういう構造だということです。`,

      'h: タイプの名前を、日本語に変えました',
      'これまで結果に出ていた英語のタイプ名（ビジョナリー、クリエイターなど）をやめて、**「感情が先に出て、外へ向かう」**のような説明的な言い方に変えました。',
      'あわせて、**その位置がどの線を足した結果なのか**を下に書くようにしています。',
      '理由は、名前と意味をセットで覚えるやり方から離れてほしいからです。手相のマークも同じで、**名前が付いているものは、たいてい線の集合体**です。名前を覚えるより、どの線がどう効いたかを見るほうが、ずっと応用がききます。',

      'h: 両手でやってみてください',
      '左右で結果が変わります。**ふだん使うほうの手が「外に出している自分」、反対の手が「ひとりのときの自分」**です。',
      '差が大きい人ほど、外向けの自分と本来の自分にギャップがあることになります。**その差そのものが情報です。**',
      `👉 [手相診断をやってみる](${S}/shindan/)`,
      '! これまでのURL（セルフ手相診断機）をブックマークしている方も、そのまま開けます。新しいページへ自動で移動します。',
    ],
  },
];

// ---- 実行 ----
const plain = (p) => (p ? (p.rich_text || p.title || []).map((x) => x.plain_text).join('') : '');
let cur, rows = [];
do {
  const r = await api('/databases/' + DB + '/query', 'POST', { page_size: 100, start_cursor: cur });
  rows.push(...r.results);
  cur = r.has_more ? r.next_cursor : null;
} while (cur);

for (const post of POSTS) {
  const blocks = post.body.map(block);
  const existing = rows.find((r) => plain(r.properties['URLスラッグ']) === post.slug);
  console.log(`\n■ ${post.title}`);
  console.log(`   スラッグ: ${post.slug} ／ ${blocks.length}ブロック ／ ${existing ? '既存を作り直す' : '新規'} ／ ${PUBLISH ? '公開' : '下書き'}`);
  if (!APPLY) continue;

  const props = {
    'タイトル': { title: [{ type: 'text', text: { content: post.title } }] },
    'URLスラッグ': { rich_text: [{ type: 'text', text: { content: post.slug } }] },
    '日付': { date: { start: TODAY } },
    'ステータス': { status: { name: PUBLISH ? '公開' : '下書き' } },
    'カテゴリー': { multi_select: post.cats.map((n) => ({ name: n })) },
  };
  let pageId;
  if (existing) {
    pageId = existing.id;
    await api('/pages/' + pageId, 'PATCH', { properties: props });
    const old = await api('/blocks/' + pageId + '/children?page_size=100');
    for (const b of old.results || []) await api('/blocks/' + b.id, 'PATCH', { archived: true });
  } else {
    pageId = (await api('/pages', 'POST', { parent: { database_id: DB }, properties: props })).id;
  }
  for (let i = 0; i < blocks.length; i += 100) {
    await api('/blocks/' + pageId + '/children', 'PATCH', { children: blocks.slice(i, i + 100) });
  }
  console.log('   → 書き込みました');
}

console.log('\n' + (APPLY ? `書き込みました（${PUBLISH ? '公開' : '下書き'}）` : 'ドライラン（書き込みなし）'));
if (!APPLY) console.log('反映するには --apply、そのまま公開するには --apply --publish');
