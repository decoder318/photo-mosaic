// a vanilla javascript implementation of jQuery's extends, taken from https://gist.github.com/pbojinov/8f3765b672efec122f66
(function(exports){
    exports._extends = _extends;

    function _extends() {
        var extended = {};

        for(key in arguments) {
            var argument = arguments[key];
            for (prop in argument) {
                if (Object.prototype.hasOwnProperty.call(argument, prop)) {
                    extended[prop] = argument[prop];
                }
            }
        }

        return extended;
    };
})(this);