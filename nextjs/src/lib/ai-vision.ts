// src/lib/ai-vision.ts
import OpenAI from 'openai';

// Inicializa el cliente de OpenAI.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Verifica si una imagen contiene contenido NSFW
 * @param imageBase64 La imagen en formato Base64
 * @returns Un objeto con el resultado del análisis
 */
export async function checkNSFWContent(imageBase64: string): Promise<{ isNSFW: boolean; reason?: string }> {
  const systemPrompt = `Eres un sistema de moderación de contenido para un generador de videos. Evalúa si la imagen contiene contenido no apto para todo público (NSFW) que pueda ser inapropiado para videos públicos. Analiza:
  1. Desnudez o contenido sexual explícito
  2. Violencia gráfica o sangre
  3. Contenido perturbador o gore
  4. Drogas ilegales o parafernalia
  5. Símbolos de odio, extremismo o contenido ofensivo
  6. Contenido inapropiado para menores (ej: temas subidos de tono)

  Responde SOLO con un objeto JSON:
  {
    "isNSFW": boolean,
    "reason": "breve explicación si isNSFW es true"
  }`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza esta imagen:' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Mantener precisión
      max_tokens: 100, // Limitar para respuestas breves
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      isNSFW: result.isNSFW || false,
      reason: result.reason,
    };
  } catch (error) {
    console.error('Error al analizar contenido NSFW:', error);
    return { isNSFW: false, reason: 'Error al procesar la imagen' };
  }
}

/**
 * Genera una descripción de texto concisa de una imagen codificada en Base64 usando GPT-4o Vision.
 * @param imageBase64 La imagen en formato Base64 (sin el prefijo 'data:image/...').
 * @returns Una descripción en español optimizada para generación de video.
 */
export async function describeImage(imageBase64: string): Promise<string> {
  const systemPrompt = `Eres un analista de imágenes para Vidu, un sistema de generación de video. Genera una descripción en ESPAÑOL, CONCISA (máximo 30 palabras), que describa la escena para un director de cine. Enfócate en:
  1. Número exacto y tipo de sujetos (ej: "tres mujeres", "un perro", "ningún sujeto").
  2. Acción principal, si es evidente (ej: "sentadas", "corriendo").
  3. Entorno básico (ej: "sala", "playa").
  4. Estilo visual básico (ej: "fotorrealista", "animado").

  Evita detalles no esenciales (ej: colores específicos, muebles detallados) a menos que sean prominentes. Maneja casos extremos:
  - Sin sujetos: Describe el entorno (ej: "paisaje montañoso, ningún sujeto").
  - Sujetos no humanos: Especifica (ej: "un gato", "una botella").
  - Imagen vaga: Usa descripción genérica (ej: "escena estática").

  Ejemplo: "Tres mujeres sentadas en un sofá en una sala, estilo fotorrealista."
  Genera SOLO el texto de la descripción.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe esta imagen:' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      temperature: 0.3, // Alta precisión
      max_tokens: 50, // Concisión estricta
    });

    let description = response.choices[0].message.content?.trim() || 'Escena estática con detalles visuales limitados, estilo fotorrealista.';

    // Validación para garantizar descripción útil
    description = validateDescription(description);

    return description;
  } catch (error) {
    console.error('Error al describir la imagen con GPT-4o Vision:', error);
    return validateDescription('Escena estática con detalles visuales limitados, estilo fotorrealista.');
  }
}

/**
 * Valida y corrige la descripción de la imagen para garantizar consistencia.
 * @param description La descripción generada
 * @returns Descripción corregida
 */
function validateDescription(description: string): string {
  if (!description.match(/\d+\s*(mujeres|hombres|personas|animales|[a-zA-Z]+\s*como\s*(perro|gato|botella))/i) && 
      !description.includes('ningún sujeto')) {
    return description.includes('paisaje') || description.includes('escena')
      ? `${description}, ningún sujeto, estilo fotorrealista`
      : `${description}, número de sujetos desconocido, estilo fotorrealista`;
  }
  return description;
}