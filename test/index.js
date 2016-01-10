var test = require('blue-tape');
var fs = require('fs');
var del = require('del');
var path = require('path');
var exists = require('path-exists');
var assign = require('object-assign');
var postcss = require('postcss');
var assetsRebase = require('..');

process.chdir('test');

function readFile(file, encoding) {
	return new Promise(function (resolve, reject) {
		fs.readFile(file, encoding, function (err, data) {
			if (err) {
				return reject(err);
			}
			resolve(data);
		});
	});
}

function writeFile(file, data) {
	return new Promise(function (resolve, reject) {
		fs.writeFile(file, data, function (err) {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}

function compareAssets(t, assetsList) {
	var destList = Object.keys(assetsList);

	var promises = destList.map(function (dest) {
		var src = assetsList[dest];
		return Promise.all([
			readFile(dest),
			readFile(src.replace(/^!/, ''))
		]).then(function (assets) {
			var result = Buffer.compare(assets[0], assets[1]);
			t.ok(src[0] === '!' ? result !== 0 : result === 0, 'same assets');
		});
	});

	return Promise.all(promises);
}

function compareFixtures(t, name, warnings, options, postcssOptions) {
	var expectedWarnings = warnings || [];

	var fixtureFile = 'fixtures/' + name + '.css';
	var expectedFile = 'fixtures/' + name + '.expected.css';
	var actualFile = 'fixtures/' + name + '.actual.css';
	var assetsFile = 'fixtures/' + name + '.assets.json';

	return Promise.all([
		options ? del(options.assetsPath) : null,
		readFile(fixtureFile, 'utf-8'),
		readFile(expectedFile, 'utf-8'),
		exists(assetsFile).then(function (exists) {
			if (exists) {
				return readFile(assetsFile, 'utf-8');
			}
		})
	])
	.then(function (results) {
		return postcss()
			.use(assetsRebase(options))
			.process(results[1], postcssOptions)
			.then(function (result) {
				var warnings = result.warnings();
				var assetsList = results[3] ? JSON.parse(results[3]) : null
				t.equal(warnings.length, expectedWarnings.length, 'no warnings');
				warnings.forEach(function (warning, i) {
					t.equal(warning.text, expectedWarnings[i], 'same warning');
				});
				t.equal(result.css, results[2], 'same css');
				return Promise.all([
					writeFile(actualFile, result.css),
					assetsList ? compareAssets(t, assetsList) : null
				]);
			});
	});
}

test('should not change css if asstesPath is not specified', function (t) {
	return compareFixtures(t, 'no-assets-path', [
		'No assets path provided, aborting'
	]);
});

test('should transform url', function (t) {
	return compareFixtures(t, 'transform-url', null, {
		assetsPath: 'result/transform-url'
	});
});

test('should proper process urls with postfixes', function (t) {
	return compareFixtures(t, 'postfix', null, {
		assetsPath: 'result/postfix'
	});
});

test('should transform url relatively postcss `to` option', function (t) {
	return compareFixtures(t, 'relative-to', null, {
		assetsPath: 'result/relative-to'
	}, {
		to: 'fixtures/actual.css'
	});
});

test('should use postcss `from` option with enabled `relative` option', function (t) {
	return compareFixtures(t, 'relative-from', null, {
		assetsPath: 'result/relative-from',
		relative: true
	}, {
		from: 'fixtures/fixture.css'
	});
});

test('should not use postcss `from` option to detect assets', function (t) {
	return compareFixtures(t, 'absolute-from', null, {
		assetsPath: 'result/absolute-from'
	}, {
		from: 'fixtures/fixture.css'
	});
});

test('should not keep directory structure', function (t) {
	return compareFixtures(t, 'flatten-structure', null, {
		assetsPath: 'result/flatten-structure'
	});
});

test('should keep directory structure with enabled option', function (t) {
	return compareFixtures(t, 'keep-structure', null, {
		assetsPath: 'result/keep-structure',
		keepStructure: true
	});
});

test('should skip duplicated assets', function (t) {
	return compareFixtures(t, 'skip', null, {
		assetsPath: 'result/skip'
	});
});

test('should rename duplicated assets with enabled option', function (t) {
	return compareFixtures(t, 'duplicated', [
		'Duplicated path \'' + path.resolve('fixtures/assets/structure/kitty.jpg') + '\' renamed to: ' + path.normalize('result/duplicated/kitty_1.jpg')
	], {
		assetsPath: 'result/duplicated',
		renameDuplicates: true
	});
});

test('should warn when file is not found', function (t) {
	return compareFixtures(t, 'not-found', [
		'Can\'t read file \'' + path.resolve('fixtures/assets/not-found.jpg') + '\', ignoring'
	], {
		assetsPath: 'result/not-found'
	})
});
