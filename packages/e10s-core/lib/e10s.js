let {Cc, Ci} = require('chrome');

let url = require("url");
let file = require("file");
let errors = require("errors");

let jetpackService = Cc["@mozilla.org/jetpack/service;1"]
                     .getService(Ci.nsIJetpackService);

function JetpackProcess() {
  var process = jetpackService.createJetpack();

  this.registerReceiver = function(name, cb) {
    process.registerReceiver(name, errors.catchAndLog(cb));
  };

  this.sendMessage = function() {
    return process.sendMessage.apply(this, arguments);
  };
  
  this.createHandle = function() {
    return process.createHandle();
  };

  this.destroy = function() {
    process.destroy();
  };

  this.eval = function(urlObj) {
    var filename = url.toFilename(urlObj);
    // The try ... catch is a workaround for bug 589308.
    process.evalScript('//@line 1 "' + filename + '"\n' +
                       "try { " + file.read(filename) + " } catch (e) { " +
                       "sendMessage('core:exception', e); }");
  };
}

function makeScriptFrom(moduleURL) {
  return {
    filename: moduleURL,
    contents: file.read(url.toFilename(moduleURL))
  };
}

exports.createProcess = function createProcess() {
  var process = new JetpackProcess();

  // Whenever our add-on is disabled or uninstalled, we want to
  // destroy the remote process.

  require("unload").when(function() {
                           process.destroy();
                           process = null;
                         });

  // Set up message receivers that the remote process will use to
  // communicate with us.

  process.registerReceiver(
    "console:log",
    function(name, msg) {
      console.log(msg);
    });

  process.registerReceiver(
    "core:exception",
    function(name, exception) {
      var e = {
        toString: function toString() {
          return "Error: " + e.message;
        },
        __proto__: exception
      };
      console.log("An exception occurred in the child Jetpack process.");
      console.exception(e);
    });

  process.registerReceiver(
    "require",
    function(name, path) {
      // TODO: Add support for relative paths, e.g. ./foo.
      var parentFS = packaging.harnessService.loader.fs;
      var moduleURL = parentFS.resolveModule(null, path);
      var moduleInfo = moduleURL ? packaging.getModuleInfo(moduleURL) : null;
      var moduleName = path;

      function maybeImportAdapterModule() {
        var adapterModuleName = moduleName + "-e10s-adapter";
        var adapterModuleURL = parentFS.resolveModule(null,
                                                      adapterModuleName);
        var adapterModuleInfo = null;
        if (adapterModuleURL)
          adapterModuleInfo = packaging.getModuleInfo(adapterModuleURL);

        if (adapterModuleInfo) {
          // e10s adapter found!
          try {
            require(adapterModuleName).register(process);
          } catch (e) {
            console.exception(e);
            return {code: "error"};
          }
          return {
            code: "ok",
            needsMessaging: true,
            script: makeScriptFrom(adapterModuleURL)
          };
        }
        
        return null;
      }

      if (moduleInfo) {
        if (moduleInfo.needsChrome) {
          return maybeImportAdapterModule() || {code: "access-denied"};
        } else {
          return {
            code: "ok",
            needsMessaging: false,
            script: makeScriptFrom(moduleURL)
          };
        }
      } else {
        return maybeImportAdapterModule() || {code: "not-found"};
      }
    });

  process.eval(require("self").data.url("bootstrap-remote-process.js"));

  return process;
};
