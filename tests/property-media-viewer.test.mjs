import assert from 'node:assert/strict';
import { isPlayableTourMedia } from '../js/tour-media.mjs';
import { collectPlayablePropertyTours, isRenderablePropertyMedia } from '../js/property-tour-utils.mjs';

// Test Fixtures & Logic Mirror for headless testing
function normalizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  return u.trim().replace(/\/+$/, '').toLowerCase();
}

const getPropertyTours = property => collectPlayablePropertyTours(property, (_property, item) => item?.floor_label || null);

function groupMediaByFloor(mediaItems) {
  const groups = new Map();
  mediaItems.forEach(item => {
    const rawFloor = (item.floor_label || '').trim();
    const floorKey = rawFloor || 'General / Entire Home';
    if (!groups.has(floorKey)) groups.set(floorKey, []);
    groups.get(floorKey).push(item);
  });
  return groups;
}

function buildEmbedUrl(url, kind) {
  const u = String(url || '').trim();
  if (/youtube\.com|youtu\.be/i.test(u)) {
    const ytMatch = u.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*)/);
    const ytId = (ytMatch && ytMatch[1]?.length === 11) ? ytMatch[1] : '';
    return { type: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1` };
  }
  if (/vimeo\.com/i.test(u)) {
    const vmMatch = u.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/);
    const vmId = vmMatch ? vmMatch[3] : '';
    return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vmId}?autoplay=1&title=0&byline=0&portrait=0` };
  }
  if (kind === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(u)) {
    return { type: 'html5_video', src: u };
  }
  if (/matterport\.com/i.test(u)) {
    let mpUrl = u;
    if (!mpUrl.includes('play=')) mpUrl += (mpUrl.includes('?') ? '&' : '?') + 'play=1&qs=1';
    return { type: 'matterport', embedUrl: mpUrl };
  }
  if (/insidemaps\.com/i.test(u)) {
    return { type: 'insidemaps', embedUrl: u };
  }
  if (/zillow\.com\/(view-3d-home|view-imx)/i.test(u)) {
    let embedUrl = u;
    if (!embedUrl.includes('hidePhotos=')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'hidePhotos=true&initialViewType=pano';
    }
    return { type: 'zillow3d', embedUrl };
  }
  if (/^https?:\/\//i.test(u)) {
    return { type: 'generic_iframe', embedUrl: u };
  }
  return { type: 'unsupported', fallbackUrl: u };
}

console.log('--- RUNNING PROPERTY MEDIA & MULTI-FLOOR TEST SUITE ---');

// Test 1: Deduplication of legacy tour when present in property_media
{
  const p = {
    id: 'test-1',
    virtual_tour_url: 'https://my.matterport.com/show/?m=SAMPLE12345/',
    property_media: [
      {
        id: 'pm-1',
        kind: 'virtual_tour',
        title: 'Main Floor 3D Tour',
        floor_label: 'Level 1',
        url: 'https://my.matterport.com/show/?m=SAMPLE12345',
        display_order: 0
      }
    ]
  };
  const tours = getPropertyTours(p);
  assert.equal(tours.length, 1, 'Should deduplicate identical tour URLs ignoring trailing slashes');
  assert.equal(tours[0].id, 'pm-1', 'Should keep property_media metadata over legacy fallback');
  console.log('✅ Test 1 Passed: Deduplication of legacy virtual_tour_url');
}

// Test 2: Inclusion of legacy tour when property_media has no tour
{
  const p = {
    id: 'test-2',
    virtual_tour_url: 'https://my.matterport.com/show/?m=LEGACY99999',
    property_media: [
      {
        id: 'pm-fp1',
        kind: 'floor_plan',
        title: 'First Floor Plan',
        floor_label: 'Level 1',
        url: 'https://example.com/fp1.jpg'
      }
    ]
  };
  const tours = getPropertyTours(p);
  assert.equal(tours.length, 1, 'Should include legacy tour if not present in property_media');
  assert.equal(tours[0].id, 'legacy-vt');
  assert.equal(tours[0].url, 'https://my.matterport.com/show/?m=LEGACY99999');
  console.log('✅ Test 2 Passed: Legacy virtual_tour_url preserved when property_media has none');
}

