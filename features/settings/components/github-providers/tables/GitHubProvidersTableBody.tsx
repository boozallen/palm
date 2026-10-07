import GitHubProviderRow from './GitHubProviderRow';

type GitHubProvider = {
  id: string;
  label: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  isSkillRepo: boolean;
  skillRepoBranch: string | null;
  skillRepoServiceUrl: string | null;
  skillRepoLastSyncAt: string | null;
  skillRepoLastSyncCommit: string | null;
};

type GitHubProvidersTableBodyProps = {
  githubProviders: GitHubProvider[];
};

export default function GitHubProvidersTableBody({
  githubProviders,
}: Readonly<GitHubProvidersTableBodyProps>) {
  return (
    <tbody>
      {githubProviders.map((provider) => (
        <GitHubProviderRow key={provider.id} provider={provider} />
      ))}
    </tbody>
  );
}
