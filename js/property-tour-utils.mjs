import { isPlayableTourMedia } from './tour-media.mjs';

const TOUR_KINDS = new Set(['video', 'virtual_tour', 'tour_3d']);
const MEDIA_KINDS = new Set(['floor_plan', ...TOUR_KINDS]);

function normalizeUrl(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isRenderablePropertyMedia(item) {
  if (!item || typeof item !== 'object' || !MEDIA_KINDS.has(String(item.kind || '').toLowerCase())) {
    return false;
  }
  if (!isHttpUrl(item.url)) return false;
  const kind = String(item.kind || '').toLowerCase();
  return kind === 'floor_plan' || isPlayableTourMedia({ ...item, kind });
}

export function collectPlayablePropertyTours(property, getFloorLabel = (_property, item) => item?.floor_label || '') {
  if (!property || typeof property !== 'object') return [];

  const tours = [];
  const seenUrls = new Set();

  function addTour(item, fallbackId, index) {
    if (!item || typeof item.url !== 'string') return;
    const kind = String(item.kind || '').toLowerCase();
    if (!TOUR_KINDS.has(kind) || !isPlayableTourMedia({ ...item, kind })) return;

    const url = item.url.trim();
    const normalized = normalizeUrl(url);
    if (!normalized || seenUrls.has(normalized)) return;
    seenUrls.add(normalized);

    tours.push({
      id: item.id || fallbackId || `media-tour-${index}`,
      kind,
      title: item.title || (kind === 'video' ? 'Video Walkthrough' : '3D Virtual Tour'),
      floor_label: getFloorLabel(property, item) || item.floor_label || null,
      provider: item.provider || null,
      url,
      poster_url: isHttpUrl(item.poster_url) ? item.poster_url.trim() : null,
      display_order: Number.isInteger(item.display_order) ? item.display_order : index
    });
  }

  if (Array.isArray(property.property_media)) {
    property.property_media.forEach((item, index) => addTour(item, null, index));
  }

  if (typeof property.virtual_tour_url === 'string' && property.virtual_tour_url.trim()) {
    addTour({
      id: 'legacy-vt',
      kind: 'virtual_tour',
      title: '3D Virtual Tour',
      url: property.virtual_tour_url.trim(),
      display_order: -1
    }, 'legacy-vt', -1);
    const legacyIndex = tours.findIndex(tour => tour.id === 'legacy-vt');
    if (legacyIndex > 0) {
      const [legacy] = tours.splice(legacyIndex, 1);
      tours.unshift(legacy);
    }
  }

  return tours;
}
