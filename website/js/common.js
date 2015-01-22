var AWPY = {};

AWPY.data_promises = {};

AWPY.fetch = function(name) {
  if (!name) {
    return Promise.resolve();
  }
  if (!AWPY.data_promises[name]) {
    AWPY.data_promises[name] = new Promise(function(resolve, reject) {
      d3.json(name, function(data) {
        if (data) {
          AWPY.convert_timestamps(data);
          resolve(data);
        } else {
          reject("failed to fetch " + name);
        }
      });
    });
  }
  return AWPY.data_promises[name];
}

AWPY.convert_timestamps = function convert_timestamps(data) {
  for (var k in data) {
    if (data[k] instanceof Array) {
      if (data[k].length > 0) {
        if (typeof data[k][0].timestamp !== "undefined") {
          MG.convert.date(data[k], "timestamp", "%Y%m%d%H%M%S");
        }
      }
    } else if (data[k] instanceof Object) {
      convert_timestamps(data[k]);
    }
  }
}


AWPY.from_location_var = function from_location_var(name) {
  var r = new RegExp("(#|&)" + name + "=([a-zA-Z0-9_\\-\\+]+)($|&)");
  var match = r.exec(window.location.hash);
  return match ? match[2] : undefined;
}


AWPY.to_location_var = function to_location_var(name, value) {
  var r = new RegExp("(#|&)" + name + "=([a-zA-Z0-9_\\-\\+]+)($|&)");
  var hash = window.location.hash;
  var match = r.exec(hash);
  if (!match) {
    if (hash && hash !== "#") {
      window.location.hash += "&" + name + "=" + value;
    } else {
      window.location.hash = "#" + name + "=" + value;
    }
  } else {
    var prefix = hash.substr(0, match.index + 1);
    var suffix = hash.substr(match.index + match[0].length - match[3].length);
    window.location.hash = prefix + name + "=" + value + suffix;
  }
}


AWPY.config = {};

AWPY.config_options = {};

AWPY.ConfigOption = function ConfigOption(name, options) {
  AWPY.config_options[name] = this;
  this.name = name;
  this.options = options || {};
  this.widgets = [];
  this.value = AWPY.from_location_var(name);
  if (typeof this.value === "undefined") {
    this.value = this.options.default;
  }
};

AWPY.ConfigOption.prototype.add_widget = function add_widget(target) {
  this.widgets.push(target);
  this._set_widget(target, this.value);
  $(target).on("change", (function() {
    var $w = $(target);
    var val;
    if ($w.attr("type") === "checkbox") {
      val = $w.get(0).checked ? "on" : "off";
    } else {
      val = $w.val();
    }
    this.set(val)
  }).bind(this));
}

AWPY.ConfigOption.prototype._set_widget = function _set_widget(widget, val) {
  var $w = $(widget);
  if ($w.attr("type") === "checkbox") {
    if (val === "on") {
      $w.get(0).checked = true;
    } else {
      $w.get(0).checked = false;
    }
  } else {
    $w.val(val)
  }
}

AWPY.ConfigOption.prototype.get = function get() {
  return this.value;
}

AWPY.ConfigOption.prototype.set = function set(val) {
  this.value = val;
  AWPY.to_location_var(this.name, val);
  for (var i = 0; i < this.widgets.length; i++) {
    this._set_widget(this.widgets[i], val);
  }
  AWPY.draw_all_the_graphs();
}


AWPY.all_graphs = [];

AWPY.draw_all_the_graphs = function draw_all_the_graphs() {
  var p = Promise.resolve();
  for (var i = 0; i < AWPY.all_graphs.length; i++) {
    p = p.then((function(i) { return function() {
      return AWPY.all_graphs[i].draw();
    };})(i));
  }
}


AWPY.Graph = function Graph(options) {
  this.options = options;
  AWPY.all_graphs.push(this);
};


AWPY.Graph.prototype.draw = function() {
  var opts = {};
  // Gather all the graph options.
  // Any functions return promises that we need to resolve async.
  var p = Promise.resolve();
  for (var k in this.options) {
    if (typeof this.options[k] !== "function") {
      opts[k] = this.options[k];
    } else {
      p = p.then((function(k) { return (function() {
        return this.options[k].call(this);
      }).bind(this);}).bind(this)(k))
      .then((function(k) { return function(val) {
        opts[k] = val;
      };})(k));
    }
  }
  return p.then((function() {
    if (!opts.width) {
      opts.width = $(opts.target).width();
    }
    if (!opts.height) {
      opts.height = 280;
      // XXX TODO: make this work without constantly growing the size...
      // var t_height = $(opts.target).parent().height();
      // opts.height = t_height > 280 ? t_height : 250;
    }
    // Re-rendering bar charts doesn't seem to work quite right.
    // This forces it to re-draw from scratch.
    if (opts.chart_type === "bar") {
      $(opts.target).empty();
    }
    MG.data_graphic(opts);
  }).bind(this));
}

$(document).ready(function() {

  $(window).on('resize', function() {
    AWPY.draw_all_the_graphs();
  });

});
