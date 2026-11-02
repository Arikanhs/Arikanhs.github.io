// Site-wide details. Mirrors "My details" in ROADMAP.md; change them here.
export const SITE = {
  name: 'Hasan Serdar Arikan',
  shortName: 'Hasan Arikan',
  intro:
    "Master's student in ML, AI and cybersecurity at UNLV and NSF CyberCorps scholar, with research on GPU graph algorithms at Berkeley Lab.",
  description:
    "Hasan Serdar Arikan: master's student in machine learning, AI and cybersecurity at UNLV. Projects, publications, writing and resume.",
  url: 'https://arikanhs.github.io',
  email: 'Arikan@unlv.nevada.edu',
  github: 'Arikanhs',
  githubUrl: 'https://github.com/Arikanhs',
  linkedinUrl: 'https://www.linkedin.com/in/hasan-serdar-arikan-698740198/',
  /** Terminal hero lines (from the resume). */
  focus: ['machine learning', 'AI', 'security'],
  status: "M.S. at UNLV, 2026–2028 · NSF CyberCorps scholar",
} as const;

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/projects/', label: 'Projects' },
  { href: '/publications/', label: 'Publications' },
  { href: '/blog/', label: 'Blog' },
  { href: '/resume/', label: 'Resume' },
] as const;
