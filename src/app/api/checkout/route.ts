import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

// Price IDs for subscription tiers (set these in your Stripe dashboard)
const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
};

export async function POST(request: NextRequest) {
  try {
    const { email, priceId, successUrl, cancelUrl } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Determine which price to use
    const stripePriceId = priceId === 'yearly'
      ? PRICE_IDS.pro_yearly
      : PRICE_IDS.pro_monthly;

    if (!stripePriceId) {
      return NextResponse.json(
        { error: 'Price ID not configured' },
        { status: 500 }
      );
    }

    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    let customerId: string;

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          source: 'conkord_web',
        },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${request.headers.get('origin')}/dashboard?success=true`,
      cancel_url: cancelUrl || `${request.headers.get('origin')}/?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          email: email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check subscription status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
      expand: ['data.subscriptions'],
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        isPro: false,
        subscription: null,
      });
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        isPro: false,
        subscription: null,
      });
    }

    const subscription = subscriptions.data[0];

    return NextResponse.json({
      isPro: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: subscription.items.data[0]?.price?.id === PRICE_IDS.pro_yearly
          ? 'yearly'
          : 'monthly',
      },
    });
  } catch (error) {
    console.error('Subscription check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check subscription' },
      { status: 500 }
    );
  }
}
