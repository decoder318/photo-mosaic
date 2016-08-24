(function(exports){    

    // not ideal, but this singleton implementation of event-emitter 
    // forces to have unique event names on each object that extends event-emitter
    exports.EventEmitter = new EventEmitter();

    
    // taken form stackoverflow: http://stackoverflow.com/a/10979055/1079159
    function EventEmitter () {
        var _this = this;
        _this.events = {};

        _this.addEventListener = function(name, handler) {
            if (_this.events.hasOwnProperty(name))
                _this.events[name].push(handler);
            else
                _this.events[name] = [handler];
        };

        _this.removeEventListener = function(name, handler) {
            if (!_this.events.hasOwnProperty(name))
                return;

            var index = _this.events[name].indexOf(handler);
            if (index != -1)
                _this.events[name].splice(index, 1);
        };

        _this.emit = function(name, args) {
            if (!_this.events.hasOwnProperty(name))
                return;

            if (!args || !args.length)
                args = [];

            var evs = _this.events[name], l = evs.length;
            for (var i = 0; i < l; i++) {
                evs[i].apply(null, args);
            }
        };
    }

})(this);
