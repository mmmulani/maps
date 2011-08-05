var pg = require('pg');
var quip = require('quip');
var connect = require('connect');

var conString = 'tcp://postgres:sergtsop@localhost/gis';

function getLines(bbox, cb) {
  var bboxQuery = bbox.map(function(x) { return x.lon + " " + x.lat; })
                      .join(", ");

  console.log("Getting data for ", bboxQuery);
  var numOfWays = 0;
  var numOfNodes = 0;

  pg.connect(conString, function(err, client) {
    client.query("SELECT w.id, w.nodes, w.tags " +
                 "FROM planet_osm_line l, planet_osm_ways w " +
                 "WHERE l.way && ST_Transform(ST_GeomFromText('POLYGON((" +
                    bboxQuery + "))',4326), 900913) " +
                   "AND l.osm_id = w.id",
    function(err, result) {
      var ways = {};
      for (var i = 0; i < result.rows.length; i++) {
        var row =  result.rows[i];
        if (row.tags.indexOf("highway") == -1)
          continue;

        var id = row.id;
        ways[id] = { pts: row.nodes,
                     highway: row.tags[row.tags.indexOf("highway") + 1] };
        numOfWays++;
      }

      client.query("SELECT n.id, n.tags, ST_X(ST_Transform(ST_SetSRID(ST_Point(n.lon::float / 100, n.lat::float / 100), 900913), 4326)), ST_Y(ST_Transform(ST_SetSRID(ST_Point(n.lon::float / 100, n.lat::float / 100), 900913), 4326)) " +
                   "FROM planet_osm_line l, planet_osm_ways w, planet_osm_nodes n " +
                   "WHERE l.way && ST_Transform(ST_GeomFromText('POLYGON((" +
                      bboxQuery + "))',4326), 900913) " +
                      "AND l.osm_id = w.id AND n.id = ANY(w.nodes)",
      function(err, result) {
        console.log(err);
        var nodes = {};
        for (var i = 0; i < result.rows.length; i++) {
          var row = result.rows[i];

          nodes[row.id] = { lat: row.st_y, lon: row.st_x };
          numOfNodes++;
        }

        console.log("Giving %d ways, %d nodes.", numOfWays, numOfNodes);
        cb({ ways: ways, nodes: nodes });
      });
    });
  });
}

var server = connect(
  quip(),
  connect.bodyParser(),
  connect.router(function(app) {
    app.post('/bbox', function(req, res) {
      var bbox = req.body.bbox;
      var box = [
        { lat: bbox.minlat, lon: bbox.minlon },
        { lat: bbox.minlat, lon: bbox.maxlon },
        { lat: bbox.maxlat, lon: bbox.maxlon },
        { lat: bbox.maxlat, lon: bbox.minlon },
        { lat: bbox.minlat, lon: bbox.minlon }
      ];
      var cb = function(data) {
        res.ok().json(data);
      }
      getLines(box, cb);
    });
  }),
  connect.static('/home/mmmulani/osm/webfeed/')
);

server.listen(8000);
