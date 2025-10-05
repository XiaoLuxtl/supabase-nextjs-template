// src/lib/ai-vision.ts (MEJORADO)

import OpenAI from 'openai';

// Inicializa el cliente de OpenAI.
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Genera una descripción de texto detallada de una imagen codificada en Base64 usando GPT-4o Vision.
 * * @param imageBase64 La imagen en formato Base64 (sin el prefijo 'data:image/...').
 * @returns Una descripción de texto detallada para la generación de video.
 */
export async function describeImage(imageBase64: string): Promise<string> {
    
    // 🔑 NUEVO System Prompt: Más enfocado en detalles técnicos para el refinador
    const systemPrompt = `Eres un **experto analista de imágenes** para sistemas de generación de video. 
    Tu tarea es generar una **descripción de texto concisa, técnica y altamente descriptiva (en español)** de la imagen proporcionada. 
    
    Enfócate estrictamente en los siguientes elementos clave, como si estuvieras describiendo una escena para un director de cine:
    1. **Sujeto/Personajes:** Descripción precisa de la acción, vestimenta y emoción.
    2. **Composición:** Tipo de plano (plano medio, plano general, primer plano), ángulo de la cámara (picado, contrapicado) y regla de tercios.
    3. **Iluminación:** Tipo (suave, dura, de relleno), fuente (natural, artificial, luz de estudio), y hora del día/condición atmosférica (atardecer dramático, luz de día brillante).
    4. **Estilo Artístico:** Estilo visual (fotorrealista, ilustración 3D, óleo digital, cyberpunk, etc.).
    5. **Fondo/Entorno:** Descripción del contexto y la profundidad de campo.

    **No** menciones la calidad ni la resolución. Genera **SOLO** el texto de la descripción, sin introducciones ni conclusiones.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Genera la descripción de la imagen:" },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`,
                                detail: "low", 
                            },
                        },
                    ],
                },
            ],
            temperature: 0.4, // Se reduce un poco para mantener la descripción fiel a la imagen.
            max_tokens: 250, // Se aumenta ligeramente para permitir más detalle técnico.
        });

        // Devolver la descripción o un mensaje de fallback.
        return response.choices[0].message.content?.trim() || "Fotografía de una escena estática con buen detalle visual. Mantén el estilo original de la imagen.";

    } catch (error) {
        console.error("Error al describir la imagen con GPT-4o Vision:", error);
        // Fallback: devolver una descripción genérica en caso de error.
        return "Fotografía de una escena estática con buen detalle visual. Mantén el estilo original de la imagen.";
    }
}