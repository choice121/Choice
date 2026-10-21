/// <reference lib="deno.ns" />

import {
  extractVerifiedZillowRental,
  isExplicitZillowRentalPage,
  parseZillowDetailUrl,
} from "../zillow-url-import.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pageFor(property: Record<string, unknown>, label = "House for rent"): string {
  const payload = {
    props: {
      pageProps: {
        componentProps: {
          gdpClientCache: JSON.stringify({ result: { property } }),
        },
      },
    },
  };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script><h1>${label}</h1>`;
}

Deno.test("accepts canonical Zillow home detail URLs and strips tracking", () => {
  const result = parseZillowDetailUrl(
    "https://www.zillow.com/homedetails/2165-Sunshine-Peak-Dr/455321734_zpid/?utm_source=test",
  );
  assert(result.ok, "Expected valid Zillow home detail URL.");
  assert(result.zpid === "455321734", "Expected to extract the Zillow property ID.");
  assert(result.url.search === "", "Expected tracking query parameters to be removed.");
});

Deno.test("rejects non-Zillow hosts, HTTP URLs, and search pages", () => {
  assert(!parseZillowDetailUrl("https://zillow.com.evil.example/homedetails/x/1_zpid/").ok, "Rejected host.");
  assert(!parseZillowDetailUrl("http://www.zillow.com/homedetails/x/1_zpid/").ok, "Rejected HTTP.");
  assert(!parseZillowDetailUrl("https://www.zillow.com/homes/for_rent/").ok, "Rejected search page.");
  assert(!parseZillowDetailUrl("https://user@www.zillow.com/homedetails/x/1_zpid/").ok, "Rejected URL credentials.");
  assert(!parseZillowDetailUrl("https://www.zillow.com:8443/homedetails/x/1_zpid/").ok, "Rejected nonstandard port.");
});

Deno.test("requires matching property ID, rental status, and asking price", () => {
  const rental = pageFor({ zpid: 123, homeStatus: "FOR_RENT", price: 2800 });
  assert(isExplicitZillowRentalPage(rental, "123"), "Expected an explicit rental listing to pass.");
  assert(!isExplicitZillowRentalPage(rental, "456"), "Rejected a different property ID.");
  const extracted = extractVerifiedZillowRental(rental, "123");
  assert(extracted?.monthly_rent === 2800, "Uses Zillow's explicit asking rent.");

  const sale = pageFor({ zpid: 123, homeStatus: "FOR_SALE", price: 2800 });
  assert(!isExplicitZillowRentalPage(sale, "123"), "Rejected a for-sale property.");

  const estimateOnly = pageFor({ zpid: 123, homeStatus: "FOR_RENT", rentZestimate: 2800 });
  assert(!isExplicitZillowRentalPage(estimateOnly, "123"), "Rejected a rent estimate without asking price.");
  const negativePrice = pageFor({ zpid: 123, homeStatus: "FOR_RENT", price: "-$2,800" });
  assert(!isExplicitZillowRentalPage(negativePrice, "123"), "Rejected a negative formatted asking price.");
});

Deno.test("uses the visible rental label when Zillow omits a status field", () => {
  const page = pageFor({ zpid: 123, price: "$2,800" }, "House for rent");
  assert(isExplicitZillowRentalPage(page, "123"), "Expected the explicit rental page label to pass.");
});

Deno.test("rejects conflicting sale and rental status fields", () => {
  const page = pageFor({
    zpid: 123,
    homeStatus: "FOR_SALE",
    listingStatus: "FOR_RENT",
    price: 2800,
  });
  assert(
    !isExplicitZillowRentalPage(page, "123"),
    "A sale status must win over a conflicting rental status.",
  );
});

Deno.test("keeps only HTTPS Zillow image CDN URLs", () => {
  const page = pageFor({
    zpid: 123,
    homeStatus: "FOR_RENT",
    price: 2800,
    responsivePhotos: [
      { url: "https://photos.zillowstatic.com/fp/house.jpg" },
      { url: "https://photos.zillowstatic.com.attacker.example/fp/fake.jpg" },
      { url: "http://photos.zillowstatic.com/fp/insecure.jpg" },
      { url: "https://user@photos.zillowstatic.com/fp/credential.jpg" },
      { url: "https://photos.zillowstatic.com:8443/fp/custom-port.jpg" },
    ],
  });
  const extracted = extractVerifiedZillowRental(page, "123");
  assert(extracted, "Expected valid rental data to be extracted.");
  const photos = JSON.parse(String(extracted.original_image_urls));
  assert(photos.length === 1, "Rejected non-Zillow image hosts and insecure URLs.");
  assert(
    photos[0] === "https://photos.zillowstatic.com/fp/house.jpg",
    "Kept the trusted Zillow photo URL.",
  );
});

Deno.test("uses the standardized address title and parses monthly price labels", () => {
  const page = pageFor({
    zpid: 123,
    homeStatus: "FOR_RENT",
    price: "$2,800/mo",
    title: "Luxury home with stunning upgrades",
    address: {
      streetAddress: "123 Main St",
      city: "Austin",
      state: "TX",
      zipcode: "78701",
    },
  });
  const extracted = extractVerifiedZillowRental(page, "123");
  assert(extracted?.monthly_rent === 2800, "Parsed the explicit monthly asking rent.");
  assert(extracted?.title === "123 Main St, Austin, TX 78701", "Used the standardized address title.");
});
