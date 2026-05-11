import { useEffect, useRef } from 'react';

type Props = {
  // 'after' resizes the panel to the *left* of the splitter as the user
  // drags right. 'before' resizes the panel to the *right* of the splitter
  // as the user drags left. Used to wire to the correct panel's width.
  side: 'after' | 'before';
  width: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
};

export function Splitter({ side, width, min, max, onChange }: Props) {
  // Hold the latest width in a ref so the mousemove listener captures it
  // without re-binding on every state change.
  const ref = useRef({ startX: 0, startW: width });
  ref.current.startW = width;

  useEffect(() => {
    // No-op cleanup; actual listeners attach in onMouseDown.
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current.startX = e.clientX;
    ref.current.startW = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - ref.current.startX;
      const proposed =
        side === 'after' ? ref.current.startW + delta : ref.current.startW - delta;
      const clamped = Math.max(min, Math.min(max, proposed));
      onChange(clamped);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return <div className="splitter" onMouseDown={onMouseDown} />;
}
