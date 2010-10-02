// This is just an adapter that provides a single function so the request
// module works without modifications. We ultimately want to move this
// single function into the api-utils module.

if (this.sendMessage)
  exports.utils = {
    defineLazyGetter: function(object, name, cb) {
      object.__defineGetter__(name, cb);
    }
  };
else
  exports.register = function(process) {
  };
