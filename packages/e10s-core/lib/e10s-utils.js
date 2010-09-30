function Pickler(messaging, channel) {
  messaging.registerReceiver(channel, function(name, handle) {
    handle.callback.apply(undefined, []);
  });

  function pickleType(type, value) {
    if (!value)
      return value;
    switch (type) {
    case "string":
      return String(value);
    case "function":
      if (typeof(value) != "function")
        throw new Error("Expected function, got " + typeof(value));
      if (value._handle)
        return value._handle;
      var handle = messaging.createHandle();
      handle.callback = value;
      value._handle = handle;
      return handle;
    case "number":
      return parseInt(value);
    case "anything":
      return value;
    default:
      throw new Error("Unsupported type: " + type);
    }
  }
  
  function pickleArgs(types, args) {
    var pickled = [];
    for (var i = 0; i < args.length; i++)
      pickled.push(pickleType(types[i], args[i]));
    return pickled;
  }

  function unpickleType(type, value) {
    if (!value)
      return value;
    switch (type) {
    case "string":
      if (typeof(value) != "string")
        throw new Error("Expected string, got " + typeof(value));
      return value;
    case "function":
      // TODO: How do we verify it's a handle?
      if (value.callback)
        return value.callback;
      function callback() {
        messaging.sendMessage(channel, value);
      }
      value.callback = callback;
      callback._handle = value;
      return callback;
    case "number":
      if (typeof(value) != "number")
        throw new Error("Expected number, got " + typeof(value));
      return value;
    case "anything":
      return value;
    default:
      throw new Error("Unsupported type: " + types[i]);
    }
  }

  function unpickleArgs(types, args) {
    var unpickled = [];
    for (var i = 0; i < args.length; i++)
      unpickled.push(unpickleType(types[i], args[i]));
    return unpickled;
  }
  
  return {
    pickleType: pickleType,
    pickleArgs: pickleArgs,
    unpickleType: unpickleType,
    unpickleArgs: unpickleArgs
  }
}

function normalizeMeta(meta) {
  if (typeof(meta.constructor) == "function")
    meta.constructor = {
      factory: meta.constructor,
      args: []
    };
}

function createProxyPrototype(chrome, meta, pickler) {
  var prototype = {};

  function defineProperty(name, info) {
    switch (info.type) {
    case "async-method":
      prototype[name] = function() {
        chrome.sendMessage(meta.channel, {
          msg: "property",
          name: name,
          handle: this._handle,
          args: pickler.pickleArgs(info.args, arguments)
        });
      };
      break;
    case "sync-method":
      prototype[name] = function() {
        var result = chrome.callMessage(meta.channel, {
          msg: "property",
          name: name,
          handle: this._handle,
          args: pickler.pickleArgs(info.args, arguments)
        })[0];
        return pickler.unpickleType(info.returnType, result);
      };
      break;
    case "sync-getter":
      prototype.__defineGetter__(name, function() {
        var result = chrome.callMessage(meta.channel, {
          msg: "property",
          name: name,
          handle: this._handle
        })[0];
        return pickler.unpickleType(info.returnType, result);
      });
      break;
    case "async-setter":
      prototype.__defineSetter__(name, function(value) {
        chrome.sendMessage(meta.channel, {
          msg: "property",
          name: name,
          handle: this._handle,
          args: pickler.pickleArgs(info.args, arguments)
        });
      });
      break;
    default:
      throw new Error("Unsupported type: " + info.type);
    }    
  }

  for (name in meta.properties)
    defineProperty(name, meta.properties[name]);
    
  return prototype;
};

const PICKLE_SUFFIX = "_PICKLING";

exports.createProxy = function createProxy(chrome, meta) {
  normalizeMeta(meta);

  var pickler = new Pickler(chrome, meta.channel + PICKLE_SUFFIX);

  function proxyConstructor() {
    this._handle = chrome.callMessage(meta.channel, {
      msg: "construct",
      args: pickler.pickleArgs(meta.constructor.args, arguments)
    })[0];
  };

  proxyConstructor.prototype = createProxyPrototype(chrome, meta, pickler);

  return proxyConstructor;
};

exports.registerProxyEndpoint = function registerProxyEndpoint(process, meta) {
  normalizeMeta(meta);

  var constructor = meta.constructor;
  var properties = meta.properties;
  var pickler = new Pickler(process, meta.channel + PICKLE_SUFFIX);

  function propertyAccess(options) {
    if (!(options.name in properties))
      throw new Error("Unknown property: " + options.name);
    var info = properties[options.name];
    var delegate = options.handle.delegate;
    switch (info.type) {
    case "async-method":
    case "sync-method":
      var args = pickler.unpickleArgs(info.args, options.args);
      var result = delegate[options.name].apply(delegate, args);
      if (info.type == "sync-method")
        return pickler.pickleType(info.returnType, result);
      break;
    case "sync-getter":
      return pickler.pickleType(info.returnType, delegate[options.name]);
    case "async-setter":
      var args = pickler.unpickleArgs(info.args, options.args);
      delegate[options.name] = args[0];
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
