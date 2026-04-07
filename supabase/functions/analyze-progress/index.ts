import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

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

const GOALS = ['Muscle Gain', 'Fat Loss', 'Body Recomposition', 'Endurance'];
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Fetch profile
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('age, height_cm, weight_kg, goal, gender, name')
      .eq('id', user.id)
      .single();

    const goal = GOALS[profile?.goal ?? 0];
    const gender = GENDERS[profile?.gender ?? 0];
    const age = profile?.age ?? 25;
    const heightFt = ((profile?.height_cm ?? 175) / 30.48).toFixed(1);
    const weightLbs = Math.round((profile?.weight_kg ?? 80) * 2.20462);
    const name = profile?.name ?? 'there';

    // Fetch latest progress photos
    const { data: latestPhoto } = await serviceClient
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('week_number', { ascending: false })
      .limit(1)
      .single();

    // Fetch week 1 photo for comparison
    const { data: firstPhoto } = await serviceClient
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('week_number', { ascending: true })
      .limit(1)
      .single();

    const weekNumber = latestPhoto?.week_number ?? 1;
    const hasMultipleWeeks = firstPhoto && latestPhoto && firstPhoto.week_number !== latestPhoto.week_number;

    // Load images
    const imageBlocks: unknown[] = [];
    const { data: files } = await serviceClient.storage.from('body-photos').list(user.id);

    for (const pose of ['front', 'side', 'back']) {
      // Try latest week first
      const weekFile = files?.find((f) => f.name.toLowerCase().startsWith(`week${weekNumber}_${pose}`));
      if (weekFile) {
        const img = await toBase64('body-photos', `${user.id}/${weekFile.name}`);
        if (img) imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
      } else {
        // fallback to original body scan photos
        const scanFile = files?.find((f) => f.name.toLowerCase().startsWith(pose));
        if (scanFile) {
          const img = await toBase64('body-photos', `${user.id}/${scanFile.name}`);
          if (img) imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
        }
      }
    }

    const hasPhotos = imageBlocks.length > 0;
    const profileSummary = `Name: ${name} | Age: ${age} | Gender: ${gender} | Height: ${heightFt}ft | Weight: ${weightLbs}lbs | Goal: ${goal} | Week ${weekNumber} of training`;

    const prompt = `You are an elite personal trainer and body transformation coach analyzing ${hasPhotos ? 'body photos' : 'a profile'} to give a deeply motivating, honest, and personalized assessment.

Profile: ${profileSummary}
${hasMultipleWeeks ? `They have been tracking for ${weekNumber} weeks.` : 'This is their first week of tracking.'}
${hasPhotos ? `You have ${imageBlocks.length} photo(s) to analyze (front, side, back views).` : ''}

Write a single powerful motivating paragraph (5-7 sentences) that:
1. Estimates their current body fat percentage range based on what you see (be specific, e.g. "around 18-22% body fat")
2. Honestly identifies their biggest strength and the key area to improve
3. Explains exactly what will change in their body as they follow their ${goal} plan
4. Gives a realistic specific timeframe (e.g. "In 12 weeks you can expect to..." or "By week 16...")
5. Ends with a powerful motivational statement personalized to their goal

Write directly to ${name} in second person ("you"). Be like a world-class coach who is honest but fires them up. Do NOT use bullet points or headers — one flowing paragraph only.

Respond ONLY with this JSON:
{"analysis": "your full paragraph here"}`;

    const content = hasPhotos
      ? [...imageBlocks, { type: 'text', text: prompt }]
      : [{ type: 'text', text: prompt }];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content }] }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse response');
    const result = JSON.parse(match[0]);

    // Save analysis to profiles
    await serviceClient.from('profiles').update({
      body_analysis: result.analysis,
      body_analysis_week: weekNumber,
      body_analysis_at: new Date().toISOString(),
    }).eq('id', user.id);

    return json({ analysis: result.analysis, week: weekNumber });

  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
