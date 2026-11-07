import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Course, RoundDetail, RoundSummary, Stats } from '@golf-sg/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, nineHoleCourse, sampleHoles } from './helpers.js';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

describe('API', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const createCourse = async () => {
    const res = await app.server.inject({
      method: 'POST',
      url: '/api/courses',
      payload: nineHoleCourse,
    });
    expect(res.statusCode).toBe(201);
    return res.json<Course>();
  };

  const createRound = async (courseId: string, playedOn = '2026-05-01', holes = sampleHoles()) =>
    app.server.inject({
      method: 'POST',
      url: '/api/rounds',
      payload: { courseId, playedOn, holes },
    });

  describe('health', () => {
    it('reports liveness and readiness with security headers', async () => {
      const health = await app.server.inject('/api/health');
      expect(health.json()).toEqual({ status: 'ok' });
      expect(health.headers['x-content-type-options']).toBe('nosniff');
      expect((await app.server.inject('/api/ready')).json()).toEqual({ status: 'ready' });
    });

    it('returns JSON 404s for unknown API routes', async () => {
      const res = await app.server.inject('/api/nope');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: 'NotFound' });
    });
  });

  describe('courses', () => {
    it('supports CRUD', async () => {
      const course = await createCourse();
      expect(course.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(course).toMatchObject({
        name: 'Riverside Nine',
        tees: 'Blue',
      });
      expect(course.holes).toHaveLength(9);

      expect((await app.server.inject('/api/courses')).json<Course[]>()).toHaveLength(1);

      const updated = await app.server.inject({
        method: 'PUT',
        url: `/api/courses/${course.id}`,
        payload: { ...nineHoleCourse, name: 'Riverside (front)' },
      });
      expect(updated.json<Course>().name).toBe('Riverside (front)');

      const del = await app.server.inject({ method: 'DELETE', url: `/api/courses/${course.id}` });
      expect(del.statusCode).toBe(204);
      expect((await app.server.inject(`/api/courses/${course.id}`)).statusCode).toBe(404);
    });

    it('validates hole count', async () => {
      const res = await app.server.inject({
        method: 'POST',
        url: '/api/courses',
        payload: { ...nineHoleCourse, holes: nineHoleCourse.holes.slice(0, 5) },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ issues: { path: string }[] }>().issues[0]?.path).toBe('holes');
    });

    it('protects courses that have rounds', async () => {
      const course = await createCourse();
      await createRound(course.id);
      const del = await app.server.inject({ method: 'DELETE', url: `/api/courses/${course.id}` });
      expect(del.statusCode).toBe(409);

      const shrink = await app.server.inject({
        method: 'PUT',
        url: `/api/courses/${course.id}`,
        payload: { ...nineHoleCourse, holes: [] },
      });
      expect(shrink.statusCode).toBe(400);
    });

    it('rejects malformed ids', async () => {
      expect((await app.server.inject('/api/courses/abc')).statusCode).toBe(400);
    });
  });

  describe('rounds', () => {
    it('creates a round and returns per-hole strokes gained', async () => {
      const course = await createCourse();
      const res = await createRound(course.id);
      expect(res.statusCode).toBe(201);
      const detail = res.json<RoundDetail>();
      expect(detail.summary).toMatchObject({ score: 41, toPar: 5, holesPlayed: 9 });
      expect(detail.holes).toHaveLength(9);
      const { offTheTee, approach, aroundTheGreen, putting, total } = detail.summary.sg;
      expect(offTheTee + approach + aroundTheGreen + putting).toBeCloseTo(total, 1);
    });

    it('reports cross-field issues with hole paths', async () => {
      const course = await createCourse();
      const holes = sampleHoles();
      holes[0] = { ...holes[0]!, putts: 2, firstPuttFeet: null };
      const res = await createRound(course.id, '2026-05-01', holes);
      expect(res.statusCode).toBe(400);
      expect(res.json<{ issues: { path: string }[] }>().issues).toEqual([
        expect.objectContaining({ path: 'holes.0.firstPuttFeet' }),
      ]);
    });

    it('rejects unknown courses and too many holes', async () => {
      expect((await createRound(crypto.randomUUID())).statusCode).toBe(400);
      const course = await createCourse();
      const tooMany = [...sampleHoles(), { ...sampleHoles()[0]!, holeNumber: 10 }];
      expect((await createRound(course.id, '2026-05-01', tooMany)).statusCode).toBe(400);
    });

    it('lists, updates and deletes rounds', async () => {
      const course = await createCourse();
      const { round } = (await createRound(course.id, '2026-05-01')).json<RoundDetail>();
      await createRound(course.id, '2026-05-08');

      const list = (await app.server.inject('/api/rounds?limit=10')).json<RoundSummary[]>();
      expect(list.map((r) => r.playedOn)).toEqual(['2026-05-08', '2026-05-01']);

      const holes = sampleHoles();
      holes[0] = { ...holes[0]!, score: 5, putts: 3 };
      const updated = await app.server.inject({
        method: 'PUT',
        url: `/api/rounds/${round.id}`,
        payload: { courseId: course.id, playedOn: '2026-05-02', notes: 'windy', holes },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json<RoundDetail>().summary.score).toBe(42);
      expect(updated.json<RoundDetail>().round.notes).toBe('windy');

      const del = await app.server.inject({ method: 'DELETE', url: `/api/rounds/${round.id}` });
      expect(del.statusCode).toBe(204);
      expect((await app.server.inject(`/api/rounds/${round.id}`)).statusCode).toBe(404);
      expect(
        (await app.server.inject({ method: 'DELETE', url: `/api/rounds/${round.id}` })).statusCode,
      ).toBe(404);
      expect(
        (
          await app.server.inject({
            method: 'PUT',
            url: `/api/rounds/${round.id}`,
            payload: { courseId: course.id, playedOn: '2026-05-02', holes },
          })
        ).statusCode,
      ).toBe(404);
    });
  });

  describe('stats', () => {
    it('aggregates rounds and supports filtering', async () => {
      const course = await createCourse();
      await createRound(course.id, '2026-05-01');
      await createRound(course.id, '2026-05-08');

      const stats = (await app.server.inject('/api/stats')).json<Stats>();
      expect(stats).toMatchObject({ baseline: 'PGA Tour', rounds: 2, holes: 18 });
      expect(stats.priorities).toHaveLength(4);
      expect(stats.trend).toHaveLength(2);

      const filtered = (await app.server.inject('/api/stats?limit=1')).json<Stats>();
      expect(filtered.rounds).toBe(1);
      expect(
        (await app.server.inject(`/api/stats?courseId=${crypto.randomUUID()}`)).json<Stats>()
          .rounds,
      ).toBe(0);
    });
  });
});

describe('static web assets', () => {
  it('serves the SPA with history fallback while keeping API 404s', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'golf-sg-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Strokes Gained</title>');
    const app = await createTestApp({ webDistDir: dir });

    const deepLink = await app.server.inject('/rounds/1');
    expect(deepLink.statusCode).toBe(200);
    expect(deepLink.body).toContain('Strokes Gained');
    expect((await app.server.inject('/api/missing')).statusCode).toBe(404);
    expect((await app.server.inject({ method: 'POST', url: '/missing' })).statusCode).toBe(404);
    await app.close();
  });

  it('falls back to API-only when assets are missing', async () => {
    const app = await createTestApp({ webDistDir: join(tmpdir(), 'does-not-exist-golf-sg') });
    expect((await app.server.inject('/')).statusCode).toBe(404);
    await app.close();
  });
});
