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

exports.startMainRemotely = function startMainRemotely(options, callbacks) {
  var packages = {};

  packaging.options.manifest.forEach(
    function(entry) {
      var packageName = entry[0];
      var moduleName = entry[1];
      var info = {        
        dependencies: entry[2],
        needsChrome: entry[3]
      };
      if (!(packageName in packages))
        packages[packageName] = {};
      packages[packageName][moduleName] = info;
    });

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
      var moduleName = path;
      var parentFS = require("cuddlefish").parentLoader.fs;
      var moduleURL = parentFS.resolveModule(null, moduleName);

      if (moduleURL) {
        var info = url.URL(moduleURL);
        var pkgName = packaging.options.resourcePackages[info.host];

        if (packages[pkgName][moduleName].needsChrome) {
          var adapterModuleName = moduleName + "-e10s-adapter";
          var adapterModuleURL = parentFS.resolveModule(null,
                                                        adapterModuleName);

          if (adapterModuleURL) {
            // e10s adapter found!
            var adapterModuleFilename = url.toFilename(adapterModuleURL);
            try {
              require(adapterModuleName).register(process);
            } catch (e) {
              console.exception(e);
              return {code: "error"};
            }
            return {
              code: "ok",
              needsMessaging: true,
              script: {
                filename: adapterModuleFilename,
                contents: file.read(adapterModuleFilename)
              }
            };
          } else {
            // No adapter exists!
            return {code: "access-denied"};
          }
        } else {
          var moduleFilename = url.toFilename(moduleURL);
          return {
            code: "ok",
            needsMessaging: false,
            script: {
              filename: moduleFilename,
              contents: file.read(moduleFilename)
            }
          };
        }
      } else {
        return {code: "not-found"};
      }
    });

  process.eval(require("self").data.url("bootstrap-remote-process.js"));
};
