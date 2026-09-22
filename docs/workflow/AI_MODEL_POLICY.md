# AI Model Selection Policy

**Policy version:** 1  
**Last verified:** 2026-09-22  
**Applies to:** repository/Codex/Work tasks for FPL and Fantacalcio

This policy has two layers:
1. stable capability classes that should rarely change;
2. a dated mapping to currently available OpenAI models.

If OpenAI changes availability, limits or model names, propose a Layer 2 update and wait for Vuk's approval before changing this file.

## Primary principle

Optimize four resources together:
1. Vuk's time;
2. model/Codex allowance;
3. project reliability;
4. durable project context.

Use the cheapest/lowest-effort configuration that is likely to complete the task correctly. Do not sacrifice correctness, security, data integrity or statistical validity merely to save usage.

Model choice and reasoning effort are separate decisions.

## Layer 1 — capability classes

| Class | Typical work | Default reasoning posture |
|---|---|---|
| Fast / Mechanical | typo fixes, tiny UI edits, renames, formatting, small deterministic changes, targeted extraction | Low |
| Standard Development | ordinary feature implementation, tests, contained debugging, existing-architecture integration, small schema changes | Medium |
| Deep Reasoning | multi-file/system bugs, race conditions, data pipelines, migrations, security, substantial audits | Medium or High |
| Frontier / Escalation | novel architecture, ML methodology, leakage prevention, auction optimization, difficult unfamiliar failures | Low or Medium first; High only when justified |

## Layer 2 — current model mapping

Current official OpenAI guidance for Plus in Work/Codex exposes GPT-6 Astra plus GPT-5.6 Sol, Terra and Luna, with account/workspace availability still authoritative.

| Capability class | Default | Escalation |
|---|---|---|
| Fast / Mechanical | GPT-5.6 Luna — Low | GPT-5.6 Terra — Low |
| Standard Development | GPT-5.6 Terra — Medium | GPT-5.6 Sol — Medium |
| Deep Reasoning | GPT-5.6 Sol — High | GPT-6 Astra — Low/Medium |
| Frontier / Escalation | GPT-6 Astra — Low or Medium | GPT-6 Astra — High only exceptionally |

Astra Low can be preferable to Sol High for difficult novel work. Higher effort is not automatically better and can consume more allowance.

### Plus Work/Codex usage guidance

OpenAI currently publishes approximate local-message ranges per five-hour period, not hard message limits:

| Model | Plus estimate |
|---|---:|
| GPT-6 Astra | 5–45 |
| GPT-5.6 Sol | 10–100 |
| GPT-5.6 Terra | 25–200 |
| GPT-5.6 Luna | 250–2,000 |

Actual consumption depends on context size, tools, task length and reasoning effort; weekly limits may also apply. Check the account's actual **Settings → Usage** before unusually large work.

Official references:
- https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex
- https://help.openai.com/en/articles/20001275

## Task-selection examples

| Task | Recommended starting point |
|---|---|
| Rename / typo / tiny CSS / mechanical test edit | Luna Low |
| Small deterministic code change | Terra Low or Medium |
| Normal feature in approved architecture | Terra Medium |
| Normal multi-file implementation | Sol Medium |
| Contained bug investigation | Terra Medium; escalate to Sol Medium if needed |
| Multi-system bug / race condition | Sol High |
| PR architecture review | Sol High |
| Supabase/RLS/security design | Sol High; Astra Low if unusually complex |
| Data-pipeline architecture | Sol High or Astra Low |
| ML feature methodology | Astra Medium |
| Leakage audit design | Astra Medium |
| Auction optimizer architecture | Astra Medium |
| Large novel whole-project audit | Astra Medium |
| Repetitive extraction/research collection | Luna or Terra |
| Final synthesis of large unfamiliar research | Sol High or Astra Low/Medium |

## Escalation triggers

Escalate when:
- the first attempt exposes unexpected complexity;
- several systems interact;
- repository state contradicts documentation;
- there is significant data-loss/security/architecture risk;
- statistical or ML reasoning is materially difficult;
- repeated debugging attempts fail;
- the current result remains uncertain after inspection.

Do not escalate merely because a task is long.

## Execution choice

For every meaningful task, classify execution as:
- **Codex** — repository work/tests/multi-file inspection benefit from automation;
- **Manual** — Vuk can complete it more quickly/safely through a short UI or physical action;
- **Hybrid** — Codex implements/tests; Vuk performs one minimal real-device/dashboard/subjective check.

## Context efficiency

- Retrieve only task-relevant Second Brain notes.
- Avoid rereading unchanged giant files.
- Use targeted repository searches.
- Reuse stable approved decisions.
- Prefer delta review over full re-audit when a trusted baseline exists.
- Do not regenerate large reports when a small evidence delta is sufficient.
- Increase context only when correctness requires it.
