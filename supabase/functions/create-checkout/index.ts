import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' });

const PLANS: Record<string, { name: string; amount: number; interval: 'month' | 'year'; interval_count: number }> = {
  monthly:   { name: 'FitAI Monthly',   amount: 2900, interval: 'month', interval_count: 1 },
  quarterly: { name: 'FitAI Quarterly', amount: 5700, interval: 'month', interval_count: 3 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: `Auth failed: ${authError?.message}` }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    const { plan = 'monthly', successUrl, cancelUrl } = await req.json();
    const planConfig = PLANS[plan] ?? PLANS.monthly;

    // Get or create Stripe customer
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id, name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: profile?.name ?? '',
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await serviceClient.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Get or create price
    const lookupKey = `fitai_${plan}`;
    const existingPrices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true });
    let priceId = existingPrices.data[0]?.id;

    if (!priceId) {
      const product = await stripe.products.create({ name: planConfig.name });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: planConfig.amount,
        currency: 'usd',
        recurring: { interval: planConfig.interval, interval_count: planConfig.interval_count },
        lookup_key: lookupKey,
      });
      priceId = price.id;
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 3 },
      success_url: successUrl ?? 'http://localhost:8081?checkout=success',
      cancel_url:  cancelUrl  ?? 'http://localhost:8081?checkout=cancelled',
      metadata: { supabase_user_id: user.id, plan },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
