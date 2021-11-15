import path from 'path';
import webpack from 'webpack';

const __dirname = path.resolve();

const webConfig = /** @type WebpackConfig */ {
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	target: 'webworker', // web extensions run in a webworker context
	entry: './src/extension.ts', // source of the web extension main file
	output: {
		filename: 'vscode-extension.js',
		path: path.join(__dirname, './dist/'),
		libraryTarget: 'commonjs',
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
		extensions: ['.ts', '.js'], // support ts-files and js-files
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			assert: false,
			buffer: path.resolve(__dirname, './node_modules/buffer/index.js'),
			fs: false,
			os: false,
			stream: false,
			https: false,
			timers: path.resolve(__dirname, './node_modules/timers-browserify/main.js'),
			path: path.resolve(__dirname, './node_modules/path-browserify/index.js'),
			http: false,
			zlib: false,
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
export default webConfig;