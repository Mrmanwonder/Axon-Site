export async function uploadScannedPage({ studentId, paperId, page, timing }) {
  timing?.stage?.('intent');
  requireOnline('Uploading');
  const measure = (stage, fn) => timing ? timing.measure(stage, fn) : fn();

const pageType = page.blob.type || 'image/jpeg';

// Four objects now, in two buckets. The page and its mask are derivatives and
// go to axon-derived; the original goes to axon-originals, which is what makes
// a bad warp or a bad encode recoverable rather than final (§7.6.4). The
// thumbnail is the cheapest large latency win in the system — triage asks "is
// this a marked exam paper", and it was being sent full pages to answer it.
const wanted = [
  { kind: 'page', name: `p${page.page_number}`, content_type: pageType, blob: page.blob },
  ];
  if (page.mask) {
    wanted.push({ kind: 'mask', name: `p${page.page_number}-mask`, content_type: 'image/png', blob: page.mask });
  }
  if (page.thumb) {
    wanted.push({ kind: 'thumb', name: `p${page.page_number}-thumb`, content_type: 'image/jpeg', blob: page.thumb });
  }
  if (page.original) {
    const originalType = page.original_type || page.original.type || 'image/jpeg';
    // An original in a type the upload endpoint will not mint a key for is not
    // silently dropped — it is skipped and said so in the return, so the gap is
    // visible in `original_key` being null rather than invisible.
    if (CAPTURE.UPLOAD_EXTENSIONS[originalType]) {
      wanted.push({ kind: 'raw', name: `p${page.page_number}-original`, content_type: originalType, blob: page.original });
    }
  }

const intent = await measure('intent', () => uploadIntent({
  student_id: studentId,
  paper_id: paperId,
  objects: wanted.map((o) => ({ kind: o.kind, name: o.name, content_type: o.content_type, bytes: o.blob.size })),
}, timing?.retry));

const minted = new Map();
  for (const want of wanted) {
    const got = intent?.objects?.find((o) => o.kind === want.kind && o.name === want.name);
    if (got) minted.set(want.kind, { ...got, blob: want.blob, content_type: want.content_type });
  }
  // The page itself is the one object there is no version of this that works
  // without. The rest each get their own check below, so a missing mask is a
  // named failure rather than a page that quietly arrives with no fine detail.
  if (!minted.has('page')) throw new Error('The page could not be prepared for upload.');
  if (page.mask && !minted.has('mask')) throw new Error('The page markings could not be prepared for upload.');

const uploads = [];
  for (const [, object] of minted) {
    await measure('transfer', () => putObject(object.url, object.blob, object.content_type, timing?.retry));
    uploads.push({ key: object.key, bucket: object.bucket, bytes: object.blob.size });
  }
  await measure('confirmation', () => uploadComplete({ paper_id: paperId, uploads }, timing?.retry));

const pageObj = minted.get('page');
  return {
    r2_bucket: pageObj.bucket,
    r2_key: pageObj.key,
    mask_key: minted.get('mask')?.key ?? null,
    thumb_key: minted.get('thumb')?.key ?? null,
    original_key: minted.get('raw')?.key ?? null,
    bytes: page.blob.size,
  };
}
