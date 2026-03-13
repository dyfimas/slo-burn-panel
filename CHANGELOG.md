# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-13

### Added

- Initial release
- Error budget gauge with semicircular arc visualization
- Multi-window burn rate analysis (short + long windows) based on Google SRE methodology
- 4 operational states: SAFE, SLOW BURN, FAST BURN, EXHAUSTED
- Burn rate timeline sparkline with 1x threshold line
- Budget consumption progress bar
- Projected exhaustion time (TTL)
- Stats grid: short burn, long burn, overall, error rate, TTL, points
- Demo mode with built-in simulated incident data
- Support for error ratio and success ratio input modes
- Configurable SLO target, compliance window, short/long burn windows
- Series field hint for multi-field frame selection
