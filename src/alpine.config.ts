import type { BuildTask } from "./main.ts";
import { fetchJson, semMajor, semMinor, sortRtl433TagsDesc } from "./utils.ts";

/**
 * The Alpine base versions to build against, newest first. Kept out of module
 * scope so importing this module performs no network IO.
 */
export const fetchAlpineVersions = async (): Promise<string[]> => {
  const cycles = await fetchJson<Array<{ latest: string }>>(
    "https://endoflife.date/api/alpine-linux.json"
  );

  return cycles.slice(0, 1).map((cycle) => cycle.latest);
};

const generateTags = (baseVersion: string, gitRef: string) => {
  const tags = [`${gitRef}-alpine-${baseVersion}`];

  if (baseVersion.includes(".")) {
    tags.push(
      ...[
        `${gitRef}-alpine-${semMinor(baseVersion)}`,
        `${gitRef}-alpine-${semMajor(baseVersion)}`,
      ]
    );
  }

  if (baseVersion === "latest") {
    tags.push(...[`${gitRef}-alpine`]);
  }

  return tags;
};

export const createAlpineBuildTasks = (
  gitRefs: string[],
  gitRefShas: Map<string, string>,
  alpineVersions: string[]
): BuildTask[] => {
  const [latestGitRef] = sortRtl433TagsDesc(gitRefs);
  const latestAlpineVersion = alpineVersions[0];

  const variants = gitRefs.flatMap((gitRef) =>
    alpineVersions.map((alpineVersion) => {
      const isLatestGitRef = gitRef === latestGitRef;
      const isLatestBase = alpineVersion === latestAlpineVersion;
      return {
        gitRef,
        alpineVersion,
        isLatestGitRef,
        isLatestBase,
      };
    })
  );

  const tasks: BuildTask[] = variants.map(
    ({ gitRef, alpineVersion, isLatestBase, isLatestGitRef }) => {
      const tags = generateTags(alpineVersion, gitRef);

      if (isLatestGitRef) {
        tags.push(...generateTags(alpineVersion, "latest"));
      }

      if (isLatestBase) {
        tags.push(...generateTags("latest", gitRef));
        tags.push(`${gitRef}`);
      }

      if (isLatestGitRef && isLatestBase) {
        tags.push(...generateTags("latest", "latest"));
        tags.push("latest");
      }

      const gitSha = gitRefShas.get(gitRef) ?? "unknown";
      const cacheScope = `type=gha,scope=alpine-${alpineVersion}-${gitRef}`;

      return {
        name: `${gitRef}-alpine-${alpineVersion}`,
        gitRef: gitRef,
        context: "./images/alpine/build-context",
        file: "./images/alpine/build-context/Dockerfile",
        tags,
        buildArgs: {
          rtl433GitVersion: gitRef,
          rtl433GitSha: gitSha,
          alpineVersion: alpineVersion,
        },
        platforms: [
          "linux/amd64",
          "linux/arm64/v8",
          "linux/arm/v6",
          "linux/arm/v7",
        ],
        cacheFrom: cacheScope,
        cacheTo: cacheScope,
      };
    }
  );

  return tasks;
};
