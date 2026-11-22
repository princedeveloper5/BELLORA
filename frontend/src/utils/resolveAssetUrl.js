export function resolveAssetUrl(path) {
  if (!path) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(path)) return path
  const apiRoot = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
  if (path.startsWith('/')) return ${apiRoot}
  return ${apiRoot}/
}
