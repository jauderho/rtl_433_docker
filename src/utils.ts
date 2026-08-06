import { retry, type RetryOptions } from "@std/async/retry";

/**
 * Fetch JSON, throwing on an error response instead of handing back the API's
 * error body. Retries server errors and 429s; anything else gives up at once,
 * since retrying a 403 or a 404 only burns more of the request budget.
 */
export const fetchJson = async <T>(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<T> => {
  const res = await retry(async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      ...init,
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    }
    return response;
  }, retryOptions);

  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`GET ${url} failed with HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
};

export const semUp = (sem: string, dots: number) =>
  sem.split(".").slice(0, dots).join(".");

export const semMinor = (sem: string) => semUp(sem, 2);

export const semMajor = (sem: string) => semUp(sem, 1);

const RTL433_TAG_REGEX = /^(\d+)\.(\d+)$/i;
export const sortRtl433TagsDesc = (tags: string[]) => {
  return tags
    .filter((tag) => RTL433_TAG_REGEX.test(tag))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
};

export const crossTagsAndRepos = (tags: string[], repos: string[]) => {
  return tags.flatMap((tag) => repos.map((repo) => `${repo}:${tag}`));
};

export const stringifyTagsWithRepos = (tags: string[], repos: string[]) =>
  crossTagsAndRepos(tags, repos).join("\n");

export const stringifyBuildArgs = (buildArgs: Record<string, string>) =>
  Object.entries(buildArgs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

export const stringifyPlatforms = (platforms: string[]) => platforms.join(",");

export const tagify = (str: string) =>
  str.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 128);
