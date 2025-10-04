// VideoGeneratorUI.tsx
"use client";

import React from "react";
import { useDropzone } from "react-dropzone";
import useDragScroll from "@/hooks/useDragScroll";
import {
  Upload,
  ArrowDownToLine,
  Share2,
  DollarSign,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";

// --- Tipado de Datos ---
interface Video {
  id: number;
  url: string; // URL de la miniatura/placeholder
  isMain: boolean;
}

interface Data {
  status: string;
  fechaCreacion: string;
  descripcionUsuario: string;
  modelo: string;
  resolucion: string;
  duracion: string;
  cantidad: number;
  creditosDisponibles: number;
  videosGenerados: Video[];
}

// --- Datos Simulados ---
const data: Data = {
  status: "Listo",
  fechaCreacion: "2024-10-01",
  descripcionUsuario:
    "Una mujer con un vestido de seda azul paseando por un jardín japonés al atardecer, estilo óleo.",
  modelo: "Pixel Q1",
  resolucion: "1080p",
  duracion: "5s",
  cantidad: 1,
  creditosDisponibles: 4,
  videosGenerados: [
    {
      id: 1,
      url: "https://placehold.co/800x600?text=V1",
      isMain: true,
    },
    {
      id: 2,
      url: "https://placehold.co/500x500?text=V2",
      isMain: false,
    },
    {
      id: 3,
      url: "https://placehold.co/500x500?text=V3",
      isMain: false,
    },
    {
      id: 4,
      url: "https://placehold.co/500x500?text=V4",
      isMain: false,
    },
    {
      id: 5,
      url: "https://placehold.co/500x500?text=V5",
      isMain: false,
    },
    {
      id: 6,
      url: "https://placehold.co/500x500?text=V6",
      isMain: false,
    },
  ],
};

const VideoGeneratorUI: React.FC = () => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedVideo, setSelectedVideo] = React.useState<Video | undefined>(
    data.videosGenerados.find((v) => v.isMain)
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  // 🔑 Llama al hook y obtén la referencia
  const sliderRef = useDragScroll();

  // Configuración de react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".tiff"],
    },
    maxSize: 10485760, // 10MB
    multiple: false,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setSelectedFile(file);

      // Crear preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    },
  });

  // Limpiar el preview cuando el componente se desmonte
  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleGenerateClick = () => {
    if (!selectedFile) {
      alert("Por favor selecciona una imagen primero");
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      alert("Simulación de Generación Terminada.");
    }, 2000);
  };

  const handleDownload = () => {
    alert("Simulación de Descarga iniciada.");
  };

  const handleShare = () => {
    alert("Simulación de Compartir.");
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* ====================================================== */}
      {/* 1. CAJA DE VISOR DE VIDEO MÓVIL (FIXED TOP) */}
      {/* 🔑 Usa el elemento <video> para el cover/thumbnail en mobile */}
      {/* ====================================================== */}
      <div
        className="lg:hidden bg-zinc-800 w-full fixed top-0 left-0 z-50 shadow-2xl"
        style={{ height: "33.33vh" }}
      >
        {/* 🔑 USAMOS EL ELEMENTO VIDEO AQUI TAMBIEN */}
        <video
          controls
          poster={selectedVideo?.url || data.videosGenerados[0].url}
          className="w-full h-full object-cover"
        >
          <source src="#" type="video/mp4" />
          Tu navegador no soporta el tag de video.
        </video>

        {/* Botones de acción móvil: Superpuestos en la esquina */}
        <div className="absolute top-2 right-2 flex space-x-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full bg-pink-500 text-white hover:bg-pink-400 transition-colors"
          >
            <ArrowDownToLine className="h-5 w-5" />
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl mx-auto p-4 pt-[33.33vh] lg:p-8 lg:pt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ====================================================== */}
        {/* COLUMNA IZQUIERDA: CONTROLES DE ENTRADA (lg:col-span-1) */}
        {/* ====================================================== */}
        <div className="lg:col-span-1 space-y-6">
          <h1 className="text-3xl font-extrabold text-emerald-500">
            Imagen a Video
          </h1>

          {/* 1. Caja para Arrastrar/Subir Imagen */}
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
                <Upload
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

          {/* 2. Caja de Descripción (Text Area) */}
          <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-600 shadow-md">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-pink-100 mb-2"
            >
              Descripción del video (Prompt)
            </label>
            <textarea
              id="description"
              rows={5}
              className="w-full bg-zinc-900 border border-zinc-700 text-white p-3 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 resize-none placeholder-zinc-500"
              placeholder="Escribe un ejemplo de descripción para la generación..."
              defaultValue={data.descripcionUsuario} // Usamos la descripción simulada
            ></textarea>
          </div>

          {/* 3. Botón Generar */}
          <button
            onClick={handleGenerateClick}
            disabled={isGenerating || data.creditosDisponibles === 0}
            className={`w-full py-4 rounded-lg font-bold text-2xl shadow-xl transition-all flex items-center justify-center space-x-2 
              ${
                isGenerating
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
              <span>¡Generar!</span>
            )}
          </button>

          {/* 4. Metadata y Créditos (Compactados) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-400 px-1">
            <p>
              Modelo: <span className="text-pink-300">{data.modelo}</span>
            </p>
            <p>
              Resolución:{" "}
              <span className="text-pink-300">{data.resolucion}</span>
            </p>
            <p>
              Duración: <span className="text-pink-300">{data.duracion}</span>
            </p>
            <p>
              Cantidad: <span className="text-pink-300">{data.cantidad}</span>
            </p>
          </div>

          {/* 5. Créditos y Botón Comprar */}
          <div className="bg-zinc-800 p-4 rounded-lg flex flex-col space-y-3">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span className="text-emerald-500">Créditos Disponibles:</span>
              <span className="text-3xl font-extrabold text-emerald-300">
                {data.creditosDisponibles}
              </span>
            </div>
            <button className="w-full py-3 rounded-lg font-bold text-lg bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/50 flex items-center justify-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Obtener más créditos</span>
            </button>
          </div>
        </div>

        {/* ====================================================== */}
        {/* COLUMNA DERECHA: VISUALIZACIÓN Y RESULTADOS (lg:col-span-2) */}
        {/* ====================================================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Status y Botones de Acción (SOLO ESCRITORIO) */}
          <div className="hidden lg:flex justify-between items-center pb-2 border-b border-zinc-800">
            <div className="text-sm font-semibold">
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  data.status === "Listo"
                    ? "bg-emerald-600/30 text-emerald-400"
                    : "bg-pink-600/30 text-pink-400"
                }`}
              >
                Status: {data.status}
              </span>
              <span className="ml-4 text-zinc-400">
                Fecha Creación: {data.fechaCreacion}
              </span>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-400 transition-colors flex items-center space-x-2"
              >
                <ArrowDownToLine className="h-5 w-5" />
                <span>Descargar</span>
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-white font-semibold hover:bg-zinc-600 transition-colors flex items-center space-x-2"
              >
                <Share2 className="h-5 w-5" />
                <span>Compartir</span>
              </button>
            </div>
          </div>

          {/* 2. Caja de Descripción del Resultado (SOLO ESCRITORIO) */}
          <div className="hidden lg:block text-zinc-400 text-sm italic border-l-4 border-emerald-500 pl-3">
            **Prompt:** {data.descripcionUsuario}
          </div>

          {/* 3. Visor de Video Principal (SOLO ESCRITORIO) */}
          {/* 🔑 Usa el elemento <video> con 'controls' para obtener la barra nativa */}
          <div className="hidden lg:block bg-zinc-800 rounded-lg shadow-2xl overflow-hidden aspect-video relative border-2 border-emerald-500">
            <video
              controls
              preload="metadata"
              poster={selectedVideo?.url || data.videosGenerados[0].url}
              className="w-full h-full object-cover"
            >
              <source src="#" type="video/mp4" />
              Tu navegador no soporta el tag de video.
            </video>
          </div>

          {/* 4. Carrusel de Videos Generados (Slider) */}
          <div>
            <h3 className="text-lg font-bold text-emerald-500 mb-3">
              Slider con los videos generados
            </h3>
            {/* 🔑 Asigna la referencia del hook para el drag-to-scroll */}
            <div
              ref={sliderRef}
              className="flex space-x-4 overflow-x-auto pb-3 custom-scrollbar cursor-grab active:cursor-grabbing"
            >
              {data.videosGenerados.map((video) => (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={`flex-shrink-0 w-32 aspect-square rounded-lg overflow-hidden cursor-pointer transition-all duration-200 
                            ${
                              selectedVideo && selectedVideo.id === video.id
                                ? "border-4 border-emerald-500 shadow-xl scale-105"
                                : "border-2 border-zinc-700 hover:border-emerald-300"
                            }`}
                  style={{ minWidth: "8rem" }}
                >
                  <img
                    src={video.url}
                    alt={`Miniatura de Video ${video.id}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Estilos CSS para el scrollbar y el cursor de arrastre */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            height: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #3f3f46; /* zinc-700 */
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #27272a; /* zinc-800 */
          }

          /* Estilo del cursor para indicar que es arrastrable */
          /* Solo debe ser visible en desktop, lo controlamos con el hook */
          .cursor-grab {
            cursor: grab;
          }
          .active-drag,
          .active\\:cursor-grabbing {
            cursor: grabbing;
          }
        `}</style>
      </div>
    </div>
  );
};

export default VideoGeneratorUI;
