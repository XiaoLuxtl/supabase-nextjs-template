// src/components/ImageUpload.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Image as ImageIcon, X, Lock } from "lucide-react";
import { DropzoneRootProps, DropzoneInputProps } from "react-dropzone";

interface ImageUploadProps {
  getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
  getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps;
  isDragActive: boolean;
  onClear: () => void;
  preview: string | null;
  disabled?: boolean; // ✅ Nueva prop opcional
}

/**
 * Componente de UI para la carga de imágenes. Recibe las props de Dropzone
 * y la lógica de preview/limpieza del componente padre.
 */
const ImageUpload: React.FC<ImageUploadProps> = React.memo(
  ({
    getRootProps,
    getInputProps,
    preview,
    isDragActive,
    onClear,
    disabled = false,
  }) => {
    // Separamos onClick de getRootProps para evitar conflictos con el botón de limpiar
    const { onClick, ...rootProps } = getRootProps();

    return (
      <div
        {...rootProps}
        onClick={disabled ? undefined : onClick} // ✅ Solo permite click si no está deshabilitado
        aria-label={preview ? "Cambiar imagen" : "Cargar imagen"}
        className={`bg-zinc-800 p-6 rounded-lg border-2 ${
          disabled
            ? "border-zinc-600 bg-zinc-900/50 cursor-not-allowed"
            : isDragActive
            ? "border-emerald-500 bg-zinc-700/50 cursor-pointer"
            : "border-pink-500/80 cursor-pointer"
        } shadow-lg transition-all text-center h-64 flex flex-col justify-center items-center relative overflow-hidden ${
          !disabled && "hover:border-pink-50"
        }`}
      >
        <input {...getInputProps()} disabled={disabled} />{" "}
        {/* ✅ Deshabilita input */}
        {disabled && (
          <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center z-30 rounded-lg">
            <div className="text-center">
              <Lock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-amber-300 font-semibold">
                Función deshabilitada
              </p>
              <p className="text-amber-200 text-sm mt-1">
                Obtén créditos para habilitar o espea a que termine el proceso.
              </p>
            </div>
          </div>
        )}
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
            {!disabled && (
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
            )}
            <div className="relative z-10 bg-zinc-900/80 p-4 rounded-lg">
              <ImageIcon className="h-10 w-10 text-emerald-400 mb-3 mx-auto" />
              <p className="text-lg font-semibold text-emerald-100">
                ¡Imagen seleccionada!
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {disabled
                  ? "Habilita la función para cambiar imagen"
                  : "Haz clic o arrastra para cambiar la imagen"}
              </p>
            </div>
          </>
        ) : (
          <>
            <ImageIcon
              className={`h-10 w-10 mb-3 ${
                disabled
                  ? "text-zinc-500"
                  : isDragActive
                  ? "text-emerald-400"
                  : "text-pink-400"
              }`}
            />
            <p
              className={`text-xl font-semibold ${
                disabled ? "text-zinc-400" : "text-pink-100"
              }`}
            >
              {disabled
                ? "Carga de imagen deshabilitada"
                : isDragActive
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
