import { describe, expect, it } from 'vitest';
import { AREAS, STATUS_LABELS, byArea, dateRange, experiences, projects } from './portfolio';

const areaIds = AREAS.map((a) => a.id);

describe('portfolio content', () => {
  it('gives every item a known area and a unique id', () => {
    const all = [...projects, ...experiences];
    for (const item of all) expect(areaIds).toContain(item.area);
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(new Set(experiences.map((e) => e.id)).size).toBe(experiences.length);
  });

  it('has at least one project and one experience in each area', () => {
    for (const id of areaIds) {
      expect(byArea(projects, id).length).toBeGreaterThan(0);
      expect(byArea(experiences, id).length).toBeGreaterThan(0);
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
