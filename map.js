var canvas, context;

var _dragging = false;
var _startingCoord = {};
function onCanvasClick(event) {
  var coord = getMouseCoordFromEvent(event);
  var canvasCoord = { x: coord.x + (canvas.width / 3),
                      y: coord.y + (canvas.height /3 ) };
  var dontDraw = false;

  if (event.type == "dblclick") {
    zoomInAtPx(canvasCoord);
  }
  else if (event.type == "mousedown") {
    // This handles the right click case.
    if (event.which == 3 || event.button == 2) {
      zoomOutAtPx(canvasCoord);
    }
    else {
      _dragging = true;
      _startingCoord = coord;

      dontDraw = true;
    }
  }
  else if (event.type == "mouseup") {
    if (_dragging) {
      _dragging = false;

      panMap({ x: coord.x - _startingCoord.x,
               y: coord.y - _startingCoord.y });

      centerCanvas();
    }
  }
  else if (event.type == "mousemove") {
    if (_dragging) {
      var diffX = coord.x - _startingCoord.x;
      var diffY = coord.y - _startingCoord.y;

      diffX += canvas.width / -3;
      diffY += canvas.height / -3;
      translateCanvas(diffX, diffY);
    }

    dontDraw = true;
  }
  else {
    dump(event.type);
  }

  if (!dontDraw)
    testRender();
}

function translateCanvas(translateX, translateY) {
  var translateStr = "translate(" + translateX + "px, " + translateY + "px)";

  canvas.style.webkitTransform = translateStr;
  canvas.style.MozTransform = translateStr;
}

function centerCanvas() {
  var translateX = canvas.width / -3;
  var translateY = canvas.height / -3;

  translateCanvas(translateX, translateY);
}

function zoomInAtPx(coord) {
  zoomAtPx(coord, true);
}

function zoomOutAtPx(coord) {
  zoomAtPx(coord, false);
}

function zoomAtPx(coord, zoomIn) {
  var oldScaleX = mapScaleX;
  var oldScaleY = mapScaleY;

  var translateRatio = zoomIn ? (1/2) : -1;
  var scaleRatio = zoomIn ? (1/2) : 2;
  var bounds = getBounds();

  bounds.x += (coord.x * translateRatio);
  bounds.y += (coord.y * translateRatio);

  bounds.width *= Math.abs(scaleRatio);
  bounds.height *= Math.abs(scaleRatio);

  setBounds(bounds);
}

function panMap(coord) {
  var bounds = getBounds();

  bounds.x -= coord.x;
  bounds.y -= coord.y;

  setBounds(bounds);

  // XXX: Disabled grabbing new data while the server is down.
  //getDataForBounds(window.bounds);
}

function onLoad() {
  canvas = document.getElementById("main");
  context = canvas.getContext("2d");

  canvas.addEventListener("mousedown", onCanvasClick);
  canvas.addEventListener("mouseup", onCanvasClick);
  canvas.addEventListener("mousemove", onCanvasClick);
  canvas.addEventListener("dblclick", onCanvasClick);
  // Try and prevent a context menu from showing up when the user right clicks
  // on the canvas.
  canvas.addEventListener("contextmenu", function(e) { e.preventDefault(); });

  centerCanvas();

  var request = new XMLHttpRequest();
  request.open("GET", "map.osm", true);
  request.overrideMimeType("text/xml");

  request.onreadystatechange = function(evt) {
    if ((request.readyState == 4) && (request.status == 200)) {
      var start = +new Date();
      parseXML(request.responseXML);
      var end = +new Date();

      dump("Took ", (end - start), "ms to load data.");

      testRender();

      // We handle this data specifically by moving the map to a "desirable"
      // viewing position.
      panMap({ x: 200, y: 400 });

      testRender();
    }
  };

  request.onprogress = function(evt) {
    if (evt.lengthComputable) {
      drawProgress(evt.loaded / evt.total);
    }
  };

  request.send(null);
}

function getDataForBounds(bounds) {
  var str = JSON.stringify({ bbox: bounds });

  var request = new XMLHttpRequest();
  request.open("POST", "bbox", true);
  request.setRequestHeader("Content-type", "application/json");
  request.setRequestHeader("Content-length", str.length);

  request.onreadystatechange = function(evt) {
    if ((request.readyState == 4) && (request.status == 200)) {
      var start = +new Date();
      var data = JSON.parse(request.responseText);
      var end = +new Date();

      dump ("Took ", (end - start), "ms to load data from JSON.");

      nodes = data.nodes;
      ways = data.ways;

      testRender();
    }
  };

  request.send(str);
}

var _data;
// nodes: hash from id to point object. Each point is of the form:
//  lat: float, lon: float
var nodes = {};
// ways: hash from id to path object. Each path is of the form:
//  pts: array of ids, corresponding to nodes, highway: string from OSM data.
var ways = {};

var bounds = {};
// bounds: object of the form:
//   minlat: float, maxlat: float, minlon: float, maxlon: float

function parseXML(osmData) {
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
  var toRet = {};

  var pts = [];
  for (var i = 0; i < node.childNodes.length; i++) {
    var elem = node.childNodes[i];
    if (elem.nodeType != Node.ELEMENT_NODE)
      continue;

    if (elem.tagName == "nd") {
      pts.push(elem.getAttribute("ref"));
    }
    else if (elem.tagName == "tag") {
      var key = elem.getAttribute("k");
      if (key == "highway")
        toRet.highway = elem.getAttribute("v");
    }
  }

  toRet.pts = pts;

  return toRet;
}

