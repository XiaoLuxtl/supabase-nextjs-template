// src/hooks/useDragScroll.ts

import { useRef, useEffect, RefObject } from 'react';

/**
 * Hook para añadir la funcionalidad de "drag-to-scroll" horizontal a un elemento de escritorio.
 * Usa eventos de mouse (mousedown, mousemove, mouseup) para desplazar el contenido.
 * @returns {RefObject<HTMLDivElement>} La referencia que debe asignarse al contenedor scrolleable.
 */
const useDragScroll = (): RefObject<HTMLDivElement> => {
  // Inicializamos la referencia con el tipo HTMLDivElement o null
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Usamos useRef para mantener el estado mutable de los eventos del mouse
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const slider = containerRef.current;
    if (!slider) return;

    // --- Manejadores de Eventos del DOM nativo (MouseEvent) ---

    const handleMouseDown = (e: MouseEvent) => {
      // Solo activamos en desktop (botón izquierdo del mouse, si aplica)
      if (window.innerWidth < 1024) return; 

      isMouseDown.current = true;
      // Clase visual que cambia el cursor a 'grabbing'
      slider.classList.add('active-drag');
      startX.current = e.pageX - slider.offsetLeft;
      scrollLeft.current = slider.scrollLeft;
    };

    const handleMouseLeave = () => {
      isMouseDown.current = false;
      slider.classList.remove('active-drag');
    };

    const handleMouseUp = () => {
      isMouseDown.current = false;
      slider.classList.remove('active-drag');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      e.preventDefault(); // Evita la selección de texto al arrastrar
      const x = e.pageX - slider.offsetLeft;
      // walk calcula la distancia recorrida
      const walk = (x - startX.current) * 1.5; // Multiplicador para acelerar el desplazamiento
      slider.scrollLeft = scrollLeft.current - walk;
    };

    // --- Asignación de Eventos ---
    slider.addEventListener('mousedown', handleMouseDown);
    // Estos eventos se escuchan en el contenedor para detectar cuando el mouse sale/suelta
    slider.addEventListener('mouseleave', handleMouseLeave);
    slider.addEventListener('mouseup', handleMouseUp);
    slider.addEventListener('mousemove', handleMouseMove);

    // --- Limpieza de Eventos ---
    return () => {
      slider.removeEventListener('mousedown', handleMouseDown);
      slider.removeEventListener('mouseleave', handleMouseLeave);
      slider.removeEventListener('mouseup', handleMouseUp);
      slider.removeEventListener('mousemove', handleMouseMove);
    };
  }, []); 

  return containerRef;
};

export default useDragScroll;