// All site content. Pages render from here; edit facts once.
// Labels and statuses are Title Case ("Live", "In Progress").

export const AREA_ORDER = ['professional', 'academic', 'personal'];

export const AREAS = {
  professional: { label: 'Professional', heading: 'PROFESSIONAL', color: '#a78bfa', soft: '#c4b5fd', path: '/professional' },
  academic: { label: 'Academic', heading: 'ACADEMIC', color: '#38bdf8', soft: '#7dd3fc', path: '/academic' },
  personal: { label: 'Personal', heading: 'PERSONAL', color: '#fb923c', soft: '#fdba74', path: '/personal' },
};

export const PROFILE = {
  name: 'Nelson Torres',
  subtitle:
    'Software Developer at Archera, Computational and Data Science Ph.D. Candidate researching fMRI and deep ' +
    'learning at Middle Tennessee State University, and owner of Olene Software.',
  links: [
    { label: 'GitHub', href: 'https://github.com/Nelsontorresjr330' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nelsontorresjr330/' },
    { label: 'Résumé', href: '/Resume.pdf' },
  ],
};

// ---------------------------------------------------------------------------
// Landing page: the stack map (work on the left, technologies on the right).
// ---------------------------------------------------------------------------

export const WORK = [
  { id: 'archera', area: 'professional', label: 'Archera · Software Developer', when: 'Jan 2026 – Present', summary: 'Cloud commitment and cost-management platform across AWS, Azure and GCP.' },
  { id: 'sde3', area: 'professional', label: 'Amazon · Senior Software Engineer (SDE3)', when: 'Jun 2025 – Jan 2026', summary: 'Computer-vision ergonomics evaluator for Amazon associates.' },
  { id: 'robotics', area: 'professional', label: 'Amazon Robotics · Software Developer II', when: 'Jun 2024 – Jun 2025', summary: 'SCADA system for Amazon warehouses; team Scrum master.' },
  { id: 'ipro', area: 'professional', label: 'IPro Systems · Software Developer', when: 'Oct 2022 – Jun 2024', summary: 'Backend APIs, Redshift DDL, large ETL migrations and billing.' },
  { id: 'nth', area: 'professional', label: 'Automation Nth · Controls Engineer Intern', when: 'Jun 2022 – Oct 2022', summary: 'PLC programming, vision systems, AutoCAD schematics and control panels.' },
  { id: 'lap', area: 'academic', label: 'Laplacian-Regularized GLM', when: 'Live', summary: 'Cortical-surface Laplacian penalty on the first-level GLM; +20.85% over OLS across three datasets.', href: '/research/laplacian-glm', cta: 'Open the demo' },
  { id: 'plasma', area: 'academic', label: 'Magnet-Induced Plasma Radiation in a Laser Trap', when: 'Published 2024', summary: 'Modeled and fit the data from a laser-trap experiment where magnetic beads and cancer cells form a plasma that emits star-like radiation (European Biophysics Journal).', href: 'https://pubmed.ncbi.nlm.nih.gov/38451329/', cta: 'PubMed' },
  { id: 'ms', area: 'academic', label: 'M.S. Computer Science · Vanderbilt University', when: '2023 – 2024', summary: 'Artificial Intelligence (CS 5260), Foundations of Machine Learning (CS 5262), parallel programming, model-based development, networks.' },
  { id: 'bs', area: 'academic', label: 'B.S. Computer Engineering & Applied Physics · MTSU', when: '2019 – 2022', summary: 'Double major, Computer Science concentration: C++, assembly, digital logic and microprocessors, computational physics. Minor in French.' },
  { id: 'olene', area: 'personal', label: 'Olene Software', when: 'Owner', summary: 'My company: PayClear, LibroCost and PlanoCost (Available), and ProsCircle and LawnMole (Coming Soon), on one shared stack.', href: '/personal', cta: 'See the apps' },
  { id: 'site', area: 'personal', label: 'nelsontorres.dev', when: 'Live', summary: 'This site: React and Vite on S3 and CloudFront, deployed with AWS CDK.' },
];

export const TECH_GROUPS = [
  { label: 'LANGUAGES', items: [['python', 'Python'], ['ts', 'TypeScript'], ['java', 'Java'], ['sql', 'SQL'], ['cpp', 'C++'], ['matlab', 'MATLAB'], ['asm', 'Assembly']] },
  { label: 'ML · NEUROIMAGING', items: [['pytorch', 'PyTorch'], ['numpy', 'NumPy'], ['nilearn', 'nilearn'], ['cv', 'Computer Vision']] },
  { label: 'CLOUD · INFRA', items: [['aws', 'AWS'], ['cdk', 'AWS CDK'], ['azure', 'Azure'], ['gcp', 'GCP'], ['docker', 'Docker'], ['cognito', 'Cognito']] },
  { label: 'DATA', items: [['sqlalchemy', 'SQLAlchemy'], ['alembic', 'Alembic'], ['spark', 'Spark']] },
  { label: 'PRODUCT · PAYMENTS', items: [['react', 'React'], ['stripe', 'Stripe'], ['plaid', 'Plaid']] },
  { label: 'HARDWARE', items: [['plc', 'PLC / SCADA'], ['logic', 'Digital Logic']] },
].map((g) => ({ label: g.label, items: g.items.map(([id, label]) => ({ id, label })) }));

export const USES = {
  python: ['archera', 'sde3', 'robotics', 'ipro', 'lap', 'ms', 'bs', 'olene'],
  ts: ['archera', 'olene', 'site'],
  java: ['sde3', 'ipro', 'ms', 'bs'],
  sql: ['archera', 'robotics', 'ipro', 'ms', 'bs', 'olene'],
  cpp: ['bs'],
  matlab: ['plasma', 'bs'],
  asm: ['bs'],
  pytorch: ['ms'],
  numpy: ['lap', 'plasma', 'ms'],
  nilearn: ['lap', 'ms'],
  cv: ['sde3', 'nth'],
  aws: ['archera', 'sde3', 'robotics', 'ipro', 'lap', 'ms', 'bs', 'olene', 'site'],
  cdk: ['archera', 'sde3', 'robotics', 'ms', 'bs', 'olene', 'site'],
  azure: ['archera'],
  gcp: ['archera'],
  docker: ['archera', 'ipro', 'lap', 'ms', 'bs'],
  cognito: ['archera', 'olene'],
  sqlalchemy: ['archera'],
  alembic: ['archera'],
  spark: ['ipro'],
  react: ['olene', 'site'],
  stripe: ['archera', 'olene'],
  plaid: ['olene'],
  plc: ['robotics', 'nth', 'bs'],
  logic: ['nth', 'bs'],
};

// ---------------------------------------------------------------------------
// Professional page.
// ---------------------------------------------------------------------------

export const ROLES = [
  { id: 'archera', org: 'Archera', title: 'Software Developer', place: 'Nashville, TN', start: [2026, 1], end: null,
    points: ['Software developer on Archera’s cloud commitment and cost-management platform, spanning AWS, Azure and GCP.', 'Python services with SQLAlchemy and Alembic, TypeScript, AWS CDK infrastructure, Cognito sign-in and Stripe billing.'],
    tags: ['Python', 'TypeScript', 'SQL', 'AWS', 'AWS CDK', 'Docker', 'Cognito', 'Azure', 'GCP', 'Stripe', 'SQLAlchemy', 'Alembic'] },
  { id: 'sde3', org: 'Amazon', title: 'Senior Software Engineer (SDE3)', place: 'Nashville, TN', start: [2025, 6], end: [2026, 1],
    points: ['Built a computer-vision ergonomics evaluator that scores workstation safety for Amazon associates.', 'Java services and Python ML frameworks on AWS, with infrastructure in AWS CDK.'],
    tags: ['Computer Vision', 'Java', 'Python', 'AWS', 'AWS CDK', 'ML'] },
  { id: 'robotics', org: 'Amazon Robotics', title: 'Software Developer II', place: 'Nashville, TN', start: [2024, 6], end: [2025, 6],
    points: ['Developed a proprietary SCADA system for Amazon warehouses: data ETLs, PLC programming, Python, AWS and SQL.', 'Team Scrum master; infrastructure in AWS CDK, shipped through Amazon’s internal CI/CD.'],
    tags: ['SCADA', 'PLC', 'Python', 'AWS', 'AWS CDK', 'SQL', 'ETL', 'Scrum'] },
  { id: 'ipro', org: 'IPro Systems', title: 'Software Developer', place: 'Hendersonville, TN', start: [2022, 10], end: [2024, 6],
    points: ['Backend APIs and frontend changes with Spark, Python, Docker, Java, FastAPI and Node.js.', 'Redshift DDL, large ETL migrations off legacy systems, and mission-critical billing processes.'],
    tags: ['Spark', 'Python', 'Docker', 'Java', 'SQL', 'FastAPI', 'Node.js', 'AWS', 'Redshift', 'ETL'] },
  { id: 'nth', org: 'Automation Nth', title: 'Controls Engineer Intern', place: 'Smyrna, TN', start: [2022, 6], end: [2022, 10],
    points: ['PLC programming, machine-vision systems, AutoCAD schematics and electrical diagrams, and building and wiring control panels.'],
    tags: ['PLC', 'Computer Vision', 'AutoCAD'] },
];

export const EXPERTISE = [
  { label: 'Languages', skills: ['Python', 'TypeScript', 'Java', 'SQL', 'Node.js'] },
  { label: 'Cloud and Infrastructure', skills: ['AWS', 'AWS CDK', 'Azure', 'GCP', 'Docker', 'Cognito', 'Redshift'] },
  { label: 'Data and Backend', skills: ['SQLAlchemy', 'Alembic', 'Spark', 'ETL', 'FastAPI'] },
  { label: 'Payments', skills: ['Stripe'] },
  { label: 'ML and Vision', skills: ['Computer Vision', 'ML'] },
  { label: 'Industrial Systems', skills: ['SCADA', 'PLC', 'AutoCAD'] },
  { label: 'Ways of Working', skills: ['Scrum'] },
];

// ---------------------------------------------------------------------------
// Academic page.
// ---------------------------------------------------------------------------

export const ACADEMIC_GROUPS = [
  { label: 'RESEARCH', items: [
    { id: 'lap', kind: 'RESEARCH', when: 'Live', title: 'Laplacian-Regularized GLM for First-Level fMRI', org: 'MTSU · advisor Dr. Xin Yang',
      blocks: [{ label: 'SUMMARY', text: 'A cortical-surface graph Laplacian penalty on the first-level GLM, solved in closed form on the mesh eigenbasis.' }, { label: 'RESULT', text: '+20.85% combined improvement over OLS across three task-fMRI datasets at K = 1,000; +50.0% with the full eigenbasis.' }],
      tags: ['Python', 'NumPy', 'nilearn', 'AWS Lambda', 'Docker'], href: '/research/laplacian-glm', cta: 'Open the demo' },
  ] },
  { label: 'DEGREES', items: [
    { id: 'phd', kind: 'DEGREE', when: '2025 – Present', title: 'Ph.D. Candidate, Computational and Data Science', org: 'Middle Tennessee State University',
      blocks: [{ label: 'ADVISOR', text: 'Dr. Xin Yang.' }, { label: 'FOCUS', text: 'fMRI analysis: surface-informed GLM regularization and contrastive representation learning for autism classification.' }],
      tags: ['Python', 'PyTorch', 'nilearn'] },
    { id: 'ms', kind: 'DEGREE', when: '2023 – 2024', title: 'M.S., Computer Science', org: 'Vanderbilt University',
      blocks: [{ label: 'COURSEWORK', text: 'Artificial Intelligence (CS 5260), Foundations of Machine Learning (CS 5262), parallel programming, model-based development, computer networks, web-based system architecture.' }, { label: 'PROJECTS', text: 'A civilization simulation in Python; an Android image processor in Java.' }],
      tags: ['Python', 'Java', 'PyTorch', 'nilearn', 'NumPy', 'SQL', 'AWS', 'AWS CDK', 'Docker'] },
    { id: 'bs', kind: 'DEGREE', when: '2019 – 2022', title: 'B.S., Computer Engineering and Applied Physics', org: 'Middle Tennessee State University · double major, Computer Science concentration · minor in French',
      blocks: [{ label: 'COURSEWORK', text: 'Computer Science I and II in C++ (CSCI 1170, 2170), discrete structures and algorithms, assembly and computer architecture, digital logic, circuit and microprocessor design, computational physics.' }, { label: 'PROJECTS', text: 'An 8-bit computer simulated from logic gates in Logisim.' }],
      tags: ['Python', 'Java', 'SQL', 'C++', 'Assembly', 'PLC', 'AWS', 'AWS CDK', 'Docker', 'Digital Logic', 'MATLAB'] },
  ] },
  { label: 'PUBLICATION', items: [
    { id: 'ebj', kind: 'PUBLICATION', when: 'Published 2024', title: 'Magnet-Induced Star-Like Radiation of a Plasma Created from Cancer Cells in a Laser Trap', org: 'European Biophysics Journal 53(3):123–131 · D. Erenso, … N. Torres, … E. E. Hach III',
      blocks: [{ label: 'CONTRIBUTION', text: 'Modeled and fit the experimental data in MATLAB and Python, and collected measurements of radiation intensity against laser power.' }],
      tags: ['MATLAB', 'Python'], href: 'https://pubmed.ncbi.nlm.nih.gov/38451329/', cta: 'Read on PubMed' },
  ] },
];

// ---------------------------------------------------------------------------
// Personal page.
// ---------------------------------------------------------------------------

export const OLENE_STATUS = { available: { label: 'Available', color: '#6ee7b7' }, soon: { label: 'Coming Soon', color: '#fcd34d' } };

export const OLENE_APPS = [
  { name: 'PayClear', status: 'available', what: 'Payroll, invoices and tax forms for small businesses, in English and Spanish.',
    points: ['Payroll, checks and tax forms', 'Invoices and estimates, paid online', 'Bank connections through Plaid; payments through Stripe'],
    tags: ['React', 'Python', 'AWS', 'Stripe', 'Plaid'], href: 'https://olenesoft.com/payclear/', shot: '/images/olene/payclear.png', caption: 'PayClear dashboard (demo company).' },
  { name: 'ProsCircle', status: 'soon', what: 'Jobs, scheduling and invoices for home service businesses.',
    points: ['Requests, estimates, jobs and invoices in one flow', 'Dispatch calendar for field crews', 'Built first for an HVAC company; trade-neutral data model'],
    tags: ['React', 'TypeScript', 'AWS CDK'], href: 'https://olenesoft.com/proscircle/', shot: '/images/olene/proscircle.webp', caption: 'ProsCircle home (demo company).' },
  { name: 'LawnMole', status: 'soon', what: 'Clients, service plans and billing for lawn care companies.',
    points: ['Recurring service plans with auto-pay', 'A portal where homeowners see service history and billing', 'Owner view of clients, plans and revenue'],
    tags: ['React', 'Stripe', 'AWS CDK'], href: 'https://olenesoft.com/lawnmole/', shot: '/images/olene/lawnmole.png', caption: 'LawnMole clients (demo company).' },
  { name: 'LibroCost', status: 'available', what: 'Turns supplier invoices into verified cost data.',
    points: ['Reads scanned, image-only invoices', 'Attributes each line to a project, period and category', 'Answers spend questions without a manual tally'],
    tags: ['Python', 'React', 'AWS CDK'], href: 'https://olenesoft.com/librocost/', shot: '/images/olene/librocost.png', caption: 'LibroCost overview (demo data).' },
  { name: 'PlanoCost', status: 'available', what: 'Masonry estimates measured on the plans.',
    points: ['Measure walls directly on the plan sheets', 'Blocks, grout, mortar, rebar and labor from the estimator’s own formulas', 'Bid totals that match the original workbook'],
    tags: ['React', 'TypeScript', 'AWS CDK'], href: 'https://olenesoft.com/planocost/', shot: '/images/olene/planocost.webp', caption: 'PlanoCost estimate (demo project).' },
];

export const INTERESTS = 'Travel, soccer, League of Legends, 3D printing and electronics.';

export const PHOTOS = [
  { src: '/images/personal/tree.jpg', alt: 'Nelson sitting in a tree' },
  { src: '/images/personal/beach.jpg', alt: 'Nelson on a beach' },
  { src: '/images/personal/jungle.jpg', alt: 'Nelson in the jungle' },
];

// Old paths that moved (also 301'd by CloudFront; see infra/cdk/lib/config.ts).
export const REDIRECTS = { '/work': '/professional', '/projects': '/personal', '/publications': '/academic' };
