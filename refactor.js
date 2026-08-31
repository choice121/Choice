const fs = require('fs');
const path = require('path');

// 1. Duplicate cp-design.css to cp-admin.css
fs.copyFileSync('css/cp-design.css', 'css/cp-admin.css');

// 2. Update Admin HTML files to use cp-admin.css
['admin', 'landlord', 'tenant'].forEach(dir => {
    if(fs.existsSync(dir)){
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
        for (const file of files) {
            const filePath = path.join(dir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            content = content.replace(/\/css\/cp-design\.css(\?v=[0-9a-zA-Z]+)?/g, '/css/cp-admin.css$1');
            fs.writeFileSync(filePath, content);
        }
    }
});

// 3. Unify Tokens in cp-marketing.css and apply.css
const replaceTokens = (filePath) => {
    if(!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/--m-brand-dark/g, '--brand-600');
    content = content.replace(/--m-brand-pale/g, '--brand-100');
    content = content.replace(/--m-brand/g, '--brand');
    content = content.replace(/--premium-accent/g, '--brand');
    content = content.replace(/--m-gold-pale/g, '--gold-100');
    content = content.replace(/--m-gold/g, '--gold');
    // Add missing token variables to cp-design.css
    fs.writeFileSync(filePath, content);
};

replaceTokens('css/cp-marketing.css');
replaceTokens('css/apply.css');

// 4. Merge premium-design.css into cp-marketing.css
let premiumCss = fs.readFileSync('css/premium-design.css', 'utf8');
premiumCss = premiumCss.replace(/--premium-accent/g, '--brand');
premiumCss = premiumCss.replace(/--premium-card-bg/g, '--surface');
premiumCss = premiumCss.replace(/--premium-muted/g, '--muted');
premiumCss = premiumCss.replace(/--premium-surface/g, '--surface-2');

fs.appendFileSync('css/cp-marketing.css', '\n\n/* Merged from premium-design.css */\n' + premiumCss);

// Remove premium-design.css link from all HTML files
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/<link rel="stylesheet" href="\/css\/premium-design\.css[^"]*">\s*/g, '');
    fs.writeFileSync(file, content);
}

// 5. Append strict mobile-first property CSS to override max-width chaos
const mobileFirstOverrides = `
/* ---------------------------------------------------------------------
   MOBILE-FIRST REWRITE: Property Grid & Cards
   Fixes responsive issues and eliminates chaotic max-width queries.
   --------------------------------------------------------------------- */

.property-grid {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 16px !important;
    width: 100% !important;
}

@media (min-width: 640px) {
    .property-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 20px !important;
    }
}

@media (min-width: 1024px) {
    .property-grid {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 24px !important;
    }
}

#gallery {
    width: 100% !important;
    margin: 0 auto !important;
    border-radius: 12px !important;
}
#gallery .gallery-main {
    height: 60vw !important;
    max-height: 500px !important;
}

@media (min-width: 768px) {
    #gallery {
        border-radius: 16px !important;
    }
    #gallery .gallery-main {
        height: 500px !important;
    }
}

.property-card {
    width: 100% !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column !important;
}
.property-card-img {
    width: 100% !important;
    padding-top: 66.66% !important;
    height: 0 !important;
    position: relative !important;
}
.property-card-img img, .property-card-img .property-card-slide {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
}

.property-card-body {
    padding: 16px !important;
}
.property-card-title {
    font-size: 16px !important;
    line-height: 1.4 !important;
}
@media (min-width: 768px) {
    .property-card-title {
        font-size: 18px !important;
    }
}
`;
fs.appendFileSync('css/cp-marketing.css', mobileFirstOverrides);

// 6. Delete premium-design.css
fs.unlinkSync('css/premium-design.css');
console.log("Refactoring complete.");
