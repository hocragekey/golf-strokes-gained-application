// Bundles the Lambda handler into one ESM file. The AWS SDK v3 ships with the Node.js 22 runtime.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/lambda.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  conditions: ['@golf-sg/source'],
  external: ['@aws-sdk/*'],
  minify: true,
  sourcemap: 'linked',
  legalComments: 'none',
});
