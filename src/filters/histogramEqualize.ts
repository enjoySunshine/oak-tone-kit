import type { Image } from '../Image.ts';
import type { Mask } from '../Mask.ts';
import { getOutputImage } from '../utils/getOutputImage.ts';
import checkProcessable from '../utils/validators/checkProcessable.ts';
import { validateChannels } from '../utils/validators/validators.ts';

export interface HistogramEqualizeOptions {
  /**
   * Specify which channels should be processed. The histogram of each
   * selected channel is computed independently and the alpha channel is
   * never processed by default.
   * @default All the components of the image (no alpha).
   */
  channels?: number[];
  /**
   * Binary mask, the same size as the image. Only the pixels where the
   * mask has a value of 1 are used to compute the histograms, while the
   * resulting mapping is applied to every pixel of the image.
   */
  mask?: Mask;
  /**
   * Image to which to output.
   */
  out?: Image;
}

/**
 * Apply histogram equalization to the image. The gray levels (or the
 * values of each color channel independently) are spread over the whole
 * range [0, image.maxValue] according to their cumulative distribution.
 *
 * The mapping applied to a value `v` present in the histogram is:
 * `round((cdf(v) - cdfMin) / (total - cdfMin) * maxValue)`, where `cdf`
 * is the cumulative histogram, `cdfMin` the count of the smallest value
 * that occurs and `total` the number of sampled pixels. Values that do
 * not occur in the sampled pixels are mapped toward the closest extremum:
 * 0 when they are smaller than the smallest occurring value and
 * `maxValue` when they are larger.
 *
 * A channel whose sampled pixels all have the same value is left
 * unchanged. The alpha channel is never modified.
 * @param image - Image to process.
 * @param options - Histogram equalization options.
 * @returns The image with equalized histograms.
 */
export function histogramEqualize(
  image: Image,
  options: HistogramEqualizeOptions = {},
): Image {
  const {
    channels = new Array(image.components).fill(0).map((value, index) => index),
    mask,
  } = options;

  validateChannels(channels, image);

  checkProcessable(image, {
    bitDepth: [8, 16],
  });

  if (
    mask !== undefined &&
    (mask.width !== image.width || mask.height !== image.height)
  ) {
    throw new RangeError(
      'mask must have the same width and height as the image',
    );
  }

  const newImage = getOutputImage(image, options, { clone: true });

  const { maxValue, size } = image;

  for (const channel of channels) {
    const histogram = new Uint32Array(maxValue + 1);
    let total = 0;
    for (let i = 0; i < size; i++) {
      if (mask === undefined || mask.getBitByIndex(i) === 1) {
        histogram[image.getValueByIndex(i, channel)]++;
        total++;
      }
    }

    if (total === 0) {
      throw new RangeError(
        'mask must contain at least one pixel to compute the histogram',
      );
    }

    // Smallest value that occurs among the sampled pixels.
    let minValue = 0;
    while (histogram[minValue] === 0) {
      minValue++;
    }

    const cdfMin = histogram[minValue];

    // Every sampled pixel has the same value: the channel is left unchanged.
    if (total === cdfMin) {
      continue;
    }

    const lookup = new Uint16Array(maxValue + 1);
    let cumulative = 0;
    let previous = 0;
    for (let value = 0; value <= maxValue; value++) {
      if (histogram[value] > 0) {
        cumulative += histogram[value];
        previous = Math.round(
          ((cumulative - cdfMin) / (total - cdfMin)) * maxValue,
        );
      }
      // Values absent from the histogram keep the most recent mapped value,
      // i.e. they are mapped toward the closest lower occurring level.
      lookup[value] = previous;
    }

    for (let i = 0; i < size; i++) {
      newImage.setValueByIndex(
        i,
        channel,
        lookup[image.getValueByIndex(i, channel)],
      );
    }
  }

  return newImage;
}
