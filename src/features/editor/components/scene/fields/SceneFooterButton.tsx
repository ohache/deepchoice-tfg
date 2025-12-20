interface SceneFooterButtonProps {
    label: string;
    onClick: () => void;
    variant?: "primary" | "danger" | "neutral";
}

export function SceneFooterButton({ label, onClick, variant = "primary" }: SceneFooterButtonProps) {

    const base = "px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors";

    const variants = {
        primary: "bg-emerald-600 hover:bg-emerald-500",
        danger: "bg-red-700 hover:bg-red-600",
        neutral: "bg-slate-700 hover:bg-slate-600",
    };

    return (
        <button type="button" onClick={onClick} className={`${base} ${variants[variant]}`}>
            {label}
        </button>
    );
}
