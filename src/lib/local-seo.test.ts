import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleReviewUrl,
  getLocalSeoPath,
  getLocalSeoProfile,
  parseVerifiedReviews,
  serializeJsonLd,
} from "./local-seo";
import {
  buildReviewRequestMessage,
  parseReviewRequestInput,
} from "./review-automation";

test("curated city and ZIP profiles resolve to unique canonical paths", () => {
  const city = getLocalSeoProfile("city", "FRESNO-CA");
  const zip = getLocalSeoProfile("zip", "93720");

  assert.equal(city?.city, "Fresno");
  assert.equal(city && getLocalSeoPath(city), "/mortgage-broker/fresno-ca");
  assert.equal(zip && getLocalSeoPath(zip), "/zip/93720");
  assert.equal(getLocalSeoProfile("city", "made-up-ca"), undefined);
  assert.equal(getLocalSeoProfile("zip", "00000"), undefined);
});

test("review URLs require and encode a configured Place ID", () => {
  assert.equal(buildGoogleReviewUrl(), undefined);
  assert.equal(buildGoogleReviewUrl(" "), undefined);
  assert.equal(
    buildGoogleReviewUrl("place/id"),
    "https://search.google.com/local/writereview?placeid=place%2Fid",
  );
});

test("review parser rejects malformed and unverified-shaped records", () => {
  const reviews = parseVerifiedReviews([
    { id: "ok", author: "A. Borrower", rating: 5, text: "Clear communication." },
    { author: "", rating: 5, text: "Missing author" },
    { author: "B", rating: 6, text: "Invalid rating" },
    { author: "C", rating: 4, text: "" },
  ]);

  assert.deepEqual(reviews, [
    {
      id: "ok",
      author: "A. Borrower",
      rating: 5,
      text: "Clear communication.",
      publishedAt: undefined,
      sourceUrl: undefined,
    },
  ]);
});

test("JSON-LD serialization escapes opening angle brackets", () => {
  assert.equal(serializeJsonLd({ text: "</script>" }), '{"text":"\\u003c/script>"}');
});

test("post-closing payload validates identifiers and builds an honest review request", () => {
  assert.equal(parseReviewRequestInput({ customerFirstName: "Ana" }), undefined);
  const input = parseReviewRequestInput({
    closingId: "close_123",
    customerFirstName: " Ana ",
    destination: "sms:+15555550123",
  });
  assert.deepEqual(input, {
    closingId: "close_123",
    customerFirstName: "Ana",
    destination: "sms:+15555550123",
  });

  assert.equal(
    input &&
      buildReviewRequestMessage(input, {
        name: "Example Mortgage",
      }),
    undefined,
  );

  const message =
    input &&
    buildReviewRequestMessage(input, {
      name: "Example Mortgage",
      placeId: "verified-place",
    });
  assert.match(message?.message || "", /honest review/);
  assert.equal(message?.closingId, "close_123");
  assert.equal(
    message?.reviewUrl,
    "https://search.google.com/local/writereview?placeid=verified-place",
  );
});
