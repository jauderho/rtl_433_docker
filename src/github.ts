import { fetchJson } from "./utils.ts";

// Unauthenticated calls get 60 requests/hour per IP, which the nightly build
// has repeatedly exhausted. A token lifts this to 1000+.
const githubHeaders = (): HeadersInit => {
  const token = Deno.env.get("GITHUB_TOKEN");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface GithubRepoTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  zipball_url: string;
  tarball_url: string;
  node_id: string;
}

export const getGithubRepoTags = (repo: string): Promise<GithubRepoTag[]> =>
  fetchJson<GithubRepoTag[]>(`https://api.github.com/repos/${repo}/tags`, {
    headers: githubHeaders(),
  });

export interface GithubCommit {
  sha: string;
  url: string;
}

export const getGithubRefCommit = (
  repo: string,
  ref: string,
): Promise<GithubCommit> =>
  fetchJson<GithubCommit>(
    `https://api.github.com/repos/${repo}/commits/${ref}`,
    { headers: githubHeaders() },
  );
