VIZ.requiresData([
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/marey-trips.json',
  'json!data/marey-header.json'
]).progress(function (percent) {
  "use strict";
  d3.select(".marey").text('Loading train data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.select(".marey").text('Error loading train data').style('text-align', 'center');
}).done(function (network, spider, trips, header) {
  "use strict";

  var ANNOTATIONS = [
    {
      time: '2014/02/03 05:00',
      text: 'Service starts at 5AM on Monday morning. Time continues downward <br> \u25BE'
    },
    {
      time: '2014/02/03 11:30',
      text: 'After the morning rush-hour subsides, everything runs smoothly throughout the middle of the day'
    },
    {
      time: '2014/02/03 17:00',
      text: 'A slow train leaving JFK/UMASS Station at 5PM causes delays on trains after (below) it for over an hour',
      connections: [{
        start: '2014/02/03 17:02',
        stop: '2014/02/03 18:07',
        station: 'JFK',
        line: 'red'
      }]
    },
    {
      time: '2014/02/03 18:20',
      text: 'Service to Bowdoin stops at 6:20PM',
      connections: [{
        start: '2014/02/03 18:20',
        stop: '2014/02/03 18:26',
        station: 'Bowdoin',
        line: 'blue'
      }]
    },
    {
      time: '2014/02/04 01:30',
      text: 'The last trains of the night finish around 1:30AM'
    },
    {
      time: '2014/02/04 02:30',
      text: 'At night, trains are moved between stations',
      connections: [
        {
          start: '2014/02/04 01:56',
          stop: '2014/02/04 02:03',
          station: 'Orient Heights',
          line: 'blue'
        },
        {
          start: '2014/02/04 03:59',
          stop: '2014/02/04 04:25',
          station: 'JFK',
          line: 'red'
        }
      ]
    },
    {
      time: '2014/02/04 05:15',
      text: 'At 5AM on Tuesday, the cycle begins again'
    }
  ];


  var fixedLeft = d3.select(".fixed-left");
  var mapSvg = fixedLeft.append('svg');
  var marey = d3.select(".marey").text('').style('text-align', 'left').append('svg');
  var container = d3.select('.marey-container');
  var idToNode = {};
  var idToLine = {};
  var radius = 2.5;
  var timeDisplay;
  var showingMap;
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
  var stationToName = {};
  var end = {};
  var nodesPerLine = network.nodes.map(function (d) {
    return d.links.map(function (link) {
      var key = d.id + '|' + link.line;
      if (d.links.length === 1) { end[key] = true; }
      stationToName[key] = d.name;
      return key;
    });
  });
  nodesPerLine = _.unique(_.flatten(nodesPerLine));

  // Setup tooltips
  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return d.name; });
  marey.call(tip);

  // Setup highlighting behavior
  var highlightedTrip = null;
  var hoveredTrip = null;
  function highlight() {
    container.classed('highlight-active', !!highlightedTrip);
    container.selectAll('.highlightable')
      .classed('active', function (d) { return d.trip === highlightedTrip; });
  }
  function highlightTrain(d) {
    highlightedTrip = d.trip;
    highlight();
    d3.event.stopPropagation();
  }
  function unHoverTrain() {
    hoveredTrip = null;
    hover();
  }
  function hoverTrain(d) {
    hoveredTrip = d.trip;
    hover();
  }
  d3.select('body').on('click.highlightoff', function () { highlightedTrip = null; highlight(); });
  function hover() {
    d3.selectAll('.hoverable')
      .classed('hover', function (d) { return d.trip === hoveredTrip; });
  }
  var highlightMareyTitle = function (title, lines) {
    var titles = {};
    titles[title] = true;
    if (lines) {
      lines.forEach(function (line) { titles[title + "|" + line] = true; });
    } else if (title) {
      titles[title] = true;
      titles[title.replace(/\|.*/, '')] = true;
    }
    stationLabels.style('display', function (d) {
      var display = end[d] || titles[d];
      return display ? null : 'none';
    });
    d3.selectAll('text.station-label').classed('active', function (d) {
      return titles[d.id ? d.id : d];
    });
  };


  function renderSideMap(svgContainer, outerWidth, outerHeight) {
    var margin = {top: 10, right: 30, bottom: 10, left: 10};
    var xRange = d3.extent(network.nodes, function (d) { return d.x; });
    var yRange = d3.extent(network.nodes, function (d) { return d.y; });
    var width = outerWidth - margin.left - margin.right,
        height = outerHeight - margin.top - margin.bottom;
    var xScale = width / (xRange[1] - xRange[0]);
    var yScale = height / (yRange[1] - yRange[0]);
    var scale = Math.min(xScale, yScale);
    margin.left = (outerWidth - scale * (xRange[1] - xRange[0])) * margin.left / (margin.left + margin.right);
    margin.top = (outerHeight - scale * (yRange[1] - yRange[0])) / 3;
    network.nodes.forEach(function (data) {
      data.pos = [data.x * scale, data.y * scale];
    });
    var endDotRadius = 0.2 * scale;
    var svg = svgContainer
        .attr('width', outerWidth)
        .attr('height', outerHeight)
      .appendOnce('g', 'map-container')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var stations = svg.selectAll('.station')
        .data(network.nodes, function (d) { return d.name; });

    var connections = svg.selectAll('.connect')
        .data(network.links, function (d) { return (d.source && d.source.id) + '-' + (d.target && d.target.id); });

    connections
        .enter()
      .append('line')
        .attr('class', 'connect')
        .attr('x1', function (d) { return d.source.pos[0]; })
        .attr('y1', function (d) { return d.source.pos[1]; })
        .attr('x2', function (d) { return d.target.pos[0]; })
        .attr('y2', function (d) { return d.target.pos[1]; });

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
          // highlightMareyTitle(d.id, _.unique(d.links.map(function (link) { return link.line; })));
        })
        .on('mouseout', function (d) {
          tip.hide(d);
          // highlightMareyTitle(null);
        })
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', 3);

    stations
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; })
        .attr('r', 3);

    // line color circles
    function dot(id, clazz) {
      svg.selectAll('circle.' + id)
        .classed(clazz, true)
        .classed('end', true)
        .classed('middle', false)
        .attr('r', endDotRadius);
    }
    dot('place-asmnl', "red");
    dot('place-alfcl', "red");
    dot('place-brntn', "red");
    dot('place-wondl', "blue");
    dot('place-bomnl', "blue");
    dot('place-forhl', "orange");
    dot('place-ogmnl', "orange");
  }


  function placeWithOffset(from, to, ratio) {
    var fromPos = idToNode[from.stop].pos;
    var toPos = idToNode[to.stop].pos;
    var midpoint = d3.interpolate(fromPos, toPos)(ratio);
    var angle = Math.atan2(toPos[1] - fromPos[1], toPos[0] - fromPos[0]) + Math.PI / 2;
    return [midpoint[0] + Math.cos(angle) * radius, midpoint[1] + Math.sin(angle) * radius];
  }

  var lastTime = minUnixSeconds;
  function renderTrainsAtTime(unixSeconds) {
    if (!unixSeconds) { unixSeconds = lastTime; }
    lastTime = unixSeconds;
    if (!showingMap) { return; }
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

    var trains = mapSvg.select('.map-container').selectAll('.train').data(positions, function (d) { return d.trip; });
    trains.enter().append('circle')
        .attr('class', function (d) { return 'train highlightable hoverable dimmable ' + d.line; })
        .classed('active', function (d) { return d.trip === highlightedTrip; })
        .classed('hover', function (d) { return d.trip === hoveredTrip; })
        .attr('r', radius)
        .on('click', function (d) { highlightTrain(d); })
        .on('mouseover', hoverTrain)
        .on('mouseout', unHoverTrain);
    trains
        .attr('cx', function (d) { return d.pos[0]; })
        .attr('cy', function (d) { return d.pos[1]; });
    trains.exit().remove();
    timeDisplay.text(moment(unixSeconds * 1000).format('h:mm a'));
  }

  var xExtent = d3.extent(d3.values(header), function (d) { return d[0]; });
  var minUnixSeconds = d3.min(d3.values(trips), function (d) { return d.begin; });
  var maxUnixSeconds = d3.max(d3.values(trips), function (d) { return d.end; });
  function renderMarey(outerSvg, outerWidth) {
    outerWidth = Math.round(outerWidth);
    var margin = {top: 0, right: 200, bottom: 0, left: 60};
    var outerHeight = 3500;
    var width = outerWidth - margin.left - margin.right,
        height = outerHeight - margin.top - margin.bottom;
    outerSvg.attr('width', outerWidth)
        .attr('height', outerHeight);

    var svg = outerSvg.appendOnce('g', 'main')
        .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');
    var svgBackground = svg.appendOnce('g', 'background');
    var svg = svg.appendOnce('g', 'foreground');
    var annotationContainer = outerSvg.appendOnce('g', 'annotations')
        .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');

    var xScale = d3.scale.linear()
        .domain(xExtent)
        .range([0, width]);
    var yScale = d3.scale.linear()
      .domain([
        minUnixSeconds,
        maxUnixSeconds
      ]).range([15, height]).clamp(true);


    var timeScale = d3.time.scale()
      .domain([new Date(minUnixSeconds * 1000), new Date(maxUnixSeconds * 1000)])
      .range([15, height]);

    var keys = d3.keys(header);
    var stationXScale = d3.scale.ordinal()
        .domain(keys)
        .range(keys.map(function (d) { return xScale(header[d][0]); }));
    var stationXScaleInvert = {};
    keys.forEach(function (key) {
      stationXScaleInvert[header[key][0]] = key;
    });

    var annotations = annotationContainer.selectAll('.annotation').data(ANNOTATIONS);
    annotations
        .enter()
      .append('g')
        .attr('class', 'annotation')
      .append('text')
        .text(function (d) { return d.text; })
        .call(VIZ.wrap, margin.right - 20);

    var connections = annotations.selectAll('.annotation-connection')
        .data(function (d) { return (d.connections || []).map(function (c) { c.parent = d; return c; }); });

    connections.enter()
      .append('path')
        .attr('class', 'annotation-connection');

    // Draw annotation lines
    connections
        .attr('d', function (connection) {
          var station = network.nodes.find(function (station) { return new RegExp(connection.station, 'i').test(station.name); })
          var annotationY = yScale(moment(connection.parent.time + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000) - 4;
          var connectionStartY = yScale(moment(connection.start + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000);
          var connectionEndY = yScale(moment(connection.stop + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000);
          var connectionX = xScale(header[station.id + '|' + connection.line][0]);
          return 'M' + [
            [
              [width + 10, annotationY],
              [connectionX + 3, (connectionStartY + connectionEndY) / 2]
            ],
            [
              [connectionX, connectionStartY],
              [connectionX + 3, connectionStartY],
              [connectionX + 3, connectionEndY],
              [connectionX, connectionEndY]
            ]
          ].map(function (segment) { return segment.map(function (point) { return point.map(Math.round).join(','); }).join('L'); }).join('M');
        });

    annotationContainer.selectAll('text, text tspan')
        .attr('x', width + 15)
        .attr('y', function (d) { return yScale(moment(d.time + ' -0500', 'YYYY/MM/DD HH:m ZZ').valueOf() / 1000); });

    var stations = svg.selectAll('.station')
        .data(nodesPerLine, function (d) { return d; });

    stations
        .enter()
      .append('line')
        .attr('class', function (d) { return 'station ' + d.replace('|', '-'); });

    stations
        .attr('x1', function (d) { return xScale(header[d][0]); })
        .attr('x2', function (d) { return xScale(header[d][0]); })
        .attr('y1', 0)
        .attr('y2', height);

    var timeFmt = d3.time.format("%-I:%M %p");
    var yAxis = d3.svg.axis()
      .tickFormat(timeFmt)
      .ticks(d3.time.minute, 15)
      .scale(timeScale)
      .orient("left");
    svg.appendOnce('g', 'y axis').call(yAxis);

    // data is:
    // [
    //   {
    //     "trip": "B98A378CB",
    //     "begin": 1391577320,
    //     "end": 1391578396,
    //     "line": "blue",
    //     "stops": [
    //       {
    //         "stop": "place-wondl",
    //         "time": 1391577320
    //       },
    //       ...
    //     ]
    //   },
    //   ...
    // ]

    var lineMapping = d3.svg.line()
      .x(function(d) { return d[0]; })
      .y(function(d) { return d[1]; })
      .defined(function (d) { return d !== null; })
      .interpolate("linear");

    // draw a line for each trip
    function draw(xScale, yScale) {
      return function (d) {
        var last = null;
        var stops = d.stops.map(function (stop) {
          // special case: place-jfk, place-nqncy -> place-jfk, place-asmnl (at same time), place-nqncy 
          // special case: place-nqncy, place-jfk -> place-nqncy, place-asmnl (at same time), place-jfk
          var result;
          if (last && last.stop === 'place-jfk' && stop.stop === 'place-nqncy') {
            result = [null, {stop: 'place-asmnl', time: last.time}, stop];
          } else if (last && last.stop === 'place-nqncy' && stop.stop === 'place-jfk') {
            result = [{stop: 'place-asmnl', time: stop.time}, null, stop];
          } else {
            result = [stop];
          }
          last = stop;
          return result;
        });
        var points = _.flatten(stops).map(function (stop) {
          if (!stop) { return null; }
          var y = yScale(stop.time);
          var x = xScale(header[stop.stop + '|' + d.line][0]);
          return [x, y];
        });
        return lineMapping(points);
      };
    }

    var mareyLines = svg.selectAll('.mareyline')
        .data(trips, function (d) { return d.trip; })

    mareyLines
        .enter()
      .append('path')
        .attr('class', function (d) { return 'mareyline hoverable highlightable dimmable ' + d.line; })
        .on('click', highlightTrain)
        .on('mouseover', hoverTrain)
        .on('mouseout', unHoverTrain);

    mareyLines
        .attr('d', draw(xScale, yScale));

    container.on('mousemove', selectTime);
    container.on('mousemove.titles', updateTitle);
    var barBackground = svgBackground.appendOnce('g', 'g-bar hide-on-ios');
    var barForeground = svg.appendOnce('g', 'g-bar hide-on-ios');
    barBackground.appendOnce('line', 'bar')
        .attr('x1', 1)
        .attr('x2', width)
        .attr('y1', 0)
        .attr('y2', 0);
    barForeground.appendOnce('rect', 'text-background').firstTime
      .attr('x', 3)
      .attr('y', -14)
      .attr('width', 45)
      .attr('height', 12);
    timeDisplay = barForeground.appendOnce('text', 'timeDisplay')
    timeDisplay.firstTime
      .attr('dx', 2)
      .attr('dy', -4);
    var bar = container.selectAll("g.g-bar");

    // function highlight() {
    //   d3.select('body').classed('highlight-active', !!highlightedTrip);
    //   d3.selectAll('.highlightable')
    //     .classed('active', function (d) { return d.trip === highlightedTrip; });
    // }

    function updateTitle() {
      var pos = d3.mouse(svg.node());
      var x = pos[0];
      var station = stationXScaleInvert[Math.round(xScale.invert(x))];
      // highlightMareyTitle(station);
    }

    function selectTime() {
      var pos = d3.mouse(svg.node());
      var y = pos[1];
      var x = pos[0];
      if (x > 0 && x < width) {
        var time = yScale.invert(y);
        select(time);
      }
    }

    function select(time) {
      var y = yScale(time);
      bar.attr('transform', 'translate(0,' + y + ')');
      timeDisplay.text(moment(time * 1000).format('h:mm a'));
      renderTrainsAtTime(time);
    }

    if (!lastTime) {
      select(minUnixSeconds);
    }
  }

  // Resizing behavior
  (function () {
    var pageHeight;
    var pageWidth;
    var x0;
    var x1;
    var y0;
    var y1;
    var vizWidth;
    var MAX_WIDTH = 1000;
    var GUTTER = 20;
    var resizeTimeout;

    function renderFullScreen() {
      x1 = GUTTER;
      showingMap = false;
      marey.style("margin-left", x1 + "px");
      mapSvg.style('display', 'none');
      renderMarey(marey, vizWidth);
    }

    function renderSplitScreen() {
      showingMap = true;
      x1 = x0 + vizWidth / 3;
      marey.style("margin-left", x1 + "px");
      mapSvg.style('display', null);
      renderSideMap(mapSvg, vizWidth / 3, pageHeight);
      renderMarey(marey, vizWidth * 2 / 3);
      renderTrainsAtTime();
      scrolled();
    }

    /////////// Handle fixing the map to the side
    function resized(width, height) {
      pageWidth = width;
      vizWidth = Math.min(pageWidth, MAX_WIDTH) - GUTTER * 2;
      x0 = (pageWidth - vizWidth) / 2;
      pageHeight = height;
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(afterresized, 10);
    }

    function afterresized() {
      y0 = marey.node().offsetTop;
      y1 = y0 + marey.node().offsetHeight - innerHeight;
      render();
    }

    function render () {
      if (pageWidth <= 859 || VIZ.ios) {
        renderFullScreen();
      } else {
        renderSplitScreen();
      }
    }

    function scrolled() {
      fixedLeft.style("top", window.pageYOffset > y1 ? y1 - window.pageYOffset + "px" : window.pageYOffset < y0 ? y0 - window.pageYOffset + "px" : null);
      fixedLeft.style("left", Math.round(x0) + "px");
    }

    VIZ.watchSize(resized);
    if (!VIZ.ios) {
      // only render the side map on scroll
      d3.select(window)
          .on("scroll.fixed-left", scrolled)
          .call(afterresized);
    }
  }());
});