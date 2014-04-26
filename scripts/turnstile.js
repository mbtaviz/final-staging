VIZ.requiresData([
  'json!data/turnstile-heatmap.json'
]).progress(function (percent) {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('Loading train data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.selectAll(".turnstile-all, .turnstile-total").text('Error loading train data').style('text-align', 'center');
}).done(function (turnstile) {
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
  var all = d3.select('.turnstile-all').append('svg')
      .attr('width', totalWidth + labelWidth)
      .attr('height', (sectionHeight * turnstile.stops.length));

  var svg = total
    .append('g')
    .attr('transform', "translate(" + stopMargin.left + "," + stopMargin.top + ")")
    .call(drawStop, 0, 'All Stations', turnstile.all, turnstile.all);

  turnstile.stops.sort(function (a, b) {
    return d3.descending(a.entrancesByType.all, b.entrancesByType.all);
  });

  all.selectAll('.station-section')
      .data(turnstile.stops, function (d) { return d.name; })
      .enter()
    .append('g')
      .attr('class', 'station-section')
      .attr('transform', function (d, i) {
        return 'translate(0,' + (sectionHeight * i) + ')';
      })
      .each(function (d, i) {
        d3.select(this).call(drawStop, i, d.name, d, turnstile);
      });

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