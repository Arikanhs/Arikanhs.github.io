// Shared, validated access to the content collections.
import { getCollection } from 'astro:content';

/** All projects in display order (`order`, ascending). */
export async function getProjects() {
  return (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
}

/**
 * All publications, newest first. Throws (failing the build) when a publication's
 * projectSlug names a project that does not exist: Astro only logs those.
 */
export async function getPublications() {
  const [publications, projects] = await Promise.all([getCollection('publications'), getCollection('projects')]);
  const projectIds = new Set(projects.map((project) => project.id));
  for (const publication of publications) {
    const ref = publication.data.projectSlug;
    if (ref && !projectIds.has(ref.id)) {
      throw new Error(
        `Publication "${publication.id}" has projectSlug "${ref.id}", but no project has that id.`,
      );
    }
  }
  return publications.sort((a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title));
}

/** Blog posts, newest first. Drafts appear in `astro dev` only. */
export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Minutes to read at about 200 words a minute (code and math count as words). */
export function readingTime(markdown = '') {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** URL slug for a tag: "machine learning" -> "machine-learning". */
export function tagSlug(tag: string) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
