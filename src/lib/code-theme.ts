// Shiki theme for code blocks, in the site palette: warm neutrals plus the one
// amber accent (keywords) and its lighter tint. Every token color passes WCAG AA
// on the code background (#151311).
export const phosphorCodeTheme = {
  name: 'phosphor',
  type: 'dark' as const,
  colors: {
    'editor.background': '#151311',
    'editor.foreground': '#ece6dc',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#a39a8e', fontStyle: 'italic' } },
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.operator.word'],
      settings: { foreground: '#ffb000' },
    },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#e2c99a' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#ffc94a' } },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call.generic'],
      settings: { foreground: '#ece6dc', fontStyle: 'bold' },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
      settings: { foreground: '#ffd98a' },
    },
    { scope: ['variable.parameter'], settings: { foreground: '#ece6dc', fontStyle: 'italic' } },
    { scope: ['punctuation', 'keyword.operator'], settings: { foreground: '#c9c0b4' } },
  ],
};