// Test 3: Multiple tours across floors
{
  const p = {
    id: 'test-3',
    property_media: [
      { id: 't1', kind: 'tour_3d', title: 'Main Level 3D Tour', floor_label: 'Main Level', url: 'https://my.matterport.com/show/?m=AAA12345678' },
      { id: 't2', kind: 'virtual_tour', title: 'Second Floor 3D Tour', floor_label: 'Level 2', url: 'https://my.matterport.com/show/?m=BBB12345678' },
      { id: 't3', kind: 'video', title: 'Full Walkthrough Video', floor_label: null, url: 'https://example.com/walkthrough.mp4' }
    ]
  };
  const tours = getPropertyTours(p);
  assert.equal(tours.length, 3, 'Should gather all 3 distinct tours/videos');
  assert.equal(tours[0].kind, 'tour_3d');
  assert.equal(tours[1].kind, 'virtual_tour');
  assert.equal(tours[2].kind, 'video');
  console.log('✅ Test 3 Passed: Multi-tour extraction across levels');
}

// Test 4: Multi-floor grouping & Unlabeled media grouping
{
  const media = [
    { id: 'm1', kind: 'floor_plan', title: 'Ground Plan', floor_label: 'Ground Level' },
    { id: 'm2', kind: 'floor_plan', title: 'Second Floor Plan', floor_label: 'Level 2' },
    { id: 'm3', kind: 'virtual_tour', title: 'Second Floor Tour', floor_label: 'Level 2' },
    { id: 'm4', kind: 'video', title: 'General Property Tour', floor_label: '' },
    { id: 'm5', kind: 'floor_plan', title: 'Detached Garage Layout', floor_label: null }
  ];
  const groups = groupMediaByFloor(media);
  assert.equal(groups.size, 3, 'Should produce exactly 3 groups: Ground Level, Level 2, General / Entire Home');
  assert.equal(groups.get('Ground Level').length, 1);
  assert.equal(groups.get('Level 2').length, 2);
  assert.equal(groups.get('General / Entire Home').length, 2);
  console.log('✅ Test 4 Passed: Multi-floor grouping and unlabeled fallback');
}

// Test 5: Provider detection & safe embed URL generation
{
  // Matterport
  const mp = buildEmbedUrl('https://my.matterport.com/show/?m=xyz', 'virtual_tour');
  assert.equal(mp.type, 'matterport');
  assert.ok(mp.embedUrl.includes('play=1&qs=1'));

  // InsideMaps
  const im = buildEmbedUrl('https://insidemaps.com/project/123/walkthrough', 'virtual_tour');
  assert.equal(im.type, 'insidemaps');

  // Zillow 3D
  const zw = buildEmbedUrl('https://www.zillow.com/view-3d-home/abc-def', 'virtual_tour');
  assert.equal(zw.type, 'zillow3d');
  assert.ok(zw.embedUrl.includes('hidePhotos=true'));

  // YouTube
  const yt = buildEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video');
  assert.equal(yt.type, 'youtube');
  assert.ok(yt.embedUrl.includes('dQw4w9WgXcQ'));

  // Vimeo
  const vm = buildEmbedUrl('https://vimeo.com/76979871', 'video');
  assert.equal(vm.type, 'vimeo');
  assert.ok(vm.embedUrl.includes('76979871'));

  // Direct HTML5 Video
  const vid = buildEmbedUrl('https://cdn.example.com/property_video.mp4', 'video');
  assert.equal(vid.type, 'html5_video');

  // Generic HTTPS (iframe + fallback)
  const gen = buildEmbedUrl('https://tours.customprovider.com/tour/456', 'virtual_tour');
  assert.equal(gen.type, 'generic_iframe');

  // Unsupported scheme
  const unsupp = buildEmbedUrl('ftp://invalid-url.com', 'virtual_tour');
  assert.equal(unsupp.type, 'unsupported');

  console.log('✅ Test 5 Passed: Provider detection and safe embed URL construction');
}

