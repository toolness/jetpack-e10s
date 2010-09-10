// This is just a placeholder that asserts it needs chrome, so that when
// required by a module in the addon process, find-tests-e10s-adapter
// is loaded.

var {Cc} = require("chrome");

throw new Error("This module should never be imported.");