function dump(txt) {
  var console = document.getElementById("console");
  console.textContent += (arguments.length > 1 ? Array.prototype.join.call(arguments, "") : txt) + "\n";
}

// zoomFactor: Factor used when converting points to pixels and vice-versa.
// It is rooted in Google Maps' zoom factor.
var zoomFactor = 4;
function calculateZoomFactor() {
  // In order to calculate the zoom factor, we scale from where the bounds
  // would be mapped to with a zoom factor of 1.
  var minPx = ptToPx({ lon: bounds.minlon, lat: bounds.minlat }, true);
  var maxPx = ptToPx({ lon: bounds.maxlon, lat: bounds.maxlon }, true);

  var xDiff = Math.abs(maxPx.x - minPx.x);
  var yDiff = Math.abs(maxPx.y - minPx.y);

  var xScale = Math.floor(Math.log((canvas.width / xDiff) / 256) / Math.log(2));
  var yScale = Math.floor(Math.log((canvas.height / yDiff) / 256) / Math.log(2));

  // Usually we would take the minimum of |xScale| and |yScale| so that we show
  // as much data as possible. Sadly our data is usually skewed towards having
  // too much content, so we take the maximum.
  zoomFactor = Math.max(xScale, yScale);
}

// ptToPx: converts a point object (lat, long) to a pixel object (x, y) using
//   a Mercator projection. The second parameter, |dontScale|, specifies whether
//   to apply any sort of scale. (It is usually true when we want to determine
//   what scale to provide for a set of points.)
function ptToPx(pt, dontScale) {
  var R = dontScale ? 1 : Math.pow(2, zoomFactor) * 256;
  var longOffset = 0;

  var latRad = pt.lat * Math.PI / 180;
  var lonRad = pt.lon * Math.PI / 180;

  var x = (lonRad - longOffset) * R;
  // Because we draw the points on a canvas, we negate the y position to allow
  // drawing where the |y| coordinate grows as you move down.
  var y = -1 * Math.log((Math.sin(latRad) + 1) / Math.cos(latRad)) * R;

  return { x: x, y: y };
}

// pxToPt: converts a pixel object to a point object using a Mercator
//   projection. This should be the inverse of |ptToPx|.
function pxToPt(px) {
  var R = Math.pow(2, zoomFactor) * 256;
  var longOffset = 0;

  // Just like in |ptToPx|, we must invert the y position to account for drawing
  // on a canvas.
  var y = -1 * px.y;

  var latRad = 2 * Math.atan(Math.exp(y / R)) - (Math.PI / 2);
  var lonRad = px.x / R + longOffset;

  var lat = latRad * 180 / Math.PI;
  var lon = lonRad * 180 / Math.PI;

  return { lat: lat, lon: lon };
}

function drawWay(way) {
  context.beginPath();

  var pts = way.pts.map(function(x) { return nodes[x]; });

  // Sanity check: make sure that we have data on all the points in the path.
  for (var i = 0; i < pts.length; i++) {
    if (typeof(pts[i]) == "undefined") {
      dump("Missing data on ", way.pts[i]);
      return;
    }
  }

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

function setBounds(aBounds) {
  var p1 = pxToPt({ x: aBounds.x, y: aBounds.y });
  var p2 = pxToPt({ x: aBounds.x + aBounds.width,
                    y: aBounds.y + aBounds.height });

  var minLat = Math.min(p1.lat, p2.lat);
  var minLon = Math.min(p1.lon, p2.lon);

  var maxLat = Math.max(p1.lat, p2.lat);
  var maxLon = Math.max(p1.lon, p2.lon);

  bounds.minlat = minLat;
  bounds.minlon = minLon;

  bounds.maxlat = maxLat;
  bounds.maxlon = maxLon;
}

var mapScaleX = 1;
var mapScaleY = 1;
var mapTranslateX;
var mapTranslateY;
function setupRenderBounds() {
  calculateZoomFactor();

  var bounds = getBounds();

  mapTranslateX = -1 * bounds.x;
  mapTranslateY = -1 * bounds.y;
}

function drawProgress(percent) {
  var percentTxt = Math.floor(percent * 100);

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.font = "16px sans-serif";
  context.fillText(percentTxt + "% loaded..", canvas.width / 2 - 50, canvas.height / 2);
}

function testRender() {
  setupRenderBounds();

  var start = +new Date();

  var bounds = getBounds();
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.save();

  context.scale(mapScaleX, mapScaleY);
  context.translate(mapTranslateX, mapTranslateY);

  var maxWays = 100000;
  var waysSlice = [];
  var i = 0;
  for (var x in ways) {
    if (typeof(ways[x].highway) == "undefined")
      continue;

    i++;
    if (i >= maxWays)
      break;

    waysSlice.push(ways[x]);
  }

  for (var i = 0; i < waysSlice.length; i++) {
    drawWay(waysSlice[i]);
  }

  context.restore();

  var end = +new Date();
  dump("Took ", (end - start), "ms to render map.");
}

function getMouseCoordFromEvent(event) {
  var x = 0;
  var y = 0;

  // We purposely calculate the |event.offsetX/Y|-like values because they do
  // not take CSS transforms into account, which are useful if the transform
  // is changed during the mouse event. (e.g. if the transform is changed on
  // mousedown.)
  var element = event.target;
  do {
    x += element.offsetLeft;
    y += element.offsetTop;
  } while (element = element.offsetParent);

  x = (window.pageXOffset + event.clientX) - x;
  y = (window.pageYOffset + event.clientY) - y;

  return { x: x, y: y };
}

window.onload = onLoad;
