VIZ.requiresData([
  'json!data/turnstile-heatmap.json',
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/turnstile-gtfs-mapping.json'
]).progress(function (percent) {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('Loading train data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('Error loading train data').style('text-align', 'center');
}).done(function (turnstile, network, spider, turnstileToGtfs) {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('');

  var hourWidth = 3;
  var hourHeight = 8;
  var dayWidth = 24 * hourWidth;
  var totalWidth = dayWidth * 7.5 + 10;
  var labelWidth = 150;
  var sectionHeight = hourHeight * (1 + 4 * 2) + 40;

  var stopMargin = {top: 15,right: 0,bottom: 0,left: 0}
  var gridMargin = {top: 10,right: 0,bottom: 0,left: 20}
  var dayMargin  = {top: 0, right: 2,bottom: 2,left: 0}

  var total = d3.select('.turnstile-total').append('svg')
      .attr('width', totalWidth + labelWidth)
      .attr('height', sectionHeight);
  var all = d3.select('.turnstile-all');

  var svg = total
    .append('g')
    .attr('transform', "translate(" + stopMargin.left + "," + stopMargin.top + ")")
    .call(drawStop, 0, 'All Stations', turnstile.all, turnstile.all);

  turnstile.stops.sort(function (a, b) {
    return d3.descending(a.entrancesByType.all, b.entrancesByType.all);
  });

  // all.selectAll('.station-section')
  //     .data(turnstile.stops, function (d) { return d.name; })
  //     .enter()
  //   .append('svg')
  //     .attr('width', totalWidth + labelWidth)
  //     .attr('height', (sectionHeight))
  //   .append('g')
  //     .attr('class', 'station-section')
  //     .each(function (d, i) {
  //       d3.select(this).call(drawStop, i, d.name, d, turnstile);
  //     });

  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return getTextForRollover(d, d3.select(this).classed('entrances') ? 'entrances' : 'exits'); });
  svg.call(tip);

  var HIGHLIGHTS = {
    'holidays': [
      [3, 1]
    ],
    'snow': [
      [1, 3],
      [2, 4]
    ]
  }
  var highlightGroups = total.selectAll('.highlight-group')
      .data([2, 7])
      .enter()
    .append('g')
      .attr('class', function (d) { return 'highlight-group num' + d; })
      .attr('transform', function (d) { return 'translate(' + (labelWidth + gridMargin.left + 15) + ',' + (d * (dayMargin.bottom + hourHeight) - 6) + ')'; });
  d3.selectAll('.section-people .highlight').on('click', function (d) {
    d3.event.preventDefault();
  })
  .on('mouseover', function (d) {
    var highlight = d3.select(this).attr('data-highlight');
    var list = HIGHLIGHTS[highlight];
    highlightGroups.selectAll('rect.highlight')
        .data(list)
        .enter()
      .append('rect')
        .attr('class', 'highlight')
        .attr('width', dayWidth - 7)
        .attr('height', hourHeight + 2)
        .attr('x', function (d) { return (dayWidth + dayMargin.right) * d[1]; })
        .attr('y', function (d) { return (hourHeight + dayMargin.bottom) * d[0]; })
    total.selectAll('.num2').selectAll('line.highlight')
        .data(list)
        .enter()
      .append('line')
        .attr('class', 'highlight')
        .attr('x1', function (d) { return (dayWidth + dayMargin.right) * d[1]; })
        .attr('x2', function (d) { return (dayWidth + dayMargin.right) * d[1]; })
        .attr('y1', function (d) { return (hourHeight + dayMargin.bottom) * d[0]; })
        .attr('y2', function (d) { return (hourHeight + dayMargin.bottom) * d[0] + 5 * (dayMargin.bottom + hourHeight); });
  })
  .on('mouseout', function (d) {
    total.selectAll('.highlight').remove();
  });

  d3.selectAll('.section-people .dim').on('click', function (d) {
    d3.event.preventDefault();
  })
  .on('mouseover', function (d) {
    var dim = d3.select(this).attr('data-dim');
    total.selectAll('.' + dim).style('opacity', 0.1);
  })
  .on('mouseout', function (d) {
    var dim = d3.select(this).attr('data-dim');
    total.selectAll('.' + dim).style('opacity', 1);
  });

  ///////////////////////////// Draw the map
  var idToNode = {}, idToLine = {}, stopToLine = {};
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
    stopToLine[link.target.id] = stopToLine[link.target.id] || {};
    stopToLine[link.source.id] = stopToLine[link.source.id] || {};
    stopToLine[link.target.id][link.line] = true;
    stopToLine[link.source.id][link.line] = true;
  });

  d3.select('.section-people .glyph').append('svg').call(drawMap);

  function drawMap(svgContainer) {
    var margin = {top: 20, right: 30, bottom: 10, left: 10};
    var xRange = d3.extent(network.nodes, function (d) { return d.x; });
    var yRange = d3.extent(network.nodes, function (d) { return d.y; });
    var width = 300 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;
    var xScale = width / (xRange[1] - xRange[0]);
    var yScale = height / (yRange[1] - yRange[0]);
    var scale = Math.min(xScale, yScale);
    network.nodes.forEach(function (data) {
      data.pos = [data.x * scale, data.y * scale];
    });
    var endDotRadius = 0.2 * scale;

    var svg = svgContainer
        .attr('width', scale * (xRange[1] - xRange[0]) + margin.left + margin.right)
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
        .attr('r', 3);

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
  }

  ///////////////////// Draw the bar charg
  var bottomMargin = {top: 20,right: 20,bottom: 10,left: 20};
  var glyphMargin = {top: 20,right: 20, bottom: 20,left: 20};
  var bottomOuterWidth = 600;
  var bottomOuterHeight = 600;
  var bottomHeight = bottomOuterHeight - bottomMargin.top - bottomMargin.bottom;
  var bottomWidth = bottomOuterWidth - bottomMargin.left - bottomMargin.right;

  var bottom = d3.select(".section-people .right").append('svg')
      .attr('class', 'barchart')
      .attr('width', bottomOuterWidth)
      .attr('height', bottomOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + bottomMargin.left + ',' + (bottomMargin.top) + ')');

  var yScale = d3.scale.ordinal()
      .domain(turnstile.stops.map(function (d) { return d.name; }))
      .rangeBands([0, bottomHeight], 0.3);

  var rows = bottom.selectAll('.row')
      .data(turnstile.stops)
      .enter()
    .append('g')
      .attr('class', 'row')
      .attr('transform', function (d) { return 'translate(0,' + yScale(d.name) + ')'; });

  rows
    .append('rect')
      .attr('y', -yScale.rangeBand())
      .attr('width', bottomWidth)
      .attr('height', yScale.rangeBand())
      .attr('stroke', 'white')
      .attr('fill', 'white');

  var names = 15;
  var weekday = 120;
  var offpeak = weekday + dayWidth + 5;
  var bar = [offpeak + dayWidth + 5, bottomWidth];
  var barLenScale = d3.scale.linear()
      .domain([0, d3.max(turnstile.stops, function (d) { return d.entrancesByType.all; })])
      .range([0, bar[1] - bar[0]]);
  // name
  rows
    .append('text')
    .attr('x', names)
    .text(function (d) { return d.name; });

  // weeday heatmap
  // offpeak heatmap
  var heatmaps = rows.selectAll('.heatmaps')
      .data(function (d) {
        return [
          {parent: d, type: 'entrances', day: 'offpeak', x: offpeak, y: -yScale.rangeBand()},
          {parent: d, type: 'exits', day: 'offpeak', x: offpeak, y: -yScale.rangeBand() / 2},
          {parent: d, type: 'entrances', day: 'weekday', x: weekday, y: -yScale.rangeBand()},
          {parent: d, type: 'exits', day: 'weekday', x: weekday, y: -yScale.rangeBand() / 2}
        ];
      })
      .enter()
    .append('g')
      .attr('class', 'heatmap')
      .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });

  var positionScale = d3.scale.ordinal()
   .rangeRoundBands([0, dayWidth], 0, 0)
   .domain(d3.range(0, 24));

  var colorScale = d3.scale.linear()
    .domain([turnstile.min, turnstile.mean || turnstile.max * 0.9, turnstile.max])
    .range(['white', 'black', 'red']);
  heatmaps.selectAll('rect')
    .data(function (d) { return d.parent.averagesByType[d.day].map(function (other) {
      return {
        hour: other.hour,
        datum: other[d.type]
      };
    }); })
    .enter().append('rect')
    .attr('x', function(d) { return positionScale(d.hour); })
    .attr('width', hourWidth)
    .attr('height', yScale.rangeBand()/2)
    .attr('fill', function(d) { return colorScale(d.datum); });

  // bar
  rows.append('rect')
    .attr('class', 'bar')
    .attr('x', bar[0])
    .attr('y', -yScale.rangeBand())
    .attr('width', function (d) { return barLenScale(d.entrancesByType.all); })
    .attr('height', yScale.rangeBand());

  var lines = ['red', 'blue', 'orange'];
  var lineDotScale = d3.scale.ordinal()
      .domain([1, 0])
      .rangePoints([0, 10]);
  rows.selectAll('.line')
      .data(function (d) { return lines.filter(function (line) { return stopToLine[turnstileToGtfs[d.name]][line]; }); })
      .enter()
    .append('circle')
      .attr('r', 2)
      .attr('cx', function (d, i) { return lineDotScale(i); })
      .attr('cy', -3)
      .attr('class', function (d) { return 'line ' + d; })
    
  function drawStop(container, i, name, stopData, aggs) {
    setTimeout(function () {
      var daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];

      var gridWidth = (dayWidth + dayMargin.right) * 7;
      var gridTranslate = gridWidth + gridMargin.left + gridMargin.right

      var svg = container.append('g')
          .attr('transform', 'translate(' + labelWidth + ',0)');

      var label = container.append('g')
          .attr('transform', 'translate(' + (labelWidth/2) + ',0)');

      label.append('text')
        .attr('class', 'station header')
        .attr('dy', 25)
        .text(name);
      label.append('text')
        .attr('dy', 45)
        .attr('class', 'station total')
        .text(d3.format(',')(d3.round(stopData.entrancesByType.all, -2)) + ' per day');
      label.append('text')
        .attr('dy', 60)
        .attr('class', 'station partial')
        .text(d3.format(',')(d3.round(stopData.entrancesByType.weekday, -2)) + ' weekdays');
      label.append('text')
        .attr('dy', 73)
        .attr('class', 'station partial')
        .text(d3.format(',')(d3.round(stopData.entrancesByType.offpeak, -2)) + ' weekends');

      // draw one grid for entrances or exits with axis labels
      // and a heat map for values.  Datatype can be either
      // 'entrances' or 'exits'
      var dayLabels = svg.selectAll('.dayLabel')
        .data(daysOfWeek)
        .enter()
        .append('g')
        .attr('class', 'xAxis');

      dayLabels.append('text')
        .attr('class', 'dayLabel')
        .text(function (d) {return d})
        .attr('dx', function (d, i) {return dayWidth/2})
        .attr('dy', 0)
        .style('text-anchor', 'middle');

      var hourLabelsScale = d3.scale.ordinal()
        .domain(['6am', '12pm', '6pm'])
        .rangePoints([0, dayWidth], 2.0);
      var xAxis = d3.svg.axis()
        .scale(hourLabelsScale)
        .orient('bottom')
        .tickSize(-3);
      dayLabels
        .attr('transform', function(d, i) {return 'translate('+(3 + gridMargin.left + (dayWidth + dayMargin.right) * i) +',0)'})
        .call(xAxis);

      var stop = svg.append('g')
        .attr('transform', 'translate('+gridMargin.left+','+gridMargin.top+")");

      var colorScale = d3.scale.linear()
        .domain([aggs.min, aggs.mean || aggs.max * 0.9, aggs.max])
        .range(['white', 'black', 'red']);

      var positionScale = d3.scale.ordinal()
       .rangeRoundBands([0, dayWidth], 0, 0)
       .domain(d3.range(0, 24));

      // draw the heat map
      stop.selectAll('.exits')
        .data(stopData.times)
        .enter().append('rect')
        .attr('class', 'exits')
        .attr('x', function(d) { return (dayWidth + dayMargin.right) * day(d) + positionScale(hour(d)) })
        .attr('y', function(d) { return (hourHeight + dayMargin.bottom)* (week(d) + 5) })
        .attr('width', hourWidth)
        .attr('height', hourHeight)
        .attr('fill', function(d) { return colorScale(d['exits']) });

      stop.selectAll('.entrances')
        .data(stopData.times)
        .enter().append('rect')
        .attr('class', 'entrances')
        .attr('x', function(d) { return (dayWidth + dayMargin.right) * day(d) + positionScale(hour(d)) })
        .attr('y', function(d) { return (hourHeight + dayMargin.bottom)* week(d) })
        .attr('width', hourWidth)
        .attr('height', hourHeight)
        .attr('fill', function(d) { return colorScale(d['entrances']) });

      svg.append('text')
        .attr('class', 'groupLabel')
        .attr('transform', 'translate(' + (totalWidth - 10) + ',' + (5) + ')rotate(90)')
        .text('entrances')
        .style('text-anchor', 'beginning');

      svg.append('text')
        .attr('class', 'groupLabel')
        .attr('transform', 'translate(' + (totalWidth - 10) + ',' + (hourHeight * 8.5) + ')rotate(90)')
        .text('exits')
        .style('text-anchor', 'beginning');

      svg
        .onOnce('mouseover', 'rect', tip.show)
        .onOnce('mouseout', 'rect', tip.hide);
    }, i * 100);
  }

  // our data looks like this
  // {
  //   "time": "2014-02-01 05:10:00",
  //   "entrances": 1,
  //   "exits": 1
  // }
  var format = d3.time.format("%Y-%m-%d %H:%M:%S");
  var begining = format.parse('2014-01-26 00:00:00');
  var formatForDisplay = d3.time.format("%b %d, %H:%M");

  function hour(d) {
    return d.hour;
  }

  // zero based day of the week
  function day(d) {
    return d.day;
  }

  // zero based week index for february
  function week(d) {
    return d.week - 1;
  }

  // function getId(stopName, type) {
  //   return stopName.replace(/\s+/g, '').replace(/\//g, '') + type;
  // }

  function getTextForRollover(d, dataType) {
    return moment(d.time).format('M/D ha')+' '+d3.format(',')(d[dataType])+' '+dataType;
  }
});