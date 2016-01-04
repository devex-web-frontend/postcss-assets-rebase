# postcss-assets-rebase [![Build Status](https://travis-ci.org/devex-web-frontend/postcss-assets-rebase.svg)](https://travis-ci.org/devex-web-frontend/postcss-assets-rebase)

[PostCSS](https://github.com/postcss/postcss) plugin to rebase assets used in project

Copies all assets used in `.css` to specified folder and rebases all paths.

Features:
* absolute/relative rebasing path
* saving/flattening assets folder structure
* assets renaming in case of duplication

If you have any questions of think that some additional options are needed – feel free to create an issue.

## Installation

```console
$ npm install postcss-assets-rebase
```

## Usage

Plugin throws warnings when asset can't be found or duplicate is renamed.
Warnings are thrown using `postcss.messages`. To output warnings in console you can use [postcss-reporter](https://github.com/postcss/postcss-reporter).
```js
// dependencies
var fs = require("fs")
var postcss = require("postcss")
var rebaser = require("postcss-assets-rebase")
var reporter = require('postcss-reporter');

// css to be processed
var css = fs.readFileSync("input.css", "utf8")

// process css
postcss()
  .use(rebaser({
    assetsPath: "assets/imported", // new path for all assets
    relative: true // is assetsPath relative to .css position.
                   //By default its relative to process.cwd()
  }))
  .use(reporter)
  .process(css, {
    from: "src/stylesheet/index.css",
    to: "dist/index.css"
  })
  .then(function (result) {
    var output = result.css;
  });
```
#### Input `src/stylesheet/index.css`:
```css
body {
  background: url("../../assets/img.jpg");
  background: url(another-assets/another-img.jpg);
  background: url("../../assets/not-existing-image.jpg");
  background: url("http://goo.gl/VR2dL6");
}
```
#### Output
```css
body {
  background: url(assets/imported/img.jpg);
  background: url(assets/imported/another-img.jpg);
  background: url(../../assets/not-existing-image.jpg);
  background: url(http://goo.gl/VR2dL6);
}
```

```
|-- dist
    |-- index.css
    |-- assets
        |-- imported
            |-- another-img.jpg
            |-- img.jpg
 
```
Checkout [tests](test) for more usage examples.

### Options

#### `assetsPath` (required)
Type: `String`  

Path to place assets to 

#### `relative` (optional)
Type: `Boolean`  
Default: `False`

Is assetsPath relative to .css position. By default its relative to process.cwd()

#### `keepStructure` (optional)
Type: `Boolean`
Default: `False`

To keep folder structure or not. By default all assets paths are collected flatly in `assetsPath` folder.
If you set this flag to `true`, folder structure relative to process.cwd() would be saved.

So then example above would generate following files:
```
|-- dist
    |-- index.css
    |-- assets
        |-- imported
          |-- assets
              |-- img.jpg
          |-- src
              |-- stylesheet
                  |-- another-assets
                      |-- another-img.jpg

```
#### `renameDuplicates` (optional)
Type: `Boolean`  
Default: `False`

If there are assets with different paths but same name, they would be renamed using `name_%` pattern.

By default only first asset would be copied.

## [License](LICENSE)
## [Changelog](CHANGELOG.md)
