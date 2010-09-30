if (this.sendMessage) {
  exports.id = callMessage("self:id")[0];
  exports.data = {
    load: function(path) {
      return callMessage("self:load", path, new Error().stack)[0];
    },
    url: function(path) {
      return callMessage("self:url", path, new Error().stack)[0];
    }
  };
} else {
  // Here we basically have to reimplement the self module.

  let file = require("file");
  let url = require("url");
  let traceback = require("traceback");

  let packageData = packaging.options.packageData;
  let resourcePackages = packaging.options.resourcePackages;
  let id = packaging.jetpackID;

  function caller(stack, levels) {
    var e = {
      stack: stack
    };
    let callerInfo = traceback.fromException(e).slice(-2-levels)[0];
    let info = url.URL(callerInfo.filename);
    let pkgName = resourcePackages[info.host];
    // pkgName is "my-package", suitable for lookup in options["packageData"]
    return pkgName;
  }

  function getURL(name, stack, level) {
    let pkgName = caller(stack, level);
    // packageData[] = "resource://jetpack-JID-PKGNAME-data/"
    if (pkgName in packageData)
      return url.URL(name, packageData[pkgName]).toString();
    throw new Error("No data for package " + pkgName);
  }

  exports.register = function(process) {
    process.registerReceiver("self:id", function(name) {
      return id;
    });
    process.registerReceiver("self:load", function(name, path, stack) {
      let data_url = getURL(path, stack, 1);
      let fn = url.toFilename(data_url);
      let data = file.read(fn);
      return data;
    });
    process.registerReceiver("self:url", function(name, path, stack) {
      return getURL(path, stack, 1);
    });
  }
}
