import type React from "react";

interface SceneFooterProps {
    children: React.ReactNode;
    justify?: "start" | "end" | "between" | "center";
}

export function SceneFooter({ children, justify = "end" }: SceneFooterProps) {
    const justifyClass =
        justify === "end"
            ? "justify-end"
            : justify === "between"
                ? "justify-between"
                : justify === "center"
                    ? "justify-center"
                    : "justify-start";

    return (
        <div className={`mt-3 flex ${justifyClass} gap-2`}>
            {children}
        </div>
    );
}
