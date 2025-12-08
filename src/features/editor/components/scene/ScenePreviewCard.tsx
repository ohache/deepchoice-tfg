interface ScenePreviewCardProps {
  title: string;
  text: string;
  imageLogicalPath?: string;
}

export function ScenePreviewCard({ title, text, imageLogicalPath }: ScenePreviewCardProps) {
  
  return (
    <div className="scene-preview-card">
      <div className="scene-preview-image-wrapper">
        {imageLogicalPath ? (
          <>
            <img
              src={imageLogicalPath}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60 z-0"
            />

            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <img
                src={imageLogicalPath}
                alt={title || "Escena"}
                className="max-w-full max-h-full object-contain drop-shadow"
              />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-4">
            <span className="text-xs text-slate-500 text-center">
              Aquí se mostrará la imagen de la escena cuando la selecciones.
            </span>
          </div>
        )}

        {title && (
          <div className="absolute top-3 inset-x-4 overflow-hidden text-center z-20 pointer-events-none">
            <div
              className={["inline-block whitespace-nowrap text-xl font-semibold text-white/80 drop-shadow",
                title.length > 80
                  ? "animate-[scene-title-marquee_16s_linear_infinite]"
                  : "",
              ].join(" ")}
            >
              {title}
            </div>
          </div>
        )}
      </div>

      <div className="scene-preview-text-box">
        {text ? (
          <p className="text-slate-100 text-sm whitespace-pre-line text-left">
            {text}
          </p>
        ) : (
          <p className="text-slate-500 text-xs text-center">
            El texto de la escena se mostrará aquí.
          </p>
        )}
      </div>
    </div>
  );
}
