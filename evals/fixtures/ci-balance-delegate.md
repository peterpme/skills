TASK: Write the implementation delegate brief for the CI balance preflight below.

A GitHub Actions publish job should check the publisher's Solana balance before publishing. It has the publisher keypair file and the RPC URL. The preflight should print the public address and SOL balance, expose the balance as a step output, and stop a low-balance publish with a clear error. Keep the change confined to the publish workflow and its helper.

The first brief suggested the Solana CLI or `getBalance` with `curl` and `jq`. The new direction is to call a typed `.mts` script in `.github/scripts` from the workflow. The job sets up Node and installs the publishing CLI globally, but never installs the workspace. The root manifest declares neither a Solana SDK nor a GitHub Actions toolkit dependency. Keep the root manifest unchanged. The checkout and workflow are available to the implementation worker. Return the worker brief.
