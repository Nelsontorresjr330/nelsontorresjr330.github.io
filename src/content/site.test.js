import { describe, expect, it } from 'vitest';
import { ACADEMIC_GROUPS, AREA_ORDER, EXPERTISE, OLENE_APPS, REDIRECTS, ROLES, TECH_GROUPS, USES, WORK } from './site';

const techIds = TECH_GROUPS.flatMap((g) => g.items.map((t) => t.id));
const workIds = WORK.map((w) => w.id);
const titleCase = (s) => s.split(/[\s–-]+/).filter(Boolean).every((w) => /^[A-Z0-9(<]/.test(w));

describe('site content', () => {
  it('orders the areas Professional, Academic, Personal', () => {
    expect(AREA_ORDER).toEqual(['professional', 'academic', 'personal']);
  });

  it('links only known work and technologies, and lists every technology exactly once', () => {
    expect(new Set(techIds).size).toBe(techIds.length);
    expect(Object.keys(USES).sort()).toEqual([...techIds].sort());
    for (const ids of Object.values(USES)) for (const id of ids) expect(workIds).toContain(id);
  });

  it('shows only built, demo-able academic work: no Contrastive ASD or ADNI rows', () => {
    const academic = WORK.filter((w) => w.area === 'academic').map((w) => w.id);
    expect(academic).toEqual(['lap', 'plasma', 'ms', 'bs']);
    const research = ACADEMIC_GROUPS.find((g) => g.label === 'RESEARCH').items.map((i) => i.id);
    expect(research).toEqual(['lap']);
  });

  it('names the journal entry after the experiment', () => {
    expect(WORK.find((w) => w.id === 'plasma').label).not.toMatch(/European Biophysics Journal/);
  });

  it('merges the Olene apps into one Personal item, so Personal has two items', () => {
    expect(WORK.filter((w) => w.area === 'personal').map((w) => w.label)).toEqual(['Olene Software', 'nelsontorres.dev']);
  });

  it('records the stacks Nelson listed', () => {
    const uses = (tech) => USES[tech];
    for (const t of ['python', 'ts', 'sql', 'aws', 'cdk', 'docker', 'cognito', 'azure', 'gcp', 'stripe', 'sqlalchemy', 'alembic']) expect(uses(t)).toContain('archera');
    for (const t of ['python', 'java', 'sql', 'plc', 'aws', 'cdk', 'docker']) expect(uses(t)).toContain('bs');
    for (const t of ['pytorch', 'nilearn', 'sql', 'aws', 'cdk', 'docker']) expect(uses(t)).toContain('ms');
    expect(uses('cdk')).toEqual(expect.arrayContaining(['sde3', 'robotics']));
    expect(uses('cv')).toContain('nth');
  });

  it('writes statuses and dates in Title Case', () => {
    for (const w of WORK) expect(titleCase(w.when), w.when).toBe(true);
    for (const g of ACADEMIC_GROUPS) for (const i of g.items) expect(titleCase(i.when), i.when).toBe(true);
  });

  it('links every listed skill to at least one role', () => {
    for (const g of EXPERTISE) for (const s of g.skills) expect(ROLES.some((r) => r.tags.includes(s)), s).toBe(true);
  });

  it('shows LibroCost and PlanoCost as Available and links every app to olenesoft.com', () => {
    const status = Object.fromEntries(OLENE_APPS.map((a) => [a.name, a.status]));
    expect(status).toMatchObject({ PayClear: 'available', LibroCost: 'available', PlanoCost: 'available', ProsCircle: 'soon', LawnMole: 'soon' });
    for (const a of OLENE_APPS) expect(a.href).toMatch(/^https:\/\/olenesoft\.com\//);
  });

  it('redirects every retired path somewhere that exists', () => {
    expect(REDIRECTS).toEqual({ '/work': '/professional', '/projects': '/personal', '/publications': '/academic' });
  });
});
