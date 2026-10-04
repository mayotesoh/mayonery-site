/**
 * 鑑定書のPDF（暗号文）  /kanteisho/<token>/pdf.json
 *
 * 本文のページから「PDFをダウンロード」を押したときだけ取りに来る。
 * **本文に混ぜていないのは、最初の表示を軽くするため**（PDFは暗号文で1.6MBほどある）。
 *
 * 鍵は本文と同じ。salt を共用しているので、合言葉から作った鍵をそのまま使える。
 * ここで配るのは {iv, ct} だけで、平文は一切含まない。
 *
 * データの出どころは本文と同じ非公開リポジトリ：
 *   .kantei/payload/<token>.pdf.json
 * 無ければこのファイルは作らない（ページ側は印刷にフォールバックする）。
 */
import fs from 'node:fs';
import path from 'node:path';

const PAYLOAD_DIR = path.resolve(process.cwd(), '.kantei', 'payload');

export function getStaticPaths() {
  if (!fs.existsSync(PAYLOAD_DIR)) return [];
  const out: { params: { token: string }; props: { body: string } }[] = [];
  for (const f of fs.readdirSync(PAYLOAD_DIR)) {
    if (!f.endsWith('.pdf.json')) continue;
    const token = f.slice(0, -'.pdf.json'.length);
    if (!/^[0-9a-f]{16,64}$/.test(token)) continue;
    // 本文が無いのに PDF だけある状態は作らない
    if (!fs.existsSync(path.join(PAYLOAD_DIR, `${token}.json`))) continue;
    out.push({
      params: { token },
      props: { body: fs.readFileSync(path.join(PAYLOAD_DIR, f), 'utf-8') },
    });
  }
  console.log(`[kantei] PDF ${out.length}件`);
  return out;
}

export function GET({ props }: { props: { body: string } }) {
  return new Response(props.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
