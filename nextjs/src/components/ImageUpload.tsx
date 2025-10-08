// src/components/ImageUpload.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Image as ImageIcon, X } from "lucide-react";
import { DropzoneRootProps, DropzoneInputProps } from "react-dropzone";

interface ImageUploadProps {
  getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
  getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps;
  isDragActive: boolean;
  onClear: () => void;
  preview: string | null;
}

/**
 * Componente de UI para la carga de imágenes. Recibe las props de Dropzone
 * y la lógica de preview/limpieza del componente padre.
 */
const ImageUpload: React.FC<ImageUploadProps> = React.memo(
  ({ getRootProps, getInputProps, preview, isDragActive, onClear }) => {
    // Separamos onClick de getRootProps para evitar conflictos con el botón de limpiar
    const { onClick, ...rootProps } = getRootProps();

    return (
      <div
        {...rootProps}
        onClick={onClick} // Siempre aplicamos onClick para permitir cambiar la imagen
        aria-label={preview ? "Cambiar imagen" : "Cargar imagen"}
        className={`bg-zinc-800 p-6 rounded-lg border-2 ${
          isDragActive
            ? "border-emerald-500 bg-zinc-700/50"
            : "border-pink-500/80"
        } shadow-lg hover:border-pink-50 transition-all cursor-pointer text-center h-64 flex flex-col justify-center items-center relative overflow-hidden`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover opacity-30"
              unoptimized // Para data URLs
            />
            {/* Botón de Limpiar (X) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onClear();
                }
              }}
              tabIndex={0}
              aria-label="Remover imagen"
              className="absolute top-3 right-3 p-1.5 bg-zinc-900/80 text-white rounded-full hover:bg-red-500 transition-colors z-20 shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative z-10 bg-zinc-900/80 p-4 rounded-lg">
              <ImageIcon className="h-10 w-10 text-emerald-400 mb-3 mx-auto" />
              <p className="text-lg font-semibold text-emerald-100">
                ¡Imagen seleccionada!
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                Haz clic o arrastra para cambiar la imagen
              </p>
            </div>
          </>
        ) : (
          <>
            <ImageIcon
              className={`h-10 w-10 mb-3 ${
                isDragActive ? "text-emerald-400" : "text-pink-400"
              }`}
            />
            <p className="text-xl font-semibold text-pink-100">
              {isDragActive
                ? "¡Suelta la imagen aquí!"
                : "Haz clic o arrastra tu imagen aquí"}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              (PNG, JPG o TIFF - Máx 10MB)
            </p>
          </>
        )}
      </div>
    );
  }
);

// Set displayName for React DevTools
ImageUpload.displayName = "ImageUpload";

export default ImageUpload;
