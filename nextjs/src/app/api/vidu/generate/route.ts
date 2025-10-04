import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image_base64, prompt, user_id } = body;

    console.log('=== VIDU GENERATE REQUEST ===');
    console.log('User ID:', user_id);
    console.log('Prompt length:', prompt?.length);
    console.log('Image base64 length:', image_base64?.length);

    if (!image_base64 || !prompt || !user_id) {
      console.error('Missing required fields');
      return NextResponse.json(
        { error: 'image_base64, prompt y user_id son requeridos' },
        { status: 400 }
      );
    }

    // 1. Verificar créditos del usuario
    console.log('Checking user credits...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('credits_balance')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    console.log('User credits:', profile.credits_balance);

    if (profile.credits_balance < 1) {
      return NextResponse.json(
        { error: 'Créditos insuficientes' },
        { status: 402 }
      );
    }

    // 2. Crear registro de generación pendiente (SIN consumir crédito aún)
    console.log('Creating generation record...');
    const { data: generation, error: genError } = await supabase
      .from('video_generations')
      .insert({
        user_id,
        prompt,
        input_image_url: '',
        status: 'pending',
        model: 'viduq1',
        duration: 5,
        aspect_ratio: '16:9',
        resolution: '1080p',
        credits_used: 0 // AÚN NO SE CONSUMIERON
      })
      .select()
      .single();

    if (genError) {
      console.error('Error creating generation:', genError);
      return NextResponse.json({ error: 'Error al crear generación' }, { status: 500 });
    }

    // 3. Llamar a Vidu API PRIMERO (antes de consumir crédito)
    console.log('Calling Vidu API...');
    console.log('Vidu URL:', process.env.VIDU_API_URL);
    console.log('API Key present:', !!process.env.VIDU_API_KEY);
    console.log('Callback URL:', `${process.env.NEXT_PUBLIC_APP_URL}/api/vidu/webhook`);

    const viduPayload = {
      model: 'viduq1',
      images: [`data:image/jpeg;base64,${image_base64}`],
      prompt: prompt,
      duration: 5,
      resolution: '1080p',
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/vidu/webhook`
    };

    console.log('Vidu payload (without image):', {
      ...viduPayload,
      images: ['<base64_image_data_omitted>']
    });

    const viduResponse = await fetch(process.env.VIDU_API_URL!, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.VIDU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(viduPayload)
    });

    console.log('Vidu response status:', viduResponse.status);
    
    const responseText = await viduResponse.text();
    console.log('Vidu raw response:', responseText);

    if (!viduResponse.ok) {
      console.error('Vidu API error:', responseText);
      
      await supabase
        .from('video_generations')
        .delete()
        .eq('id', generation.id);

      return NextResponse.json({ error: `Vidu API error: ${responseText}` }, { status: viduResponse.status });
    }

    let viduData;
    try {
      viduData = JSON.parse(responseText);
      console.log('Vidu parsed data:', viduData);
    } catch (parseError) {
      console.error('Failed to parse Vidu response:', parseError);
      
      await supabase
        .from('video_generations')
        .delete()
        .eq('id', generation.id);

      return NextResponse.json({ error: 'Invalid Vidu response' }, { status: 500 });
    }

    // Verificar que tenemos un task_id válido
    const taskId = viduData.task_id?.toString();
    console.log('Vidu task_id:', taskId);

    if (!taskId) {
      console.error('No task_id in Vidu response');
      await supabase
        .from('video_generations')
        .delete()
        .eq('id', generation.id);
      return NextResponse.json({ error: 'No task_id in response' }, { status: 500 });
    }

    // 4. Consumir crédito (Vidu aceptó el request)
    console.log('Consuming credit...');
    const { error: consumeError } = await supabase.rpc(
      'consume_credit_for_video',
      {
        p_user_id: user_id,
        p_video_id: generation.id
      }
    );

    if (consumeError) {
      console.error('Error consuming credit:', consumeError);
      await supabase
        .from('video_generations')
        .update({ 
          status: 'failed',
          error_message: 'Error al consumir crédito'
        })
        .eq('id', generation.id);

      return NextResponse.json({ error: 'Error al consumir crédito' }, { status: 500 });
    }

    // 5. Actualizar generación con task_id de Vidu
    const { error: updateError } = await supabase
      .from('video_generations')
      .update({
        vidu_task_id: taskId,
        status: 'processing',
        started_at: new Date().toISOString(),
        vidu_full_response: viduData,
        credits_used: 1
      })
      .eq('id', generation.id);

    if (updateError) {
      console.error('Error updating generation with task_id:', updateError);
      return NextResponse.json({ error: 'Error updating generation' }, { status: 500 });
    }

    // 6. Retornar info al frontend
    return NextResponse.json({
      success: true,
      generation_id: generation.id,
      vidu_task_id: taskId,
      status: 'processing'
    });

  } catch (error: any) {
    console.error('=== VIDU GENERATE ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error?.message },
      { status: 500 }
    );
  }
}