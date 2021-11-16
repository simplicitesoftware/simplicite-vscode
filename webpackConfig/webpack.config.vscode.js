const path = require('path');
const webpack = require('webpack');

const webConfig = /** @type WebpackConfig */ {
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	target: 'webworker', // web extensions run in a webworker context
	entry: './src/extension.ts', // source of the web extension main file
	output: {
		filename: 'vscode-extension.js',
		path: path.join(__dirname, '../dist/'),
		libraryTarget: "commonjs2"	
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			assert: require.resolve('assert'),
			buffer: require.resolve('buffer/'),
			fs: require.resolve('path-browserify'),
			os: require.resolve('os-browserify/browser'),
			stream: require.resolve('stream-browserify'),
			path: require.resolve('path-browserify'),
			https: require.resolve('https-browserify'),
			timers: require.resolve('timers-browserify'),
			http: require.resolve('stream-http'),
			zlib: require.resolve('browserify-zlib'),
		},

	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	plugins: [
		new webpack.ProvidePlugin({
			process: 'process/browser', // provide a shim for the global `process` variable
		}),
	],
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'nosources-source-map', // create a source map that points to the original source file

};
module.exports = webConfig;