var chalk = require('chalk');
var isSilentMode = false;

module.exports = {
	setSilentMode: setSilentMode,
	warn: warn,
	error: error
};

function setSilentMode(mode){
	isSilentMode = !!mode;
}

function warn(message) {
	if (!isSilentMode) {
		console.warn(chalk.yellow(message));
	}
}
function error(message) {
	if (!isSilentMode) {
		console.warn(chalk.red(message))
	}
}