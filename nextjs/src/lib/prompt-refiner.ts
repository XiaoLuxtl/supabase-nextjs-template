// src/lib/prompt-refiner.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Refina y traduce el prompt del usuario y la descripción de la imagen usando GPT-4o
 * para obtener una descripción precisa, creativa y en inglés para Vidu, cubriendo diversos escenarios.
 * @param userPrompt El prompt original del usuario (ej: "Que estén platicando entre ellas").
 * @param imageDescription La descripción de la imagen (ej: "Tres mujeres sentadas en un sofá en una sala, estilo fotorrealista").
 * @returns El prompt refinado en INGLÉS.
 */
export async function refineViduPrompt(
  userPrompt: string,
  imageDescription: string
): Promise<string> {
  const systemPrompt = `You are an expert prompt refiner for Vidu, an AI video generation system that converts images to videos.
Your goal is to take a simple user prompt (in Spanish) and an image description (in Spanish), then generate a concise, action-focused, and creative prompt in high-quality, natural ENGLISH that covers a wide range of scenarios, including social interactions, individual actions, promotional content, and stylistic transformations. Either adapt a relevant example from the list below or craft a new one to best match the user’s intent and image context.

The resulting English prompt MUST:
1. **Prioritize Core Action**: Focus on the main action or scene in the user prompt (e.g., "talking together") without adding unrequested actions or subjects.
2. **Exact Subject Count**: Use the exact number of subjects from the image description (e.g., if "tres mujeres" is described, include only three women). If the image has "ningún sujeto" (e.g., a landscape), focus on the scene or action.
3. **Resolve Conflicts**: If the user prompt and image description conflict (e.g., prompt says "one person," image says "two people"), prioritize the image’s subject count and adapt the action to fit.
4. **Essential Visual Details**: Incorporate only key visual details from the image description (e.g., setting, subject count) to maintain context, avoiding unrequested embellishments (e.g., specific furniture or clothing) unless implied by the user prompt or image.
5. **Concise Yet Expressive**: Output a single sentence or short paragraph (20-60 words) in Vidu’s action-driven style (e.g., "The two subjects in the scene turn towards each other and begin to hug"), with creative flair for scenarios like social media ads or artistic videos.
6. **Flexible Adaptation**: Use the example prompts below as inspiration for tone and structure, but create a custom prompt if the user’s intent (e.g., a dynamic ad, a unique action) doesn’t match any example exactly.
7. **High-Quality Video Context**: Include minimal stylistic cues (e.g., "smooth motion," "cinematic lighting," "vibrant setting") to enhance video quality, especially for promotional or artistic use cases.
8. **Handle Edge Cases**:
   - Vague prompts (e.g., "Que se vean felices"): Default to a natural action like smiling or interacting.
   - No subjects in the image (e.g., "ningún sujeto"): Focus on environmental motion or user-requested action (e.g., "The scene transitions to a vibrant sunset").
   - Non-human subjects (e.g., animals, objects): Apply the action to the subject (e.g., "A dog runs across a beach").
   - Complex actions (e.g., "Una banda tocando"): Simplify to the key action (e.g., "playing music").

**Example Prompts for Inspiration**:
- Social Interaction: "The [number] subjects in the scene interact naturally, engaging in a lively conversation with smooth motion."
- Hugging: "The [number] subjects turn towards each other and embrace warmly with smooth, natural motion."
- Smiling: "The [number] subjects face the camera, showing gentle smiles with natural, fluid motion."
- Walking: "The [number] subjects hold hands and walk together naturally in the scene with smooth motion."
- Object Interaction: "The [number] subjects receive a bouquet of flowers from an off-screen hand, showing surprise and a joyful smile."
- Ad-Style: "The [number] subjects dynamically showcase [product/action] in a vibrant setting with cinematic lighting and smooth motion."
- Emotional Expression: "The [number] subjects display [emotion, e.g., joy] with subtle, natural facial movements in a [setting]."
- Animal Action: "The [animal] performs [action, e.g., runs] in the scene with smooth, natural motion."
- Stylistic Transformation: "The scene transitions smoothly into a Studio Ghibli-style animation with fluid motion."
- Group Activity: "The [number] subjects perform [action, e.g., dance] together in a [setting] with vibrant, synchronized motion."
- Landscape Motion: "The scene animates with [action, e.g., clouds moving] in a vibrant, natural setting with smooth motion."

Example Outputs:
- User Prompt: "Que estén platicando entre ellas"
  Image Description: "Tres mujeres sentadas en un sofá en una sala, estilo fotorrealista"
  Output: "Three women sit on a sofa in a living room, engaging in a lively conversation with smooth, natural motion."
- User Prompt: "Que muestren un producto para un anuncio de Facebook"
  Image Description: "Dos personas con un producto en una tienda, estilo fotorrealista"
  Output: "Two people in a store dynamically showcase a product with cinematic lighting and smooth, vibrant motion."
- User Prompt: "Un perro corriendo"
  Image Description: "Un border collie en una playa, estilo fotorrealista"
  Output: "A border collie runs across a beach with smooth, natural motion."
- User Prompt: "Que se vean felices"
  Image Description: "Dos personas en un café, estilo fotorrealista"
  Output: "Two people in a café face the camera, showing gentle smiles with natural, fluid motion."
- User Prompt: "Un paisaje animado"
  Image Description: "Montaña con cielo nublado, ningún sujeto, estilo fotorrealista"
  Output: "The mountain scene animates with clouds moving across a vibrant sky with smooth motion."
- User Prompt: "Una banda tocando"
  Image Description: "Cuatro personas con instrumentos en un escenario, estilo fotorrealista"
  Output: "Four people on a stage play music energetically with vibrant, synchronized motion."

Generate ONLY the final, English-language refined prompt.`;

  const combinedInput = `User's original simple prompt (in Spanish): "${userPrompt}". 
Detailed Image Description (in Spanish): "${imageDescription}".
If the prompt and image conflict (e.g., prompt says "one person," image says "two people"), prioritize the image’s subject count and adapt the action. Use the example prompts as inspiration, adapting the most relevant one or creating a new one to best match the user’s intent and image context, and generate the refined English prompt:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: combinedInput },
      ],
      temperature: 0.7, // Balance entre creatividad y precisión
      max_tokens: 200, // Espacio para expresividad
    });

    const refinedPrompt = completion.choices[0].message.content?.trim() || userPrompt;
    console.log('Prompt Original (ES):', userPrompt);
    console.log('Image Description (ES):', imageDescription);
    console.log('Prompt Refinado (EN, GPT-4o):', refinedPrompt);
    return refinedPrompt;
  } catch (error) {
    console.error('Error al refinar/traducir el prompt con GPT-4o:', error);
    return `The scene described as "${userPrompt}" with ${imageDescription}`;
  }
}