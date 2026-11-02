import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { isValidBibtex } from './lib/bibtex';

/** https://github.com/<owner>/<repo> */
const githubRepo = z
  .url({ protocol: /^https$/, hostname: /^github\.com$/ })
  .refine((url) => /^\/[\w.-]+\/[\w.-]+\/?$/.test(new URL(url).pathname), {
    message: 'must be a GitHub repository URL like https://github.com/owner/repo',
  });

const tags = z.array(z.string().min(1));

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      summary: z.string().min(1),
      date: z.coerce.date(),
      tags,
      repo: githubRepo,
      demo: z.url().optional(),
      /** The image the ASCII background is built from. */
      cover: image(),
      featured: z.boolean(),
      /** Position on /projects, ascending. */
      order: z.number().int(),
    }),
});

const publications = defineCollection({
  loader: glob({ base: './src/content/publications', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    url: z.url().optional(),
    /** A full URL, or a path to a file in public/ such as /papers/paper.pdf. */
    pdf: z.union([z.url(), z.string().regex(/^\/\S+\.pdf$/)]).optional(),
    /** The GitHub repository with the paper's code. */
    repo: githubRepo,
    /** The id of the matching entry in the projects collection. */
    projectSlug: reference('projects').optional(),
    tags,
    bibtex: z.string().refine(isValidBibtex, {
      message: 'must be one valid BibTeX entry with title, author and year',
    }),
  }),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    date: z.coerce.date(),
    tags,
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, publications, blog };
