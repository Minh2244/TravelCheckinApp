import { useRef, useState, type MouseEvent } from "react";

export function useDraggableScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: MouseEvent<T>) => {
    if (!ref.current) return;
    setHasDragged(false);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const onMouseLeave = () => {
    // optional: reset or just leave it
  };

  const onMouseUp = () => {
    // don't reset hasDragged here, so onClick can read it
  };

  const onMouseMove = (e: MouseEvent<T>) => {
    if (e.buttons !== 1 || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    if (Math.abs(x - startX) > 5) {
      setHasDragged(true);
    }
    const walk = (x - startX) * 1.5; // Scroll speed
    ref.current.scrollLeft = scrollLeft - walk;
  };

  return {
    ref,
    onMouseDown,
    onMouseLeave,
    onMouseUp,
    onMouseMove,
    hasDragged,
  };
}
