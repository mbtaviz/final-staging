VIZ.requiresData([
  'json!data/delay.json',
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/average-actual-delays.json'
]).progress(function (percent) {
  "use strict";
  d3.selectAll(".interaction-all").text('Loading delay data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.select(".interaction-all").text('Error loading delay data').style('text-align', 'center');
}).done(function (delay, network, spider, averageActualDelays) {
  "use strict";
  var bottomMargin = {top: 20,right: 50,bottom: 10,left: 40};
  var glyphMargin = {top: 20,right: 20, bottom: 20,left: 20};
  var glyphOuterHeight = 300;
  var glyphOuterWidth = 300
  var glyphWidth = glyphOuterWidth - glyphMargin.left - glyphMargin.right,
      glyphHeight = glyphOuterHeight - glyphMargin.top - glyphMargin.bottom;
  var bottomOuterWidth = 600;
  var bottomOuterHeight = 300;
  var bottomHeight = bottomOuterHeight - bottomMargin.top - bottomMargin.bottom;
  var bottomWidth = bottomOuterWidth - bottomMargin.left - bottomMargin.right;
  var idToLine = {};
  var nodesById = {};
  var delays = {};
  var entrances = {};
  var exits = {};
  var lineMapping = d3.svg.line()
    .x(function(d) { return d[0]; })
    .y(function(d) { return d[1]; })
    .interpolate("linear");

  delay.sort(function (a, b) {
    return d3.ascending(a.msOfDay, b.msOfDay);
  });

  window.delay = delay;

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

  var glyph = d3.select(".interaction-all").text("").append('svg')
      .attr('class', 'breathing-glyph')
      .attr('width', glyphOuterWidth)
      .attr('height', glyphOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + (glyphMargin.left) + ',' + (glyphMargin.top) + ')');

  var bottom = d3.select(".interaction-all").append('svg')
      .attr('class', 'horizons')
      .attr('width', bottomOuterWidth)
      .attr('height', bottomOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + 0 + ',' + (bottomMargin.top) + ')');

  var days = d3.range(0, 7);
  var rowScale = d3.scale.ordinal()
      .domain([1, 2, 3, 4, 5, 6, 0])
      .rangeRoundBands([0, bottomHeight], 0.3);

  var outerRow = bottom.selectAll('.row')
      .data(days)
      .enter()
    .append('g')
      .attr('class', 'row');

  var rows = outerRow.append('g')
      .attr('transform', function (d) { return 'translate(' + bottomMargin.left + ',' + rowScale(d) + ')'; });

  var rowLabels = outerRow.append('g')
      .attr('transform', function (d) { return 'translate(' + (bottomMargin.left / 2) + ',' + rowScale(d) + ')'; });
  rowLabels.append('text')
    .attr('class', 'daylabel')
    .attr('dy', rowScale.rangeBand() - 15)
    .attr('text-anchor', 'middle')
    .text(function (d) { return moment.weekdaysShort()[d]; });
  rowLabels.append('text')
    .attr('class', 'dayofmonthlabel')
    .attr('dy', rowScale.rangeBand() - 2)
    .attr('text-anchor', 'middle')
    .text(function (d) { return 'Feb ' + (2 + (d === 0 ? 7 : d)); });

  ////////////////////////////// draw the row data
  var horizonType = 'ins_total';
  var delayMapHeight = 5;
  var horizonMargin = {top: 0, right: 0, bottom: delayMapHeight, left: 0};
  var horizonWidth = bottomWidth - horizonMargin.left - horizonMargin.right;
  var horizonHeight = rowScale.rangeBand() - horizonMargin.top - horizonMargin.bottom;
  var timeScale = d3.time.scale()
    .domain([0, 24 * 60 * 60 * 1000])
    .range([0, horizonWidth])
    .clamp(true);
  var timeAxis = d3.svg.axis()
    .scale(timeScale)
    .tickFormat(d3.time.format.utc("%-I%p"))
    .orient('top')
    .ticks(d3.time.hours, 2);
  var axisContainer = bottom.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(' + bottomMargin.left + ',0)')
    .call(timeAxis);
  var horizon = d3.horizon()
      .width(horizonWidth)
      .height(horizonHeight)
      .yMax(1.1)
      .bands(3)
      .mode("offset")
      .interpolate("basis");
  horizon.color.domain([-4, 0, 4]).range(['#555', 'white', '#555']);
  var horizons = rows.append('g')
      .attr('class', 'horizon-row')
      .attr('transform', 'translate(' + horizonMargin.left + ',' + horizonMargin.top + ')');

  horizons.selectAll('.horizon')
      .data(function (d, i) {
        var min = d3.min(delay, function (t) { return t[horizonType]; });
        var max = d3.max(delay, function (t) { return t[horizonType]; });
        var scale = d3.scale.linear().domain([min, max]);
        return [
          _.chain(delay)
            .where({day: d})
            .filter(function (t) { return typeof (t[horizonType]) === 'number'; })
            .map(function (t) { return [t.msOfDay, scale(t[horizonType])]; })
            .value()
        ];
      })
      .enter()
    .append('g')
      .attr('class', 'horizon')
      .call(horizon);


  var byDay = _.toArray(_.groupBy(delay, 'day'));
  var buckets = 24 * 4;
  var gradient = bottom.append("svg:defs").selectAll('linearGradient')
      .data(byDay)
      .enter()
    .append("svg:linearGradient")
      .attr("id", function (d, i) { return "gradient" + i; })
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%")
      .attr("spreadMethod", "pad");

  var delayMapColorScale = d3.scale.linear()
      .interpolate(d3.interpolateLab)
      .domain([-0.2, 0, 0.4])
      .range(['rgb(0, 104, 55)', 'rgb(255, 255, 255)', 'rgb(165, 0, 38)']);

  var delayMapXScale = d3.scale.linear()
      .domain([0, 24 * 60 * 60])
      .range(["0%", "100%"]);

  gradient.selectAll('stop')
      .data(function (d) { return d; })
      .enter()
    .append("svg:stop")
      .attr("offset", function (d) { return delayMapXScale(d.msOfDay + 60 * 7.5); })
      .attr("stop-color", function (d) { return delayMapColorScale(d.delay_actual); })
      .attr("stop-opacity", 1);

  horizons.append('rect')
      .attr('class', 'delay-rect')
      .attr('y', horizonHeight)
      .attr('width', horizonWidth)
      .attr('height', delayMapHeight)
      .attr('fill', function (d) { return "url(#gradient" + d + ")"; })

  ////////////////////////////// calculate glyph attributes

  var xScale = glyphWidth / (xRange[1] - xRange[0]);
  var yScale = glyphHeight / (yRange[1] - yRange[0]);

  var scale = Math.min(xScale, yScale);
  var dist = 0.3 * scale;
  var distScale = d3.scale.linear()
    .domain([0, 100])
    .range([0.15 * scale, 0.7 * scale]);
  var colorScale = d3.scale.pow().exponent(2)
      .domain([1.2, 0.5, 0])
      .range(['white', 'black', 'red']);
  function colorFunc(d) {
    var speed = delays[d.ids];
    var color;
    if (speed === null || typeof speed === 'undefined') {
      color = 'white';
    } else {
      color = colorScale(speed);
    }
    return color;
  }
  var endDotRadius = 0.3 * scale;
  network.nodes.forEach(function (data) {
    data.pos = [data.x * scale, data.y * scale];
  });

  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return d.name; });
  glyph.call(tip);

  d3.select('.interaction-all').on('mousemove', mouseover);

  var bar = bottom.append('g').attr('class', 'indicator');
  bar.append('line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', -10)
    .attr('y2', rowScale.rangeBand() + 10);
  var timeDisplay = bar.append('text').attr('dx', -3).attr('dy', -1).attr('text-anchor', 'end');
  var insDisplay = bar.append('text').attr('dx', 3).attr('dy', -1).attr('text-anchor', 'beginning');
  var delayDisplay = bar.append('text').attr('dx', 3).attr('dy', rowScale.rangeBand() + 10).attr('text-anchor', 'beginning');
  var bisect = d3.bisector(function (d) { return d.msOfDay; }).left;
  var bucketSize = 15*60*1000;
  function mouseover() {
    var x = d3.mouse(bottom.node())[0] - bottomMargin.left;
    var y = d3.mouse(bottom.node())[1];
    if (y < 0 || x < bottomMargin.top) { return; }
    var day = Math.max(1, d3.bisectLeft(rowScale.range(), y)) % 7;
    var theTime = timeScale.invert(x).getTime();
    x = timeScale(theTime);
    y = rowScale(day);
    bar.attr('transform', 'translate(' + (x+bottomMargin.left) + ',' + y + ')');
    timeDisplay.text(moment(theTime).utc().format('h:mm a'));
    var inputData = byDay[day];
    delays = {};
    var idx = bisect(inputData, theTime / 1000) - 1;
    var ratio = (theTime % bucketSize) / bucketSize;
    var before = inputData[idx] || {outs:{}, ins:{},lines:[]};
    var after = inputData[idx+1] || before;
    entrances = d3.interpolate(before.ins, after.ins)(ratio);
    insDisplay.text(d3.format('f')(d3.interpolate(before.ins_total, after.ins_total)(ratio)) + " entries/min");
    var delay = d3.interpolate(before.delay_actual, after.delay_actual)(ratio)
    if (delay < 0) {
      delayDisplay.text(d3.format('%')(-delay) + " fast");
    } else {
      delayDisplay.text(d3.format('%')(delay) + " slow");
    }
    // exits = d3.interpolate(before.outs, after.outs)(ratio);
    var lines = d3.interpolate(before.lines, after.lines)(ratio);
    lines.forEach(function (datum) {
      var line = datum.line;
      var byPair = datum.delay_actual;
      function update(FROM, TO) {
        var key = FROM + "|" + TO;
        if (byPair.hasOwnProperty(key)) {
          var diff = byPair[key];
          var median = averageActualDelays[key];
          var speed = median / diff;
          delays[key] = speed;
        } else if (line === idToLine[key]) {
          delays[key] = null;
        }
      }

      network.links.forEach(function (link) {
        update(link.source.id, link.target.id);
        update(link.target.id, link.source.id);
      });
    });

    glyph.selectAll('.connect path')
      .attr('fill', colorFunc)
      .attr('d', lineFunction);
  }

  ////////////////////////////// Draw the glyphs
  var lines = glyph.selectAll('.connect')
      .data(function (d) { return network.links.map(function (link) { return { link: link, day: d }; })})
      .enter()
    .append('g')
      .attr('class', 'connect');

  lines.append('g')
      .attr('class', function (d) { return d.link.line + '-glyph ' + d.link.source.id + '-' + d.link.target.id; })
    .append('path')
      .datum(function (d) {
        return {
          incoming: getEntering(d.link.source),
          line: d.link.line,
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

  function getEntering(node, day) {
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
        ids: ids,
        day: day
      };
    });
  }

  function getLeaving(node, day) {
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
        ids: ids,
        day: day
      };
    });
  }

  // line color circles
  function dot(id, color) {
    glyph.append('circle')
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
      var val = entrances[a];
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
    var ids = d.ids.split("|");
    var src = ids[0];
    var dest = ids[1];
    return lineMapping([p1, p2, p3, p4, p1]);
  }
  function place(selection) {
    selection
      .append('path')
      .attr('fill', colorFunc)
      .attr('d', lineFunction);
  }

  var lineMapping = d3.svg.line()
    .x(function(d) { return d[0]; })
    .y(function(d) { return d[1]; })
    .interpolate("linear");

  function average(list) {
    return list.reduce(function (a,b) { return a+b; }) / list.length;
  }
});