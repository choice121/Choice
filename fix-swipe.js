const fs = require('fs');

// 1. Update CSS
let css = fs.readFileSync('css/cp-marketing.css', 'utf8');
css = css.replace(
  '.property-card-slides{display:flex;transition:transform .35s ease;width:100%;height:100%}',
  '.property-card-slides{display:flex;width:100%;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none;}\n.property-card-slides::-webkit-scrollbar{display:none;}'
);
css = css.replace(
  '.property-card-slide{min-width:100%;flex:0 0 100%;position:relative}',
  '.property-card-slide{min-width:100%;flex:0 0 100%;position:relative;scroll-snap-align:start;}'
);
fs.writeFileSync('css/cp-marketing.css', css);

// 2. Update JS
let js = fs.readFileSync('js/card-builder.js', 'utf8');

// Replace goTo logic
js = js.replace(
  /slides\.style\.transform = 'translateX\(-' \+ \(idx \* 100\) \+ '%\)';/g,
  "slides.scrollTo({ left: slides.offsetWidth * idx, behavior: 'smooth' });"
);

// Remove touch swipe logic
js = js.replace(
  /\/\/ Touch swipe[\s\S]*?(?=\/\/ Desktop arrow buttons)/g,
  ""
);

// Add scroll listener to update dots naturally when native swipe happens
const scrollSync = `
    // Native scroll sync for dots
    slides.addEventListener('scroll', function() {
      if (dots.length === 0) return;
      var newIdx = Math.round(slides.scrollLeft / slides.offsetWidth);
      if (newIdx !== idx && newIdx >= 0 && newIdx < total) {
        idx = newIdx;
        dots.forEach(function(dot, i) {
          var active = i === idx;
          dot.classList.toggle('active', active);
          dot.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      }
    }, { passive: true });
    
    // Desktop arrow buttons`;
    
js = js.replace('// Desktop arrow buttons', scrollSync);

fs.writeFileSync('js/card-builder.js', js);
console.log('Swipe physics upgraded to CSS Scroll Snap.');
