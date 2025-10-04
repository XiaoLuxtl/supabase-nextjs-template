import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface ImageUploadProps {
  onImageSelected: (file: File) => void;
  preview: string | null;
}

export const ImageUpload: React.FC<ImageUploadProps> = React.memo(
  ({ onImageSelected, preview }) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      accept: {
        "image/*": [".png", ".jpg", ".jpeg", ".tiff"],
      },
      maxSize: 10485760, // 10MB
      multiple: false,
      onDrop: (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
          onImageSelected(file);
        }
      },
    });

    return (
      <div
        {...getRootProps()}
        className={`bg-zinc-800 p-6 rounded-lg border-2 ${
          isDragActive
            ? "border-emerald-500 bg-zinc-700/50"
            : "border-pink-500/80"
        } shadow-lg hover:border-pink-50 transition-all cursor-pointer text-center h-64 flex flex-col justify-center items-center relative overflow-hidden`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <>
            <img
              src={preview}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="relative z-10 bg-zinc-900/80 p-4 rounded-lg">
              <ImageIcon className="h-10 w-10 text-emerald-400 mb-3 mx-auto" />
              <p className="text-lg font-semibold text-emerald-100">
                ¡Imagen seleccionada!
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                Click o arrastra para cambiar
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
                : "Click o arrastra tu foto aquí"}
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
