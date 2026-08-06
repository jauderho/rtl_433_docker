import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { assertSpyCalls, resolvesNext, stub } from "@std/testing/mock";
import { fetchJson, sortRtl433TagsDesc, tagify } from "./utils.ts";

// Collapses the backoff so the retry tests do not sit through the real one.
const fastRetry = { minTimeout: 1, maxTimeout: 1, jitter: 0, maxAttempts: 3 };

Deno.test("fetchJson resolves the parsed body on 200", async () => {
  using fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(Response.json([{ name: "25.12" }])),
  );

  const body = await fetchJson<Array<{ name: string }>>(
    "https://api.example.test/tags",
  );

  assertEquals(body, [{ name: "25.12" }]);
  assertSpyCalls(fetchStub, 1);
});

// The bug this guards: a rate-limited GitHub reply is valid JSON, so without the
// `res.ok` check it parsed into an error *object* and blew up much later with
// "tags.map is not a function". The failure has to be loud, and it has to name
// the URL and status so the nightly log says which endpoint gave up.
Deno.test("fetchJson rejects on a non-ok response, naming the status and URL", async () => {
  using fetchStub = stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(new Response("API rate limit exceeded", { status: 403 })),
  );

  const error = await assertRejects(
    () => fetchJson("https://api.example.test/tags"),
    Error,
  );

  assertStringIncludes(error.message, "403");
  assertStringIncludes(error.message, "https://api.example.test/tags");
  assertStringIncludes(error.message, "API rate limit exceeded");

  // A 403 never becomes OK inside the backoff window, so retrying it would only
  // spend more of an already-exhausted request budget.
  assertSpyCalls(fetchStub, 1);
});

Deno.test("fetchJson retries a server error and succeeds", async () => {
  using fetchStub = stub(
    globalThis,
    "fetch",
    resolvesNext([
      new Response("bad gateway", { status: 502 }),
      Response.json({ sha: "abc123" }),
    ]),
  );

  const body = await fetchJson<{ sha: string }>(
    "https://api.example.test/commit",
    undefined,
    fastRetry,
  );

  assertEquals(body, { sha: "abc123" });
  assertSpyCalls(fetchStub, 2);
});

Deno.test("sortRtl433TagsDesc orders numerically, not lexically", () => {
  // The trap: compared as plain strings "25.2" sorts above "25.12", which would
  // hand `latest` to the older release.
  assertEquals(
    sortRtl433TagsDesc(["25.2", "24.10", "25.12"]),
    ["25.12", "25.2", "24.10"],
  );
  assertEquals(
    sortRtl433TagsDesc(["24.10", "25.02", "25.12"]),
    ["25.12", "25.02", "24.10"],
  );
});

Deno.test("sortRtl433TagsDesc drops everything that is not a two-part version", () => {
  assertEquals(
    sortRtl433TagsDesc([
      "master",
      "nightly",
      "25.12",
      "v25.02",
      "24.10.1",
      "24.10",
    ]),
    ["25.12", "24.10"],
  );
});

Deno.test("sortRtl433TagsDesc does not mutate its input", () => {
  const input = ["24.10", "25.12", "master"];
  sortRtl433TagsDesc(input);
  assertEquals(input, ["24.10", "25.12", "master"]);
});

Deno.test("tagify replaces docker-illegal characters", () => {
  // Platforms become tag suffixes, so slashes and dots have to go.
  assertEquals(tagify("linux/arm64/v8"), "linux_arm64_v8");
  assertEquals(tagify("linux/amd64"), "linux_amd64");
  assertEquals(tagify("3.24.1"), "3_24_1");
  assertEquals(tagify("keeps-these_09AZ"), "keeps-these_09AZ");
});

Deno.test("tagify truncates to docker's 128-character tag limit", () => {
  assertEquals(tagify("a".repeat(200)).length, 128);
});
