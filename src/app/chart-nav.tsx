"use client";

export function ChartNav({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  rangeStart,
  rangeEnd,
  total,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted mb-1">
      <span>
        {rangeStart}–{rangeEnd} / {total}
      </span>
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        className="btn text-xs px-2 py-0.5 disabled:opacity-30"
        aria-label="←"
      >
        ←
      </button>
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        className="btn text-xs px-2 py-0.5 disabled:opacity-30"
        aria-label="→"
      >
        →
      </button>
    </div>
  );
}
