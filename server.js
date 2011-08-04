var pg = require('pg');
var quip = require('quip');
var connect = require('connect');

var conString = 'tcp://postgres:sergtsop@localhost/gis';

function getLines(bbox) {
  var bboxQuery = bbox.map(function(x) { return x.lat + " " + x.lon; }).join(", ");
  pg.connect(conString, function(err, client) {
    console.log(err);
    client.query({
      text: "SELECT w.id, w.nodes, w.tags " +
            "FROM planet_osm_line l, planet_osm_ways w " +
            "WHERE l.way && ST_Transform(ST_GeomFromText('POLYGON(($1))',4326), 900913) " +
              "AND l.osm_id = w.id",
      values: [bboxQuery],
    },
    function(err, result) {
      console.log("in query");
      console.log("row count: %d", result.rows.length);
    });
  });
}

var server = connect(
  quip(),
  connect.bodyParser(),
  connect.router(function(app) {
    app.post('/bbox', function(req, res) {
      var box = req.body.bbox;
      console.log('got request for ', box);
      res.ok().json({ test: 1 });
    });
  }),
  connect.static('/home/mmmulani/osm/webfeed/')
);

server.listen(8000);
