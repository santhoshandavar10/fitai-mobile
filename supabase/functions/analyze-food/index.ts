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

function computeScore(calories: number, protein: number): { score: string; score_color: string } {
  if (protein >= 20 && calories <= 600) return { score: 'A', score_color: '#C8FF00' };
  if (calories <= 700) return { score: 'B', score_color: '#00D4FF' };
  if (calories <= 900) return { score: 'C', score_color: '#FF8C42' };
  return { score: 'D', score_color: '#FF4757' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: `Auth failed: ${authError?.message}` }, 401);

    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    // Accept base64 image directly from client
    const { imageData, mimeType = 'image/jpeg' } = await req.json();
    if (!imageData) return json({ error: 'imageData required' }, 400);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageData } },
            { type: 'text', text: `You are a professional nutritionist and food recognition expert. Look at this food photo carefully.

1. Identify exactly what food/dish this is — be specific (e.g. "Chicken Biryani", "Avocado Toast with Poached Egg", "Big Mac Meal", "Grilled Salmon with Rice").
2. Estimate portion size from the image (plate size, serving size, container).
3. Calculate realistic nutritional values for that exact portion.

Rules:
- If the image is blurry or unclear, still give your best identification.
- Base calorie estimates on standard serving sizes visible in the image.
- Do NOT guess generic values — use real macros for the specific food.

Reply with ONLY this JSON (no markdown, no explanation):
{"name":"exact food name","description":"main ingredients, 1 sentence","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}` },
          ],
        }],
      }),
    });

    const claudeData = await claudeRes.json();

    if (!claudeRes.ok) {
      return json({ error: `Claude error: ${claudeData.error?.message ?? JSON.stringify(claudeData)}` }, 500);
    }

    const text: string = claudeData.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: `Bad Claude response: ${text.slice(0, 200)}` }, 500);

    const parsed = JSON.parse(match[0]);
    const { score, score_color } = computeScore(Number(parsed.calories), Number(parsed.protein_g));

    return json({ nutrition: { ...parsed, score, score_color } });

  } catch (err: any) {
    return json({ error: `Error: ${err.message}` }, 500);
  }
});
