export function publicPath(path: string): string {
  const cleanPath = path.replace(/^\/+/, "")
  return `${import.meta.env.BASE_URL}${cleanPath}`
}