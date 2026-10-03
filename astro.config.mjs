// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    // 🌟 サイトのベースURLを設定
    site: 'https://mayonery.jp',
    
    // 🌟 MDXとサイトマップの機能を有効化
    integrations: [
        mdx(),
        sitemap({
            // 鑑定書（お客様個人のもの）は sitemap に載せない。載ると検索エンジンに拾われる。
            // **`/kantei/` は「手相鑑定」の公開ページなので、ここで除外してはいけない。**
            // そのため鑑定書は `/kanteisho/` という別の場所に置いてある
            filter: (page) => !page.includes('/kanteisho/'),
        }),
    ],

    fonts: [
        {
            provider: fontProviders.local(),
            name: 'Atkinson',
            cssVariable: '--font-atkinson',
            fallbacks: ['sans-serif'],
            options: {
                variants: [
                    {
                        src: ['./src/assets/fonts/atkinson-regular.woff'],
                        weight: 400,
                        style: 'normal',
                        display: 'swap',
                    },
                    {
                        src: ['./src/assets/fonts/atkinson-bold.woff'],
                        weight: 700,
                        style: 'normal',
                        display: 'swap',
                    },
                ],
            },
        },
    ],
});