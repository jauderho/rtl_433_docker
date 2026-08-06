import { assert, assertEquals } from "@std/assert";
import { createAlpineBuildTasks } from "./alpine.config.ts";

// A realistic nightly input: the moving branch plus the three newest releases.
const GIT_REFS = ["master", "25.12", "25.02", "24.10"];
const ALPINE_VERSIONS = ["3.24.1"];

const buildTasks = () =>
  createAlpineBuildTasks(
    GIT_REFS,
    new Map([
      ["master", "deadbeef"],
      ["25.12", "1111111"],
      ["25.02", "2222222"],
      ["24.10", "3333333"],
    ]),
    ALPINE_VERSIONS,
  );

Deno.test("createAlpineBuildTasks emits one task per ref", () => {
  assertEquals(buildTasks().map((task) => task.name), [
    "master-alpine-3.24.1",
    "25.12-alpine-3.24.1",
    "25.02-alpine-3.24.1",
    "24.10-alpine-3.24.1",
  ]);
});

// The whole published tag surface for the newest release on the newest base.
// Pinned exactly: every alias here is a name users pull by, and a silent change
// mislabels an image.
Deno.test("the newest release on the newest base carries the full alias set", () => {
  const task = buildTasks().find((task) => task.gitRef === "25.12")!;

  assertEquals(task.tags, [
    "25.12-alpine-3.24.1",
    "25.12-alpine-3.24",
    "25.12-alpine-3",
    "latest-alpine-3.24.1",
    "latest-alpine-3.24",
    "latest-alpine-3",
    "25.12-alpine-latest",
    "25.12-alpine",
    "25.12",
    "latest-alpine-latest",
    "latest-alpine",
    "latest",
  ]);
});

// Numeric ordering decides this, and "master" must never win it — a `latest`
// pointing at the branch build is the worst mislabel available.
Deno.test("`latest` and its aliases go to the newest release only", () => {
  for (const task of buildTasks().filter((task) => task.gitRef !== "25.12")) {
    assertEquals(
      task.tags.filter((tag) => tag.startsWith("latest")),
      [],
      `${task.name} leaked a latest alias`,
    );
  }
});

// Every ref still gets its own bare tag, so `docker pull hertzg/rtl_433:24.10`
// and `:master` both resolve.
Deno.test("every ref gets a bare version tag of its own", () => {
  const tasks = buildTasks();
  for (const ref of GIT_REFS) {
    const task = tasks.find((task) => task.gitRef === ref)!;
    assert(task.tags.includes(ref), `${ref} has no bare tag`);
  }
});

Deno.test("a ref with no known sha builds with an `unknown` sha rather than dropping out", () => {
  const tasks = createAlpineBuildTasks(["25.12"], new Map(), ALPINE_VERSIONS);

  assertEquals(tasks.length, 1);
  assertEquals(tasks[0].buildArgs.rtl433GitSha, "unknown");
  assertEquals(tasks[0].buildArgs.rtl433GitVersion, "25.12");
});

// A base version without a dot has no minor/major to alias, and only the
// "latest" spelling earns the bare `-alpine` suffix.
Deno.test("dotless base versions produce no minor/major aliases", () => {
  const tasks = createAlpineBuildTasks(["25.12"], new Map(), ["edge"]);

  assertEquals(
    tasks[0].tags.filter((tag) => tag.startsWith("25.12-alpine")),
    ["25.12-alpine-edge", "25.12-alpine-latest", "25.12-alpine"],
  );
});

Deno.test("cache scope is keyed per base version and ref", () => {
  const task = buildTasks().find((task) => task.gitRef === "master")!;

  assertEquals(task.cacheFrom, "type=gha,scope=alpine-3.24.1-master");
  assertEquals(task.cacheTo, task.cacheFrom);
});
