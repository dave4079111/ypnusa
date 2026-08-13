import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

process.env.YPNUS_WP_API_BASE = "https://wp.test/wp-json/ypnus/v1";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("live territory lookup", async () => {
  const { fetchLiveTerritory } = await import("./live-territory");

  afterEach(() => {
    mock.restoreAll();
  });

  function stubFetch(handler: (url: string) => Response | Promise<Response>) {
    const calls: string[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return handler(String(input));
    });
    return calls;
  }

  it("rejects an invalid ZIP locally without calling the remote ledger", async () => {
    const calls = stubFetch(() => jsonResponse({ available: true }));

    for (const raw of ["123", "abcde", undefined, null, {}]) {
      const result = await fetchLiveTerritory(raw);
      assert.equal(result?.valid, false);
      assert.equal(result?.available, false);
      assert.match(result?.message ?? "", /valid 5-digit ZIP/);
    }
    assert.deepEqual(calls, []);
  });

  it("queries the configured WordPress ledger with the normalized ZIP", async () => {
    const calls = stubFetch(() => jsonResponse({ available: true, city: "Fresno", state: "CA" }));

    const result = await fetchLiveTerritory(" 93720 ");

    assert.deepEqual(calls, ["https://wp.test/wp-json/ypnus/v1/zip-check/93720"]);
    assert.equal(result?.zip, "93720");
    assert.equal(result?.valid, true);
    assert.equal(result?.available, true);
    assert.equal(result?.message, "Fresno, CA is open.");
  });

  it("summarizes demand and locked territories from the remote payload", async () => {
    stubFetch(() =>
      jsonResponse({
        available: false,
        city: "Austin",
        state: "TX",
        demand: { total: 42, window_days: 30 },
      }),
    );

    const result = await fetchLiveTerritory("78701");

    assert.equal(
      result?.message,
      "Austin, TX is exclusively locked. ~42 people buying, selling, or moving in the next 30 days.",
    );
    assert.equal(result?.live?.demand?.total, 42);
  });

  it("defaults the demand window and falls back to the ZIP when no place is returned", async () => {
    stubFetch(() => jsonResponse({ available: true, demand: { total: 7 } }));

    const result = await fetchLiveTerritory("93618");

    assert.equal(
      result?.message,
      "ZIP 93618 is open. ~7 people buying, selling, or moving in the next 60 days.",
    );
  });

  it("prefers a remote message over the generated copy", async () => {
    stubFetch(() => jsonResponse({ available: true, message: "  Claim this ZIP today.  " }));

    assert.equal((await fetchLiveTerritory("93618"))?.message, "Claim this ZIP today.");
  });

  it("ignores a blank remote message", async () => {
    stubFetch(() => jsonResponse({ available: true, message: "   ", city: "Fresno", state: "CA" }));

    assert.equal((await fetchLiveTerritory("93720"))?.message, "Fresno, CA is open.");
  });

  it("returns null so callers can fall back to the local store", async () => {
    stubFetch(() => jsonResponse({ error: "boom" }, { status: 502 }));
    assert.equal(await fetchLiveTerritory("93720"), null, "non-2xx response");

    mock.restoreAll();
    stubFetch(() => jsonResponse({ zip: "93720" }));
    assert.equal(await fetchLiveTerritory("93720"), null, "payload without an availability flag");

    mock.restoreAll();
    stubFetch(() => new Response("<html>nope</html>", { status: 200 }));
    assert.equal(await fetchLiveTerritory("93720"), null, "unparseable body");

    mock.restoreAll();
    stubFetch(() => {
      throw new Error("network down");
    });
    assert.equal(await fetchLiveTerritory("93720"), null, "transport failure");
  });
});
