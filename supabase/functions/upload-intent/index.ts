// Mint the keys and the presigned PUTs a device needs to upload a paper.
//
// Bytes never pass through here. A function has two seconds of CPU, and one
// 800KB body read and re-emit spends most of it — so the device is handed a URL
// per object and talks to the bucket directly. Each page is an independent PUT,
// which is also what makes a sixteen-page booklet on patchy 4G resumable: an
// interrupted upload retries the page that failed, not the booklet.

import { CORS, clientFor, failure, json, readJson, serviceClient } from '../_shared/http.ts';
import { BUCKET_FOR, type ObjectKind, objectKey, presignPut, PUT_TTL_SECONDS } from '../_shared/r2.ts';

interface RequestedObject {
  kind: ObjectKind;
  name: string | number;
  content_type: string;
  bytes?: number;
}

interface Body {
  student_id: string;
  paper_id: string;
  objects: RequestedObject[];
}

/** A page at 2400px long edge encodes to ~200KB; a source PDF can be larger. */
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_OBJECTS = 60;

const ALLOWED: Record<string, string[]> = {
  'image/webp': ['webp'],
  'image/jpeg': ['jpg'],
  'image/png': ['png'],
  'image/heic': ['heic'],
  'application/pdf': ['pdf'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const user = clientFor(req);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.student_id || !body?.paper_id || !Array.isArray(body.objects) || !body.objects.length) {
    return failure('Nothing to upload.');
  }
  if (body.objects.length > MAX_OBJECTS) {
    return failure(`That is more than ${MAX_OBJECTS} files in one go.`);
  }

  // RLS proves the student belongs to this caller. Reaching the row at all is
  // the check — a guessed id returns nothing rather than someone else's paper.
  const { data: paper } = await user
    .from('paper').select('id, student_id')
    .eq('id', body.paper_id).eq('student_id', body.student_id).maybeSingle();
  if (!paper) return failure('That paper is not yours.', 403);

  const admin = serviceClient();
  const minted: {
    kind: ObjectKind; name: string | number; bucket: string; key: string; url: string; upload_id?: string;
  }[] = [];

  for (const object of body.objects) {
    const extensions = ALLOWED[object.content_type];
    if (!extensions) return failure(`We cannot take a ${object.content_type} file.`);
    if (object.bytes && object.bytes > MAX_BYTES) {
      return failure('One of those files is too large to upload.');
    }
    if (!BUCKET_FOR[object.kind]) return failure('Unknown file kind.');

    const bucket = BUCKET_FOR[object.kind];
    const key = objectKey({
      studentId: body.student_id,
      paperId: body.paper_id,
      kind: object.kind,
      name: object.name,
      extension: extensions[0],
    });

    const entry = {
      kind: object.kind,
      name: object.name,
      bucket,
      key,
      url: await presignPut(bucket, key, object.content_type),
    } as (typeof minted)[number];

    // A source document gets a row now, unconfirmed. Derived artifacts do not:
    // they are recorded on the page row when the paper is submitted, and a row
    // per crop would be bookkeeping nobody reads.
    if (object.kind === 'upload' || object.kind === 'raw') {
      const { data: row } = await admin.from('upload').insert({
        paper_id: body.paper_id,
        student_id: body.student_id,
        kind: object.content_type === 'application/pdf' ? 'pdf' : 'image',
        r2_bucket: bucket,
        r2_key: key,
        content_type: object.content_type,
      }).select('id').single();
      entry.upload_id = row?.id;
    }

    minted.push(entry);
  }

  return json({ objects: minted, expires_in: PUT_TTL_SECONDS });
});
