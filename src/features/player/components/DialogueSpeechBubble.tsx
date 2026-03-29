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
  if (!text || !targetRect) return null;

  const centerX = targetRect.left + targetRect.width / 2;
  const topY = targetRect.top;

  return (
    <div
      className="absolute z-40 pointer-events-none"
      style={{
        left: centerX,
        top: topY,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        className={"relative max-w-xs rounded-xl border px-4 py-3 text-base shadow-xl backdrop-blur text-white " +
          (speaker === "player"
            ? "bg-emerald-950/90 border-emerald-700"
            : "bg-cyan-950/90 border-cyan-700")}
      >
        <p className="whitespace-pre-line leading-relaxed">{text}</p>

        {/* Flechita */}
        <div
          className={"absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-8 border-l-transparent border-r-8 border-r-transparent " +
            (speaker === "player"
              ? "border-t-10 border-t-emerald-800"
              : "border-t-10 border-t-cyan-800")}
        />
      </div>
    </div>
  );
}