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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return json({ error: `Auth failed: ${authError?.message}` }, 401);

    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    // Accept base64 image OR text description
    const { imageData, mimeType = 'image/jpeg', textDescription } = await req.json();
    if (!imageData && !textDescription) return json({ error: 'imageData or textDescription required' }, 400);

    const nutritionPrompt = `Reply with ONLY this JSON (no markdown, no explanation):
{"name":"exact food name","description":"main ingredients, 1 sentence","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}`;

    let content: unknown[];
    let model: string;

    if (textDescription) {
      // Text-only: use Haiku (fast & cheap)
      model = 'claude-haiku-4-5-20251001';
      content = [{
        type: 'text',
        text: `You are a professional nutritionist. The user describes what they ate. Calculate accurate macros.

Food description: "${textDescription}"

Rules:
- Parse quantities precisely (e.g. "5 egg whites" = 5 × 17 calories, 3.6g protein each)
- Account for cooking methods and added ingredients (oil sprays, sauces, etc.)
- 1 oil spray ≈ 7–10 calories, 1g fat
- Use real nutritional data, not estimates

${nutritionPrompt}`,
      }];
    } else {
      // Image: use Sonnet
      model = 'claude-sonnet-4-6';
      content = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageData } },
        { type: 'text', text: `You are a professional nutritionist and food recognition expert. Look at this food photo carefully.

1. Identify exactly what food/dish this is — be specific (e.g. "Chicken Biryani", "Avocado Toast with Poached Egg", "Big Mac Meal", "Grilled Salmon with Rice").
2. Estimate portion size from the image (plate size, serving size, container).
3. Calculate realistic nutritional values for that exact portion.

Rules:
- If the image is blurry or unclear, still give your best identification.
- Base calorie estimates on standard serving sizes visible in the image.
- Do NOT guess generic values — use real macros for the specific food.

${nutritionPrompt}` },
      ];
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: 'user', content }] }),
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
