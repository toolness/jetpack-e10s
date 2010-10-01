// This is the first code that's ever run in a Jetpack process. It sets up
// infrastructure and receivers needed to start a Jetpack-based addon
// in a separate process.

// Set up our "proxy" objects that just send messages to our parent
// process to do the real work.

var global = this;

// Taken from plain-text-console.js.
function stringify(arg) {
  try {
    return String(arg);
  }
  catch(ex) {
    return "<toString() error>";
  }
}

var console = {
  exception: function(e) {
    sendMessage('console:exception', e);
  },
  trace: function() {
    sendMessage('console:trace', new Error());
  }
};

['log', 'debug', 'info', 'warn', 'error'].forEach(function(method) {
  console[method] = function() {
    sendMessage('console:' + method, Array.map(arguments, stringify));
  }
});

var memory = {
  track: function() {
    /* TODO */
  }
};

var modules = {};

function require(name) {
  // TODO: Support relative imports.
  if (name && name[0] != "." && name in modules)
    return modules[name].exports;

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

  modules[name] = module;

  // Set up the globals of the sandbox.
  module.exports = {};
  module.console = console;
  module.memory = memory;
  module.require = require;
  module.__url__ = response.script.filename;

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
