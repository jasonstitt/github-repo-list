# github-repo-list

CLI to export an inventory of one or more GitHub orgs into a CSV

## Usage

```
github-repo-list <org> [org...]

Options:
  --version      Show version number                                   [boolean]
  --token        GitHub API personal token (can also provide via GITHUB_TOKEN
                 env var or ~/.github-token)                            [string]
  --output, -o   Output filename          [string] [default: "github-repos.csv"]
  --include, -i  What types of repo to include in the output
             [array] [choices: "public", "private", "fork", "nonfork"] [default:
                                                 ["public","private","nonfork"]]
  -h, --help     Show help                                             [boolean]
```

## Authentication

This CLI uses a GitHub personal access token. See: [Creating a personal access token for the command line](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line).

You can provide the token in any of three ways:

- Put it in a file called `.github-token` in your home directory
- Export an environment variable `GITHUB_TOKEN`
- Pass it on the command line with `--token`

## Maintainers

* Jason Stitt
