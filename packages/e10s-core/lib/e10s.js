/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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

  ['log', 'debug', 'info', 'warn', 'error'].forEach(function(method) {
    process.registerReceiver("console:" + method, function(name, args) {
      console[method].apply(console, args);
    });
  });

  function remoteException(exception) {
    return {
      toString: function toString() {
        return "Error: " + this.message;
      },
      __proto__: exception
    };
  }
  
  process.registerReceiver("console:trace", function(name, exception) {
    var traceback = require("traceback");
    var stack = traceback.fromException(remoteException(exception));
    console.log(traceback.format(stack.slice(0, -2)));
  });

  process.registerReceiver("console:exception", function(name, exception) {
    console.exception(remoteException(exception));
  });
  
  process.registerReceiver(
    "core:exception",
    function(name, exception) {
      console.log("An exception occurred in the child Jetpack process.");
      console.exception(remoteException(exception));
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

          // Even if a module doesn't explicitly require chrome privileges, if
          // an e10s adapter exists for it, use it, because said module might
          // import other modules that require chrome.
          //
          // In the future we may want to look at the module's dependencies to
          // determine whether importing an adapter is a better idea.

          return maybeImportAdapterModule() || {
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
