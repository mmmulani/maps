var canvas, context;

function onLoad() {
  canvas = document.getElementById("main");
  context = canvas.getContext("2d");

  var request = new XMLHttpRequest();
  request.open("GET", "map.osm", true);
  request.overrideMimeType("text/xml");

  request.onreadystatechange = function(evt) {
    if ((request.readyState == 4) && (request.status == 200)) {
      var start = +new Date();
      init(request.responseXML);
      var end = +new Date();

      dump("Took ", (end - start), "ms to load data.");
    }
  };

  request.send(null);
}

var _data;
// nodes: hash from id to point object. Each point is of the form:
//  lat: float, lon: float
var nodes = {};
// ways: hash from id to path object. Each path is of the form:
//  pts: array of ids, corresponding to nodes.
var ways = {};

var bounds = {};
// bounds: object of the form:
//   minlat: float, maxlat: float, minlon: float, maxlon: float

function init(osmData) {
  _data = osmData;
  var data = osmData.firstChild.childNodes;
  for (var i = 0; i < data.length; i++) {
    var node = data[i];
    if (node.nodeType != Node.ELEMENT_NODE)
      continue;

    switch (node.tagName) {
      case "node":
        var id = node.getAttribute("id");
        if (typeof(nodes[id]) != "undefined")
          break;

        nodes[id] = { lat: parseFloat(node.getAttribute("lat")),
                      lon: parseFloat(node.getAttribute("lon")) };

        break;
      case "bounds":
        bounds = { minlat: parseFloat(node.getAttribute("minlat")),
                   minlon: parseFloat(node.getAttribute("minlon")),
                   maxlat: parseFloat(node.getAttribute("maxlat")),
                   maxlon: parseFloat(node.getAttribute("maxlon")) };

        break;
      case "way":
        var id = node.getAttribute("id");
        if (typeof(ways[id]) != "undefined")
          break;

        ways[id] = extractWay(node);

        break;
    }
  }
}

function extractWay(node) {
  var pts = [];
  for (var i = 0; i < node.childNodes.length; i++) {
    var elem = node.childNodes[i];
    if (elem.nodeType != Node.ELEMENT_NODE)
      continue;

    if (elem.tagName == "nd") {
      pts.push(elem.getAttribute("ref"));
    }
  }

  return { pts: pts };
}

function dump(txt) {
  var console = document.getElementById("console");
  console.textContent += (arguments.length > 1 ? Array.prototype.join.call(arguments, "") : txt) + "\n";
}

// ptToPx: converts a point object (lat, long) to a pixel object (x, y) using
//   a Mercator projection.
function ptToPx(pt) {
  var R = Math.pow(2, 13) * 256;
  var longOffset = 0;

  var latRad = pt.lat * Math.PI / 180;
  var lonRad = pt.lon * Math.PI / 180;

  var x = (lonRad - longOffset) * R;
  var y = Math.log((Math.sin(latRad) + 1) / Math.cos(latRad)) * R;

  return { x: x, y: y };
}

function drawWay(way) {
  context.beginPath();
  var pts = way.pts.map(function(x) { return nodes[x]; });

  var firstPx = ptToPx(pts[0]);
  context.moveTo(firstPx.x, firstPx.y);

  for (var i = 1; i < pts.length; i++) {
    var px = ptToPx(pts[i]);
    context.lineTo(px.x, px.y);
  }

  context.stroke();
}

function getBounds() {
  var minBound = ptToPx({ lat: bounds.minlat, lon: bounds.minlon });
  var maxBound = ptToPx({ lat: bounds.maxlat, lon: bounds.maxlon });

  var x = Math.min(minBound.x, maxBound.x);
  var y = Math.min(minBound.y, maxBound.y);

  var width = Math.abs(minBound.x - maxBound.x);
  var height = Math.abs(minBound.y - maxBound.y);

  return { x: x, y: y, width: width, height: height };
}

function test() {
  var bounds = getBounds();
  context.translate(-1 * bounds.x, -1 * bounds.y);

  var maxWays = 1000;
  var waysSlice = [];
  var i = 0;
  for (var x in ways) {
    i++;
    if (i >= maxWays)
      break;

    waysSlice.push(ways[x]);
  }

  for (var i = 0; i < waysSlice.length; i++) {
    drawWay(waysSlice[i]);
  }
}

window.onload = onLoad;