// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { phosphorCodeTheme } from './src/lib/code-theme.ts';
import { SITE } from './src/lib/site.ts';

import sitemap from '@astrojs/sitemap';

/**
 * Dev-only pages: routed by `astro dev`, never built. The page files start with
 * "_" so Astro's file-based routing ignores them.
 * @type {import('astro').AstroIntegration}
 */
const devOnlyPages = {
  name: 'dev-only-pages',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({ pattern: '/lab/ascii', entrypoint: './src/pages/lab/_ascii.astro' });
      injectRoute({ pattern: '/lab/cards', entrypoint: './src/pages/lab/_cards.astro' });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  // GitHub Pages user site (repo named <username>.github.io), so no `base` is needed.
  site: SITE.url,
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['ui-monospace', 'Menlo', 'monospace'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Source Serif 4',
      cssVariable: '--font-source-serif',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
  ],
  integrations: [devOnlyPages, sitemap()],
  markdown: {
    // The unified (remark/rehype) processor instead of Astro 7's default Sätteri,
    // for remark-math + rehype-katex: $inline$ and $$display$$ math rendered to
    // HTML + MathML at build time.
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
    shikiConfig: { theme: phosphorCodeTheme },
  },
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle so the dev server does not re-optimize (and reload) on first use.
    optimizeDeps: { include: ['textmode.js'] },
  },
});