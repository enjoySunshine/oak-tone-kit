import { describe, expect, it } from 'vitest';

import { Image } from '../../Image.ts';
import { Mask } from '../../Mask.ts';
import { histogramEqualize } from '../histogramEqualize.ts';

describe('grey images', () => {
  it('spreads the grey levels using the counts of the whole image', () => {
    const image = testUtils.createGreyImage([
      [10, 10, 10, 10],
      [20, 30, 30, 200],
    ]);

    const result = histogramEqualize(image);

    expect(result).toMatchImageData([
      [0, 0, 0, 0],
      [64, 191, 191, 255],
    ]);
  });

  it('does not modify the original image and keeps the counts readable', () => {
    const image = testUtils.createGreyImage([
      [10, 10, 10, 10],
      [20, 30, 30, 200],
    ]);

    const result = histogramEqualize(image);

    expect(image).toMatchImageData([
      [10, 10, 10, 10],
      [20, 30, 30, 200],
    ]);
    expect(result).not.toBe(image);

    const histogram = image.histogram();

    expect(histogram[10]).toBe(4);
    expect(histogram[20]).toBe(1);
    expect(histogram[30]).toBe(2);
    expect(histogram[200]).toBe(1);
  });

  it('leaves a constant image unchanged', () => {
    const image = testUtils.createGreyImage([
      [40, 40],
      [40, 40],
    ]);

    expect(histogramEqualize(image)).toMatchImageData([
      [40, 40],
      [40, 40],
    ]);
  });

  it('maps unseen values toward the closest extremum', () => {
    const image = testUtils.createGreyImage([
      [10, 10, 0, 255],
      [10, 20, 80, 90],
    ]);
    // Histogram computed on the two left columns only:
    // 10 occurs 3 times, 20 occurs 1 time.
    const mask = testUtils.createMask([
      [1, 1, 0, 0],
      [1, 1, 0, 0],
    ]);

    const result = histogramEqualize(image, { mask });

    expect(result).toMatchImageData([
      [0, 0, 0, 255],
      [0, 255, 255, 255],
    ]);
  });

  it('can be used through the Image method', () => {
    const image = testUtils.createGreyImage([
      [10, 10, 10, 10],
      [20, 30, 30, 200],
    ]);

    expect(image.histogramEqualize()).toMatchImageData([
      [0, 0, 0, 0],
      [64, 191, 191, 255],
    ]);
  });

  it('supports the out option, including in-place processing', () => {
    const image = testUtils.createGreyImage([
      [10, 10, 10, 10],
      [20, 30, 30, 200],
    ]);

    const out = new Image(4, 2, { colorModel: 'GREY' });
    const result = histogramEqualize(image, { out });

    expect(result).toBe(out);
    expect(result).toMatchImageData([
      [0, 0, 0, 0],
      [64, 191, 191, 255],
    ]);

    histogramEqualize(image, { out: image });

    expect(image).toMatchImageData([
      [0, 0, 0, 0],
      [64, 191, 191, 255],
    ]);
  });

  it('throws when the mask has another size', () => {
    const image = testUtils.createGreyImage([
      [10, 10, 10, 10],
      [20, 30, 30, 200],
    ]);
    const mask = new Mask(4, 1);

    expect(() => histogramEqualize(image, { mask })).toThrow(
      /same width and height/,
    );
  });

  it('throws when the mask selects no pixel', () => {
    const image = testUtils.createGreyImage([
      [10, 10],
      [20, 30],
    ]);
    const mask = testUtils.createMask([
      [0, 0],
      [0, 0],
    ]);

    expect(() => histogramEqualize(image, { mask })).toThrow(
      /at least one pixel/,
    );
  });
});

describe('color images', () => {
  it('equalizes each component independently and keeps alpha untouched', () => {
    const image = testUtils.createRgbaImage([
      [10, 10, 15, 100],
      [10, 20, 15, 80],
      [10, 30, 15, 100],
      [200, 200, 15, 50],
    ]);

    const result = histogramEqualize(image);

    expect(result).toMatchImageData([
      [0, 0, 15, 100],
      [0, 85, 15, 80],
      [0, 170, 15, 100],
      [255, 255, 15, 50],
    ]);
  });

  it('does not modify the alpha channel of a GREYA image', () => {
    const image = testUtils.createGreyaImage([
      [10, 100],
      [10, 80],
      [10, 100],
      [200, 50],
    ]);

    expect(histogramEqualize(image)).toMatchImageData([
      [0, 100],
      [0, 80],
      [0, 100],
      [255, 50],
    ]);
  });

  it('accepts an explicit channels option', () => {
    const image = testUtils.createRgbImage([
      [10, 10, 15],
      [10, 20, 15],
      [10, 30, 15],
      [200, 200, 15],
    ]);

    const result = histogramEqualize(image, { channels: [1] });

    expect(result).toMatchImageData([
      [10, 0, 15],
      [10, 85, 15],
      [10, 170, 15],
      [200, 255, 15],
    ]);
  });

  it('throws on an invalid channel', () => {
    const image = testUtils.createRgbImage([
      [10, 10, 15],
      [200, 200, 15],
    ]);

    expect(() => histogramEqualize(image, { channels: [3] })).toThrow(
      /invalid channel/,
    );
  });
});

describe('16-bit images', () => {
  it('spreads the values over the full 16-bit range', () => {
    const image = testUtils.createGreyImage(
      [
        [1000, 1000],
        [2000, 3000],
      ],
      { bitDepth: 16 },
    );

    const result = histogramEqualize(image);
    const values = result.getChannel(0);

    expect(values[0]).toBe(0);
    expect(values[2]).toBe(32768);
    expect(values[3]).toBe(65535);
  });
});
