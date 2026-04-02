import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // frames: array of base64 jpeg strings (up to 5)
    // exerciseName: the exercise we're trying to verify
    const { frames, exerciseName } = await req.json();
    if (!frames?.length || !exerciseName) return json({ error: 'frames and exerciseName required' }, 400);

    // Build content with up to 2 frames
    const imageFrames = frames.slice(0, 2).map((f: string) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: f },
    }));

    const prompt = `You are a certified personal trainer. These are 2 frames from a workout video.

The user claims they performed: "${exerciseName}"

In ONE pass, answer:
1. Is a person visible and moving (not just standing)?
2. Does the body position match "${exerciseName}"?

Be fair — partial reps or imperfect form still count as verified if the right muscle group is clearly being used.
Mark not verified only if: person is just standing still, video is unrecognisable, or completely wrong exercise.

Reply ONLY with valid JSON (no markdown):
{"verified":true or false,"confidence":0-1,"detected_exercise":"what you see or null","reason":"one short sentence"}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: [...imageFrames, { type: 'text', text: prompt }] }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));

    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Bad response: ${text.slice(0, 200)}`);

    return json(JSON.parse(match[0]));

  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
