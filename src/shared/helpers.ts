import type { Condition } from "@/domain/conditions";

export function publicPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/")
  const cleanPath = path.replace(/^\/+/, "")

  return `${base}${cleanPath}`
}

/* Devuelve true si la condición está vacía o no aporta lógica útil */
export function isEmptyCondition(condition: Condition | undefined): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case "and": return (condition.all.length === 0 || condition.all.every(isEmptyCondition));

    case "or": return (condition.any.length === 0 || condition.any.every(isEmptyCondition));

    case "not": return isEmptyCondition(condition.cond);

    default: return false;
  }
}