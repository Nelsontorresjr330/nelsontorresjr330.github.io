import { describe, expect, it } from 'vitest';
import { AREAS, STATUS_LABELS, byArea, dateRange, experiences, expertise, profile, projects, rolesUsing } from './portfolio';

const areaIds = AREAS.map((a) => a.id);

describe('portfolio content', () => {
  it('gives every item a known area and a unique id', () => {
    const all = [...projects, ...experiences];
    for (const item of all) expect(areaIds).toContain(item.area);
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(new Set(experiences.map((e) => e.id)).size).toBe(experiences.length);
  });

  it('has experience in every area, and projects in Academic and Personal', () => {
    for (const id of areaIds) expect(byArea(experiences, id).length).toBeGreaterThan(0);
    for (const id of ['academic', 'personal']) expect(byArea(projects, id).length).toBeGreaterThan(0);
  });

  it('keeps Olene Software and its apps under Personal, not Professional (I own the company)', () => {
    expect(experiences.find((e) => e.id === 'olene').area).toBe('personal');
    for (const id of ['payclear', 'librocost', 'lawnmole', 'proscircle', 'planocost', 'olene-platform']) {
      expect(projects.find((p) => p.id === id)?.area).toBe('personal');
    }
    expect(byArea(experiences, 'professional').map((e) => e.org)).not.toContain('Olene Software LLC');
  });

  it('shows Archera as the one current role, and Amazon as ended', () => {
    const current = byArea(experiences, 'professional').filter((e) => e.end === 'Present');
    expect(current.map((e) => e.org)).toEqual(['Archera']);
    expect(experiences.find((e) => e.id === 'amazon-sde3').end).not.toBe('Present');
    expect(profile.headline).toMatch(/Archera/);
    expect(profile.summary).not.toMatch(/at Amazon/);
  });

  it('lists the Archera stack and marks LibroCost and PlanoCost as available', () => {
    expect(experiences.find((e) => e.id === 'archera').tags).toEqual(
      expect.arrayContaining(['Python', 'TypeScript', 'AWS CDK', 'Azure', 'GCP', 'SQLAlchemy', 'Alembic']),
    );
    for (const id of ['librocost', 'planocost', 'payclear']) expect(projects.find((p) => p.id === id).status).toBe('live');
    for (const id of ['lawnmole', 'proscircle']) expect(projects.find((p) => p.id === id).status).toBe('coming-soon');
    expect(STATUS_LABELS['coming-soon']).toBe('Coming Soon');
  });

  it('starts the career clock in October 2022', () => {
    expect(profile.careerStart).toBe('2022-10-01');
  });

  it('links every listed skill to at least one role', () => {
    for (const group of expertise) {
      for (const skill of group.skills) expect(rolesUsing(skill).length, skill).toBeGreaterThan(0);
    }
  });

  it('uses only known statuses, and every live project links somewhere', () => {
    for (const p of projects) {
      expect(Object.keys(STATUS_LABELS)).toContain(p.status);
      if (p.status === 'live' && p.id !== 'olene-platform' && p.id !== 'this-site') expect(p.href).toBeTruthy();
    }
  });

  it('keeps the Laplacian demo under Academic at its published path', () => {
    const lap = projects.find((p) => p.id === 'laplacian-glm');
    expect(lap).toMatchObject({ area: 'academic', status: 'live', href: '/research/laplacian-glm' });
  });

  it("lists Dr. Yang's three contrastive-learning projects under Academic", () => {
    for (const id of ['contrastive-asd', 'graph-contrastive', 'dynamic-fc']) {
      expect(projects.find((p) => p.id === id)?.area).toBe('academic');
    }
  });

  it('formats date ranges with missing ends', () => {
    expect(dateRange({ start: 'Jun 2024', end: 'Jun 2025' })).toBe('Jun 2024 – Jun 2025');
    expect(dateRange({ start: null, end: 'Present' })).toBe('Present');
    expect(dateRange({ start: null, end: null })).toBe('');
  });

  it("returns everything for the 'all' filter", () => {
    expect(byArea(projects, 'all')).toHaveLength(projects.length);
  });
});
