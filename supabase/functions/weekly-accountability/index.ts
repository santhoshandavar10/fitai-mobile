import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' });
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!
);

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
    // Last week: Monday 00:00 → Sunday 23:59
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const weekLabel = lastMonday.toISOString().split('T')[0]; // e.g. "2025-04-21"

    // Fetch all accountability users
    const { data: profiles, error } = await serviceClient
      .from('profiles')
      .select('id, stripe_customer_id, name')
      .eq('accountability_enabled', true)
      .not('stripe_customer_id', 'is', null);

    if (error) throw error;
    if (!profiles?.length) return json({ message: 'No accountability users', charged: 0 });

    const results = [];

    for (const profile of profiles) {
      // Count workouts last week
      const { count } = await serviceClient
        .from('workout_logs')
        .select('id', { count: 'exact' })
        .eq('user_id', profile.id)
        .gte('logged_at', lastMonday.toISOString())
        .lte('logged_at', lastSunday.toISOString());

      const workoutsLastWeek = count ?? 0;
      const safe = workoutsLastWeek >= 3;

      if (safe) {
        // Log safe week
        await serviceClient.from('accountability_charges').upsert({
          user_id: profile.id,
          week_start: lastMonday.toISOString(),
          week_label: weekLabel,
          workouts_logged: workoutsLastWeek,
          status: 'safe',
          amount_cents: 0,
        }, { onConflict: 'user_id, week_label' });

        results.push({ userId: profile.id, status: 'safe', workouts: workoutsLastWeek });
        continue;
      }

      // Attempt charge
      try {
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id) as any;
        const paymentMethodId = customer.invoice_settings?.default_payment_method;

        if (!paymentMethodId) {
          await serviceClient.from('accountability_charges').upsert({
            user_id: profile.id,
            week_start: lastMonday.toISOString(),
            week_label: weekLabel,
            workouts_logged: workoutsLastWeek,
            status: 'no_payment_method',
            amount_cents: 0,
          }, { onConflict: 'user_id, week_label' });

          results.push({ userId: profile.id, status: 'no_payment_method', workouts: workoutsLastWeek });
          continue;
        }

        const intent = await stripe.paymentIntents.create({
          amount: 1000, // $10
          currency: 'usd',
          customer: profile.stripe_customer_id,
          payment_method: paymentMethodId,
          confirm: true,
          off_session: true,
          description: `FitAI accountability — missed workouts week of ${weekLabel}`,
          metadata: { user_id: profile.id, week: weekLabel, workouts_logged: String(workoutsLastWeek) },
        });

        await serviceClient.from('accountability_charges').upsert({
          user_id: profile.id,
          week_start: lastMonday.toISOString(),
          week_label: weekLabel,
          workouts_logged: workoutsLastWeek,
          status: 'charged',
          amount_cents: 1000,
          stripe_payment_intent_id: intent.id,
        }, { onConflict: 'user_id, week_label' });

        results.push({ userId: profile.id, status: 'charged', workouts: workoutsLastWeek });

      } catch (stripeErr: any) {
        await serviceClient.from('accountability_charges').upsert({
          user_id: profile.id,
          week_start: lastMonday.toISOString(),
          week_label: weekLabel,
          workouts_logged: workoutsLastWeek,
          status: 'charge_failed',
          amount_cents: 0,
          error_message: stripeErr.message,
        }, { onConflict: 'user_id, week_label' });

        results.push({ userId: profile.id, status: 'charge_failed', error: stripeErr.message });
      }
    }

    const charged = results.filter(r => r.status === 'charged').length;
    const safe    = results.filter(r => r.status === 'safe').length;
    return json({ message: 'Accountability run complete', charged, safe, total: profiles.length, results });

  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
