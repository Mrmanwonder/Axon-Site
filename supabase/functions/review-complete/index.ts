// The student has finished reviewing. Start the explanations.
//
// This is the one transition the pipeline cannot make on its own, because the
// thing it waits for is a person. Everything downstream of here is built on
// marks a student has looked at and confirmed — which is the whole reason
// explanations run after review rather than eagerly during extraction.

import { CORS, clientFor, failure, json, readJson, serviceClient } from '../_shared/http.ts';

interface Body { run_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const user = clientFor(req);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.run_id) return failure('Which paper?');

  // RLS decides whose run this is. Reaching the row is the check.
  const { data: run } = await user
    .from('extraction_run').select('id, status').eq('id', body.run_id).maybeSingle();
  if (!run) return failure('That paper is not yours.', 403);

  const { count } = await user
    .from('question_region')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', body.run_id).eq('needs_review', true).is('student_confirmed_at', null);

  if ((count ?? 0) > 0) {
    return failure(
      `${count} question${count === 1 ? '' : 's'} still need${count === 1 ? 's' : ''} your eyes.`,
      409,
      { outstanding: count },
    );
  }

  const admin = serviceClient();
  const { data: queued, error } = await admin.rpc('begin_explanations', { p_run_id: body.run_id });
  if (error) return failure('We could not start the explanations. Your corrections are saved.', 500, error.message);

  return json({ run_id: body.run_id, explaining: queued ?? 0 });
});
