var e10sUtils = require("e10s-utils");

var XHR_META = {
  channel: "xhr",
  constructor: function() {
    var xhr = require("xhr");
    return new xhr.XMLHttpRequest();
  },
  properties: {
    overrideMimeType: {
      type: "async-method",
      args: ["string"]
    }
  }
};

if (this.sendMessage) {
  exports.XMLHttpRequest = e10sUtils.createProxy(this, XHR_META);
} else {
  exports.register = function(process) {
    e10sUtils.registerProxyEndpoint(process, XHR_META);
  };
}
