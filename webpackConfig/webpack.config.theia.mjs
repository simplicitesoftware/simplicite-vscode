import path from 'path';

const __dirname = path.resolve();

const nodeConfig = /** @type WebpackConfig */ {
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	target: 'node',
	entry: './src/extension.ts', // source of the web extension main file
	output: {
		filename: 'theia-extension.js',
		path: path.join(__dirname, './dist/'),
		libraryTarget: 'commonjs',
	},
	resolve: {
		mainFields: ['node', 'module', 'main', 'simplicite'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
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
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'nosources-source-map', // create a source map that points to the original source file

};
export default nodeConfig;