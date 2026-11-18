// Single source of truth for the portfolio's content. Every design concept in
// Storybook (and the rebuilt site) renders from this file, so a fact is edited once.
//
// Areas: 'academic' | 'professional' | 'personal'
// Project status: 'live' (public demo or product) | 'in-progress' | 'planned'

export const AREAS = [
  { id: 'academic', label: 'Academic', blurb: 'Ph.D. research in computational neuroimaging and deep learning.', statement: 'learning how the brain is wired, from fMRI.' },
  { id: 'professional', label: 'Professional', blurb: 'Software engineering at Amazon, and the apps I run at Olene Software.', statement: 'software people rely on every day.' },
  { id: 'personal', label: 'Personal', blurb: 'What I build and do outside of work.', statement: 'what I make when nobody asked.' },
];

export const STATUS_LABELS = {
  live: 'Live',
  'in-progress': 'In progress',
  planned: 'Planned',
};

export const profile = {
  name: 'Nelson Torres',
  role: 'Software engineer and Ph.D. researcher',
  headline: 'I build software at Amazon and study the brain with deep learning.',
  summary:
    'Senior Software Engineer (SDE3) at Amazon and Ph.D. student in Computational and Data Sciences at ' +
    'Middle Tennessee State University, advised by Dr. Xin Yang. My research applies graph signal processing ' +
    'and contrastive deep learning to fMRI, starting with autism classification on ABIDE.',
  location: 'Nashville, TN',
  links: [
    { label: 'GitHub', href: 'https://github.com/Nelsontorresjr330' },
    { label: 'Résumé', href: '/Resume.pdf' },
    { label: 'Academic portfolio', href: '/AcademicPortfolio.pdf' },
  ],
  stats: [
    { value: '3+', label: 'years in industry' },
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
    start: null,
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
    start: null,
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
    start: null,
    end: 'Dec 2022',
    summary: 'Double major with a minor in French. Built an 8-bit computer from logic gates in Logisim.',
    tags: ['Physics', 'Computer architecture'],
  },
  // Professional
  {
    id: 'amazon-sde3',
    area: 'professional',
    title: 'Senior Software Engineer (SDE3)',
    org: 'Amazon',
    start: 'Jun 2025',
    end: 'Present',
    summary:
      'Building a computer-vision ergonomics evaluator for Amazon associates. Java, Python ML frameworks, AWS.',
    tags: ['Computer vision', 'Java', 'AWS'],
  },
  {
    id: 'olene',
    area: 'professional',
    title: 'Founder',
    org: 'Olene Software LLC',
    start: null,
    end: 'Present',
    summary:
      'I design, build and run a family of business apps on AWS: PayClear (payroll and business finance, live), ' +
      'with LibroCost, LawnMole, ProsCircle and PlanoCost in development. One shared sign-in across all of them.',
    tags: ['React', 'AWS CDK', 'Stripe'],
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
    tags: ['SCADA', 'Python', 'SQL'],
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
    tags: ['Spark', 'FastAPI', 'Redshift'],
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
  },
  // Personal
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
  // Professional
  {
    id: 'payclear',
    area: 'professional',
    title: 'PayClear',
    summary: 'Payroll and business finance for small businesses, with Stripe and Plaid. Live with paying customers.',
    status: 'live',
    year: '2025',
    art: 'app',
    tags: ['React', 'Python', 'Stripe', 'Plaid'],
    href: 'https://tspayclear.com/',
    cta: 'Visit PayClear',
    image: '/ProjectScreenshots/PayClearDashboard.png',
    featured: true,
  },
  {
    id: 'olene-platform',
    area: 'professional',
    title: 'Olene platform and shared sign-in',
    summary:
      'One account across five apps: a shared Cognito pool, SRP sign-in in each app, and hand-off between apps.',
    status: 'live',
    year: '2026',
    art: 'app',
    tags: ['Cognito', 'AWS CDK', 'Playwright'],
  },
  {
    id: 'ergonomics-cv',
    area: 'professional',
    title: 'Computer-vision ergonomics evaluator',
    summary: 'At Amazon: scoring workstation ergonomics from video so associates work more safely.',
    status: 'in-progress',
    year: '2025',
    art: 'timeseries',
    tags: ['Computer vision', 'Amazon'],
  },
  // Personal
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
