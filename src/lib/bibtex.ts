// A small BibTeX parser for single entries: enough to validate the `bibtex`
// field of publications at build time and to check copied entries in tests.

export interface BibtexEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
}

/** Parses one `@type{key, name = {value}, ...}` entry, or returns null if malformed. */
export function parseBibtex(source: string): BibtexEntry | null {
  const text = source.trim();
  const head = /^@([a-zA-Z]+)\s*\{\s*([^,\s{}]+)\s*,/.exec(text);
  if (!head) return null;

  const fields: Record<string, string> = {};
  let i = head[0].length;
  const skipSpace = () => {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
  };

  for (;;) {
    skipSpace();
    if (text[i] === '}') break;
    const name = /^[a-zA-Z][\w-]*/.exec(text.slice(i));
    if (!name) return null;
    i += name[0].length;
    while (/\s/.test(text[i] ?? '')) i += 1;
    if (text[i] !== '=') return null;
    i += 1;
    while (/\s/.test(text[i] ?? '')) i += 1;

    let value = '';
    if (text[i] === '{' || text[i] === '"') {
      const close = text[i] === '{' ? '}' : '"';
      let depth = 0;
      const start = i + 1;
      for (i += 1; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '\\') {
          i += 1;
        } else if (ch === '{') {
          depth += 1;
        } else if (ch === '}' && depth > 0) {
          depth -= 1;
        } else if (ch === close && depth === 0) {
          break;
        }
      }
      if (i >= text.length) return null;
      value = text.slice(start, i);
      i += 1;
    } else {
      const bare = /^[\w.-]+/.exec(text.slice(i));
      if (!bare) return null;
      value = bare[0];
      i += bare[0].length;
    }
    fields[name[0].toLowerCase()] = value.trim();
  }

  // Nothing may follow the closing brace of the entry.
  if (i !== text.length - 1) return null;
  return { type: head[1].toLowerCase(), key: head[2], fields };
}

/** A parseable entry with at least a title, an author and a year. */
export function isValidBibtex(source: string): boolean {
  const entry = parseBibtex(source);
  return !!entry && ['title', 'author', 'year'].every((field) => entry.fields[field]);
}
