# jev-router

A [Pi](https://pi.dev) package that adds a virtual model, `jev/auto`. For each new user task it asks the Jev classifier (`typesafe/jev-latest`) to pick:

- a physical chat model from the eligible catalog, and
- a thinking effort (`off` … `xhigh`).

Continuations, retries, and compaction reuse the previous decision, so a turn stays on one model.

## Install

Add to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "git:github.com/smg1024/jev-router"
  ],
  "defaultProvider": "jev",
  "defaultModel": "auto"
}
```

Or install directly:

```bash
pi install git:github.com/smg1024/jev-router
```

## Requirements

- `TYPESAFE_API_KEY` set (for the `typesafe/jev-latest` classifier).
- At least one physical chat model with credentials configured.
- For image prompts, at least one eligible model that accepts image input.

## Behavior

| Situation | Result |
|---|---|
| New user task | Jev picks a model and effort from the eligible catalog |
| `continuation` / `retry` | Reuses the previous (or failed) model and effort |
| `direct` (internal calls) | First eligible model, `low` effort, no classification |
| Scoped models set | Only those models are eligible |
| Virtual models (`pi-virtual`) | Never chosen as a target |

Errors are raised for: no eligible model, missing classifier, classifier failure, or an invalid classifier choice.

## Test

```bash
npm test
```

The test uses a mock Jev classifier and does not call any API.

## License

Unlicensed for now; add a `LICENSE` file before wider reuse.
