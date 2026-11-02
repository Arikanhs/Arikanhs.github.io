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
