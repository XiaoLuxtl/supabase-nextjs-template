// src/app/api/vidu/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refineViduPrompt } from '@/lib/prompt-refiner';
import { describeImage, checkNSFWContent } from '@/lib/ai-vision';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image_base64, prompt: userPrompt, user_id } = body;

    console.log('=== VIDU GENERATE REQUEST ===');
    console.log('User ID:', user_id);
    console.log('Prompt length:', userPrompt?.length);
    console.log('Image base64 length:', image_base64?.length);

    if (!userPrompt || !user_id) {
      console.error('Missing required fields');
      return NextResponse.json(
        { error: 'prompt y user_id son requeridos' },
        { status: 400 }
      );
    }

    // Verificar créditos
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

    if (profile.credits_balance < 1) {
      return NextResponse.json({ error: 'Créditos insuficientes' }, { status: 402 });
    }

    // Validar NSFW (si hay imagen)
    let imageDescription = 'ninguna imagen proporcionada';
    if (image_base64) {
      console.log('Checking image content...');
      const nsfwCheck = await checkNSFWContent(image_base64);
      if (nsfwCheck.isNSFW) {
        console.log('NSFW content detected:', nsfwCheck.reason);
        return NextResponse.json(
          { error: `Contenido no permitido: ${nsfwCheck.reason || 'Imagen inapropiada'}`, code: 'NSFW_CONTENT' },
          { status: 400 }
        );
      }
      console.log('Analyzing image with GPT-4 Vision...');
      imageDescription = await describeImage(image_base64);
      console.log('Image Description:', imageDescription);
    }

    // Refinar prompt
    console.log('Refining prompt with GPT-4o...');
    const refinedPrompt = await refineViduPrompt(userPrompt, imageDescription);
    console.log('Refined Prompt:', refinedPrompt);

    // Crear registro en Supabase
    console.log('Creating generation record...');
    const videoData = {
      user_id,
      prompt: userPrompt,
      translated_prompt_en: refinedPrompt,
      input_image_url: '',
      // input_image_path: image_base64 ? `user_${user_id}/${Date.now()}.jpg` : null,
      status: 'pending',
      model: 'viduq1',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
      credits_used: 0,
      created_at: new Date().toISOString(),
    };

    const { data: generation, error: genError } = await supabase
      .from('video_generations')
      .insert(videoData)
      .select()
      .single();

    if (genError) {
      console.error('Error creating generation:', genError);
      return NextResponse.json({ error: 'Error al crear generación' }, { status: 500 });
    }

    // Llamar a Vidu API
    console.log('Calling Vidu API...');
    const viduPayload = {
      model: 'viduq1',
      images: image_base64 ? [`data:image/jpeg;base64,${image_base64}`] : [],
      prompt: refinedPrompt,
      duration: 5,
      resolution: '1080p',
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/vidu/webhook`,
    };

    const viduResponse = await fetch(process.env.VIDU_API_URL!, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.VIDU_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(viduPayload),
    });

    const responseText = await viduResponse.text();
    console.log('Vidu response status:', viduResponse.status);
    console.log('Vidu raw response:', responseText);

    if (!viduResponse.ok) {
      console.error('Vidu API error:', responseText);
      await supabase.from('video_generations').delete().eq('id', generation.id);
      return NextResponse.json({ error: `Vidu API error: ${responseText}` }, { status: viduResponse.status });
    }

    let viduData;
    try {
      viduData = JSON.parse(responseText);
      console.log('Vidu parsed data:', viduData);
    } catch (parseError) {
      console.error('Failed to parse Vidu response:', parseError);
      await supabase.from('video_generations').delete().eq('id', generation.id);
      return NextResponse.json({ error: 'Invalid Vidu response' }, { status: 500 });
    }

    const taskId = viduData.task_id?.toString();
    if (!taskId) {
      console.error('No task_id in Vidu response');
      await supabase.from('video_generations').delete().eq('id', generation.id);
      return NextResponse.json({ error: 'No task_id in response' }, { status: 500 });
    }

    // Consumir crédito
    console.log('Consuming credit...');
    const { error: consumeError } = await supabase.rpc('consume_credit_for_video', {
      p_user_id: user_id,
      p_video_id: generation.id,
    });

    if (consumeError) {
      console.error('Error consuming credit:', consumeError);
      await supabase
        .from('video_generations')
        .update({ status: 'failed', error_message: 'Error al consumir crédito' })
        .eq('id', generation.id);
      return NextResponse.json({ error: 'Error al consumir crédito' }, { status: 500 });
    }

    // Actualizar generación
    const { error: updateError } = await supabase
      .from('video_generations')
      .update({
        vidu_task_id: taskId,
        status: 'processing',
        started_at: new Date().toISOString(),
        vidu_full_response: viduData,
        credits_used: 1,
      })
      .eq('id', generation.id);

    if (updateError) {
      console.error('Error updating generation:', updateError);
      return NextResponse.json({ error: 'Error updating generation' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      generation_id: generation.id,
      vidu_task_id: taskId,
      status: 'processing',
    });
  } catch (error) {
    const err = error as Error;
    console.error('=== VIDU GENERATE ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    return NextResponse.json({ error: 'Error interno del servidor', details: err.message }, { status: 500 });
  }
}