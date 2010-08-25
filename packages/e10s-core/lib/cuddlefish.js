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

(function(global) {
   const Cc = Components.classes;
   const Ci = Components.interfaces;
   const Cu = Components.utils;
   const Cr = Components.results;

   var exports = {};

   // Load the SecurableModule prerequisite.
   var securableModule;

   if (global.require)
     // We're being loaded in a SecurableModule.
     securableModule = require("securable-module");
   else {
     var myURI = Components.stack.filename.split(" -> ").slice(-1)[0];
     var ios = Cc['@mozilla.org/network/io-service;1']
               .getService(Ci.nsIIOService);
     var securableModuleURI = ios.newURI("securable-module.js", null,
                                         ios.newURI(myURI, null, null));
     if (securableModuleURI.scheme == "chrome") {
       // The securable-module module is at a chrome URI, so we can't
       // simply load it via Cu.import(). Let's assume we're in a
       // chrome-privileged document and use mozIJSSubScriptLoader.
       var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                    .getService(Ci.mozIJSSubScriptLoader);

       // Import the script, don't pollute the global scope.
       securableModule = {__proto__: global};
       loader.loadSubScript(securableModuleURI.spec, securableModule);
       securableModule = securableModule.SecurableModule;
     } else {
       securableModule = {};
       try {
         Cu.import(securableModuleURI.spec, securableModule);
       } catch (e if e.result == Cr.NS_ERROR_ILLEGAL_VALUE) {
         Cu.reportError("Failed to load " + securableModuleURI.spec);
       }
     }
   }

   function unloadLoader(reason) {
     this.require("unload").send(reason);
   }

   var cuddlefishSandboxFactory = {
     createSandbox: function(options) {
       var filename = options.filename ? options.filename : null;
       var sandbox = this.__proto__.createSandbox(options);
       sandbox.defineProperty("__url__", filename);
       return sandbox;
     },
     __proto__: new securableModule.SandboxFactory("system")
   };

   function CuddlefishModule(loader) {
     this.parentLoader = loader;
     this.__proto__ = exports;
   }

   var Loader = exports.Loader = function Loader(options) {
     var globals = {};

     if (options.globals)
       for (var name in options.globals)
         globals[name] = options.globals[name];

     if (options.console)
       globals.console = options.console;
     if (options.memory)
       globals.memory = options.memory;

     var modules = options.modules || {};

     var loaderOptions = {rootPath: options.rootPath,
                          rootPaths: options.rootPaths,
                          fs: options.fs,
                          sandboxFactory: cuddlefishSandboxFactory,
                          globals: globals,
                          modules: modules};

     var loader = new securableModule.Loader(loaderOptions);
     var path = loader.fs.resolveModule(null, "cuddlefish");
     modules[path] = new CuddlefishModule(loader);

     if (!globals.console) {
       var console = loader.require("plain-text-console");
       globals.console = new console.PlainTextConsole(options.print);
     }
     if (!globals.memory)
       globals.memory = loader.require("memory");

     modules['es5'] = loader.require('es5');

     loader.console = globals.console;
     loader.memory = globals.memory;
     loader.unload = unloadLoader;

     if ('packaging' in globals) {
       var e10s = loader.require("e10s");
       e10s.init(loader, globals.packaging);

       var mainInfo = e10s.getModuleInfo(null, globals.packaging.options.main);
       if (!mainInfo.needsChrome) {
         modules[mainInfo.url] = {
           main: function main(options, callbacks) {
             e10s.startMainRemotely(options, callbacks);
           }
         };
       }
     }

     return loader;
   };

   if (global.window) {
     // We're being loaded in a chrome window, or a web page with
     // UniversalXPConnect privileges.
     global.Cuddlefish = exports;
   } else if (global.exports) {
     // We're being loaded in a SecurableModule.
     for (name in exports) {
       global.exports[name] = exports[name];
     }
   } else {
     // We're being loaded in a JS module.
     global.EXPORTED_SYMBOLS = [];
     for (name in exports) {
       global.EXPORTED_SYMBOLS.push(name);
       global[name] = exports[name];
     }
   }
 })(this);
