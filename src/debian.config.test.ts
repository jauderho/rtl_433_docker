import { assert, assertEquals } from "@std/assert";
import { createDebianBuildTasks } from "./debian.config.ts";

const GIT_REFS = ["master", "25.12", "25.02", "24.10"];
const DEBIAN_VERSIONS = ["trixie"];

const buildTasks = () =>
  createDebianBuildTasks(
    GIT_REFS,
    new Map([
      ["master", "deadbeef"],
      ["25.12", "1111111"],
      ["25.02", "2222222"],
      ["24.10", "3333333"],
    ]),
    DEBIAN_VERSIONS,
  );

Deno.test("createDebianBuildTasks emits one task per ref", () => {
  assertEquals(buildTasks().map((task) => task.name), [
    "master-debian-trixie",
    "25.12-debian-trixie",
    "25.02-debian-trixie",
    "24.10-debian-trixie",
  ]);
});

Deno.test("the newest release on the newest base carries the full alias set", () => {
  const task = buildTasks().find((task) => task.gitRef === "25.12")!;

  assertEquals(task.tags, [
    "25.12-debian-trixie",
    "25.12-debian-latest",
    "25.12-debian",
    "latest-debian-trixie",
    "latest-debian-latest",
    "latest-debian",
  ]);
});

// Deliberate asymmetry with alpine: alpine is the default flavour and owns the
// unsuffixed namespace, so debian must never claim a bare `latest` or a bare
// version tag or it would overwrite the alpine image under the same name.
Deno.test("debian never claims the unsuffixed tag namespace", () => {
  for (const task of buildTasks()) {
    for (const tag of task.tags) {
      assert(
        tag.includes("-debian"),
        `${task.name} published unsuffixed tag ${tag}`,
      );
    }
  }
});

Deno.test("`latest`-prefixed aliases go to the newest release only", () => {
  for (const task of buildTasks().filter((task) => task.gitRef !== "25.12")) {
    assertEquals(
      task.tags.filter((tag) => tag.startsWith("latest")),
      [],
      `${task.name} leaked a latest alias`,
    );
  }
});

// These rtl_433 releases do not compile on these debian cycles; the pairing has
// to be dropped entirely rather than produce a failing build.
Deno.test("known-broken release/cycle pairs are dropped", () => {
  const trixie = createDebianBuildTasks(
    ["25.12", "19.08", "18.12"],
    new Map(),
    ["trixie"],
  );
  assertEquals(trixie.map((task) => task.gitRef), ["25.12", "19.08"]);

  const bookworm = createDebianBuildTasks(
    ["25.12", "19.08", "18.12"],
    new Map(),
    ["bookworm"],
  );
  assertEquals(bookworm.map((task) => task.gitRef), ["25.12"]);
});

Deno.test("an unlisted cycle drops nothing", () => {
  const tasks = createDebianBuildTasks(
    ["25.12", "19.08", "18.12"],
    new Map(),
    ["forky"],
  );

  assertEquals(tasks.map((task) => task.gitRef), ["25.12", "19.08", "18.12"]);
});

Deno.test("a ref with no known sha builds with an `unknown` sha rather than dropping out", () => {
  const tasks = createDebianBuildTasks(["25.12"], new Map(), DEBIAN_VERSIONS);

  assertEquals(tasks.length, 1);
  assertEquals(tasks[0].buildArgs.rtl433GitSha, "unknown");
  assertEquals(tasks[0].buildArgs.debianVersion, "trixie");
});

Deno.test("cache scope is keyed per base version and ref", () => {
  const task = buildTasks().find((task) => task.gitRef === "master")!;

  assertEquals(task.cacheFrom, "type=gha,scope=debian-trixie-master");
  assertEquals(task.cacheTo, task.cacheFrom);
});
