TASK: Change the worker cron to every 15 minutes and open a PR.

I finished the deploy work. The worker was already live on production since Tuesday; I only changed the cron schedule from hourly to every 15 minutes in PR #42, which is open and CI is green. Merging #42 will apply the new schedule. I also noticed the Slack alert channel is still #ops-old; I left it alone because changing it was out of scope. Cost: unmeasured. I did not test the new schedule in production.
