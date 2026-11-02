import fs from 'node:fs';
import path from 'node:path';

export const DIST = path.resolve(import.meta.dirname, '../../../dist');

function htmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

/** Route of every page in the last build, e.g. "/" or "/projects/". Excludes 404.html. */
export function builtPages(): string[] {
  if (!fs.existsSync(DIST)) throw new Error('dist/ is missing: run `npm test`, which builds first.');
  return htmlFiles(DIST)
    .filter((file) => file.endsWith(`${path.sep}index.html`))
    .map((file) => {
      const dir = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
      return dir ? `/${dir}/` : '/';
    })
    .sort();
}

/** The built HTML for a route, e.g. "/projects/" -> dist/projects/index.html. */
export function builtHtml(route: string): string {
  return fs.readFileSync(path.join(DIST, route, 'index.html'), 'utf8');
}

/** File name for a route in tests/screenshots, e.g. "/projects/" -> "projects". */
export function routeSlug(route: string): string {
  return route.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'home';
}
