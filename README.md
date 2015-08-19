# postcss-assets-rebase [![Build Status](https://travis-ci.org/devex-web-frontend/postcss-assets-rebase.svg)](https://travis-ci.org/devex-web-frontend/postcss-assets-rebase)

[PostCSS](https://github.com/postcss/postcss) plugin to rebase assets used in project

Copies all assets used in `.css` to specified folder(not saving folder structure) and rebases all paths.

## Installation

```console
$ npm install postcss-assets-rebase
```

## Usage

Plugin throws warnings when asset can't be found or duplicate is renamed.
Warnings are thrown using `postcss.messages`. To output warnings in console can be used [postcss-reporter](https://github.com/postcss/postcss-reporter).
```js
// dependencies
var fs = require("fs")
var postcss = require("postcss")
var rebaser = require("postcss-assets-rebase")
var reporter = require('postcss-reporter');

// css to be processed
var css = fs.readFileSync("input.css", "utf8")

// process css
var output = postcss()
  .use(rebaser({
    assetsPath: "imported", // new path for all assets
    relative: true // is assetsPath relative to .css position. By default its relative to process.cwd()
  }))
  .use(reporter)
  .process(css, {
    from: "src/stylesheet/index.css"
    to: "dist/index.css"
  })
  .css
```
Source `src/stylesheet/index.css`: 
```css
body {
  background: url("../../assets/img.jpg");
  background: url(another-assets/another-img.jpg);
  background: url("../../assets/not-existing-image.jpg");
  background: url("http://goo.gl/VR2dL6");
}
```
Resulting `dist/index.css` (+`dist/imported` folder containing `img.jpg` and `another-img.jpg`):
```css
body {
  background: url(imported/img.jpg);
  background: url(imported/another-img.jpg);
  background: url(../../assets/not-existing-image.jpg);
  background: url(http://goo.gl/VR2dL6);
}
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

#### `renameDuplicates` (optional)
Type: `Boolean`  
Default: `False`

If there are assets with different paths but same name, they would be renamed using `name_%` pattern.

By default only first asset would be copied.

## [License](LICENSE)
