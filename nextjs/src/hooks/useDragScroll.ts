// src/hooks/useDragScroll.ts
import { useRef, useEffect, RefObject } from "react";

/**
 * Hook para añadir la funcionalidad de "drag-to-scroll" horizontal en escritorio.
 * Usa eventos de puntero (pointerdown, pointermove, pointerup) para desplazar el contenido.
 * @returns {RefObject<HTMLDivElement>} La referencia que debe asignarse al contenedor scrolleable.
 */
const useDragScroll = (): RefObject<HTMLDivElement | null> => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const slider = containerRef.current;
    if (!slider) {
      return;
    }

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      slider.classList.add("active-drag");
      startX.current = e.clientX - (slider.getBoundingClientRect().left || 0);
      scrollLeft.current = slider.scrollLeft;
    };

    const handlePointerUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        slider.classList.remove("active-drag");
      }
    };

    const handlePointerLeave = () => {
      if (isDragging.current) {
        isDragging.current = false;
        slider.classList.remove("active-drag");
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const x = e.clientX - (slider.getBoundingClientRect().left || 0);
      const walk = (x - startX.current) * 1.2;
      const newScrollLeft = scrollLeft.current - walk;
      slider.scrollLeft = newScrollLeft;
      if (slider.scrollLeft !== newScrollLeft) {
        slider.scrollTo({ left: newScrollLeft, behavior: "auto" });
      }
    };

    slider.addEventListener("pointerdown", handlePointerDown, {
      passive: false,
    });
    slider.addEventListener("pointerup", handlePointerUp);
    slider.addEventListener("pointerleave", handlePointerLeave);
    slider.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });

    return () => {
      slider.removeEventListener("pointerdown", handlePointerDown);
      slider.removeEventListener("pointerup", handlePointerUp);
      slider.removeEventListener("pointerleave", handlePointerLeave);
      slider.removeEventListener("pointermove", handlePointerMove);
    };
  }, [containerRef.current]); // Re-run when ref binds

  return containerRef;
};

export default useDragScroll;
