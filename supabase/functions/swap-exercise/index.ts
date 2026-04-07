import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { exerciseName, muscle, environment } = await req.json();
    if (!exerciseName || !muscle) return json({ error: 'exerciseName and muscle required' }, 400);

    const env = environment === 'Home' ? 'home (no gym machines, bodyweight or dumbbells only)' : 'gym';

    const prompt = `You are a personal trainer. The user cannot do "${exerciseName}" (targets: ${muscle}) because they don't have the required equipment. They are training at ${env}.

Suggest ONE alternative exercise that:
1. Targets the same muscle group (${muscle})
2. Requires no special machine — use bodyweight, resistance bands, or dumbbells only
3. Is equally effective for muscle activation

Reply ONLY with valid JSON (no markdown):
{
  "name": "Exercise Name",
  "detail": "3 × 12 reps · bodyweight · 60s rest",
  "muscle": "${muscle}",
  "sets": "3 sets × 12 reps",
  "instructions": "Step by step form cues in 2-3 sentences."
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));

    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Bad response: ${text.slice(0, 200)}`);

    return json({ exercise: JSON.parse(match[0]) });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
