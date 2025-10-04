import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Vidu webhook received:', JSON.stringify(body, null, 2));

    // Guardar webhook log
    await supabase
      .from('vidu_webhook_logs')
      .insert({
        vidu_task_id: body.id,
        payload: body,
        processed: false
      });

    // Verificar que sea una notificación de éxito
    if (body.state !== 'success') {
      console.log('Webhook not success state:', body.state);
      return NextResponse.json({ received: true });
    }

    const taskId = body.id;
    const creation = body.creations?.[0];

    if (!taskId || !creation) {
      console.error('Invalid webhook data');
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Buscar la generación por vidu_task_id
    const { data: generation, error: findError } = await supabase
      .from('video_generations')
      .select('*')
      .eq('vidu_task_id', taskId)
      .single();

    if (findError || !generation) {
      console.error('Generation not found for task:', taskId);
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    // Actualizar generación con resultados
    const { error: updateError } = await supabase
      .from('video_generations')
      .update({
        status: 'completed',
        vidu_creation_id: creation.id,
        video_url: creation.url,
        cover_url: creation.cover_url,
        video_duration_actual: creation.video?.duration || 0,
        video_fps: creation.video?.fps || 0,
        bgm: body.bgm || false,
        completed_at: new Date().toISOString(),
        vidu_full_response: body
      })
      .eq('id', generation.id);

    if (updateError) {
      console.error('Error updating generation:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    // Marcar webhook como procesado
    await supabase
      .from('vidu_webhook_logs')
      .update({ processed: true })
      .eq('vidu_task_id', taskId);

    console.log('Video generation completed:', generation.id);

    return NextResponse.json({ 
      received: true,
      processed: true,
      generation_id: generation.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      received: true, 
      error: 'Internal error' 
    });
  }
}

// GET para verificación
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}