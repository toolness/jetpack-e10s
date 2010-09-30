function pickleArgs(types, args) {
  var pickled = [];
  for (var i = 0; i < args.length; i++) {
    switch (types[i]) {
    case "string":
      pickled.push(String(args[i]));
      break;
    default:
      throw new Error("Unsupported type: " + types[i]);
    }
  }
  return pickled;
}

function unpickleArgs(types, args) {
  var unpickled = [];
  for (var i = 0; i < args.length; i++) {
    switch (types[i]) {
    case "string":
      if (typeof(args[i]) != "string")
        throw new Error("Expected string, got " + typeof(args[i]));
      unpickled.push(args[i]);
      break;
    default:
      throw new Error("Unsupported type: " + types[i]);
    }
  }
  return unpickled;
}

function createProxyPrototype(chrome, meta) {
  var prototype = {};

  function defineProperty(name, info) {
    switch (info.type) {
    case "async-method":
      prototype[name] = function() {
        chrome.sendMessage(meta.channel, {
          name: name,
          handle: this._handle,
          args: pickleArgs(info.args, arguments)
        });
      };
      break;
    default:
      throw new Error("Unsupported type: " + info.type);
    }    
  }

  for (name in meta.properties)
    defineProperty(name, meta.properties[name]);
    
  return prototype;
};

exports.createProxy = function createProxy(chrome, meta) {
  function proxyConstructor() {
    this._handle = chrome.callMessage(meta.channel, {
      msg: "construct",
      args: pickleArgs(meta.constructor.args, arguments)
    })[0];
  };

  proxyConstructor.prototype = createProxyPrototype(chrome, meta);

  return proxyConstructor;
};

exports.registerProxyEndpoint = function registerProxyEndpoint(process, meta) {
  var constructor = meta.constructor;
  var properties = meta.properties;

  function propertyAccess(options) {
    if (!(options.name in properties))
      throw new Error("Unknown property: " + options.name);
    var info = properties[options.name];
    var delegate = options.handle.delegate;
    switch (info.type) {
    case "async-method":
      delegate[options.name].apply(delegate,
                                   unpickleArgs(info.args, options.args));
      break;
    default:
      throw new Error("Unsupported type: " + info.type);
    }
  }

  process.registerReceiver(meta.channel, function(name, options) {
    switch (options.msg) {
    case "property":
      return propertyAccess(options);
      break;
    case "construct":
      var handle = process.createHandle();
      handle.delegate = constructor.factory();
      return handle;
      break;
    default:
      throw new Error("Unsupported message: " + options.msg);
    }
  });
};
