import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
});

const paymentClient = new Payment(client);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Webhook received:', body);

    // Mercado Pago envía diferentes tipos de notificaciones
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    // Obtener detalles del pago desde Mercado Pago
    const payment = await paymentClient.get({ id: paymentId });

    console.log('Payment details:', {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference
    });

    // El external_reference es el ID de nuestra compra
    const purchaseId = payment.external_reference;
    if (!purchaseId) {
      console.error('No external_reference in payment');
      return NextResponse.json({ received: true });
    }

    // Obtener la compra de nuestra DB
    const { data: purchase, error: purchaseError } = await supabase
      .from('credit_purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase not found:', purchaseId);
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Mapear estados de MP a nuestros estados
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

    // Actualizar estado del pago
    const { error: updateError } = await supabase
      .from('credit_purchases')
      .update({
        payment_id: payment.id?.toString(),
        payment_status: newStatus
      })
      .eq('id', purchaseId);

    if (updateError) {
      console.error('Error updating purchase:', updateError);
      return NextResponse.json({ error: 'Error updating purchase' }, { status: 500 });
    }

    // Si el pago fue aprobado, acreditar los créditos
    if (newStatus === 'approved' && !purchase.applied_at) {
      console.log('Applying credits for purchase:', purchaseId);
      
      // Llamar a la función de Supabase que acredita créditos
      const { error: applyError } = await supabase.rpc(
        'apply_credit_purchase',
        { p_purchase_id: purchaseId }
      );

      if (applyError) {
        console.error('Error applying credits:', applyError);
        // No fallar el webhook, se puede reintentar manualmente
      } else {
        console.log('Credits applied successfully');
      }
    }

    return NextResponse.json({ 
      received: true,
      status: newStatus 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    // Retornar 200 para que MP no reintente indefinidamente
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