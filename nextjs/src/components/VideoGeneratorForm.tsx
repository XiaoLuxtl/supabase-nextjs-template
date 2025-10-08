// src/components/VideoGeneratorForm.tsx
"use client";

import React from "react";
import { AlertCircle, DollarSign, Loader2 } from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import { DropzoneRootProps, DropzoneInputProps } from "react-dropzone";

interface VideoGeneratorFormProps {
  isGenerating: boolean;
  credits: number;
  error: string | null;
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
    credits,
    error,
    preview,
    prompt,
    onClearImage,
    onPromptChange,
    onGenerate,
    getRootProps,
    getInputProps,
    isDragActive,
  }) => {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-emerald-500">
          Imagen a Video
        </h1>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Image Upload */}
        <ImageUpload
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          preview={preview}
          isDragActive={isDragActive}
          onClear={onClearImage}
        />

        {/* Textarea prompt */}
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-600">
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
            className="w-full bg-zinc-900 border border-zinc-700 text-white p-3 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 resize-none placeholder-zinc-500"
            placeholder="Ej: Una mujer paseando por un jardín japonés al atardecer..."
          />
        </div>

        {/* Botón generar */}
        <button
          onClick={onGenerate}
          disabled={isGenerating || credits === 0}
          className={`w-full py-4 rounded-lg font-bold text-2xl shadow-xl transition-all flex items-center justify-center space-x-2 ${
            isGenerating || credits === 0
              ? "bg-pink-700 cursor-not-allowed opacity-75"
              : "bg-pink-500 hover:bg-pink-400 shadow-pink-500/50"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Generando...</span>
            </>
          ) : (
            <span>Generar</span>
          )}
        </button>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-400 px-1">
          <p>
            Modelo: <span className="text-pink-300">PixelQ1</span>
          </p>
          <p>
            Resolución: <span className="text-pink-300">1080p</span>
          </p>
          <p>
            Duración: <span className="text-pink-300">5s</span>
          </p>
          <p>
            Costo: <span className="text-pink-300">1 crédito</span>
          </p>
        </div>

        {/* Créditos */}
        <div className="bg-zinc-800 p-4 rounded-lg flex flex-col space-y-3">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span className="text-emerald-500">Créditos:</span>
            <span className="text-3xl font-extrabold text-emerald-300">
              {credits}
            </span>
          </div>
          <Link
            href="/paquetes"
            className="w-full py-3 rounded-lg font-bold text-lg bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/50 flex items-center justify-center space-x-2"
          >
            <DollarSign className="h-5 w-5" />
            <span>Obtener más créditos</span>
          </Link>
        </div>
      </div>
    );
  }
);

// Set displayName for React DevTools
VideoGeneratorForm.displayName = "VideoGeneratorForm";

export default VideoGeneratorForm;
