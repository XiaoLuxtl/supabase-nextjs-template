// src/hooks/useDragScroll.ts
import { useRef, useEffect, RefObject } from "react";

/**
 * Hook para añadir la funcionalidad de "drag-to-scroll" horizontal a un elemento de escritorio.
 * Usa eventos de mouse (mousedown, mousemove, mouseup) para desplazar el contenido.
 * @returns {RefObject<HTMLDivElement | null>} La referencia que debe asignarse al contenedor scrolleable.
 */
const useDragScroll = (): RefObject<HTMLDivElement | null> => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const slider = containerRef.current;
    if (!slider) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return;

      isMouseDown.current = true;
      slider.classList.add("active-drag");
      startX.current = e.pageX - slider.offsetLeft;
      scrollLeft.current = slider.scrollLeft;
    };

    const handleMouseLeave = () => {
      isMouseDown.current = false;
      slider.classList.remove("active-drag");
    };

    const handleMouseUp = () => {
      isMouseDown.current = false;
      slider.classList.remove("active-drag");
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX.current) * 1.5;
      slider.scrollLeft = scrollLeft.current - walk;
    };

    slider.addEventListener("mousedown", handleMouseDown);
    slider.addEventListener("mouseleave", handleMouseLeave);
    slider.addEventListener("mouseup", handleMouseUp);
    slider.addEventListener("mousemove", handleMouseMove);

    return () => {
      slider.removeEventListener("mousedown", handleMouseDown);
      slider.removeEventListener("mouseleave", handleMouseLeave);
      slider.removeEventListener("mouseup", handleMouseUp);
      slider.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return containerRef;
};

export default useDragScroll;
