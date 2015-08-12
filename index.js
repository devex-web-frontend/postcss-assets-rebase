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

function composeUrl(url, postfix) {
	postfix = postfix || '';
	return 'url(' + normalizeUrl(url) + postfix + ')';
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
				absolute: rebasedAssets[i].absolute,
				relative: rebasedAssets[i].relative
			};
		}
	}
	return null;
}

function getDuplicationIndex(filePath) {
	var index = 0;
	rebasedAssets.forEach(function(rebasedAsset) {
		var newIndex = compareFileNames(rebasedAsset.relative, filePath);
		index = (newIndex > index) ? newIndex : index;
	});
	return index;
}

function resolvePathDuplication(filePath, resolvedPaths) {
	var absoluteAssetPath = resolvedPaths.absolute;
	var relativeAssetPath = resolvedPaths.relative;

	var alreadyRebasedPath = getAlreadyRebasedPath(filePath);

	if (!!alreadyRebasedPath) {
		absoluteAssetPath = alreadyRebasedPath.absolute;
		relativeAssetPath = alreadyRebasedPath.relative;
	} else {
		var duplicationIndex = getDuplicationIndex(absoluteAssetPath);
		if (duplicationIndex) {
			relativeAssetPath = composeDuplicatedPath(relativeAssetPath, duplicationIndex);
			absoluteAssetPath = composeDuplicatedPath(absoluteAssetPath, duplicationIndex);
			console.warn(chalk.yellow('postcss-assets-rebase: duplicated path \'' + filePath + '\' renamed to: ' +
				relativeAssetPath));
		}
	}

	rebasedAssets.push({
		filePath: filePath,
		absolute: absoluteAssetPath,
		relative: relativeAssetPath
	});

	return {
		relative: relativeAssetPath,
		absolute: absoluteAssetPath
	};
}

function resolveAssetPaths(options, to, fileName) {

	var relativeAssetPath = '';
	var absoluteAssetPath = '.';

	if (options.relative) {
		absoluteAssetPath = path.resolve(to, options.assetsPath);
		relativeAssetPath = options.assetsPath;
	} else {
		absoluteAssetPath = path.resolve(options.assetsPath);
		relativeAssetPath = path.relative(to, absoluteAssetPath);
	}

	return {
		absolute: path.join(absoluteAssetPath, fileName),
		relative: path.join(relativeAssetPath, fileName)
	}
}
function processUrlRebase(dirname, url, to, options) {

	var urlPostfix = getPostfix(url);
	var clearUrl = getClearUrl(url);

	var filePath = path.resolve(dirname, clearUrl);
	var fileName = path.basename(clearUrl);

	var assetContents = getAsset(filePath);
	var resolvedPaths = resolveAssetPaths(options, to, fileName);

	if (!assetContents) {
		return composeUrl(url);
	}

	if (options.renameDuplicates) {
		resolvedPaths = resolvePathDuplication(filePath, resolvedPaths);
	}

	copyAsset(resolvedPaths.absolute, assetContents);

	return composeUrl(resolvedPaths.relative, urlPostfix);
}
