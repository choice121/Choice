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
    "https://www.zillow.com/homedetails/2165-Sunshine-Peak-Dr/455321734_zpid/?utm_source=test");
  assert(result.ok, "Expected valid Zillow home detail URL.");
  assert(result.zpid === "455321734", "Expected to extract the Zillow property ID.");
  assert(result.url.search === "", "Expected tracking query parameters to be removed.");
});

Deno.test("rejects non-Zillow hosts, HTTP URLs, and search pages", () => {
  assert(!parseZillowDetailUrl("https://zillow.com.evil.example/homedetails/x/1_zpid/").ok, "Rejected host.");
  assert(!parseZillowDetailUrl("http://www.zillow.com/homedetails/x/1_zpid/").ok, "Rejected HTTP.");
  assert(!parseZillowDetailUrl("https://www.zillow.com/homes/for_rent/").ok, "Rejected search page.");
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
});

Deno.test("uses the visible rental label when Zillow omits a status field", () => {
  const page = pageFor({ zpid: 123, price: "$2,800" }, "House for rent");
  assert(isExplicitZillowRentalPage(page, "123"), "Expected the explicit rental page label to pass.");
});

Deno.test("extracts structured media for the pipeline publisher", () => {
  const page = pageFor({
    zpid: 123,
    homeStatus: "FOR_RENT",
    price: 2800,
    floorPlans: [{ url: "https://cdn.example.com/plan.png", title: "First floor" }],
    videos: [{ url: "https://cdn.example.com/walkthrough.mp4" }],
    virtualTourUrl: "https://my.matterport.com/show/?m=abc",
  });
  const extracted = extractVerifiedZillowRental(page, "123");
  const media = extracted?.media as Array<Record<string, unknown>> | undefined;

  assert(media?.length === 3, "Expected floor plan, video, and tour media.");
  assert(media[0].kind === "floor_plan", "Expected floor plan media first.");
  assert(media[1].kind === "video", "Expected video media second.");
  assert(media[2].kind === "virtual_tour", "Expected tour media third.");
});
