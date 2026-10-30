/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { extractFromNextData } from "../zillow-extract.ts";

function pageFor(property: Record<string, unknown>): string {
  const payload = {
    props: {
      pageProps: {
        componentProps: {
          gdpClientCache: JSON.stringify({ result: { property } }),
        },
      },
    },
  };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
}

function monthlyRent(result: Record<string, unknown> | { _error: string }): unknown {
  if (!("monthly_rent" in result)) throw new Error("Zillow listing extraction failed.");
  return result.monthly_rent;
}

function listingField(
  result: Record<string, unknown> | { _error: string },
  field: string,
): unknown {
  if ("_error" in result) throw new Error("Zillow listing extraction failed.");
  return result[field];
}

Deno.test("Zillow extraction does not substitute estimated rent for asking rent", () => {
  const result = extractFromNextData(pageFor({
    zpid: 123,
    bedrooms: 2,
    rentZestimate: 1800,
  }));
  assertEquals(monthlyRent(result), null);
});

Deno.test("Zillow extraction preserves explicit asking rent", () => {
  const result = extractFromNextData(pageFor({
    zpid: 123,
    bedrooms: 2,
    price: "$1,800",
    rentZestimate: 1900,
    address: {
      streetAddress: "123 Main St",
      city: "Tulsa",
      state: "OK",
      zipcode: "74103",
    },
  }));
  assertEquals(monthlyRent(result), 1800);
  assertEquals(listingField(result, "title"), "123 Main St, Tulsa, OK 74103");
  assertEquals(listingField(result, "city"), "Tulsa");
});
