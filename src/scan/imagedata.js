// A working ImageData, wherever this code happens to be running.
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
