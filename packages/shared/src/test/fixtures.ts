import {
  holeEntrySchema,
  type Course,
  type CourseHole,
  type HoleEntry,
  type HoleEntryInput,
  type Round,
} from '../schemas.js';

export const par4: CourseHole = { number: 1, par: 4, yardage: 400 };
export const par3: CourseHole = { number: 2, par: 3, yardage: 160 };
export const par5: CourseHole = { number: 3, par: 5, yardage: 520 };

export const entry = (input: Partial<HoleEntryInput> = {}): HoleEntry =>
  holeEntrySchema.parse({ holeNumber: 1, score: 4, gir: true, putts: 2, ...input });

const now = '2026-01-01T00:00:00.000Z';

export const course: Course = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Pine Valley Muni',
  tees: 'White',
  holes: [par4, par3, par5],
  createdAt: now,
  updatedAt: now,
};

export function round(id: string, playedOn: string, holes: HoleEntry[]): Round {
  return {
    id,
    courseName: course.name,
    tees: course.tees,
    playedOn,
    notes: '',
    layout: course.holes.slice(0, holes.length),
    holes,
    createdAt: now,
    updatedAt: now,
  };
}
