const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/content-script': './src/content/content-script.ts',
    'popup/popup': './src/popup/popup.tsx',
    'offscreen/offscreen-document': './src/offscreen/offscreen-document.ts'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
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
  
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx']
  },
  
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/offscreen/offscreen-document.html', to: 'offscreen/offscreen-document.html' },
        { from: 'src/content/content-script.css', to: 'content/content-script.css' },
        { from: 'src/components/GradingOverlay.css', to: 'components/GradingOverlay.css' },
        { from: 'icons', to: 'icons', noErrorOnMissing: true },
        // Copy Tesseract.js worker files
        { from: 'node_modules/tesseract.js/dist/worker.min.js', to: 'tesseract/worker.min.js' },
        { from: 'node_modules/tesseract.js-core/tesseract-core.wasm.js', to: 'tesseract/tesseract-core.wasm.js', noErrorOnMissing: true },
        { from: 'node_modules/tesseract.js-core/tesseract-core-simd.wasm.js', to: 'tesseract/tesseract-core-simd.wasm.js', noErrorOnMissing: true }
      ]
    })
  ],
  
  mode: 'development',
  devtool: 'source-map'
};
