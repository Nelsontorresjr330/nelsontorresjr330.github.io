import { CAREER_START } from './careerClock';

// Single source of truth for the portfolio's content. Every design concept in
// Storybook (and the rebuilt site) renders from this file, so a fact is edited once.
//
// Areas: 'academic' | 'professional' | 'personal'
// Project status: 'live' (public demo or product) | 'in-progress' | 'planned'

export const AREAS = [
  { id: 'academic', label: 'Academic', blurb: 'Ph.D. research in computational neuroimaging and deep learning.', statement: 'learning how the brain is wired, from fMRI.' },
  { id: 'professional', label: 'Professional', blurb: 'Full-time software engineering since October 2022, and what I know how to do.', statement: 'software people rely on every day.' },
  { id: 'personal', label: 'Personal', blurb: 'Olene Software, the company I own, and what I make for fun.', statement: 'what I own, build and love.' },
];

export const STATUS_LABELS = {
  live: 'Live',
  'in-progress': 'In progress',
  planned: 'Planned',
};

export const profile = {
  name: 'Nelson Torres',
  role: 'Software developer and Ph.D. researcher',
  headline: 'I write software at Archera and teach neural networks to read brain scans.',
  summary:
    'Software developer at Archera, Ph.D. student in Computational and Data Sciences at Middle Tennessee ' +
    'State University (advised by Dr. Xin Yang), and owner of Olene Software. My research applies graph ' +
    'signal processing and contrastive deep learning to fMRI, starting with autism classification on ABIDE.',
  // Full-time engineering began in October 2022; the site shows a live clock from here.
  careerStart: CAREER_START,
  location: 'Nashville, TN',
  links: [
    { label: 'GitHub', href: 'https://github.com/Nelsontorresjr330' },
    { label: 'Résumé', href: '/Resume.pdf' },
    { label: 'Academic portfolio', href: '/AcademicPortfolio.pdf' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nelsontorresjr330/' },
  ],
  stats: [
    { value: 'Oct 2022', label: 'full-time engineering since' },
    { value: 'M.S.', label: 'Computer Science, Vanderbilt' },
    { value: '1', label: 'live research demo' },
  ],
};

export const experiences = [
  // Academic
  {
    id: 'phd-mtsu',
    area: 'academic',
    title: 'Ph.D., Computational and Data Sciences',
    org: 'Middle Tennessee State University',
    start: '2025',
    end: 'Present',
    summary:
      'Advisor: Dr. Xin Yang. fMRI analysis: surface-informed regularization of the GLM, and contrastive ' +
      'representation learning for autism spectrum disorder (ASD) classification on ABIDE I and II.',
    tags: ['fMRI', 'PyTorch', 'Graph signal processing'],
  },
  {
    id: 'ms-vanderbilt',
    area: 'academic',
    title: 'M.S., Computer Science',
    org: 'Vanderbilt University',
    start: '2023',
    end: 'May 2024',
    summary:
      'GPA 3.74. Artificial intelligence, machine learning, model-based development, computer networks, ' +
      'parallel programming, web system architecture.',
    tags: ['AI', 'Machine learning'],
  },
  {
    id: 'bs-mtsu',
    area: 'academic',
    title: 'B.S., Computer Engineering and Applied Physics',
    org: 'Middle Tennessee State University',
    start: '2019',
    end: 'Dec 2022',
    summary: 'Double major with a minor in French. Built an 8-bit computer from logic gates in Logisim.',
    tags: ['Physics', 'Computer architecture'],
  },
  // Professional (full-time engineering since Oct 2022; Olene Software is personal: I own it)
  {
    id: 'archera',
    area: 'professional',
    title: 'Software Developer',
    org: 'Archera',
    start: 'Jan 2026',
    end: 'Present',
    current: true,
    summary: 'Cloud commitment and cost-management platform.',
    tags: [],
  },
  {
    id: 'amazon-sde3',
    area: 'professional',
    title: 'Senior Software Engineer (SDE3)',
    org: 'Amazon',
    start: 'Jun 2025',
    end: 'Jan 2026',
    summary:
      'Built a computer-vision ergonomics evaluator for Amazon associates. Java, Python ML frameworks, AWS.',
    tags: ['Computer vision', 'Java', 'Python', 'AWS', 'ML'],
  },
  {
    id: 'amazon-robotics',
    area: 'professional',
    title: 'Software Developer II',
    org: 'Amazon Robotics',
    start: 'Jun 2024',
    end: 'Jun 2025',
    summary:
      'Proprietary SCADA system for Amazon warehouses: data ETLs, PLC programming, Python, AWS, SQL. Team Scrum master.',
    tags: ['SCADA', 'PLC', 'Python', 'AWS', 'SQL', 'ETL', 'Scrum'],
  },
  {
    id: 'ipro',
    area: 'professional',
    title: 'Software Developer',
    org: 'IPro Systems',
    start: 'Oct 2022',
    end: 'Jun 2024',
    summary:
      'Backend APIs and frontend changes. Spark, Python, Docker, Java, FastAPI, Node.js, AWS. Redshift DDL, large ' +
      'ETL migrations from legacy systems, and billing processes.',
    tags: ['Spark', 'Python', 'Docker', 'Java', 'SQL', 'FastAPI', 'Node.js', 'AWS', 'Redshift', 'ETL'],
  },
  {
    id: 'automation-nth',
    area: 'professional',
    title: 'Controls Engineer Intern',
    org: 'Automation Nth',
    start: 'Jun 2022',
    end: 'Oct 2022',
    summary: 'PLC programming, AutoCAD schematics, and building and wiring control panels.',
    tags: ['PLC', 'AutoCAD'],
    internship: true,
  },
  // Personal
  {
    id: 'olene',
    area: 'personal',
    title: 'Owner',
    org: 'Olene Software LLC',
    start: null,
    end: 'Present',
    summary:
      'My company. I design, build and run its apps: PayClear (live), LibroCost, LawnMole, ProsCircle and ' +
      'PlanoCost, all on one shared sign-in.',
    tags: ['React', 'AWS CDK', 'Stripe'],
  },
  {
    id: 'making',
    area: 'personal',
    title: '3D printing and electronics',
    org: 'At home',
    start: null,
    end: null,
    summary: 'Designing and printing parts, and tinkering with microcontrollers.',
    tags: ['Making'],
  },
  {
    id: 'outside',
    area: 'personal',
    title: 'Travel, soccer and games',
    org: 'Everywhere',
    start: null,
    end: null,
    summary: 'Travelling with friends and family, playing soccer, and League of Legends.',
    tags: ['Travel', 'Soccer'],
  },
];

export const projects = [
  // Academic
  {
    id: 'laplacian-glm',
    area: 'academic',
    title: 'Laplacian-regularized GLM for first-level fMRI',
    summary:
      'Adds a cortical-surface graph Laplacian penalty to the GLM, solved in closed form on the mesh eigenbasis. ' +
      '+20.85% combined improvement over OLS across three task-fMRI datasets.',
    status: 'live',
    year: '2026',
    art: 'surface',
    tags: ['Graph Laplacian', 'nilearn', 'AWS Lambda'],
    href: '/research/laplacian-glm',
    cta: 'Run the simulation',
    featured: true,
  },
  {
    id: 'contrastive-asd',
    area: 'academic',
    title: 'Self-supervised contrastive learning for ASD classification',
    summary:
      'A 1D-CNN encoder trained SimCLR-style (NT-Xent) on two views of each participant’s resting-state ROI signals ' +
      'from ABIDE, compared with FC + SVM/RF and a supervised CNN, with site-wise and motion analyses.',
    status: 'in-progress',
    year: '2026',
    art: 'timeseries',
    tags: ['PyTorch', 'SimCLR', 'ABIDE'],
    href: '/research/contrastive-asd',
    cta: 'Demo coming',
    featured: true,
  },
  {
    id: 'graph-contrastive',
    area: 'academic',
    title: 'Graph contrastive learning on functional brain networks',
    summary:
      'GCN and GAT encoders with a graph-level contrastive objective on weighted connectivity graphs, using views ' +
      'that keep signed connections intact.',
    status: 'planned',
    year: '2027',
    art: 'graph',
    tags: ['GNN', 'GAT', 'Connectomics'],
    href: '/research/graph-contrastive',
    cta: 'Planned',
  },
  {
    id: 'dynamic-fc',
    area: 'academic',
    title: 'Dynamic functional connectivity with temporal contrastive learning',
    summary:
      'Temporal CNN, GRU or Transformer encoders learning from two temporal views of each subject, with objectives ' +
      'that down-weight unstable short-window connectivity.',
    status: 'planned',
    year: '2027',
    art: 'dynamic',
    tags: ['Temporal CL', 'dFC'],
    href: '/research/dynamic-fc',
    cta: 'Planned',
  },
  {
    id: 'adni-graph',
    area: 'academic',
    title: 'Graph theory of Alzheimer’s disease in resting-state fMRI',
    summary:
      'Replicating Khazaee et al. (2015) graph-theory classification of AD on a larger, matched ADNI cohort.',
    status: 'in-progress',
    year: '2026',
    art: 'graph',
    tags: ['ADNI', 'DPARSF', 'Graph theory'],
  },
  {
    id: 'plasma-paper',
    area: 'academic',
    title: 'Magnet-induced star-like radiation of a plasma from cancer cells',
    summary:
      'European Biophysics Journal, 2024. I modeled and fit the experimental data (MATLAB and Python) and collected measurements.',
    status: 'live',
    year: '2024',
    art: 'radiation',
    tags: ['Publication', 'MATLAB'],
    href: 'https://pubmed.ncbi.nlm.nih.gov/38451329/',
    cta: 'Read on PubMed',
  },
  // Personal (Olene Software is mine, so it lives here)
  {
    id: 'payclear',
    area: 'personal',
    title: 'PayClear',
    summary: 'Payroll, invoices and tax forms for small businesses, in English and Spanish. Live with paying customers.',
    status: 'live',
    year: '2025',
    art: 'app',
    tags: ['React', 'Python', 'Stripe', 'Plaid'],
    href: 'https://olenesoft.com/payclear/',
    cta: 'PayClear on olenesoft.com',
    image: '/ProjectScreenshots/PayClearDashboard.png',
    featured: true,
  },
  {
    id: 'librocost',
    area: 'personal',
    title: 'LibroCost',
    summary: 'Turns supplier invoices into verified cost data.',
    status: 'in-progress',
    year: '2026',
    art: 'app',
    tags: ['OCR', 'Python', 'AWS'],
  },
  {
    id: 'lawnmole',
    area: 'personal',
    title: 'LawnMole',
    summary: 'Clients, service plans and billing for lawn care companies.',
    status: 'in-progress',
    year: '2026',
    art: 'app',
    tags: ['SaaS', 'Stripe'],
  },
  {
    id: 'proscircle',
    area: 'personal',
    title: 'ProsCircle',
    summary: 'Jobs, scheduling and invoices for home service businesses.',
    status: 'in-progress',
    year: '2026',
    art: 'app',
    tags: ['Field service'],
  },
  {
    id: 'planocost',
    area: 'personal',
    title: 'PlanoCost',
    summary: 'Masonry estimates measured on the plans.',
    status: 'in-progress',
    year: '2026',
    art: 'app',
    tags: ['Estimating'],
  },
  {
    id: 'olene-platform',
    area: 'personal',
    title: 'Olene platform and shared sign-in',
    summary:
      'One account across five apps: a shared Cognito pool, SRP sign-in in each app, and hand-off between apps.',
    status: 'live',
    year: '2026',
    art: 'app',
    tags: ['Cognito', 'AWS CDK', 'Playwright'],
  },
  {
    id: 'this-site',
    area: 'personal',
    title: 'This site',
    summary: 'React and Vite on S3 and CloudFront, built with CDK, with each research demo hosted alongside.',
    status: 'live',
    year: '2026',
    art: 'app',
    tags: ['Vite', 'CloudFront', 'Storybook'],
  },
  {
    id: 'prints',
    area: 'personal',
    title: '3D-printed builds',
    summary: 'Printed parts, enclosures and small electronics projects.',
    status: 'in-progress',
    year: 'Ongoing',
    art: 'radiation',
    tags: ['3D printing'],
  },
];

// Professional page: skills grouped, each linked to the roles (experience ids) that used it.
export const expertise = [
  { label: 'Languages', skills: ['Python', 'Java', 'SQL', 'Node.js'] },
  { label: 'Cloud and infrastructure', skills: ['AWS', 'Docker', 'Redshift'] },
  { label: 'Data engineering', skills: ['Spark', 'ETL', 'FastAPI'] },
  { label: 'ML and vision', skills: ['Computer vision', 'ML'] },
  { label: 'Industrial systems', skills: ['SCADA', 'PLC'] },
  { label: 'Ways of working', skills: ['Scrum'] },
];

export function rolesUsing(skill) {
  return experiences.filter((e) => e.area === 'professional' && e.tags.includes(skill));
}

export const photos = ['/PersonalImages/InTree.JPG', '/PersonalImages/OnBeach.JPG', '/PersonalImages/InJungle.JPG'];

export function byArea(list, area) {
  return area && area !== 'all' ? list.filter((x) => x.area === area) : list;
}

export function dateRange({ start, end }) {
  if (start && end) return `${start} – ${end}`;
  return end || start || '';
}

const content = { profile, experiences, projects, photos, AREAS };
export default content;
