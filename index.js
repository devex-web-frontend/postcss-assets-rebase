var fs = require('fs');
var path = require('path');
var url = require('url');
var reduceFunctionCall = require('reduce-function-call');
var mkdirp = require('mkdirp');
var postcss = require('postcss');

module.exports = postcss.plugin('postcss-img-rebase', function(options) {

	return function(css, postcssOptions) {
		var to = postcssOptions.opts.to ? path.dirname(postcssOptions.opts.to) : '.';

		if (options && options.assetsPath) {
			css.eachDecl(function(decl) {
				if (decl.value && decl.value.indexOf('url(') > -1) {
					processDecl(decl, to, options);
				}
			})
		} else {
			console.warn("No assets path provided, aborting");
		}
	}
});

function processDecl(decl, to, options) {

	var dirname = (decl.source && decl.source.input) ? path.dirname(decl.source.input.file) : process.cwd();

	decl.value = reduceFunctionCall(decl.value, 'url', function(value) {
		var url = getUrl(value),
			processedUrl;

		if (notLocalImg(url)) {
			processedUrl = composeUrl(url);
		} else {
			processedUrl = processUrlRebase(dirname, url, to, options);
		}

		return processedUrl;
	});
}

function getUrl(url) {
	return url.match(/(['"]?)(.+)\1/)[2];
}

function composeUrl(url) {
	return 'url(' + url + ')';
}

// checks if file is not local
function notLocalImg(url) {
	return url.indexOf('/') === 0 ||
		url.indexOf('data:') === 0 ||
		url.indexOf('#') === 0 ||
		/^[a-z]+:\/\//.test(url)
}

//copy asset and place it to assets folder
function copyAsset(assetPath, contents) {
	mkdirp.sync(path.dirname(assetPath));
	if (!fs.existsSync(assetPath)) {
		fs.writeFileSync(assetPath, contents);
	}
}

//get asset content
function getAsset(filePath) {

	if (fs.existsSync(filePath)) {
		return fs.readFileSync(filePath);
	} else {
		console.warn("Can't read file '" + filePath + "', ignoring");
	}

}


function processUrlRebase(dirname, url, to, options) {

	var relativeAssetsPath = '';
	var absoluteAssetsPath = '.';

	var filePath = path.resolve(dirname, url);
	var fileName = path.basename(url);

	var assetContents = getAsset(filePath);

	if (!assetContents) {
		return composeUrl(url);
	}

	if (options.relative) {
		absoluteAssetsPath = path.resolve(to, options.assetsPath);
		relativeAssetsPath = options.assetsPath;
	} else {
		absoluteAssetsPath = path.resolve(options.assetsPath);
		relativeAssetsPath = path.relative(to, absoluteAssetsPath);
	}

	absoluteAssetsPath = path.join(absoluteAssetsPath, fileName);
	relativeAssetsPath = path.join(relativeAssetsPath, fileName);

	copyAsset(absoluteAssetsPath, assetContents);

	return composeUrl(relativeAssetsPath);
}
