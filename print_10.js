const fs = require('fs');
const props = require('./props.json');

props.forEach((house, index) => {
    const formattedRent = house.monthly_rent.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    console.log(`${index + 1}. ${house.address}, ${house.city}, ${house.state} ${house.zip} ($${formattedRent}/mo | ${house.bedrooms} Bed / ${house.bathrooms} Bath) — https://choice-properties-site.pages.dev/property.html?id=${house.id}\n`);
});
