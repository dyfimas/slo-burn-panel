# SLO Burn Rate Panel for Grafana

[![Grafana](https://img.shields.io/badge/Grafana-%3E%3D11.0.0-orange)](https://grafana.com)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/dyfimas/slo-burn-panel/blob/main/LICENSE)

Real-time SLO burn rate tracking for Grafana, built on the [Google SRE multi-window burn rate](https://sre.google/workbook/alerting-on-slos/) methodology. No Grafana Cloud required.

![SLO Burn Rate Panel](https://raw.githubusercontent.com/dyfimas/slo-burn-panel/main/src/img/screenshot-panel.svg)

## Features

- **Error Budget Gauge** — semicircular gauge showing remaining error budget at a glance
- **Multi-Window Burn Rate** — short window (fast burn) and long window (slow burn) detection following Google SRE practices
- **4 Operational States** — `SAFE` → `SLOW BURN` → `FAST BURN` → `EXHAUSTED`
- **Burn Rate Timeline** — sparkline showing per-point burn rate with 1x threshold line
- **Budget Consumption Bar** — real-time budget consumption percentage
- **Projected Exhaustion** — estimates when error budget will run out at current burn rate
- **Demo Mode** — built-in simulated data with incident and recovery when no datasource is configured
- **Works with any datasource** — Prometheus, Elasticsearch, Loki, TestData, or anything that returns numeric series

## How It Works

The panel takes a numeric time series representing **error ratio** (or success ratio) with values between 0 and 1, and calculates:

| Metric | Description |
|--------|-------------|
| **Error Budget** | `1 - SLO target` (e.g., 0.001 for 99.9% SLO) |
| **Burn Rate** | `observed_error_rate / allowed_error_rate` — a burn rate of 1x means you're consuming budget exactly at the sustainable rate |
| **Short Burn** | Mean burn rate over a short window (default 12 points, ~1h) — detects fast incidents |
| **Long Burn** | Mean burn rate over a long window (default 72 points, ~6h) — detects slow degradation |
| **Budget Consumed** | Overall burn rate as fraction of total budget |
| **Projected Exhaustion** | Days until budget is fully consumed at current rate |

### Status Logic

| Status | Condition |
|--------|-----------|
| **SAFE** | Long burn rate < 1x |
| **SLOW BURN** | Long burn rate ≥ 1x |
| **FAST BURN** | Short burn ≥ 6x AND long burn ≥ 3x |
| **EXHAUSTED** | Budget consumed ≥ 100% |

## Installation

### From Grafana Plugin Catalog (recommended)

Search for **"SLO Burn Rate"** in Grafana → Administration → Plugins.

### Manual Installation

```bash
# Download the latest release
wget https://github.com/dyfimas/slo-burn-panel/releases/latest/download/dyfimas-sloburn-panel-latest.zip

# Extract to Grafana plugins directory
unzip dyfimas-sloburn-panel-latest.zip -d /var/lib/grafana/plugins/

# Restart Grafana
systemctl restart grafana-server
```

### Docker

```yaml
volumes:
  - ./plugins/slo-burn-panel/dist:/var/lib/grafana/plugins/dyfimas-sloburn-panel
environment:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "dyfimas-sloburn-panel"
```

## Configuration

### Panel Options

| Option | Default | Description |
|--------|---------|-------------|
| **SLO Target (%)** | 99.9 | Service Level Objective percentage (50–100) |
| **Compliance Window (days)** | 30 | Rolling window for budget calculation (1–365) |
| **Input is Error Ratio** | true | Toggle between error ratio (0–1) and success ratio input |
| **Series Field Hint** | _(empty)_ | Field name hint when multiple numeric fields exist |
| **Short Burn Window** | 12 | Points for fast-burn detection (~1h with 5min intervals) |
| **Long Burn Window** | 72 | Points for slow-burn detection (~6h with 5min intervals) |

### Example Prometheus Queries

```promql
# Error ratio from HTTP requests
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

```promql
# Error ratio from probe success
1 - probe_success
```

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode (hot-reload)
npm run dev

# Type checking
npm run typecheck
```

## Requirements

- Grafana ≥ 11.0.0
- Input: numeric time series with values between 0 and 1

## License

[Apache License 2.0](https://github.com/dyfimas/slo-burn-panel/blob/main/LICENSE)

## Author

**Dylan Fiego** — [@dyfimas](https://github.com/dyfimas)
