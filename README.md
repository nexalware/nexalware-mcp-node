# @nexalware/mcp

[Nexalware](https://nexalware.com) as an [MCP](https://modelcontextprotocol.io) server, over stdio. Point any MCP-aware host (Claude Desktop, Claude Code, Cursor, etc.) at it, and your device control tools show up automatically, the host's own model decides when to call them. It's a thin wrapper around the [TypeScript SDK](https://www.npmjs.com/package/@nexalware/sdk), same operations, same permissions, just discoverable instead of hand-coded.

Building your own agent instead of using a pre-built host? Use the SDK directly, in [TypeScript](https://www.npmjs.com/package/@nexalware/sdk) or [Python](https://pypi.org/project/nexalware/). It's one function call away in code you already control, no subprocess or protocol discovery needed.

## Get an API key

Create one on the [dashboard](https://nexalware.com) (API Keys), scoped with a DeviceGrant to only the device(s) this agent should touch. This key ends up sitting in a local config file, least privilege matters more here than for a typical server-side integration.

## Claude Code

```bash
claude mcp add nexalware -e NEXALWARE_API_KEY=nxw_live_sk_your_key_here -- npx -y @nexalware/mcp
```

## Claude Desktop, or any host using a `mcpServers` config file

Add this block to the host's MCP config (Claude Desktop: Settings -> Developer -> Edit Config):

```json
{
  "mcpServers": {
    "nexalware": {
      "command": "npx",
      "args": ["-y", "@nexalware/mcp"],
      "env": {
        "NEXALWARE_API_KEY": "nxw_live_sk_your_key_here"
      }
    }
  }
}
```

Restart the host afterward, tools only load at startup.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `NEXALWARE_API_KEY` | yes | The key from the step above. The server exits immediately with an error if this is missing. |
| `NEXALWARE_API_URL` | no | Override for a self-hosted or staging deployment. Defaults to the production API. |

Using `npx -y @nexalware/mcp` (not a pinned version) means every launch runs the latest published release, no separate update step.

## Troubleshooting

**`Invalid API key`** — either a placeholder was never replaced (`nxw_live_sk_your_key_here` sent as-is fails exactly like this, not with a clearer error), or a server process from *before* you changed the key is still running. Fully restart the host after any key/command change (for VS Code: *File → Exit*, then reopen) — `claude mcp list` can show `Connected` while an already-open session is still talking to a stale process holding the old key.

**Windows PowerShell 5.1 drops a bare `--`,** so `claude mcp add` fails with `error: unknown option '-y'`. Quote it:

```powershell
claude mcp add nexalware --scope user -e "NEXALWARE_API_KEY=nxw_live_sk_your_key_here" '--' npx -y '@nexalware/mcp'
```

**If the server times out or keeps disconnecting,** `npx -y` contacts the npm registry on every start, which can exceed the client's startup timeout on a slow connection. Install the package once and run it with `node` directly instead:

```powershell
npm install -g @nexalware/mcp
claude mcp remove nexalware --scope user
claude mcp add nexalware --scope user -e "NEXALWARE_API_KEY=nxw_live_sk_your_key_here" '--' node "$(npm config get prefix)\node_modules\@nexalware\mcp\dist\bin\nexalware-mcp.js"
```

Run `npm install -g @nexalware/mcp` again whenever you want to update, since this method skips the auto-latest behavior described above.

## Tools

Every tool takes and returns the same shape as its equivalent TypeScript SDK method, a failed call comes back as a normal MCP tool error with the same message the API itself returns, not a crash. The model reads each tool's parameter descriptions straight from its schema at call time, the breakdown below is the same information, written out for a human deciding what to wire up or debugging what the agent just did.

### `list_devices`

The devices this key can actually act on, only what its own DeviceGrant(s) cover, never the rest of the account. The natural first call, an agent that doesn't already know a `deviceId` starts here instead of guessing one.

- **`projectId`** (string, optional) — Narrow the list to one project. Leave it out to list every device this key can reach.

### `get_device_commands`

The command catalog a device accepts, so the agent knows what `cmd` values are actually valid before calling `send_command`.

- **`deviceId`** (string, required) — From a prior `list_devices` call, shaped like `dev_a1b2c3`.

### `send_command`

The general-purpose way to make a device do something.

- **`deviceId`** (string, required) — Which device to command.
- **`cmd`** (string, required) — Must match a `name` from `get_device_commands`, case-sensitive.
- **`params`** (object, optional) — Only if that command's catalog entry declares a `paramsSchema`, shape depends entirely on the specific command.

### `turn_device_on` / `turn_device_off`

Shorthand for the `ON`/`OFF` command.

- **`deviceId`** (string, required) — Which device to turn on/off.

### `get_device_telemetry`

Historical telemetry readings, newest first.

- **`deviceId`** (string, required) — Which device's history to read.
- **`metric`** (string, optional) — Only this metric name, e.g. `power_draw`. Omit to get every metric.
- **`limit`** (number, optional) — Max rows, 1-1000, defaults to 100.
- **`since`** (number, optional) — Unix **milliseconds**, only readings at or after this time.

### `get_latest_telemetry`

Current state plus the most recent reading per metric, in one call.

- **`deviceId`** (string, required) — Which device to snapshot.

### `list_sub_devices`

Physical devices connected locally behind this one, if it's acting as a master. Empty until the master's own firmware reports one.

- **`deviceId`** (string, required) — The **master** device's id, not a sub-device id.

### `get_sub_device`

One sub-device's current state and capabilities.

- **`deviceId`** (string, required) — The master device's id.
- **`subDeviceId`** (string, required) — From a prior `list_sub_devices` call, shaped like `sub_x1y2z3`.

### `get_sub_device_telemetry`

Same idea as `get_device_telemetry`, scoped to one sub-device.

- **`deviceId`** (string, required) — The master device's id.
- **`subDeviceId`** (string, required) — Which sub-device's history to read.
- **`metric` / `limit` / `since`** (optional) — Same meaning as in `get_device_telemetry`.

### `send_sub_device_command`

Send a command to one sub-device behind a master, instead of the master itself.

- **`deviceId`** (string, required) — The master device's id.
- **`subDeviceId`** (string, required) — Which sub-device to target.
- **`cmd`** (string, required) — Whatever command name the sub-device itself declared it accepts (its own vocabulary, not a Nexalware-defined catalog).
- **`params`** (object, optional) — Arguments for that command, if it needs any.

### `list_schedules`

A device's active (`PENDING` or `ACTIVE`) schedules.

- **`deviceId`** (string, required) — Which device's schedules to list.

### `get_schedule_context`

The commands available to schedule for a device, same catalog as `get_device_commands`.

- **`deviceId`** (string, required) — Which device to check.

### `create_schedule`

Create or replace one of a device's 5 schedule slots, firing `onCommand` at `onTs` and `offCommand` at `offTs`. Calling this again with the same `slot` overwrites what was there.

- **`deviceId`** (string, required) — Which device to schedule.
- **`slot`** (number, required) — Which of the 5 fixed slots to use, an integer **0 to 4**.
- **`onTs`** (number, required) — Unix **seconds** to fire `onCommand`.
- **`offTs`** (number, required) — Unix seconds to fire `offCommand`.
- **`label`** (string, optional) — Shown on the dashboard, **max 7 characters**.
- **`enabled`** (boolean, optional) — Omit to default enabled; `false` creates it disabled.
- **`onCommand`** (object, optional) — `{ command, params? }`. Defaults to `{ command: "ON" }` if omitted.
- **`offCommand`** (object, optional) — Same shape, defaults to `{ command: "OFF" }`.

### `update_schedule`

Update an existing schedule slot, only the fields provided are changed.

- **`deviceId`** (string, required) — Which device's schedule to update.
- **`slot`** (number, required) — Which slot (0-4), must already exist.
- **`onTs` / `offTs` / `label` / `enabled` / `onCommand` / `offCommand`** (all optional) — Same meaning as in `create_schedule`, include only what's changing.

### `delete_schedule`

Cancel a schedule slot.

- **`deviceId`** (string, required) — Which device's schedule to cancel.
- **`slot`** (number, required) — Which slot (0-4) to cancel.

### `get_schedule_history`

A device's completed or cancelled schedules, most recent first.

- **`deviceId`** (string, required) — Which device to check.

## What it can't do

Nothing outside the calling key's own DeviceGrant. There's no tool to create a grant, register a device, or manage API keys, those stay dashboard-only, an MCP tool call is only ever as capable as the key you gave it, never able to expand its own access.

`create_schedule`/`update_schedule` fire existing commands from a device's catalog, they can't invent new ones. Defining, editing, or deleting a command definition itself stays a dashboard-only action.

## Links

- [Full docs](https://docs.nexalware.com/docs/sdk/mcp-server)
- [SDK Reference (TypeScript)](https://docs.nexalware.com/docs/sdk/sdk) / [SDK Reference (Python)](https://docs.nexalware.com/docs/sdk/sdk-python) - the same operations, called directly from your own code.
- [Device Orchestration](https://docs.nexalware.com/docs/device-orchestration) - what `list_sub_devices`/`send_sub_device_command` actually operate on.

## License

MIT
