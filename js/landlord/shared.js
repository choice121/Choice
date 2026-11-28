// js/landlord/shared.js
// Shared utilities for landlord portal pages.
// Imported by new-listing.js, edit-listing.js, and any future landlord modules.

export const STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ['DC','Washington D.C.']
];

export function whenSidebarReady(cb, tries = 0) {
  if (document.getElementById('admin-name')) return cb();
  if (tries > 50) return;
  setTimeout(() => whenSidebarReady(cb, tries + 1), 40);
}

export function installImageFallback() {
  document.addEventListener('error', function(e) {
    var t = e.target;
    if (t.tagName !== 'IMG') return;
    if (t.src !== location.origin + '/assets/placeholder-property.jpg') {
      t.src = '/assets/placeholder-property.jpg';
    }
  }, true);
}
