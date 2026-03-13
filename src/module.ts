import { PanelPlugin } from '@grafana/data';
import { SloBurnPanel } from './components/SloBurnPanel';
import { SloBurnOptions } from './types';

export const plugin = new PanelPlugin<SloBurnOptions>(SloBurnPanel).setPanelOptions((builder) => {
  return builder
    .addNumberInput({
      path: 'sloTarget',
      name: 'SLO Target (%)',
      description: 'Service Level Objective as a percentage (e.g. 99.9).',
      defaultValue: 99.9,
      settings: { min: 50, max: 100, step: 0.01 },
      category: ['SLO'],
    })
    .addNumberInput({
      path: 'windowDays',
      name: 'Compliance Window (days)',
      description: 'Rolling compliance window in days (typically 7, 28 or 30).',
      defaultValue: 30,
      settings: { min: 1, max: 365, integer: true },
      category: ['SLO'],
    })
    .addBooleanSwitch({
      path: 'isErrorRatio',
      name: 'Input is Error Ratio',
      description: 'Enable if the input series represents error ratio (0–1). Disable if it represents success ratio.',
      defaultValue: true,
      category: ['SLO'],
    })
    .addTextInput({
      path: 'seriesFieldHint',
      name: 'Series Field Hint',
      description: 'Optional field name to prioritize when multiple numeric fields exist.',
      defaultValue: '',
      category: ['Data'],
    })
    .addNumberInput({
      path: 'shortWindow',
      name: 'Short Burn Window (points)',
      description: 'Number of recent points for fast-burn detection (maps to ~1h alert window).',
      defaultValue: 12,
      settings: { min: 2, max: 200, integer: true },
      category: ['Detection'],
    })
    .addNumberInput({
      path: 'longWindow',
      name: 'Long Burn Window (points)',
      description: 'Number of recent points for slow-burn detection (maps to ~6h alert window).',
      defaultValue: 72,
      settings: { min: 5, max: 1000, integer: true },
      category: ['Detection'],
    });
});
