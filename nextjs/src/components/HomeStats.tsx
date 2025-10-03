import React from "react";

const stats = [
  { label: "Videos Generados", value: "5K+" },
  { label: "Fotos Restauradas", value: "600+" },
  { label: "Países", value: "5+" },
  { label: "Tiempo de Actividad", value: "99.9%" },
];

export default function HomeStats() {
  return (
    <section className="py-16 bg-zinc-800 border-t border-b border-zinc-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-pink-500 drop-shadow-md">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
