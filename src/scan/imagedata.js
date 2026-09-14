// Scanner math uses a structural image plane. Canvas APIs, however, require a
// realm-branded ImageData. Keep that distinction at this one boundary.

import { scanError } from './errors.js';

function dimensions(width, height) {
  return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0;
}
//
// The pipeline modules are pure and are deliberately reusable in three places:
// the browser main thread, a worker, and the accuracy harness under Node. Node
// has no ImageData, and the harness is the one place where correctness is
// actually measured, so it must not be the one place the modules cannot load.

export function makeImageData(width, height) {
  if (typeof ImageData !== 'undefined') return new ImageData(width, height);
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function wrapImageData(data, width, height) {
  if (typeof ImageData !== 'undefined') return new ImageData(data, width, height);
  return { width, height, data };
}

export function isImagePlane(value) {
  return !!value && dimensions(value.width, value.height)
    && value.data instanceof Uint8ClampedArray
    && value.data.length === value.width * value.height * 4;
}

export function assertImagePlane(value, label = 'image') {
  if (!isImagePlane(value)) {
    throw scanError('SCAN_IMAGE_PLANE_INVALID',
      'That page could not be prepared. Try taking it again.', {
        debugMessage: `${label} is not a valid RGBA image plane`,
        details: { width: value?.width, height: value?.height, length: value?.data?.length },
      });
  }
  return value;
}

export function imageDataForContext(ctx, value) {
  const plane = assertImagePlane(value);
  if (typeof ImageData !== 'undefined' && plane instanceof ImageData) return plane;
  if (!ctx?.createImageData) {
    throw scanError('SCAN_CANVAS_CONTEXT',
      'That page could not be prepared. Try taking it again.', {
        debugMessage: 'The canvas context cannot create ImageData',
      });
  }
  const native = ctx.createImageData(plane.width, plane.height);
  native.data.set(plane.data);
  return native;
}
