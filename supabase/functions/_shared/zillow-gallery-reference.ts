type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function safeText(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? Math.round(value * 100) / 100
    : null;
}

function sanitizeRect(value: unknown): Rect | null {
  if (!value || typeof value !== "object") return null;
  const rect = value as Record<string, unknown>;
  const x = safeNumber(rect.x, -100000, 100000);
  const y = safeNumber(rect.y, -100000, 100000);
  const width = safeNumber(rect.width, 0, 100000);
  const height = safeNumber(rect.height, 0, 100000);
  if (x === null || y === null || width === null || height === null) return null;
  return { x, y, width, height };
}

function sanitizeImage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const image = value as Record<string, unknown>;
  const rect = sanitizeRect(image.rect);
  if (!rect) return null;
  return {
    alt: safeText(image.alt, 160),
    naturalWidth: safeNumber(image.naturalWidth, 0, 30000),
    naturalHeight: safeNumber(image.naturalHeight, 0, 30000),
    rect,
  };
}

const STYLE_KEYS = [
  "display",
  "position",
  "gridTemplateColumns",
  "gridTemplateRows",
  "flexDirection",
  "gap",
  "borderRadius",
  "objectFit",
  "objectPosition",
  "aspectRatio",
  "overflow",
  "backgroundColor",
  "zIndex",
  "alignItems",
  "justifyContent",
] as const;

function sanitizeContainer(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const container = value as Record<string, unknown>;
  const rect = sanitizeRect(container.rect);
  if (!rect) return null;
  const rawStyles = container.styles && typeof container.styles === "object"
    ? container.styles as Record<string, unknown>
    : {};
  const styles: Record<string, string> = {};
  for (const key of STYLE_KEYS) {
    styles[key] = safeText(rawStyles[key], 240);
  }
  return {
    tag: safeText(container.tag, 24),
    role: safeText(container.role, 40),
    classes: safeText(container.classes, 180),
    rect,
    styles,
  };
}

function sanitizeControl(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const control = value as Record<string, unknown>;
  const rect = sanitizeRect(control.rect);
  if (!rect) return null;
  return {
    tag: safeText(control.tag, 24),
    role: safeText(control.role, 40),
    label: safeText(control.label, 100),
    ariaLabel: safeText(control.ariaLabel, 100),
    title: safeText(control.title, 100),
    groupLabel: safeText(control.groupLabel, 100),
    rect,
    disabled: control.disabled === true,
    expanded: safeText(control.expanded, 10),
  };
}

export function sanitizeZillowGalleryReport(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.schemaVersion !== 1) return null;
  const viewportInput = snapshot.viewport && typeof snapshot.viewport === "object"
    ? snapshot.viewport as Record<string, unknown>
    : {};
  const width = safeNumber(viewportInput.width, 1, 20000);
  const height = safeNumber(viewportInput.height, 1, 20000);
  const devicePixelRatio = safeNumber(viewportInput.devicePixelRatio, 0.1, 10);
  const capturedAt = safeText(snapshot.capturedAt, 40);
  if (width === null || height === null || devicePixelRatio === null || !Number.isFinite(Date.parse(capturedAt))) {
    return null;
  }

  const images = Array.isArray(snapshot.images)
    ? snapshot.images.slice(0, 12).map(sanitizeImage).filter((item) => item !== null)
    : [];
  if (!images.length) return null;

  const containers = Array.isArray(snapshot.containers)
    ? snapshot.containers.slice(0, 32).map(sanitizeContainer).filter((item) => item !== null)
    : [];
  const controls = Array.isArray(snapshot.controls)
    ? snapshot.controls.slice(0, 30).map(sanitizeControl).filter((item) => item !== null)
    : [];

  return {
    schemaVersion: 1,
    capturedAt,
    viewport: { width, height, devicePixelRatio },
    visibleImageCount: safeNumber(snapshot.visibleImageCount, 0, 10000) ?? images.length,
    images,
    containers,
    controls,
  };
}

export function normalizeZillowListingUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["www.zillow.com", "m.zillow.com"].includes(url.hostname)) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}
