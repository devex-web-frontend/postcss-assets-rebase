var fs = require('fs');
var path = require('path');
var parseURL = require('url').parse;
var valueParser = require('postcss-value-parser');
var mkdirp = require('mkdirp');
var postcss = require('postcss');
var postcssResult;

var rebasedAssets = [];

module.exports = postcss.plugin('postcss-assets-rebase', function(options) {

	return function(css, postcssOptions) {
		var to = postcssOptions.opts.to ? path.dirname(postcssOptions.opts.to) : '.';
		postcssResult = postcssOptions;
		if (options && options.assetsPath) {
			css.walkDecls(function(decl) {
				if (decl.value && decl.value.indexOf('url(') > -1) {
					processDecl(decl, to, options);
				}
			})
		} else {
			postcssResult.warn('No assets path provided, aborting');
		}
	}
});

function processDecl(decl, to, options) {
	var dirname = (decl.source && decl.source.input) ? path.dirname(decl.source.input.file) : process.cwd();

	decl.value = valueParser(decl.value).walk(function(node) {
		if (node.type !== 'function' || node.value !== 'url' || !node.nodes.length) {
			return;
		}

		var url = node.nodes[0].value;
		if (isLocalImg(url)) {
			node.nodes[0].value = processUrlRebase(dirname, url, to, options);
		}
	}).toString();
}

function normalizeUrl(url) {
	return (path.sep === '\\') ? url.replace(/\\/g, '\/') : url;
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
		postcssResult.warn('Can\'t read file \'' + filePath + '\', ignoring');
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
	return rebasedAssets.reduce(function(index, rebasedAsset) {
		var newIndex = compareFileNames(rebasedAsset.relative, filePath);
		return (newIndex > index) ? newIndex : index;
	}, 0);
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
			postcssResult.warn('Duplicated path \'' + filePath + '\' renamed to: ' + relativeAssetPath);
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

function resolveAssetPaths(options, to, filePath) {

	var fileName = path.basename(filePath);
	var keptPath =  path.relative(process.cwd(),path.dirname(filePath));
	var relativeAssetPath = '';
	var absoluteAssetPath = '.';

	if (options.relative) {
		absoluteAssetPath = path.resolve(to, options.assetsPath);
		relativeAssetPath = options.assetsPath;
	} else {
		absoluteAssetPath = path.resolve(options.assetsPath);
		relativeAssetPath = path.relative(to, absoluteAssetPath);
	}
	
	if (options.keepStructure) {
		absoluteAssetPath = path.join(absoluteAssetPath, keptPath);
		relativeAssetPath = path.join(relativeAssetPath, keptPath);
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

	var assetContents = getAsset(filePath);
	var resolvedPaths = resolveAssetPaths(options, to, filePath);

	if (!assetContents) {
		return normalizeUrl(url);
	}

	if (options.renameDuplicates) {
		resolvedPaths = resolvePathDuplication(filePath, resolvedPaths);
	}

	copyAsset(resolvedPaths.absolute, assetContents);

	return normalizeUrl(resolvedPaths.relative) + urlPostfix;
}
