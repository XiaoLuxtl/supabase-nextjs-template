import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
});

const paymentClient = new Payment(client);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

// Helper para esperar
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Procesar el pago de forma asíncrona
async function processPaymentAsync(paymentId: string) {
  const maxRetries = 10;
  let payment;

  // Intentar obtener el pago con reintentos
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) {
        await sleep(2000); // 2 segundos entre intentos
        console.log(`[Async] Retry ${i + 1}/${maxRetries} for payment ${paymentId}`);
      }
      
      payment = await paymentClient.get({ id: paymentId });
      console.log(`[Async] Payment ${paymentId} found on attempt ${i + 1}`);
      break;
    } catch (error: any) {
      if (error.status === 404 && i < maxRetries - 1) {
        continue;
      }
      console.error(`[Async] Failed to get payment ${paymentId}:`, error);
      return;
    }
  }

  if (!payment) {
    console.error(`[Async] Payment ${paymentId} not found after ${maxRetries} retries`);
    return;
  }

  console.log('[Async] Payment details:', {
    id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    external_reference: payment.external_reference,
    transaction_amount: payment.transaction_amount
  });

  const purchaseId = payment.external_reference;
  if (!purchaseId) {
    console.error('[Async] No external_reference in payment');
    return;
  }

  // Obtener la compra
  const { data: purchase, error: purchaseError } = await supabase
    .from('credit_purchases')
    .select('*')
    .eq('id', purchaseId)
    .single();

  if (purchaseError || !purchase) {
    console.error('[Async] Purchase not found:', purchaseId);
    return;
  }

  // Mapear estados
  let newStatus = 'pending';
  if (payment.status === 'approved') {
    newStatus = 'approved';
  } else if (payment.status === 'rejected') {
    newStatus = 'rejected';
  } else if (payment.status === 'cancelled') {
    newStatus = 'cancelled';
  } else if (payment.status === 'refunded') {
    newStatus = 'refunded';
  }

  console.log('[Async] Updating purchase status:', {
    purchaseId,
    oldStatus: purchase.payment_status,
    newStatus
  });

  // Actualizar estado
  const { error: updateError } = await supabase
    .from('credit_purchases')
    .update({
      payment_id: payment.id?.toString(),
      payment_status: newStatus
    })
    .eq('id', purchaseId);

  if (updateError) {
    console.error('[Async] Error updating purchase:', updateError);
    return;
  }

  // Acreditar créditos si fue aprobado
  if (newStatus === 'approved' && !purchase.applied_at) {
    console.log('[Async] Applying credits for purchase:', purchaseId);
    
    const { error: applyError } = await supabase.rpc(
      'apply_credit_purchase',
      { p_purchase_id: purchaseId }
    );

    if (applyError) {
      console.error('[Async] Error applying credits:', applyError);
    } else {
      console.log('[Async] ✓ Credits applied successfully!');
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Webhook received:', body);

    // Ignorar notificaciones que no sean de pago
    if (body.type !== 'payment') {
      console.log('Ignoring non-payment notification');
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.error('No payment ID in webhook');
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    console.log('Processing payment (async):', paymentId);

    // Procesar de forma asíncrona SIN ESPERAR
    // Retornar 200 inmediatamente para que MP no reintente
    processPaymentAsync(paymentId).catch(err => {
      console.error('[Async] Unhandled error:', err);
    });

    // Responder inmediatamente
    return NextResponse.json({ 
      received: true,
      payment_id: paymentId,
      processing: 'async'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      received: true, 
      error: 'Internal error' 
    });
  }
}

// GET para verificación de Mercado Pago
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}