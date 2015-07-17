var test = require('tape');
var path = require('path');
var fs = require('fs');
var rebaser = require('..');
var postcss = require('postcss');
var rimraf = require('rimraf').sync;
var writefile = require('writefile');

function read(name) {
	console.log(name);
	return fs.readFileSync(name, 'utf8').trim()
}
function clearAssets(assetsFolder) {
	rimraf(assetsFolder || 'test/imported');
}
function clearResults(css, assetsFoler) {
	clearAssets(assetsFoler);
	rimraf(css || 'test/result');
}

function compareFixtures(t, testMessage, rebaserOptions, psOptions) {
	var fileName = path.basename(psOptions.from);
	var filePath = psOptions.from;
	var destPath = psOptions.to || fileName;
	var destName = path.basename(psOptions.to);

	var result = postcss(rebaser(rebaserOptions))
		.process(read(filePath), psOptions)
		.css;

	var expected = read('test/expected/' + destName);

	writefile(destPath, result);

	t.equal(result, expected, testMessage);
}

function checkAssetsCopied(folderPath) {
	var imgPaths = ['img.jpg', 'another-img.jpg'];
	return imgPaths.every(function(imgPath) {
		return fs.existsSync(folderPath + imgPath);
	});

}

test('no options', function(t) {
	var rebaserOptions = {};
	var postcssOptions = {
		from: 'test/fixtures/copy.css',
		to: 'test/result/no-copy.css'
	};
	clearResults();
	compareFixtures(t, 'should not change .css if asstesPath not specified', rebaserOptions, postcssOptions);
	t.end();

});

test('absolute', function(t) {
	var rebaserOptions = {
		assetsPath: 'test/imported'
	};
	var postcssOptions = {
		from: 'test/fixtures/copy.css',
		to: 'test/result/copy.css'
	};
	clearResults('test/result/copy.css', 'test/imported');
	compareFixtures(t, 'should change existing assets path', rebaserOptions, postcssOptions);
	t.ok(checkAssetsCopied('test/imported/'), 'should copy assets to assetsPath');
	t.end();

});

test('relative', function(t) {
	var rebaserOptions = {
		assetsPath: 'imported',
		relative: 'true'
	};
	var postcssOptions = {
		from: 'test/fixtures/copy.css',
		to: 'test/result/copy-relative.css'
	};
	clearResults('test/result/copy-relative.css', 'test/result/imported');
	compareFixtures(t, 'should change existing assets path', rebaserOptions, postcssOptions);
	t.ok(checkAssetsCopied('test/result/imported/'), 'should copy assets to assetsPath relative to source file');
	t.end();

});
