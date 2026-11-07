import type { CourseInput, HoleEntryInput } from '@golf-sg/shared';
import { buildApp, type BuildAppOptions } from '../src/app.js';
import { openDatabase } from '../src/db/client.js';

export const nineHoleCourse: CourseInput = {
  name: 'Riverside Nine',
  tees: 'Blue',
  holes: [
    { number: 1, par: 4, yardage: 380 },
    { number: 2, par: 3, yardage: 165 },
    { number: 3, par: 5, yardage: 510 },
    { number: 4, par: 4, yardage: 410 },
    { number: 5, par: 4, yardage: 350 },
    { number: 6, par: 3, yardage: 140 },
    { number: 7, par: 5, yardage: 540 },
    { number: 8, par: 4, yardage: 395 },
    { number: 9, par: 4, yardage: 420 },
  ],
};

/** A plausible bogey-ish front nine that passes every consistency rule. */
export function sampleHoles(): HoleEntryInput[] {
  return [
    {
      holeNumber: 1,
      score: 4,
      teeResult: 'fairway',
      approachYards: 140,
      gir: true,
      firstPuttFeet: 25,
      putts: 2,
    },
    { holeNumber: 2, score: 3, gir: true, firstPuttFeet: 12, putts: 2 },
    {
      holeNumber: 3,
      score: 6,
      teeResult: 'left',
      approachYards: 110,
      approachLie: 'rough',
      gir: false,
      missDirection: 'short',
      shortGameShots: 1,
      shortGameYards: 15,
      shortGameLie: 'rough',
      firstPuttFeet: 6,
      putts: 2,
    },
    {
      holeNumber: 4,
      score: 5,
      teeResult: 'right',
      approachYards: 175,
      approachLie: 'rough',
      gir: false,
      missDirection: 'right',
      shortGameShots: 1,
      shortGameYards: 20,
      shortGameLie: 'sand',
      firstPuttFeet: 3,
      putts: 1,
      penalties: 0,
    },
    {
      holeNumber: 5,
      score: 4,
      teeResult: 'fairway',
      approachYards: 120,
      gir: true,
      firstPuttFeet: 35,
      putts: 2,
    },
    { holeNumber: 6, score: 4, gir: true, firstPuttFeet: 30, putts: 3 },
    {
      holeNumber: 7,
      score: 6,
      teeResult: 'penalty',
      approachYards: 130,
      gir: false,
      missDirection: 'long',
      shortGameShots: 1,
      shortGameYards: 10,
      shortGameLie: 'fringe',
      firstPuttFeet: 8,
      putts: 1,
      penalties: 1,
    },
    {
      holeNumber: 8,
      score: 4,
      teeResult: 'fairway',
      approachYards: 155,
      gir: true,
      firstPuttFeet: 18,
      putts: 2,
    },
    {
      holeNumber: 9,
      score: 5,
      teeResult: 'short',
      approachYards: 200,
      gir: false,
      missDirection: 'left',
      shortGameShots: 1,
      shortGameYards: 25,
      shortGameLie: 'rough',
      firstPuttFeet: 12,
      putts: 2,
    },
  ];
}

export async function createTestApp(opts: Partial<BuildAppOptions> = {}) {
  const database = openDatabase(':memory:');
  const app = await buildApp({ db: database.db, ...opts });
  return {
    ...app,
    close: async () => {
      await app.server.close();
      database.close();
    },
  };
}
