import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// 사이트별 환경 변수에서 site URL 읽음 (자동 셋업 스크립트가 .env 자동 생성)
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://yookahplus.org';

export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind({
      applyBaseStyles: false, // global.css에서 직접 베이스 스타일 작성
    }),
    sitemap(),
    mdx(),
  ],
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
