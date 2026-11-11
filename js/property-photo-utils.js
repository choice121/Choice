export function normalizePhotoList(list, fallback = '/assets/placeholder-property.jpg') {
  if (!Array.isArray(list) || list.length === 0) {
    return [fallback];
  }

  const seen = new Set();
  const normalized = [];

  for (const item of list) {
    if (item == null) continue;

    const value = typeof item === 'string' ? item.trim() : String(item).trim();
    if (!value) continue;

    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized.length > 0 ? normalized : [fallback];
}

export function getPrimaryPhoto(list, fallback = '/assets/placeholder-property.jpg') {
  const photos = normalizePhotoList(list, fallback);
  return photos[0] || fallback;
}
