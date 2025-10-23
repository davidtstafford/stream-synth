const path = require('path');

module.exports = {
  entry: './src/frontend/app.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist/frontend'),
    filename: 'app.js'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  externals: {
    electron: 'commonjs electron'
  }
};
