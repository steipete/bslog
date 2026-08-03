# Authentication

bslog uses two Better Stack authentication systems. Structured log commands usually need both because they resolve a source name before sending a query.

| Credential                      | Used for                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Telemetry API token             | Listing sources, reading source metadata, and resolving a source name to its team and table |
| Query API username and password | Reading log data and executing raw ClickHouse SQL                                           |

## Telemetry API token

In Better Stack, open **Settings → API tokens** and create or copy a Telemetry API token. Export it as:

```sh
export BETTERSTACK_API_TOKEN="your-telemetry-token"
```

The token is required by `sources list`, `sources get`, and every structured query that resolves a source name. The current client also requires it during startup for `sql`, even though raw SQL does not call the Telemetry API.

## Query API credentials

In Better Stack, open **Logs → Dashboards → Connect remotely**, create credentials in the SQL API section, and copy the password when it is shown. Export the pair as:

```sh
export BETTERSTACK_QUERY_USERNAME="your-query-username"
export BETTERSTACK_QUERY_PASSWORD="your-query-password"
```

These credentials are required for `tail`, `errors`, `warnings`, `search`, `trace`, `query`, and `sql`.

Keep credentials in your shell environment or a secret manager. bslog reads a `.env` file from the current directory for local development, but credentials should not be committed to the repository. The config file at `~/.bslog/config.json` stores non-secret defaults only.

## Query API region

The default Query API endpoint is `https://eu-nbg-2-connect.betterstackdata.com`. Query credentials are tied to the cluster where Better Stack created them. A valid pair returns an authentication error when sent to a different cluster.

Use the endpoint shown alongside your credentials under **Connect remotely**. Set it for one process with `BSLOG_QUERY_HOST`, or save it as the `queryBaseUrl` configuration key. The environment variable takes precedence over the saved value.

```sh
export BSLOG_QUERY_HOST="https://eu-fsn-3-connect.betterstackdata.com"
```

## Verify the setup

First verify the Telemetry API token:

```sh
bslog sources list
```

Then query a source returned by that command:

```sh
bslog tail my-app-production --limit 5
```

If source discovery succeeds but log queries return HTTP 403, compare `BSLOG_QUERY_HOST` or the saved `queryBaseUrl` with the cluster shown next to the Query API credentials.
