import { courseInputSchema } from '@golf-sg/shared';
import type { FastifyPluginCallback } from 'fastify';
import { conflict, notFound, parseOrThrow } from '../errors.js';
import type { Repository } from '../repository.js';
import { idParams } from './params.js';

export const courseRoutes: FastifyPluginCallback<{ repo: Repository }> = (app, { repo }, done) => {
  const findCourse = (params: unknown) => {
    const { id } = parseOrThrow(idParams, params);
    const course = repo.getCourse(id);
    if (!course) throw notFound('Course');
    return course;
  };

  app.get('/courses', () => repo.listCourses());

  app.post('/courses', async (req, reply) => {
    const input = parseOrThrow(courseInputSchema, req.body);
    return reply.code(201).send(repo.createCourse(input));
  });

  app.get('/courses/:id', (req) => findCourse(req.params));

  app.put('/courses/:id', (req) => {
    const { id } = findCourse(req.params);
    const input = parseOrThrow(courseInputSchema, req.body);
    const maxPlayed = repo.maxHolePlayed(id);
    if (input.holes.length < maxPlayed) {
      throw conflict(`Rounds on this course include hole ${maxPlayed}; keep at least that many`);
    }
    return repo.updateCourse(id, input);
  });

  app.delete('/courses/:id', async (req, reply) => {
    const { id } = findCourse(req.params);
    const roundCount = repo.countRoundsForCourse(id);
    if (roundCount > 0) {
      throw conflict(`Course has ${roundCount} round(s); delete them first`);
    }
    repo.deleteCourse(id);
    return reply.code(204).send();
  });

  done();
};
