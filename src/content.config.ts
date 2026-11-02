import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
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

/** YYYY or YYYY-MM. */
const month = z.string().regex(/^\d{4}(-\d{2})?$/, 'use YYYY or YYYY-MM');
const period = {
  start: month,
  end: z.union([month, z.literal('present')]),
  /** Shown instead of the formatted dates, e.g. "Spring 2023 – Fall 2023". */
  label: z.string().optional(),
};
const role = z.object({
  title: z.string().min(1),
  org: z.string().min(1),
  url: z.url().optional(),
  ...period,
  points: z.array(z.string().min(1)).default([]),
});

/** Phone-number-like text: a run of 10 or more digits with separators. */
const PHONE = /\+?\(?\d[\d\s().-]{8,}\d/;
function containsPhone(value: unknown): boolean {
  if (typeof value === 'string') {
    return [...value.matchAll(new RegExp(PHONE, 'g'))].some((m) => m[0].replace(/\D/g, '').length >= 10);
  }
  if (Array.isArray(value)) return value.some(containsPhone);
  if (value && typeof value === 'object') return Object.values(value).some(containsPhone);
  return false;
}

// One entry (id "resume") read from src/data/resume.yaml.
const resume = defineCollection({
  loader: file('src/data/resume.yaml'),
  schema: z
    .object({
      summary: z.string().min(1),
      education: z.array(
        z.object({
          degree: z.string().min(1),
          school: z.string().min(1),
          ...period,
          details: z.array(z.string().min(1)).default([]),
        }),
      ),
      experience: z.array(role),
      involvement: z.array(role).default([]),
      skills: z.array(z.object({ area: z.string().min(1), items: z.array(z.string().min(1)).min(1) })),
      awards: z.array(z.object({ title: z.string().min(1), org: z.string().min(1), year: z.string() })).default([]),
      certifications: z.array(z.object({ name: z.string().min(1), status: z.string().optional() })).default([]),
    })
    .refine((data) => !containsPhone(data), {
      message: 'resume.yaml must not contain a phone number (it is published on the site and in cv.pdf)',
    }),
});

export const collections = { projects, publications, blog, resume };
