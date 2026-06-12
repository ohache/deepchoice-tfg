type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DialogueSpeechBubbleProps = {
  text: string;
  speaker: "player" | "npc";
  targetRect: Rect | null;
};

export function DialogueSpeechBubble({ text, speaker, targetRect }: DialogueSpeechBubbleProps) {
  if (!text.trim() || !targetRect) return null;

  const centerX = targetRect.left + targetRect.width / 2;
  const topY = targetRect.top;

  const speakerClasses =
    speaker === "player"
      ? "bg-emerald-950/65 border-emerald-700/80"
      : "bg-cyan-950/65 border-cyan-700/80";

  const arrowClasses =
    speaker === "player"
      ? "border-t-emerald-800/80"
      : "border-t-cyan-800/80";

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: centerX,
        top: topY,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        className={`relative max-w-xs rounded-xl border px-4 py-3 text-base text-white shadow-xl backdrop-blur-sm ${speakerClasses}`}
      >
        <p className="whitespace-pre-line text-center leading-relaxed">
          {text}
        </p>

        <div
          className={`absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-8 border-r-8 border-t-10 border-l-transparent border-r-transparent ${arrowClasses}`}
        />
      </div>
    </div>
  );
}