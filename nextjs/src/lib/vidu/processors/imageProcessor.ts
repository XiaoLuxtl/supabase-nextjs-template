// /lib/vidu/processors/imageProcessor.ts
import { describeImage, checkNSFWContent } from "@/lib/ai-vision";
import { refineViduPrompt } from "@/lib/prompt-refiner";
import { ImageProcessingResult, NSFWCheckResult } from "../types/viduTypes";

export class ImageProcessor {
  static async processImage(
    imageBase64?: string
  ): Promise<ImageProcessingResult> {
    if (!imageBase64) {
      return { imageDescription: "ninguna imagen proporcionada" };
    }

    try {
      // Primero verificar NSFW
      const nsfwCheck = await this.checkNSFW(imageBase64);
      if (nsfwCheck.isNSFW) {
        return {
          imageDescription: "",
          nsfwCheck,
        };
      }

      // Luego analizar la imagen
      const imageDescription = await describeImage(imageBase64);
      return {
        imageDescription,
        nsfwCheck,
      };
    } catch (error) {
      console.error("Error processing image:", error);
      throw new Error("Error al procesar la imagen");
    }
  }

  private static async checkNSFW(
    imageBase64: string
  ): Promise<NSFWCheckResult> {
    try {
      return await checkNSFWContent(imageBase64);
    } catch (error) {
      console.error("Error in NSFW check:", error);
      return {
        isNSFW: true,
        reason: "Error al validar contenido de imagen",
      };
    }
  }

  static async refinePrompt(
    userPrompt: string,
    imageDescription: string
  ): Promise<string> {
    try {
      return await refineViduPrompt(userPrompt, imageDescription);
    } catch (error) {
      console.error("Error refining prompt:", error);
      throw new Error("Error al refinar el prompt");
    }
  }
}
