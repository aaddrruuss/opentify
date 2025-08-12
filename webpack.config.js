const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

module.exports = {
  mode: 'development',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
    }),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('CopyIconPlugin', () => {
          const srcPath = path.resolve(__dirname, 'assets/images/icon.png');
          const destPath = path.resolve(__dirname, 'dist/icon.png');
          try {
            if (fs.existsSync(srcPath)) {
              fs.copyFileSync(srcPath, destPath);
              console.log('✅ Icon copied to dist/icon.png');
            } else {
              console.warn('⚠️ Icon source not found:', srcPath);
            }
          } catch (error) {
            console.error('❌ Error copying icon:', error);
          }
        });
      },
    },
  ],
};