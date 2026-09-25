import { expect, test } from 'bun:test';
import service from '../src/image-service';

const source = await Bun.file(new URL('./fixtures/64x48.jpg', import.meta.url)).bytes();
const logger = { warn: () => {} } as never;

async function run(transform: Record<string, unknown>) {
  const { data } = await service.transform(source, { src: '64x48.jpg', ...transform }, {} as never, logger);
  return new Bun.Image(data).metadata();
}

test('a width alone keeps the ratio', async () => {
  expect(await run({ width: 32, format: 'webp' })).toMatchObject({ width: 32, height: 24, format: 'webp' });
});

test('outside covers the box with the source ratio', async () => {
  // 64×48 scaled until it covers 30×40: height decides.
  expect(await run({ width: 30, height: 40, fit: 'outside', format: 'jpeg' })).toMatchObject({
    width: 53,
    height: 40,
    format: 'jpeg',
  });
});

test('never enlarges', async () => {
  expect(await run({ width: 128, format: 'png' })).toMatchObject({ width: 64, height: 48, format: 'png' });
});

test('cover with another ratio is refused, not silently stretched', async () => {
  await expect(run({ width: 30, height: 40, fit: 'cover' })).rejects.toThrow('cannot crop');
});

test('the source format is kept without an explicit one', async () => {
  expect((await run({ width: 16 })).format).toBe('jpeg');
});
