#!/usr/bin/env node

const yargs = require('yargs');
const fs = require('fs');
const { homedir } = require('os');
const path = require('path');
const got = require('got');
const Promise = require('bluebird');
const ora = require('ora');
const csv = require('@fast-csv/format');

const spinner = ora();

if (!module.parent) {
  (async () => {
    try {
      await cli();
    } catch (err) {
      spinner.fail(err.message);
      process.exit(1);
    }
  })();
}

async function cli () {
  const args = yargs
    .option('token', {
      type: 'string',
      description: 'GitHub API personal token (can also provide via GITHUB_TOKEN env var or ~/.github-token)'
    })
    .option('output', {
      type: 'string',
      alias: 'o',
      description: 'Output filename',
      default: 'github-repos.csv'
    })
    .option('include', {
      type: 'array',
      alias: 'i',
      description: 'What types of repo to include in the output',
      choices: ['public', 'private', 'fork', 'nonfork'],
      default: ['public', 'private', 'nonfork']
    })
    .alias('h', 'help')
    .usage('$0 <org> [org...]')
    .demandCommand()
    .strict()
    .parse();

  spinner.start('Fetching repositories');
  const token = githubTokenChain(args);
  const api = got.extend({
    prefixUrl: 'https://api.github.com/',
    responseType: 'json',
    headers: {
      authorization: `token ${token}`
    }
  });
  const orgs = args._;
  const repos = [].concat(...await Promise.mapSeries(orgs, org => getRepos(api, org)));
  repos.sort((a, b) => a.full_name.localeCompare(b.full_name));
  const include = new Set(args.include);
  const filtered = repos.filter(repo => {
    return (
      ((repo.fork && include.has('fork')) || (!repo.fork && include.has('nonfork'))) &&
      ((repo.private && include.has('private')) || (!repo.private && include.has('public')))
    );
  });

  spinner.start('Fetching last commits');
  await Promise.map(filtered, async repo => {
    repo.last_commit_date = await getLastCommitDate(api, repo.full_name);
  }, { concurrency: 5 });

  spinner.start('Writing CSV');
  const csvFilename = args.output;
  await csv.writeToPath(csvFilename, filtered, {
    headers: ['URL', 'Private', 'Fork', 'Language', 'LastCommitDate', 'LastCommitYear', 'Description'],
    alwaysWriteHeaders: true,
    includeEndRowDelimiter: true,
    transform: row => [
      row.html_url,
      row.private,
      row.fork,
      row.language,
      row.last_commit_date,
      row.last_commit_date && row.last_commit_date.substr(0, 4),
      row.description
    ]
  });
  spinner.succeed(`Wrote ${csvFilename}`);
}

function githubTokenChain (args) {
  if (args.token) {
    return args.token;
  }
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  try {
    return fs.readFileSync(path.join(homedir(), '.github-token'), 'utf-8').trim();
  } catch (err) {
    throw new Error('Could not load GitHub token from any source (argument, env, .github-token file)');
  }
}

const githubPaginator = {
  paginate: (res, all, items) => {
    const params = res.request.options.searchParams;
    const page = Number(params.get('page') || 1);
    const perPage = Number(params.get('per_page') || 100);
    if (items.length < perPage) {
      return false;
    }
    return { searchParams: { page: page + 1 } };
  }
};

async function getRepos (api, org) {
  return api.paginate.all(`orgs/${org}/repos`, {
    searchParams: { per_page: 100, page: 1 },
    pagination: githubPaginator
  });
}

async function getLastCommitDate (api, fullName) {
  try {
    const res = await api(`${fullName}/commits?per_page=1`);
    const lastCommit = res && res.body.length && res.body[0];
    const date = lastCommit && lastCommit.commit.committer.date;
    return date || null;
  } catch (err) {
    if (err.response && err.response.statusCode < 500) {
      return null;
    }
    throw err;
  }
}

module.exports = {
  githubTokenChain,
  githubPaginator,
  getRepos,
  getLastCommitDate
};
