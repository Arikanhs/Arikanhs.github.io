// Shiki theme for code blocks. Its colors are CSS variables (--code-* in
// src/styles/global.css), built from the page's tokens, so code follows the
// theme of the page it is on: fg text, accent-text keywords, mixes of the two
// for numbers, types and strings, muted comments and punctuation. Every one is
// AA on the code background (the surface token); tests/e2e/themes.spec.ts checks.
export const phosphorCodeTheme = {
  name: 'phosphor',
  type: 'light' as const,
  colors: {
    'editor.background': 'var(--code-bg)',
    'editor.foreground': 'var(--code-fg)',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: 'var(--code-comment)', fontStyle: 'italic' },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.operator.word'],
      settings: { foreground: 'var(--code-keyword)' },
    },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: 'var(--code-string)' } },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character'],
      settings: { foreground: 'var(--code-number)' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call.generic'],
      settings: { foreground: 'var(--code-fg)', fontStyle: 'bold' },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
      settings: { foreground: 'var(--code-type)' },
    },
    { scope: ['variable.parameter'], settings: { foreground: 'var(--code-fg)', fontStyle: 'italic' } },
    { scope: ['punctuation', 'keyword.operator'], settings: { foreground: 'var(--code-punctuation)' } },
  ],
};
