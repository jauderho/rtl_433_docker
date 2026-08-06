import { assertEquals } from "@std/assert";
import {
  assertSpyCallArg,
  assertSpyCalls,
  resolvesNext,
  returnsNext,
  stub,
} from "@std/testing/mock";
import { getGithubRefCommit, getGithubRepoTags } from "./github.ts";

// Unauthenticated api.github.com allows 60 requests/hour per IP and the nightly
// build has exhausted it before. A dropped header degrades silently into
// rate-limit failures, so it is worth pinning.
Deno.test("getGithubRepoTags sends a bearer token when GITHUB_TOKEN is set", async () => {
  using _env = stub(Deno.env, "get", returnsNext(["s3cret"]));
  using fetchStub = stub(
    globalThis,
    "fetch",
    resolvesNext([Response.json([{ name: "25.12" }])]),
  );

  const tags = await getGithubRepoTags("merbanan/rtl_433");

  assertEquals(tags.map((tag) => tag.name), ["25.12"]);
  assertSpyCalls(fetchStub, 1);
  assertSpyCallArg(
    fetchStub,
    0,
    0,
    "https://api.github.com/repos/merbanan/rtl_433/tags",
  );
  // Not assertSpyCallArg: fetchJson adds a live AbortSignal alongside the
  // headers, and two of those never compare equal.
  assertEquals(fetchStub.calls[0].args[1]?.headers, {
    Authorization: "Bearer s3cret",
  });
});

Deno.test("no bearer token is sent when GITHUB_TOKEN is unset", async () => {
  using _env = stub(Deno.env, "get", returnsNext([undefined]));
  using fetchStub = stub(
    globalThis,
    "fetch",
    resolvesNext([Response.json([])]),
  );

  await getGithubRepoTags("merbanan/rtl_433");

  assertSpyCalls(fetchStub, 1);
  assertEquals(fetchStub.calls[0].args[1]?.headers, {});
});

Deno.test("getGithubRefCommit requests the ref's commit", async () => {
  using _env = stub(Deno.env, "get", returnsNext(["s3cret"]));
  using fetchStub = stub(
    globalThis,
    "fetch",
    resolvesNext([Response.json({ sha: "abc123" })]),
  );

  const commit = await getGithubRefCommit("merbanan/rtl_433", "master");

  assertEquals(commit.sha, "abc123");
  assertSpyCalls(fetchStub, 1);
  assertSpyCallArg(
    fetchStub,
    0,
    0,
    "https://api.github.com/repos/merbanan/rtl_433/commits/master",
  );
  assertEquals(fetchStub.calls[0].args[1]?.headers, {
    Authorization: "Bearer s3cret",
  });
});
