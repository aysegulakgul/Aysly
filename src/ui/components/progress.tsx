/** Figma UI/Progress (4:70714): metin + 4 px iz; dolu kısım ay ışığı, kalan kısım palette/support-2. */
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm text-text-secondary">{label}</p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={label}
        aria-label={label}
        className="flex h-1 w-full overflow-hidden rounded-sm bg-support-2"
      >
        <div className="h-1 bg-moonlight" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
