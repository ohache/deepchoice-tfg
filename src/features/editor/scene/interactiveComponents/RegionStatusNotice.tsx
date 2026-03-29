type RegionStatusNoticeProps = {
  isDrawing: boolean;
  hasShape: boolean;
  hasCollisions: boolean;
  collisionSummary: string;
  collisionLock: { active: boolean; summary: string };
  missingShapeText: string;
  drawingText: string;
};

export function RegionStatusNotice({ isDrawing, hasShape, hasCollisions, collisionSummary, collisionLock, missingShapeText, drawingText }: RegionStatusNoticeProps) {
  if (collisionLock.active) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-100">
        Colisión con: <span className="font-semibold">{collisionLock.summary}</span>. Dibuja otra región o pulsa “Cancelar”.
      </div>
    );
  }

  if (!isDrawing && hasShape && hasCollisions) {
    return (
      <div className="rounded-md border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
        Colisión con: <span className="font-semibold">{collisionSummary}</span>. Ajusta la región para que no se solape.
      </div>
    );
  }

  if (isDrawing) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-950/20 px-2 py-1 text-[11px] text-emerald-100">
        {drawingText}
      </div>
    );
  }

  if (!hasShape) {
    return (
      <div className="rounded-md border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
        {missingShapeText}
      </div>
    );
  }

  return null;
}