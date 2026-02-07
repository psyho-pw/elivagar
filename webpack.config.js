const { spawn } = require('child_process');
const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const cliDir = path.dirname(require.resolve('@nestjs/cli/package.json'));
const hotPoll = require.resolve('webpack/hot/poll', { paths: [cliDir] });

// --- tsgo type-check config resolution ---

function resolveTsConfigPath(options) {
  const entry = Array.isArray(options.entry)
    ? options.entry[0]
    : typeof options.entry === 'string'
      ? options.entry
      : '';

  const appMatch = String(entry).match(/apps[/\\]([^/\\]+)[/\\]/);
  if (appMatch) {
    return `apps/${appMatch[1]}/tsconfig.app.tsgo.json`;
  }
  return './tsconfig.tsgo.json';
}

// --- TsgoTypeCheckPlugin ---

class TsgoTypeCheckPlugin {
  constructor(options = {}) {
    this.configFile = options.configFile;
  }

  apply(compiler) {
    let isFirstCompilation = true;

    compiler.hooks.afterCompile.tapPromise('TsgoTypeCheckPlugin', (compilation) => {
      return new Promise((resolve) => {
        const child = spawn('tsgo', ['--noEmit', '-p', this.configFile], {
          stdio: 'inherit',
        });

        child.on('close', (code) => {
          if (code !== 0) {
            compilation.errors.push(new Error('tsgo type check failed'));
          }
          resolve();
        });
      });
    });

    compiler.hooks.shouldEmit.tap('TsgoTypeCheckPlugin', (compilation) => {
      if (isFirstCompilation) {
        isFirstCompilation = false;
        return true;
      }
      return compilation.errors.length === 0;
    });
  }
}

// --- webpack config factory ---

module.exports = function (options, webpack) {
  const tsgoConfigPath = resolveTsConfigPath(options);
  const isWatchMode = process.argv.includes('start') || process.argv.includes('--watch');

  const plugins = [new TsgoTypeCheckPlugin({ configFile: tsgoConfigPath })];

  if (!isWatchMode) {
    plugins.push(
      new webpack.DefinePlugin({
        'module.hot': 'undefined',
      }),
    );
  }

  if (isWatchMode) {
    plugins.push(new webpack.HotModuleReplacementPlugin());
    plugins.push(new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }));
    plugins.push({
      apply(compiler) {
        compiler.hooks.watchRun.tap('ClearConsolePlugin', () => {
          process.stdout.write('\x1Bc');
        });
      },
    });
  }

  return {
    ...options,
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
      buildDependencies: {
        config: [__filename],
      },
    },
    entry: isWatchMode ? [`${hotPoll}?100`, options.entry] : options.entry,
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
              compilerOptions: {
                sourceMap: true,
              },
            },
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      plugins: [
        new TsconfigPathsPlugin({
          configFile: './tsconfig.json',
        }),
      ],
      cache: true,
    },
    plugins: [...options.plugins, ...plugins],
  };
};
