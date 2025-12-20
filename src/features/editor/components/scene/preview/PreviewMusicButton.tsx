import { useEffect, useRef, useState } from "react";
import { MusicalNoteIcon } from "@heroicons/react/24/solid";

interface PreviewMusicButtonProps {
    label?: string;
    musicUrl?: string;
    className?: string;
}

export function PreviewMusicButton({ label, musicUrl, className = "absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-slate-900/85 rounded-full px-2 py-1 text-[10px] text-fuchsia-200 shadow",
}: PreviewMusicButtonProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }, [musicUrl]);

    useEffect(() => {
        return () => {
            if (audioRef.current) audioRef.current.pause();
        };
    }, []);

    const handleClick = async () => {
        if (!musicUrl || !audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
            return;
        }

        try {
            await audioRef.current.play();
            setIsPlaying(true);
        } catch (err) {
            console.error("No se ha podido reproducir la música de la preview", err);
            setIsPlaying(false);
        }
    };

    if (!musicUrl) return null;

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                className={className}
                title={label}
            >
                <MusicalNoteIcon className="w-4 h-4" />
                {isPlaying ? "Parar" : "Preview"}
            </button>

            <audio ref={audioRef} src={musicUrl} className="hidden" />
        </>
    );
}
