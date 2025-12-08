// inputShortcuts.ts
export function createCommitCancelKeyHandler(
    onCommit: () => void,
    onCancel: () => void
  ) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit();
      } else if (e.key === "Escape") {
        onCancel();
      }
    };
  }
  