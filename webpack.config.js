const path = require('path');

module.exports = {
  entry: './src/frontend/app.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist/frontend'),
    filename: 'app.js'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.css']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  externals: {
    electron: 'commonjs electron'
  }
};
