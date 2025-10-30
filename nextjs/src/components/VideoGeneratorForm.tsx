// src/components/VideoGeneratorForm.tsx
"use client";

import React from "react";
import { DollarSign, Loader2, CreditCard, Zap } from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import { DropzoneRootProps, DropzoneInputProps } from "react-dropzone";
import { useCredits } from "@/hooks/useCredits";

interface VideoGeneratorFormProps {
  isGenerating: boolean;
  selectedFile: File | null;
  preview: string | null;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
  getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps;
  isDragActive: boolean;
  onClearImage: () => void;
}

export const VideoGeneratorForm: React.FC<VideoGeneratorFormProps> = React.memo(
  ({
    isGenerating,
    preview,
    prompt,
    onClearImage,
    onPromptChange,
    onGenerate,
    getRootProps,
    getInputProps,
    isDragActive,
  }) => {
    const { balance, hasCredits } = useCredits();
    const isFormDisabled = !hasCredits || isGenerating;

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-emerald-500">
          Imagen a Video
        </h1>

        {/* Alerta cuando no hay créditos */}
        {!hasCredits && (
          <div className="bg-amber-500/20 border border-amber-500 rounded-lg p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-200 font-semibold mb-1">
                Sin créditos disponibles
              </p>
              <p className="text-amber-100 text-sm">
                Por favor adquiere créditos para comenzar a generar videos.
              </p>
            </div>
          </div>
        )}

        {/* Image Upload - Deshabilitado sin créditos */}
        <div className={isFormDisabled ? "opacity-60 cursor-not-allowed" : ""}>
          <div className={isFormDisabled ? "pointer-events-none" : ""}>
            <ImageUpload
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              preview={preview}
              isDragActive={isDragActive}
              onClear={onClearImage}
              disabled={isFormDisabled}
            />
          </div>
          {!hasCredits && (
            <p className="text-amber-400 text-xs mt-2 text-center">
              Agrega imágenes después de obtener créditos
            </p>
          )}
        </div>

        {/* Textarea prompt - Deshabilitado sin créditos */}
        <div
          className={`bg-zinc-800 p-4 rounded-lg border border-zinc-600 transition-all ${
            isFormDisabled ? "opacity-60" : ""
          }`}
        >
          <label
            htmlFor="description"
            className="block text-sm font-medium text-pink-100 mb-2"
          >
            Descripción del video (Prompt)
          </label>
          <textarea
            id="description"
            rows={5}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            disabled={isFormDisabled}
            className="w-full bg-zinc-900 border border-zinc-700 text-white p-3 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 resize-none placeholder-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={
              hasCredits
                ? "Describe la acción que quieres ver en el video... Ej: Quiero que ella lo abrace a él mientras la cámara gira a su alrededor"
                : "Obtén créditos para habilitar esta función"
            }
          />
          {!hasCredits && (
            <p className="text-amber-400 text-xs mt-2">
              Escribe tu prompt después de obtener créditos
            </p>
          )}
        </div>

        {/* Botón generar */}
        <button
          onClick={onGenerate}
          disabled={isFormDisabled}
          className={`w-full py-4 rounded-lg font-bold text-2xl shadow-xl transition-all flex items-center justify-center space-x-2 relative ${
            isFormDisabled
              ? "bg-gray-600 cursor-not-allowed opacity-75"
              : "bg-pink-500 hover:bg-pink-400 shadow-pink-500/50 hover:shadow-pink-400/50 transform hover:scale-[1.02]"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Generando...</span>
            </>
          ) : !hasCredits ? (
            <>
              <CreditCard className="h-6 w-6" />
              <span>Obtener Créditos</span>
            </>
          ) : (
            <>
              <Zap className="h-6 w-6" />
              <span>Generar Video</span>
            </>
          )}
        </button>

        {/* Metadata */}
        <div
          className={`grid grid-cols-2 gap-x-4 gap-y-1 text-sm px-1 transition-all ${
            !hasCredits ? "opacity-50" : ""
          }`}
        >
          <p className="text-zinc-400">
            Modelo: <span className="text-pink-300">PixelQ1</span>
          </p>
          <p className="text-zinc-400">
            Resolución: <span className="text-pink-300">1080p</span>
          </p>
          <p className="text-zinc-400">
            Duración: <span className="text-pink-300">5s</span>
          </p>
          <p className="text-zinc-400">
            Costo: <span className="text-pink-300">1 crédito</span>
          </p>
        </div>

        {/* Créditos */}
        <div
          className={`bg-zinc-800 p-4 rounded-lg flex flex-col space-y-3 transition-all ${
            !hasCredits ? "border-2 border-amber-500/50 bg-amber-500/10" : ""
          }`}
        >
          <div className="flex justify-between items-center text-lg font-semibold">
            <span
              className={hasCredits ? "text-emerald-500" : "text-amber-500"}
            >
              Créditos disponibles:
            </span>
            <span
              className={`text-3xl font-extrabold ${
                hasCredits ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {balance}
            </span>
          </div>

          {!hasCredits ? (
            <div className="text-center py-2">
              <p className="text-amber-300 font-semibold mb-2">
                ¡Necesitas créditos para comenzar!
              </p>
              <Link
                href="/paquetes"
                className="w-full py-3 rounded-lg font-bold text-lg bg-amber-500 hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/50 flex items-center justify-center space-x-2 transform hover:scale-[1.02]"
              >
                <DollarSign className="h-5 w-5" />
                <span>Comprar Créditos Ahora</span>
              </Link>
            </div>
          ) : (
            <Link
              href="/paquetes"
              className="w-full py-3 rounded-lg font-bold text-lg bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/50 flex items-center justify-center space-x-2"
            >
              <DollarSign className="h-5 w-5" />
              <span>Obtener más créditos</span>
            </Link>
          )}
        </div>

        {/* Mensaje adicional para usuarios sin créditos */}
        {!hasCredits && (
          <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 text-center">
            <p className="text-blue-200 text-sm">
              💡 <strong>Consejo:</strong> Obtén créditos ahora y comienza a
              crear videos increíbles al instante
            </p>
          </div>
        )}
      </div>
    );
  }
);

// Set displayName for React DevTools
VideoGeneratorForm.displayName = "VideoGeneratorForm";

export default VideoGeneratorForm;
