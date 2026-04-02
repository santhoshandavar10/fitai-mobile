import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

const GOALS = ['Muscle Gain', 'Fat Loss', 'Body Recomposition', 'Endurance'];
const ENVIRONMENTS = ['Gym', 'Home'];
const GENDERS = ['Male', 'Female', 'Other'];

async function toBase64(bucket: string, path: string) {
  const { data, error } = await serviceClient.storage.from(bucket).download(path);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  const arr = new Uint8Array(buf);
  let bin = '';
  arr.forEach((b) => { bin += String.fromCharCode(b); });
  const ext = path.split('.').pop()?.toLowerCase() ?? 'jpeg';
  return { data: btoa(bin), mediaType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
}

async function callClaude(content: unknown[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, messages: [{ role: 'user', content }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
  const text = data.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
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

    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    // Fetch profile
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('age, height_cm, weight_kg, goal, environment, gender, name')
      .eq('id', user.id)
      .single();

    const goal = GOALS[profile?.goal ?? 0];
    const environment = ENVIRONMENTS[profile?.environment ?? 0];
    const gender = GENDERS[profile?.gender ?? 0];
    const age = profile?.age ?? 25;
    const height = profile?.height_cm ?? 175;
    const weight = profile?.weight_kg ?? 80;

    // Download body photos
    const { data: files } = await serviceClient.storage.from('body-photos').list(user.id);
    const imageBlocks: unknown[] = [];
    for (const pose of ['front', 'side', 'back']) {
      const file = files?.find((f) => f.name.toLowerCase().startsWith(pose));
      if (file) {
        const img = await toBase64('body-photos', `${user.id}/${file.name}`);
        if (img) imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
      }
    }

    const hasPhotos = imageBlocks.length > 0;
    const heightFt = (height / 30.48).toFixed(1);
    const weightLbs = Math.round(weight * 2.20462);
    const profileSummary = `Age: ${age} | Gender: ${gender} | Height: ${heightFt}ft | Weight: ${weightLbs}lbs | Goal: ${goal} | Training: ${environment}`;

    // ── WORKOUT PLAN ──────────────────────────────────────────────────────────
    const workoutPrompt = `You are an elite personal trainer. ${hasPhotos ? 'Analyze the body photos and' : 'Based on the profile below,'} create a highly personalized workout plan.

Profile: ${profileSummary}
${hasPhotos ? `Photos provided: ${imageBlocks.length} (assess muscle development, body fat, posture, and proportions).` : ''}

Generate a 6-day training split with 5 exercises per training day tailored to their goal and environment.
IMPORTANT: Sunday (SUN) is the ONLY rest day. MON through SAT must ALL be training days — no other rest days.

Respond ONLY with this JSON (no markdown):
{
  "body_assessment": "3-4 sentences on current physique, key strengths, areas to improve, and how the plan addresses their goal",
  "week_schedule": [
    {"day":"MON","type":"Push","rest":false},
    {"day":"TUE","type":"Pull","rest":false},
    {"day":"WED","type":"Legs","rest":false},
    {"day":"THU","type":"Push","rest":false},
    {"day":"FRI","type":"Pull","rest":false},
    {"day":"SAT","type":"Arms","rest":false},
    {"day":"SUN","type":"REST","rest":true}
  ],
  "workouts": {
    "Push": [
      {"name":"Exercise","detail":"4 × 8 reps · weight · 90s rest","muscle":"Chest","sets":"4 sets × 8 reps","instructions":"Step-by-step form cues..."},
      {"name":"...","detail":"...","muscle":"Shoulders","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Triceps","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Chest","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Shoulders","sets":"...","instructions":"..."}
    ],
    "Pull": [
      {"name":"...","detail":"...","muscle":"Back","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Back","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Biceps","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Back","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Biceps","sets":"...","instructions":"..."}
    ],
    "Legs": [
      {"name":"...","detail":"...","muscle":"Legs","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Legs","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Legs","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Legs","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Legs","sets":"...","instructions":"..."}
    ],
    "Arms": [
      {"name":"...","detail":"...","muscle":"Biceps","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Triceps","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Biceps","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Triceps","sets":"...","instructions":"..."},
      {"name":"...","detail":"...","muscle":"Biceps","sets":"...","instructions":"..."}
    ]
  }
}`;

    // ── MEAL PLAN ─────────────────────────────────────────────────────────────
    const mealPrompt = `You are a professional nutritionist. Create a personalized 7-day meal plan for this person.

Profile: ${profileSummary}

Design meals optimized for their goal (${goal}). Include calorie targets, macros, and practical meal ideas.

Respond ONLY with this JSON (no markdown):
{
  "daily_calories": number,
  "daily_protein_g": number,
  "daily_carbs_g": number,
  "daily_fat_g": number,
  "nutrition_note": "2-3 sentences on the nutrition strategy for their goal",
  "meal_plan": {
    "monday": {
      "breakfast": {"name":"meal name","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"ingredients":"brief list"},
      "lunch": {"name":"meal name","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"ingredients":"brief list"},
      "dinner": {"name":"meal name","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"ingredients":"brief list"},
      "snack": {"name":"snack name","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"ingredients":"brief list"}
    },
    "tuesday": {"breakfast":{...},"lunch":{...},"dinner":{...},"snack":{...}},
    "wednesday": {"breakfast":{...},"lunch":{...},"dinner":{...},"snack":{...}},
    "thursday": {"breakfast":{...},"lunch":{...},"dinner":{...},"snack":{...}},
    "friday": {"breakfast":{...},"lunch":{...},"dinner":{...},"snack":{...}},
    "saturday": {"breakfast":{...},"lunch":{...},"dinner":{...},"snack":{...}},
    "sunday": {"breakfast":{...},"lunch":{...},"dinner":{...},"snack":{...}}
  },
  "grocery_list": [
    {"name":"item","qty":"amount","emoji":"🥩"},
    ...15 items
  ]
}`;

    // Run both AI calls in parallel
    const workoutContent = hasPhotos
      ? [...imageBlocks, { type: 'text', text: workoutPrompt }]
      : [{ type: 'text', text: workoutPrompt }];

    const [workoutPlan, mealPlan] = await Promise.all([
      callClaude(workoutContent),
      callClaude([{ type: 'text', text: mealPrompt }]),
    ]);

    // Enforce: SUN = only rest day, MON–SAT = always training
    if (Array.isArray(workoutPlan.week_schedule)) {
      for (const d of workoutPlan.week_schedule) {
        if (d.day === 'SUN') { d.rest = true; d.type = 'REST'; }
        else { d.rest = false; }
      }
      const sunEntry = workoutPlan.week_schedule.find((d: any) => d.day === 'SUN');
      if (!sunEntry) workoutPlan.week_schedule.push({ day: 'SUN', type: 'REST', rest: true });
    }

    // Save both plans
    await Promise.all([
      serviceClient.from('workout_plans').upsert(
        { user_id: user.id, plan: workoutPlan, body_assessment: workoutPlan.body_assessment, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      ),
      serviceClient.from('meal_plans').upsert(
        { user_id: user.id, plan: mealPlan, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      ),
    ]);

    return json({ workoutPlan, mealPlan });

  } catch (err: any) {
    return json({ error: `Error: ${err.message}` }, 500);
  }
});
