type Rect = { left: number; top: number; width: number; height: number };

type DialogueSpeechBubbleProps = {
  text: string;
  speaker: "player" | "npc";
  targetRect: Rect | null;
};

type BubblePlacement = "top" | "left" | "right";

const TOP_PLACEMENT_MIN_Y = 112;
const LEFT_PLACEMENT_MIN_X = 300;

function pickBubblePlacement(targetRect: Rect): BubblePlacement {
  if (targetRect.top >= TOP_PLACEMENT_MIN_Y) return "top";

  return targetRect.left >= LEFT_PLACEMENT_MIN_X ? "left" : "right";
}

function buildBubblePosition(targetRect: Rect, placement: BubblePlacement): React.CSSProperties {
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  if (placement === "top") {
    return { left: centerX, top: targetRect.top, transform: "translate(-50%, -100%)" };
  }

  if (placement === "left") {
    return { left: targetRect.left, top: centerY, transform: "translate(-100%, -50%)" };
  }

  return { left: targetRect.left + targetRect.width, top: centerY, transform: "translate(0, -50%)" };
}

function buildArrowPosition(placement: BubblePlacement, arrowColor: string): React.CSSProperties {
  if (placement === "top") {
    return {
      left: "50%",
      top: "100%",
      transform: "translateX(-50%)",
      borderLeft: "8px solid transparent",
      borderRight: "8px solid transparent",
      borderTop: `10px solid ${arrowColor}`,
    };
  }

  if (placement === "left") {
    return {
      left: "100%",
      top: "50%",
      transform: "translateY(-50%)",
      borderTop: "8px solid transparent",
      borderBottom: "8px solid transparent",
      borderLeft: `10px solid ${arrowColor}`,
    };
  }

  return {
    right: "100%",
    top: "50%",
    transform: "translateY(-50%)",
    borderTop: "8px solid transparent",
    borderBottom: "8px solid transparent",
    borderRight: `10px solid ${arrowColor}`,
  };
}

export function DialogueSpeechBubble({ text, speaker, targetRect }: DialogueSpeechBubbleProps) {
  if (!text.trim() || !targetRect) return null;

  const placement = pickBubblePlacement(targetRect);

  const speakerClasses = speaker === "player" ? "bg-emerald-950/70 border-emerald-700/80" : "bg-cyan-950/70 border-cyan-700/80";
  const arrowColor = speaker === "player" ? "rgba(6, 78, 59, 0.86)" : "rgba(22, 78, 99, 0.86)";

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={buildBubblePosition(targetRect, placement)}
    >
      <div
        className={`relative max-w-sm rounded-xl border px-4 py-3 text-base text-white shadow-xl backdrop-blur-sm ${speakerClasses}`}
      >
        <p className="whitespace-pre-line text-center leading-relaxed">
          {text}
        </p>

        <div
          className="absolute h-0 w-0"
          style={buildArrowPosition(placement, arrowColor)}
        />
      </div>
    </div>
  );
}