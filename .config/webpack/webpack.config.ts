import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { type Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
// @ts-ignore – no types
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
// @ts-ignore – no types
import LiveReloadPlugin from 'webpack-livereload-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.resolve(ROOT, 'dist');

const pkg = JSON.parse(readFileSync(path.resolve(ROOT, 'package.json'), 'utf-8'));

const config = (env: Record<string, string>): Configuration => {
  const isProduction =
    env.production === 'true' || env.production === '';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    context: ROOT,
    entry: {
      module: './src/module.ts',
    },
    output: {
      path: DIST,
      filename: '[name].js',
      library: { type: 'amd' },
      clean: true,
    },
    externals: [
      'react',
      'react-dom',
      '@grafana/data',
      '@grafana/ui',
      '@grafana/runtime',
      '@grafana/schema',
      'lodash',
      'emotion',
      '@emotion/css',
      '@emotion/react',
    ],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript', tsx: true },
                transform: { react: { runtime: 'automatic' } },
                target: 'es2021',
              },
            },
          },
        },
      ],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/plugin.json', to: 'plugin.json' },
          { from: 'src/img', to: 'img', noErrorOnMissing: true },
          { from: 'README.md', to: 'README.md', noErrorOnMissing: true },
          { from: 'LICENSE', to: '.', noErrorOnMissing: true },
          { from: 'CHANGELOG.md', to: 'CHANGELOG.md', noErrorOnMissing: true },
        ],
      }),
      new ForkTsCheckerWebpackPlugin({
        typescript: { configFile: path.resolve(ROOT, 'tsconfig.json') },
      }),
      new ReplaceInFileWebpackPlugin([
        {
          dir: DIST,
          files: ['plugin.json'],
          rules: [
            { search: '%VERSION%', replace: pkg.version },
            { search: '%TODAY%', replace: new Date().toISOString().slice(0, 10) },
          ],
        },
      ]),
      ...(!isProduction
        ? [new LiveReloadPlugin({ appendScriptTag: false })]
        : []),
    ],
  };
};

export default config;