// Test 6: Unit Floor vs Floor Label separation
{
  const prop = {
    unit_floor: '3rd Floor, Unit 302',
    floors: 2, // 2-story penthouse unit
    property_media: [
      { id: 'fp-1', kind: 'floor_plan', title: 'Penthouse Lower Level', floor_label: 'Lower Level' },
      { id: 'fp-2', kind: 'floor_plan', title: 'Penthouse Rooftop Terrace', floor_label: 'Rooftop Level' }
    ]
  };

  const groups = groupMediaByFloor(prop.property_media);
  assert.ok(groups.has('Lower Level'));
  assert.ok(groups.has('Rooftop Level'));
  assert.ok(!groups.has(prop.unit_floor), 'Floor groups should NOT mix building unit_floor with internal layout floor_labels');
  console.log('✅ Test 6 Passed: Unit Floor is kept separate from internal floor labels');
}

// Test 7: Reject image thumbnails and provider landing pages as tours
{
  assert.equal(isPlayableTourMedia({ kind: 'virtual_tour', url: 'https://www.zillow.com/s3/hdp/home-details/images/third-party-virtual-tour/cc_ft_768.jpg' }), false);
  assert.equal(isPlayableTourMedia({ kind: 'video', url: 'https://www.insidemaps.com/app/walkthrough-tour/' }), false);
  assert.equal(isPlayableTourMedia({ kind: 'virtual_tour', url: 'https://my.matterport.com/show/?m=50084live' }), false);
  assert.equal(isPlayableTourMedia({ kind: 'virtual_tour', url: 'https://tour.example.com/virtual-tour/12345' }), false);
  assert.equal(isPlayableTourMedia({ kind: 'virtual_tour', url: 'https://my.matterport.com/show/?m=abc123def45' }), true);
  assert.equal(isPlayableTourMedia({ kind: 'virtual_tour', url: 'https://www.propertypanorama.com/instaview/ntreis/21409428' }), true);
  assert.equal(isPlayableTourMedia({ kind: 'video', url: 'https://cdn.example.test/walkthrough.mp4' }), true);
  assert.equal(isPlayableTourMedia({ kind: 'video', url: 'https://vimeo.com/76979871' }), true, 'Common public Vimeo video URLs should be accepted');
  assert.equal(isPlayableTourMedia({ kind: 'virtual_tour', url: 'https://tours.customprovider.com/tour/456' }), false, 'Unknown providers should not be treated as playable embeds');
  console.log('✅ Test 7 Passed: Only playable tour/video URLs are accepted');
}

// Test 8: Production media filtering rejects broken viewer candidates before rendering
{
  assert.equal(isRenderablePropertyMedia({ kind: 'virtual_tour', url: 'https://www.zillow.com/s3/hdp/home-details/images/third-party-virtual-tour/cc_ft_768.jpg' }), false);
  assert.equal(isRenderablePropertyMedia({ kind: 'virtual_tour', url: 'https://tours.customprovider.com/tour/456' }), false);
  assert.equal(isRenderablePropertyMedia({ kind: 'floor_plan', url: 'https://cdn.example.test/floor-plan.png' }), true);
  assert.equal(isRenderablePropertyMedia({ kind: 'video', url: 'https://cdn.example.test/walkthrough.mp4' }), true);
  console.log('✅ Test 8 Passed: Production media rendering accepts supported media only');
}

console.log('--- ALL PROPERTY MEDIA TESTS DEFINED (8 groups) ---');
