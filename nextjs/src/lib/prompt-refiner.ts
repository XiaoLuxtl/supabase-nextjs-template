// src/lib/prompt-refiner.ts

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Refina y traduce el prompt del usuario y la descripción de la imagen usando GPT-4o
 * para obtener una descripción detallada, efectiva y en inglés para Vidu.
 * * @param userPrompt El prompt original del usuario (ej: "un perro corriendo").
 * @param imageDescription La descripción de la imagen de la herramienta de visión (ej: "fotografía de un border collie en la playa").
 * @returns El prompt refinado en INGLÉS.
 */
export async function refineViduPrompt(
    userPrompt: string,
    imageDescription: string
): Promise<string> {
    
    // 🔑 Configuración del System Prompt para guiar a GPT-4o
    // Se añade la instrucción de traducción y el formato.
    const systemPrompt = `You are an expert prompt refiner for high-quality, AI video generation systems (Vidu). 
    Your goal is to take a simple user prompt (in Spanish) and a detailed image description, combine them into a single, 
    detailed, and effective prompt, and **translate the entire final prompt into high-quality, natural ENGLISH.**
    
    The resulting English prompt MUST follow this structure and content:
    1. **Primary Focus:** The prompt must clearly describe the core action/movement requested by the user, integrating the visual details from the image description.
    2. **Visual Quality:** Add high-quality stylistic details (cinematic lighting, composition, artistic style, high resolution) suitable for a video model.
    3. **Format:** The output must be a single, descriptive sentence or short paragraph, ready for immediate use. DO NOT include headers like "# Video content" or "# Requirements" unless the user prompt specifically asked for complex camera movement or effects.
    
    Example of a desired output (in English): 
    "A stunning cinematic medium shot of a Border Collie running rapidly across the wet sand of a beach during a dramatic sunset, featuring strong backlighting and prominent lens flare."
    
    Generate ONLY the final, **English-language** refined prompt.`;

    // 🔑 El modelo que usarás (GPT-4o)
    const model = 'gpt-4o'; 
    
    // 🔑 Creamos el prompt para la IA (manteniendo el input en español para que entienda lo que tiene que traducir)
    const combinedInput = `User's original simple prompt (in Spanish): "${userPrompt}". 
Detailed Image Description: "${imageDescription}".
Generate the refined and translated English prompt:`;

    try {
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: combinedInput }
            ],
            temperature: 0.75, // Aumentamos un poco para mejorar la creatividad en la descripción visual
            max_tokens: 300,
        });

        // Extraer y limpiar el prompt refinado
        const refinedPrompt = completion.choices[0].message.content?.trim() || userPrompt;
        
        console.log("Prompt Original (ES):", userPrompt);
        console.log("Image Description (AI):", imageDescription);
        console.log("Prompt Refinado (EN, GPT-4o):", refinedPrompt);
        
        // Devolvemos el prompt refinado en INGLÉS
        return refinedPrompt;
        
    } catch (error) {
        console.error("Error al refinar/traducir el prompt con GPT-4o:", error);
        // En caso de error, devolver el prompt original EN ESPAÑOL. 
        // ¡ADVERTENCIA! Si Vidu solo acepta inglés, esto podría fallar. 
        // Una opción más segura sería usar un traductor simple como fallback:
        // return await simpleTranslate(userPrompt, 'en'); 
        // Pero por ahora, devolvemos el original para mantener la simplicidad del error.
        return userPrompt; 
    }
}