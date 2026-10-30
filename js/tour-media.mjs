const IMAGE_FILE = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i;
const VIDEO_FILE = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;

function isYouTubeUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return false;
  const id = host === 'youtu.be'
    ? url.pathname.split('/').filter(Boolean)[0]
    : url.pathname.split('/').filter(Boolean).at(-1) === 'watch'
      ? url.searchParams.get('v')
      : url.pathname.split('/').filter(Boolean).at(-1);
  return /^[A-Za-z0-9_-]{11}$/.test(id || '');
}

function isVimeoUrl(url) {
  return /(?:^|\.)vimeo\.com$/i.test(url.hostname) && /\/video\/?\d+(?:\/|$)/.test(url.pathname);
}

export function isPlayableTourMedia(item) {
  if (!item || typeof item.url !== 'string') return false;
  const kind = String(item.kind || '').toLowerCase();
  if (!['video', 'virtual_tour', 'tour_3d'].includes(kind)) return false;

  let url;
  try {
    url = new URL(item.url.trim());
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol) || IMAGE_FILE.test(url.pathname)) return false;
  if (VIDEO_FILE.test(url.pathname) || isYouTubeUrl(url) || isVimeoUrl(url)) return true;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'my.matterport.com' || host.endsWith('.matterport.com')) {
    return /^\/show\/?$/i.test(url.pathname) && /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('m') || '');
  }
  if (host === 'propertypanorama.com' || host.endsWith('.propertypanorama.com')) {
    return /^\/instaview\/[^/]+\/[^/]+\/?$/i.test(url.pathname);
  }
  if (host === 'zillow.com' || host === 'm.zillow.com' || host.endsWith('.zillow.com')) {
    return /\/(?:view-3d-home|view-imx)\/[^/]+/i.test(url.pathname);
  }
  if (host === 'insidemaps.com' || host.endsWith('.insidemaps.com')) {
    return /\/(?:project\/[^/]+\/walkthrough|app\/walkthrough-tour\/[^/]+)\/?$/i.test(url.pathname);
  }

  return false;
}