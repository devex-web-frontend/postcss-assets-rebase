var fs = require('fs');
var path = require('path');
var parseURL = require('url').parse;
var reduceFunctionCall = require('reduce-function-call');
var mkdirp = require('mkdirp');
var postcss = require('postcss');
var chalk = require('chalk');

var rebasedAssets = new Array();

module.exports = postcss.plugin('postcss-assets-rebase', function(options) {

	return function(css, postcssOptions) {
		var to = postcssOptions.opts.to ? path.dirname(postcssOptions.opts.to) : '.';

		if (options && options.assetsPath) {
			css.eachDecl(function(decl) {
				if (decl.value && decl.value.indexOf('url(') > -1) {
					processDecl(decl, to, options);
				}
			})
		} else {
			console.warn(chalk.red('postcss-assets-rebase: No assets path provided, aborting'));
		}
	}
});

function processDecl(decl, to, options) {

	var dirname = (decl.source && decl.source.input) ? path.dirname(decl.source.input.file) : process.cwd();

	decl.value = reduceFunctionCall(decl.value, 'url', function(value) {
		var url = getUrl(value),
			processedUrl;

		if (isLocalImg(url)) {
			processedUrl = processUrlRebase(dirname, url, to, options);
		} else {
			processedUrl = composeUrl(url);
		}

		return processedUrl;
	});
}

function getUrl(url) {
	return url.match(/(['"]?)(.+)\1/)[2];
}

function normalizeUrl(url) {
	return (path.sep === '\\') ? url.replace(/\\/g, '\/') : url;
}

function composeUrl(url) {
	return 'url(' + normalizeUrl(url) + ')';
}

// checks if file is not local
function isLocalImg(url) {
	var notLocal = url.indexOf('data:') === 0 ||
		url.indexOf('#') === 0 ||
		/^[a-z]+:\/\//.test(url);

	return !notLocal;
}

//copy asset and place it to assets folder
function copyAsset(assetPath, contents) {
	mkdirp.sync(path.dirname(assetPath));
	if (!fs.existsSync(assetPath)) {
		fs.writeFileSync(assetPath, contents);
	}
}

function composeDuplicatedPath(assetPath, index) {
	var extname = path.extname(assetPath);
	var fileName = path.basename(assetPath, extname);
	var dirname = path.dirname(assetPath);

	return path.join(dirname, fileName + '_' + index + extname);
}

//get asset content
function getAsset(filePath) {
	if (fs.existsSync(filePath)) {
		return fs.readFileSync(filePath);
	} else {
		console.warn(chalk.yellow('postcss-assets-rebase: Can\'t read file \'' + filePath + '\', ignoring'));
	}

}

function getPostfix(url) {
	var parsedURL = parseURL(url);
	var postfix = '';

	if (parsedURL.search) {
		postfix += parsedURL.search;
	}

	if (parsedURL.hash) {
		postfix += parsedURL.hash;
	}

	return postfix;
}

function getClearUrl(url) {
	return parseURL(url).pathname;
}
//compare already rebased asset name with provided and get duplication index
function compareFileNames(rebasedPath, filePath) {
	var rebasedExtName = path.extname(rebasedPath);
	var fileExtName = path.extname(filePath);
	var rebasedBaseName = path.basename(rebasedPath, rebasedExtName);
	var fileBaseName = path.basename(filePath, fileExtName);

	var reg = new RegExp('^' + fileBaseName + '_(\\d+)$');
	var executed = reg.exec(rebasedBaseName);
	var index;

	if (rebasedBaseName === fileBaseName && rebasedExtName === fileExtName) {
		index = 1;
	} else {
		index = executed ? (parseFloat(executed[1]) + 1) : 0;
	}

	return index;
}

function getAlreadyRebasedPath(filePath) {
	for (var i = 0; i < rebasedAssets.length; i++) {
		if (rebasedAssets[i].filePath === filePath) {
			return {
				absolute: rebasedAssets[i].absoluteAssetsPath,
				relative: rebasedAssets[i].relativeAssetsPath
			};
		}
	}
}

function getDuplicationIndex(filePath) {
	var index = 0;
	rebasedAssets.forEach(function(rebasedAsset) {
		var newIndex = compareFileNames(rebasedAsset.relativeAssetsPath, filePath);
		index = (newIndex > index) ? newIndex : index;
	});
	return index;
}

function processAssetPaths(filePath, absoluteAssetsPath, relativeAssetsPath) {
	var alreadyRebasedPath = getAlreadyRebasedPath(filePath);

	if (!!alreadyRebasedPath) {
		absoluteAssetsPath = alreadyRebasedPath.absolute;
		relativeAssetsPath = alreadyRebasedPath.relative;
	} else {
		var duplicationIndex = getDuplicationIndex(absoluteAssetsPath);
		if (duplicationIndex) {
			relativeAssetsPath = composeDuplicatedPath(relativeAssetsPath, duplicationIndex);
			absoluteAssetsPath = composeDuplicatedPath(absoluteAssetsPath, duplicationIndex);
			console.warn(chalk.yellow('postcss-assets-rebase: duplicated path \'' + filePath + '\' renamed to: ' +
				relativeAssetsPath));
		}
	}

	rebasedAssets.push({
		filePath: filePath,
		absoluteAssetsPath: absoluteAssetsPath,
		relativeAssetsPath: relativeAssetsPath
	});

	return {
		relative: relativeAssetsPath,
		absolute: absoluteAssetsPath
	};
}
function processUrlRebase(dirname, url, to, options) {

	var relativeAssetsPath = '';
	var absoluteAssetsPath = '.';

	var postfix = getPostfix(url);
	var clearUrl = getClearUrl(url);

	var filePath = path.resolve(dirname, clearUrl);
	var fileName = path.basename(clearUrl);

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

	if (options.renameDuplicates) {
		var processedPaths = processAssetPaths(filePath, absoluteAssetsPath, relativeAssetsPath);
		relativeAssetsPath = processedPaths.relative;
		absoluteAssetsPath = processedPaths.absolute;
	}

	copyAsset(absoluteAssetsPath, assetContents);

	if (postfix) {
		relativeAssetsPath += postfix;
	}
	return composeUrl(relativeAssetsPath);
}
