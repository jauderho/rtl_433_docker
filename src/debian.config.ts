import type { BuildTask } from "./main.ts";
import { fetchJson, sortRtl433TagsDesc } from "./utils.ts";

/**
 * The Debian base codenames to build against, newest first. Kept out of module
 * scope so importing this module performs no network IO.
 */
export const fetchDebianVersions = async (): Promise<string[]> => {
  const cycles = await fetchJson<Array<{ codename: string }>>(
    "https://endoflife.date/api/debian.json"
  );

  return cycles.slice(0, 1).map((cycle) => cycle.codename.toLocaleLowerCase());
};

const BROKEN_RTLVERSIONS_FOR_DEBIAN_CYCLES = new Map([
  ["bookworm", ["19.08", "18.12"]],
  ["trixie", ["18.12"]],
]);

const generateTags = (baseVersion: string, gitRef: string) => {
  const tags = [`${gitRef}-debian-${baseVersion}`];

  if (baseVersion === "latest") {
    tags.push(...[`${gitRef}-debian`]);
  }

  return tags;
};

export const createDebianBuildTasks = (
  gitRefs: string[],
  gitRefShas: Map<string, string>,
  debianVersions: string[]
): BuildTask[] => {
  const [latestGitRef] = sortRtl433TagsDesc(gitRefs);
  const latestDebianVersion = debianVersions[0];

  const variants = gitRefs.flatMap((gitRef) =>
    debianVersions.map((debianVersion) => {
      const isLatestGitRef = gitRef === latestGitRef;
      const isLatestBase = debianVersion === latestDebianVersion;
      return {
        gitRef,
        debianVersion,
        isLatestGitRef,
        isLatestBase,
      };
    })
  );

  const tasks: BuildTask[] = variants
    .filter(({ gitRef, debianVersion }) =>
      !(BROKEN_RTLVERSIONS_FOR_DEBIAN_CYCLES.get(debianVersion) ?? []).includes(
        gitRef
      )
    )
    .map(({ gitRef, debianVersion, isLatestGitRef, isLatestBase }) => {
      const tags = generateTags(debianVersion, gitRef);

      if (isLatestBase) {
        tags.push(...generateTags("latest", gitRef));
      }

      if (isLatestGitRef) {
        tags.push(...generateTags(debianVersion, "latest"));
      }

      if (isLatestBase && isLatestGitRef) {
        tags.push(...generateTags("latest", "latest"));
      }

      const gitSha = gitRefShas.get(gitRef) ?? "unknown";
      const cacheScope = `type=gha,scope=debian-${debianVersion}-${gitRef}`;

      return {
        name: `${gitRef}-debian-${debianVersion}`,
        gitRef: gitRef,
        context: "./images/debian/build-context",
        file: "./images/debian/build-context/Dockerfile",
        tags,
        buildArgs: {
          rtl433GitVersion: gitRef,
          rtl433GitSha: gitSha,
          debianVersion: debianVersion,
        },
        platforms: [
          "linux/amd64",
          "linux/arm64/v8",
          "linux/arm/v7",
        ],
        cacheFrom: cacheScope,
        cacheTo: cacheScope,
      };
    });

  return tasks;
};
