# gdspark-cli

CLI parser for GDS-style commands. It tokenizes and parses input into an AST JSON output.

## Requirements

- [Bun](https://bun.com)

## Install

```bash
bun install
```

## Run

Start interactive mode:

```bash
bun run index.ts
```

Then enter one command per line. The CLI prints parsed AST JSON for each line.

Exit commands:
- `exit`
- `quit`
- `:q`

## Commands Covered

The parser currently supports:

- `AN` availability lookup
- `SS` sell/select from availability
- `NM` passenger name input
- `APM` passenger mobile
- `APE` passenger email
- `TKTL` ticketing time limit
- `ER` end/save record
- `XE` delete line number
- `FXP` pricing on selected booking class
- `FXB` lowest available pricing
- `TTK` ticket issuance with quantity

## Syntax Notes

- `AN`: `ANDDMMMOOODDD` with optional `/AIRLINE`
- Example: `AN15SEPILOMNL`, `AN15SEPILOMNL/A5J`
- `SS`: compact format `SS<passengerCount><bookingClass><flightNumber>`
- Example: `SS1Y3`, `SS2T5`
- `NM`: one or more entries in `<count><SURNAME>/<Given>/<Given>` format, comma-separated for multiple entries; trailing title is supported
- Example: `NM1SMITH/John Mr`, `NM1SMITH/John,1ROXAS/Peter`
- `APM` / `APE`: accepts dashed and non-dashed value entry
- Example: `APM - 09171234567`, `APE - r@r.com`
- `TKTL`: compact date format `TKTLDDMMM`
- Example: `TKTL05MAR`
- `XE`: requires whitespace before integer line number
- Example: `XE 2`
- `TTK`: requires `/T<n>-<quantity>`
- Example: `TTK/T1-3`

## Examples

```text
AN15SEPILOMNL
AN15SEPILOMNL/A5J
SS1Y3
NM2SMITH/John/Peter Mr
APM - 09171234567
APE - r@r.com
TKTL05MAR
ER
XE 2
FXP
FXB
TTK/T1-3
```
