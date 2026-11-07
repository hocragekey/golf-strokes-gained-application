import type { ApiError } from '@golf-sg/shared';
import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly issues?: ApiError['issues'],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string): HttpError =>
  new HttpError(404, 'NotFound', `${what} not found`);

export const conflict = (message: string): HttpError => new HttpError(409, 'Conflict', message);

export const validationError = (issues: NonNullable<ApiError['issues']>): HttpError =>
  new HttpError(400, 'ValidationError', 'Request validation failed', issues);

/** Parses `data` with `schema`, throwing a 400 HttpError with field-level issues on failure. */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw validationError(
    result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}
