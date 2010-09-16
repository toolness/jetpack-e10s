// This implementation is neither secure nor complete,
// because timer functionality should be implemented
// natively in-process by bug 568695.

if (this.sendMessage) {
  var callbacks = {};
  exports.setTimeout = function setTimeout(cb, ms) {
    var id = callMessage("setTimeout", ms)[0];
    callbacks[id] = cb;
    return id;
  };

  exports.clearTimeout = function clearTimeout(id) {
    delete callbacks[id];
    sendMessage("clearTimeout", id);
  };
  
  registerReceiver("onTimeout", function(name, id) {
    var cb = callbacks[id];
    delete callbacks[id];
    cb();
  });
} else {
  exports.register = function(process) {
    var timer = require("timer");
    process.registerReceiver("setTimeout", function(name, ms) {
      var id = timer.setTimeout(function() {
        process.sendMessage("onTimeout", id);
      }, ms);
      return id;
    });
    process.registerReceiver("clearTimeout", function(name, id) {
      timer.clearTimeout(id);
    });
  };
}
