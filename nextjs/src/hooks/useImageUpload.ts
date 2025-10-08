import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
// Asegúrate de que esta librería exista y devuelva { dataUrl: string }
import { processImageForVidu } from "@/lib/image-processor";

/**
 * Custom hook para manejar la subida de imagen, el procesamiento y la vista previa.
 * Exporta las props de Dropzone, el preview y la función de limpieza.
 */
export function useImageUpload() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    
    // Función de limpieza para liberar la URL de vista previa de la memoria
    useEffect(() => {
        return () => {
            // Limpia la URL de objeto para evitar fugas de memoria
            if (preview) URL.revokeObjectURL(preview); 
        };
    }, [preview]);

    // Función para resetear el estado de la imagen (limpieza)
    const resetImage = useCallback(() => {
        setSelectedFile(null);
        setPreview(null);
        setUploadError(null);
    }, []);

    // Handler de Dropzone con la lógica de procesamiento
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploadError(null);
        setSelectedFile(file);

        try {
            // Procesar imagen (asumimos que esto genera la URL para el preview)
            const processed = await processImageForVidu(file);
            setPreview(processed.dataUrl);
        } catch (err: unknown) {
            let errorMessage = "Error al procesar la imagen. Verifica el formato y tamaño.";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            setUploadError(errorMessage);
            setSelectedFile(null);
            setPreview(null);
        }
    }, []);

    // Configuración de Dropzone
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
        maxSize: 20 * 1024 * 1024,
        multiple: false,
        onDrop,
    });
    
    return {
        selectedFile,
        preview,
        uploadError,
        isDragActive,
        getRootProps,
        getInputProps,
        resetImage, // Exportado para ser pasado como prop 'onClear' al componente
    };
}
