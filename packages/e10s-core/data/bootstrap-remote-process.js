// Set up our "proxy" objects that just send messages to our parent
// process to do the real work.

var global = this;

var console = {
  log: function console_log(msg) {
    sendMessage('console:log', "" + msg);
  }
};
console.info = console.log;

function require(name) {
  var response = callMessage("require", name)[0];
  switch (response.code) {
  case "not-found":
    throw new Error("Unknown module '" + name + "'.");
  case "access-denied":
    throw new Error("Module '" + name + "' requires chrome privileges " +
                    "and has no e10s adapter.");
  case "error":
    throw new Error("An unexpected error occurred in the chrome " +
                    "process.");
  case "ok":
    break;
  default:
    throw new Error("Internal error: unknown response code '" +
                    response.code + "'");
  };

  var module = createSandbox();

  // Set up the globals of the sandbox.
  module.exports = {};
  module.console = console;
  module.require = require;

  if (response.needsMessaging)
    ["registerReceiver",
     "createHandle",
     "sendMessage",
     "callMessage"].forEach(
       function(name) {
         module[name] = global[name];
       });

  evalInSandbox(module, '//@line 1 "' + response.script.filename + 
                '"\n' + response.script.contents);

  return module.exports;
};

registerReceiver(
  "startMain",
  function(name, mainName, options, callbacks) {
    var main = require(mainName);

    // TODO: Callbacks will just be handles, we need to actually turn
    // them into functions.

    if ('main' in main)
      main.main(options, callbacks);
  });
