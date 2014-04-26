VIZ.requiresData([
  'json!data/delay.json',
  'json!data/station-network.json',
  'json!data/spider.json'
]).progress(function (percent) {
  "use strict";
  d3.selectAll(".interaction-all").text('Loading delay data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.select(".interaction-all").text('Error loading delay data').style('text-align', 'center');
}).done(function (delay, network, spider) {
  "use strict";
  var margin = {top: 20,right: 10,bottom: 10,left: 10};
  var outerWidth = 700;
  var outerHeight = 700;
  var height = outerHeight - margin.top - margin.bottom;
  var width = outerWidth - margin.left - margin.right;
  var idToLine = {};
  var nodesById = {};
  var delays = {};
  var entrances = {};
  var lineMapping = d3.svg.line()
    .x(function(d) { return d[0]; })
    .y(function(d) { return d[1]; })
    .interpolate("linear");

  ////////////////////////////// pre-process the data
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
  network.nodes.forEach(function (data) {
    data.x = spider[data.id][0];
    data.y = spider[data.id][1];
    nodesById[data.id] = data;
  });
  var xRange = d3.extent(network.nodes, function (d) { return d.x; });
  var yRange = d3.extent(network.nodes, function (d) { return d.y; });

  var svg = d3.select(".interaction-all").text("").append('svg')
      .attr('width', outerWidth)
      .attr('height', outerHeight)
    .append('g')
      .attr('transform', 'translate(' + (margin.left) + ',' + (margin.top) + ')');

  var days = d3.range(0, 7);
  var rowScale = d3.scale.ordinal()
      .domain(days)
      .rangeBands([0, height], 0.1);

  var rows = svg.selectAll('.row')
      .data(days)
      .enter()
    .append('g')
      .attr('class', 'row')
      .attr('transform', function (d) { return 'translate(0,' + rowScale(d) + ')'; });

  ////////////////////////////// draw the row data
  var horizonTypes = [
    'delay_actual_inbound',
    'delay_actual_outbound',
    'ins_total',
    'outs_total'
  ];
  console.log(delay);
  var horizonContainerMargin = {top: 0,right: 0,bottom: 0,left: 0};
  var horizonScale = d3.scale.ordinal()
      .domain(days)
      .rangeBands([0, rowScale.rangeBand()], 0.1);
  var horizonWidth = outerWidth - rowScale.rangeBand() - horizonContainerMargin.left - horizonContainerMargin.right;
  var horizonHeight = horizonScale.rangeBand() - horizonContainerMargin.top - horizonContainerMargin.bottom;
  var timeScale = d3.time.scale()
    .domain([0, 24 * 60 * 60 * 1000])
    .range([0, horizonWidth]);
  var timeAxis = d3.svg.axis()
    .scale(timeScale)
    .tickFormat(d3.time.format.utc("%-I%p"))
    .orient('top')
    .ticks(d3.time.hours, 2);
  svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(' + (rowScale.rangeBand() + horizonContainerMargin.left) + ',0)')
    .call(timeAxis);
  var horizonContainer = rows.append('g')
    .attr('transform', 'translate(' + (rowScale.rangeBand() + horizonContainerMargin.left) + ',' + horizonContainerMargin.top + ')');
  var horizon = d3.horizon()
      .width(width)
      .height(height)
      .bands(1)
      .mode("mirror")
      .interpolate("basis");


  ////////////////////////////// calculate glyph attributes
  var glyphMargin = {top: 0,right: 0,bottom: 0,left: 0};

  var glyphWidth = rowScale.rangeBand() - glyphMargin.left - glyphMargin.right,
      glyphHeight = rowScale.rangeBand() - glyphMargin.top - glyphMargin.bottom;

  var xScale = glyphWidth / (xRange[1] - xRange[0]);
  var yScale = glyphHeight / (yRange[1] - yRange[0]);

  var scale = Math.min(xScale, yScale);
  var dist = 0.3 * scale;
  var distScale = d3.scale.linear()
    .domain([0, 100])
    .range([0.15 * scale, 0.4 * scale]);
  var colorScale = d3.scale.pow().exponent(2)
      .domain([1.2, 0.5, 0])
      .range(['white', 'black', 'red']);
  function colorFunc(d) {
    var speed = (delays[d.day] || {})[d.ids];
    var color;
    if (speed === null || typeof speed === 'undefined') {
      color = 'white';
    } else {
      color = colorScale(speed);
    }
    return color;
  }
  var endDotRadius = 0.5 * scale;
  network.nodes.forEach(function (data) {
    data.pos = [data.x * scale, data.y * scale];
  });

  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return d.name; });
  svg.call(tip);

  ////////////////////////////// Draw the glyphs
  var lines = rows.selectAll('.connect')
      .data(function (d) { return network.links.map(function (link) { return { link: link, day: d }; })})
      .enter()
    .append('g')
      .attr('attr', 'connect');

  lines.append('g')
      .attr('class', function (d) { return d.link.line + '-glyph ' + d.link.source.id + '-' + d.link.target.id; })
    .append('path')
      .datum(function (d) {
        return {
          incoming: getEntering(d.link.source),
          line: d.link.line,
          day: d.day,
          ids: d.link.source.id + '|' + d.link.target.id,
          segment: [d.link.source.pos, d.link.target.pos],
          outgoing: getLeaving(d.link.target),
          name: d.link.source.name + " to " + d.link.target.name
        };
      })
      .attr('fill', colorFunc)
      .attr('d', lineFunction)
      .on('mouseover.tip', tip.show)
      .on('mouseout.tip', tip.hide);

  lines.append('g')
      .attr('class', function (d) { return d.link.line + '-glyph ' + d.link.target.id + '-' + d.link.source.id; })
    .append('path')
      .datum(function (d) {
        return {
          incoming: getEntering(d.link.target),
          line: d.link.line,
          day: d.day,
          ids: d.link.target.id + '|' + d.link.source.id,
          segment: [d.link.target.pos, d.link.source.pos],
          outgoing: getLeaving(d.link.source),
          name: d.link.target.name + " to " + d.link.source.name
        };
      })
      .attr('fill', colorFunc)
      .attr('d', lineFunction)
      .on('mouseover.tip', tip.show)
      .on('mouseout.tip', tip.hide);

  function getEntering(node) {
    return node.links.map(function (n) {
      var segment;
      var ids;
      if (n.target === node) {
        segment = [n.source.pos, n.target.pos];
        ids = n.source.id + "|" + n.target.id;
      } else {
        segment = [n.target.pos, n.source.pos];
        ids = n.target.id + "|" + n.source.id;
      }
      return {
        segment: segment,
        line: n.line,
        ids: ids
      };
    });
  }

  function getLeaving(node) {
    return node.links.map(function (n) {
      var segment;
      var ids;
      if (n.source === node) {
        segment = [n.source.pos, n.target.pos];
        ids = n.source.id + "|" + n.target.id;
      } else {
        segment = [n.target.pos, n.source.pos];
        ids = n.target.id + "|" + n.source.id;
      }
      return {
        segment: segment,
        line: n.line,
        ids: ids
      };
    });
  }

  // line color circles
  function dot(id, color) {
    rows.append('circle')
      .attr('cx', scale * spider[id][0])
      .attr('cy', scale * spider[id][1])
      .attr('fill', color)
      .attr('r', endDotRadius)
      .attr('stroke', "none");
  }
  dot('place-asmnl', "#E12D27");
  dot('place-alfcl', "#E12D27");
  dot('place-brntn', "#E12D27");
  dot('place-wondl', "#2F5DA6");
  dot('place-bomnl', "#2F5DA6");
  dot('place-forhl', "#E87200");
  dot('place-ogmnl', "#E87200");

  ///////////////////////////////////// Utilities

  function closestClockwise(line, lines) {
    var origAngle = angle(line.segment);
    lines = lines || [];
    var result = null;
    var minAngle = Infinity;
    lines.forEach(function (other) {
      if (same(other, line)) { return; }
      var thisAngle = angle(other.segment) + Math.PI;
      var diff = -normalize(thisAngle - origAngle);
      if (diff < minAngle) {
        minAngle = diff;
        result = other;
      }
    });
    return result;
  }
  function closestCounterClockwise(line, lines) {
    var origAngle = angle(line.segment);
    lines = lines || [];
    var result = null;
    var minAngle = Infinity;
    lines.forEach(function (other) {
      var thisAngle = angle(other.segment);
      var diff = normalize(origAngle - thisAngle);
      var absDiff = Math.abs(diff);
      if (absDiff < 0.2 || Math.abs(absDiff - Math.PI) < 0.2) { return; }
      if (diff < minAngle) {
        minAngle = diff;
        result = other;
      }
    });
    return result;
  }

  function same(a, b) {
    var sega = JSON.stringify(a.segment);
    var segb = JSON.stringify(b.segment);
    return sega === segb;
  }

  function normalize(angle) {
    return (Math.PI * 4 + angle) % (Math.PI * 2) - Math.PI;
  }

  function angle(p1, p2) {
    if (arguments.length === 1) {
      var origP1 = p1;
      p1 = origP1[0];
      p2 = origP1[1];
    }
    return Math.atan2((p2[1] - p1[1]), (p2[0] - p1[0]));
  }
  function offsetPoints(d) {
    var split = d.ids.split("|").map(function (a) {
      var val = (entrances[d.day] || {})[a];
      return distScale(val || 0);
    });
    var p1 = d.segment[0];
    var p2 = d.segment[1];
    var lineAngle = angle(p1, p2);
    var angle90 = lineAngle + Math.PI / 2;
    var p3 = [p2[0] + split[1] * Math.cos(angle90), p2[1] + split[1] * Math.sin(angle90)];
    var p4 = [p1[0] + split[0] * Math.cos(angle90), p1[1] + split[0] * Math.sin(angle90)];
    return [p4, p3];
  }
  function slope(line) {
    return (line[1][1] - line[0][1]) / (line[1][0] - line[0][0]);
  }
  function intercept(line) {
    // y = mx + b
    // b = y - mx
    return line[1][1] - slope(line) * line[1][0];
  }
  function intersect(line1, line2) {
    var m1 = slope(line1);
    var b1 = intercept(line1);
    var m2 = slope(line2);
    var b2 = intercept(line2);
    var m1Infinite = m1 === Infinity || m1 === -Infinity;
    var m2Infinite = m2 === Infinity || m2 === -Infinity;
    var x, y;
    if ((m1Infinite && m2Infinite) || Math.abs(m2 - m1) < 0.01) {
      return null;
    } else if (m1Infinite) {
      x = line1[0][0];
      // y = mx + b
      y = m2 * x + b2;
      return [x, y];
    } else if (m2Infinite) {
      x = line2[0][0];
      y = m1 * x + b1;
      return [x, y];
    } else {
      // return null;
      // x = (b2 - b1) / (m1 - m2)
      x = (b2 - b1) / (m1 - m2);
      y = m1 * x + b1;
      return [x, y];
    }
  }
  function length (a, b) {
    return Math.sqrt(Math.pow(b[1] - a[1], 2) + Math.pow(b[0] - a[0], 2));
  }
  function lineFunction (d) {
    var p1 = d.segment[0];
    var p2 = d.segment[1];
    var offsets = offsetPoints(d);
    var p3 = offsets[1];
    var p4 = offsets[0];
    var first;

    first = closestClockwise(d, d.outgoing);
    if (first && d.outgoing.length > 1) {
      var outgoingPoints = offsetPoints(first);
      var newP3 = intersect(offsets, outgoingPoints);
      if (newP3) { p3 = newP3; }
    }
    first = closestCounterClockwise(d, d.incoming);
    if (first && d.incoming.length > 1) {
      var incomingPoints = offsetPoints(first);
      var newP4 = intersect(offsets, incomingPoints);
      if (newP4) { p4 = newP4; }
    }
    return lineMapping([p1, p2, p3, p4, p1]);
  }
  function place(selection) {
    selection
      .append('path')
      .attr('fill', colorFunc)
      .attr('d', lineFunction);
  }

  function average(list) {
    return list.reduce(function (a,b) { return a+b; }) / list.length;
  }
});