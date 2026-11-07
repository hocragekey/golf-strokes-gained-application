import {
  computeStats,
  roundInputSchema,
  roundIssues,
  summarizeRound,
  type Course,
  type RoundDetail,
  type ValidRoundInput,
} from '@golf-sg/shared';
import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { notFound, parseOrThrow, validationError } from '../errors.js';
import type { Repository } from '../repository.js';
import { idParams } from './params.js';

const listQuery = z.object({
  courseId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function validateAgainstCourse(input: ValidRoundInput, course: Course): void {
  const issues = roundIssues(input.holes, course);
  if (issues.length > 0) throw validationError(issues);
}

export const roundRoutes: FastifyPluginCallback<{ repo: Repository }> = (app, { repo }, done) => {
  const courseOrThrow = (courseId: string): Course => {
    const course = repo.getCourse(courseId);
    if (!course) throw validationError([{ path: 'courseId', message: 'Course does not exist' }]);
    return course;
  };

  const detail = (id: string): RoundDetail => {
    const round = repo.getRound(id);
    if (!round) throw notFound('Round');
    const course = repo.getCourse(round.courseId);
    if (!course) throw notFound('Course');
    const { holeSg, ...summary } = summarizeRound({ round, course });
    return { round, course, summary, holes: holeSg };
  };

  const withCourses = (filter: z.infer<typeof listQuery>) => {
    const courses = new Map(repo.listCourses().map((c) => [c.id, c]));
    return repo.listRounds(filter).flatMap((round) => {
      const course = courses.get(round.courseId);
      return course ? [{ round, course }] : [];
    });
  };

  app.get('/rounds', (req) => {
    const filter = parseOrThrow(listQuery, req.query);
    return withCourses(filter).map((rc) => {
      const { holeSg: _holeSg, ...summary } = summarizeRound(rc);
      return summary;
    });
  });

  app.post('/rounds', async (req, reply) => {
    const input = parseOrThrow(roundInputSchema, req.body);
    validateAgainstCourse(input, courseOrThrow(input.courseId));
    const round = repo.createRound(input);
    return reply.code(201).send(detail(round.id));
  });

  app.get('/rounds/:id', (req) => detail(parseOrThrow(idParams, req.params).id));

  app.put('/rounds/:id', (req) => {
    const { id } = parseOrThrow(idParams, req.params);
    if (!repo.getRound(id)) throw notFound('Round');
    const input = parseOrThrow(roundInputSchema, req.body);
    validateAgainstCourse(input, courseOrThrow(input.courseId));
    repo.updateRound(id, input);
    return detail(id);
  });

  app.delete('/rounds/:id', async (req, reply) => {
    const { id } = parseOrThrow(idParams, req.params);
    if (!repo.deleteRound(id)) throw notFound('Round');
    return reply.code(204).send();
  });

  app.get('/stats', (req) => computeStats(withCourses(parseOrThrow(listQuery, req.query))));

  done();
};
