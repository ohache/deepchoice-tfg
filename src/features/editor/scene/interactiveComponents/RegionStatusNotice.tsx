type RegionStatusNoticeProps = {
  isDrawing: boolean;
  hasShape: boolean;
  hasCollisions: boolean;
  collisionSummary: string;
  collisionLock: { active: boolean; summary: string };
  missingShapeText: string;
  drawingText: string;
};

/*Muestra el estado actual de la región */
export function RegionStatusNotice({ isDrawing, hasShape, hasCollisions, collisionSummary, collisionLock,
  missingShapeText, drawingText }: RegionStatusNoticeProps) {

  if (collisionLock.active) {
    return (
      <Notice variant="error">
        Colisión con: <strong>{collisionLock.summary}</strong>. Dibuja otra región o pulsa “Cancelar”.
      </Notice>
    );
  }

  if (!isDrawing && hasShape && hasCollisions) {
    return (
      <Notice variant="warning">
        Colisión con: <strong>{collisionSummary}</strong>. Ajusta la región para que no se solape.
      </Notice>
    );
  }

  if (isDrawing) return <Notice variant="success">{drawingText}</Notice>;

  if (!hasShape) return <Notice variant="warning">{missingShapeText}</Notice>;

  return null;
}

/* Componente base reutilizable para mensajes visuales */
function Notice({ variant, children }: { variant: "error" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-500/40 bg-red-950/20 text-red-100",
    warning: "border-rose-500/40 bg-rose-950/20 text-rose-100",
    success: "border-emerald-500/40 bg-emerald-950/20 text-emerald-100",
  };

  return (
    <div className={`rounded-md border px-2 py-1 text-[11px] ${styles[variant]}`}>
      {children}
    </div>
  );
}