// packages
const core = require('@actions/core')
const github = require('@actions/github')

// modules
const lint = require('./lint.js')

const messageProps = { title: 'commit-lint' }

// exit early
if (!['pull_request', 'pull_request_target', 'push'].includes(github.context.eventName)) {
  core.warning(`action ran on unsupported event: ${github.context.eventName}`, messageProps)
  process.exit(0) // soft exit
}

// error handler
function errorHandler ({ message, stack }) {
  core.error(message, messageProps)
  core.debug(stack)
  process.exit(1)
}

// catch errors and exit
process.on('unhandledRejection', errorHandler)
process.on('uncaughtException', errorHandler)

// backward compatibility locally
if (!process.env.INPUT_TOKEN && process.env['INPUT_GITHUB-TOKEN']) {
  process.env.INPUT_TOKEN = process.env['INPUT_GITHUB-TOKEN']
}

// parse inputs
const inputs = {
  token: core.getInput('token', { required: true }),
  config: core.getInput('config', { required: true })
}

// extract the pull_request
const { payload } = github.context // eslint-disable-line camelcase

// initiate the client
const octokit = github.getOctokit(inputs.token)

const commits = []

async function main () {
  // handle Pul Requests
  if (['pull_request', 'pull_request_target'].includes(github.context.eventName)) {
    // fetch commits
    const { data } = await octokit.rest.pulls.listCommits({
      ...github.context.repo,
      pull_number: payload.pull_request.number
    })

    commits.push(...data)
  } else {
    commits.push(...payload.commits)
  }

  if (commits.length === 0) {
    core.error('no commits found', messageProps)
    process.exit(0) // soft exit
  }

  // process commits
  await lint({
    config: inputs.config,
    commits
  })
}

main()
