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
    },
    open: {
      type: "async-method",
      args: ["string", "string"]
    },
    send: {
      type: "async-method",
      args: ["string"]
    },
    getAllResponseHeaders: {
      type: "sync-method",
      args: [],
      returnType: "anything"
    },
    readyState: {
      type: "sync-getter",
      returnType: "number"
    },
    status: {
      type: "sync-getter",
      returnType: "number"
    },
    responseText: {
      type: "sync-getter",
      returnType: "string"
    },
    onreadystatechange: {
      type: "async-setter",
      args: ["function"],
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
