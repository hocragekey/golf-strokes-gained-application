import type { CourseInput, HoleEntryInput, RoundInput } from '@golf-sg/shared';

export const courseInput: CourseInput = {
  name: 'Pebble Creek',
  tees: 'White',
  holes: [
    { number: 1, par: 4, yardage: 400 },
    { number: 2, par: 3, yardage: 160 },
    { number: 3, par: 4, yardage: 380 },
    { number: 4, par: 5, yardage: 520 },
    { number: 5, par: 4, yardage: 410 },
    { number: 6, par: 3, yardage: 175 },
    { number: 7, par: 4, yardage: 360 },
    { number: 8, par: 5, yardage: 540 },
    { number: 9, par: 4, yardage: 420 },
  ],
};

export const par4: HoleEntryInput = {
  holeNumber: 1,
  score: 4,
  teeResult: 'fairway',
  approachYards: 150,
  gir: true,
  firstPuttFeet: 20,
  putts: 2,
};

export const par3ThreePutt: HoleEntryInput = {
  holeNumber: 2,
  score: 4,
  approachLie: 'tee',
  gir: true,
  firstPuttFeet: 30,
  putts: 3,
};

/** A round at the fixture course, carrying the par and yardage of each played hole. */
export const roundInput = (holes: HoleEntryInput[]): RoundInput => ({
  courseName: courseInput.name,
  tees: courseInput.tees ?? '',
  playedOn: '2026-05-01',
  layout: courseInput.holes.slice(0, holes.length),
  holes,
});
