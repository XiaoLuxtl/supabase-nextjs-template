/**
 * Procesador de imágenes para Vidu API
 * - Redimensiona a máximo 1080p (lado más largo)
 * - Comprime a máximo 850KB
 * - Convierte a JPEG para base64
 */

export interface ProcessedImage {
  file: File;
  dataUrl: string;
  base64: string;
  width: number;
  height: number;
  sizeKB: number;
}

export class ImageProcessingError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

export async function processImageForVidu(file: File): Promise<ProcessedImage> {
  const maxDimension = 1080;
  const maxSizeKB = 850;
  const quality = 0.92;

  if (!file.type.startsWith('image/')) {
    throw new ImageProcessingError('El archivo debe ser una imagen', 'INVALID_FILE_TYPE');
  }

  try {
    const img = await loadImage(file);
    const { width, height } = calculateDimensions(img.width, img.height, maxDimension);

    let processedBlob = await resizeAndCompress(img, width, height, quality);
    let currentQuality = quality;
    let attempts = 0;

    while (processedBlob.size > maxSizeKB * 1024 && attempts < 5) {
      currentQuality -= 0.1;
      if (currentQuality < 0.5) break;
      processedBlob = await resizeAndCompress(img, width, height, currentQuality);
      attempts++;
    }

    const finalSizeKB = processedBlob.size / 1024;
    if (finalSizeKB > maxSizeKB) {
      throw new ImageProcessingError(
        `No se pudo reducir la imagen a menos de ${maxSizeKB}KB`,
        'SIZE_LIMIT_EXCEEDED'
      );
    }

    const processedFile = new File([processedBlob], `processed_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    });

    const dataUrl = await blobToDataURL(processedBlob);
    const base64 = dataUrl.split(',')[1];

    return { file: processedFile, dataUrl, base64, width, height, sizeKB: finalSizeKB };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError('Error al procesar la imagen', 'PROCESSING_ERROR');
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = url;
  });
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;
  if (originalWidth > originalHeight) {
    return { width: maxDimension, height: Math.round(maxDimension / aspectRatio) };
  } else {
    return { width: Math.round(maxDimension * aspectRatio), height: maxDimension };
  }
}

function resizeAndCompress(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo crear contexto de canvas'));
      return;
    }

    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar el blob'));
    }, 'image/jpeg', quality);
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}