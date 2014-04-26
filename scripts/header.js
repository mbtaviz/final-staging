(function () {
  var MIN_HEIGHT = 200;
  var $container = $('.header .container');
  var $caption = $('.header .caption');
  var svg = d3.select('.header .graphic').append("svg");
  var min = 300, max = 1000;
  var heights = d3.scale.linear()
    .domain([min, max])
    .range([min, max])
    .clamp(true);

  VIZ.requiresData([
    'json!data/station-network.json',
    'json!data/spider.json',
    'json!data/marey-trips.json'
  ]).progress(function (percent) {
    "use strict";
  }).onerror(function () {
    "use strict";
  }).done(function (network, spider, trips) {
    "use strict";
    var idToNode = {}, idToLine = {};
    network.nodes.forEach(function (data) {
      data.x = spider[data.id][0];
      data.y = spider[data.id][1];
      idToNode[data.id] = data;
    });
    network.links.forEach(function (link) {
      link.source = network.nodes[link.source];
      link.target = network.nodes[link.target];
      link.source.links = link.source.links || [];
      link.target.links = link.target.links || [];
      link.target.links.splice(0, 0, link);
      link.source.links.splice(0, 0, link);
      idToLine[link.source.id + '|' + link.target.id] = link.line;
      idToLine[link.target.id + '|' + link.source.id] = link.line;
    });

    // watch height to adjust visualization after loading data
    VIZ.watchSize(function (pageWidth, pageHeight) {
      heights
          .domain([MIN_HEIGHT, pageWidth])
          .range([MIN_HEIGHT, pageWidth]);
      var height = heights(pageHeight);
      var captionHeight = $caption.outerHeight();
      var width = $container.width();
      drawMap(svg, width, height - captionHeight);
    });


    function placeWithOffset(from, to, ratio) {
      var fromPos = idToNode[from.stop].pos;
      var toPos = idToNode[to.stop].pos;
      var midpoint = d3.interpolate(fromPos, toPos)(ratio);
      var angle = Math.atan2(toPos[1] - fromPos[1], toPos[0] - fromPos[0]) + Math.PI / 2;
      return [midpoint[0] + Math.cos(angle) * radius, midpoint[1] + Math.sin(angle) * radius];
    }

    var radius = 2;
    var minUnixSeconds = moment('2014/02/03 05:12 -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000;
    var maxUnixSeconds = moment('2014/02/04 02:00 -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000;

    setInterval(function () {
      renderTrainsAtTime(lastTime > maxUnixSeconds ? minUnixSeconds : (lastTime + 30));
    }, 1000);

    var lastTime = minUnixSeconds;
    function renderTrainsAtTime(unixSeconds, now) {
      var duration = now ? 0 : 1000;
      if (!unixSeconds) { unixSeconds = lastTime; }
      lastTime = unixSeconds;
      var active = trips.filter(function (d) {
        return d.begin < unixSeconds && d.end > unixSeconds;
      });
      var positions = active.map(function (d) {
        // get prev, next stop and mix
        for (var i = 0; i < d.stops.length - 1; i++) {
          if (d.stops[i + 1].time > unixSeconds) {
            break;
          }
        }
        var from = d.stops[i];
        var to = d.stops[i + 1];
        var ratio = (unixSeconds - from.time) / (to.time - from.time);
        return {trip: d.trip, pos: placeWithOffset(from, to, ratio), line: d.line};
      });

      var trains = svg.select('.map-container').selectAll('.train').data(positions, function (d) { return d.trip; });
      if (now) {
        trains.transition().duration(0)
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; });
      } else {
        trains.transition().duration(duration).ease('linear')
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; });
      }
      trains.enter().append('circle')
          .attr('class', function (d) { return 'train ' + d.line; })
          .attr('r', radius)
          .attr('cx', function (d) { return d.pos[0]; })
          .attr('cy', function (d) { return d.pos[1]; });
      trains.exit().remove();
      if (unixSeconds) { svg.select('.time-display').text(function () {
        var t = moment(unixSeconds * 1000);
        return t.format('dddd M/D h:mm a');
      }); }
    }

    function drawMap(svgContainer, outerWidth, outerHeight) {
      var margin = {top: 20, right: 30, bottom: 10, left: 10};
      var xRange = d3.extent(network.nodes, function (d) { return d.x; });
      var yRange = d3.extent(network.nodes, function (d) { return d.y; });
      var width = outerWidth - margin.left - margin.right,
          height = outerHeight - margin.top - margin.bottom;
      var xScale = width / (xRange[1] - xRange[0]);
      var yScale = height / (yRange[1] - yRange[0]);
      var scale = Math.min(xScale, yScale);
      network.nodes.forEach(function (data) {
        data.pos = [data.x * scale, data.y * scale];
      });
      var endDotRadius = 0.2 * scale;

      var svg = svgContainer
          .attr('width', scale * (xRange[1] - xRange[0]) + margin.left + margin.right)
          .style('margin-left', -(scale * (xRange[1] - xRange[0]) + margin.left + margin.right)/2)
          .attr('height', scale * (yRange[1] - yRange[0]) + margin.top + margin.bottom)
        .appendOnce('g', 'map-container')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      svg.appendOnce('text', 'time-display')
        .attr('x', svgContainer.attr('width') * 0.55)
        .attr('y', svgContainer.attr('height') * 0.55);

      var tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) { return d.name; });
      svg.call(tip);

      var stations = svg.selectAll('.station')
          .data(network.nodes, function (d) { return d.name; });

      var connections = svg.selectAll('.connect')
          .data(network.links, function (d) { return (d.source && d.source.id) + '-' + (d.target && d.target.id); });

      connections
          .enter()
        .append('line')
          .attr('class', function (d) { return 'connect ' + d.line; });

      connections
          .attr('x1', function (d) { return d.source.pos[0]; })
          .attr('y1', function (d) { return d.source.pos[1]; })
          .attr('x2', function (d) { return d.target.pos[0]; })
          .attr('y2', function (d) { return d.target.pos[1]; });

      stations
          .enter()
        .append('circle')
          .attr('class', function (d) { return 'station middle station-label ' + d.id; })
          .on('mouseover', function (d) {
            if (d.pos[1] < 30) {
              tip.direction('e')
                .offset([0, 10]);
            } else {
              tip.direction('n')
                .offset([-10, 0]);
            }
            tip.show(d);
          })
          .on('mouseout', tip.hide);

      stations.attr('cx', function (d) { return d.pos[0]; })
          .attr('cy', function (d) { return d.pos[1]; })
          .attr('r', 2);

      // line color circles
      function dot(id, clazz) {
        svg.selectAll('circle.' + id)
          .classed(clazz, true)
          .classed('end', true)
          .classed('middle', false)
          .attr('r', Math.max(endDotRadius, 3));
      }
      dot('place-asmnl', "red");
      dot('place-alfcl', "red");
      dot('place-brntn', "red");
      dot('place-wondl', "blue");
      dot('place-bomnl', "blue");
      dot('place-forhl', "orange");
      dot('place-ogmnl', "orange");
      renderTrainsAtTime(lastTime, true);
    }
  });

  // start adjusting height from the beginning
  VIZ.watchSize(function (pageWidth, pageHeight) {
    heights
        .domain([MIN_HEIGHT, pageWidth])
        .range([MIN_HEIGHT, pageWidth]);
    var height = heights(pageHeight);
    var captionHeight = $caption.outerHeight();
    var width = $container.width();
    $container.css('height', height + 'px');
  });
}());

