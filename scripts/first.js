(function () {
  "use strict";
  var ios = /iPad|iPod|iPhone/.test(navigator.userAgent);
  d3.select('html').classed('ios', ios);

  // Utilities
  var pageWidth = ios ? function() {
    return document.body.clientWidth;
  } : function() {
    return window.innerWidth || document.documentElement.clientWidth;
  };
  var pageHeight = ios ? function() {
    var screenWidth,
        screenHeight;
    switch (window.orientation || 0) {
    case 90:
    case -90:
      screenWidth = screen.height;
      screenHeight = screen.availWidth;
      break;
    default:
      screenWidth = screen.width;
      screenHeight = screen.availHeight;
      break;
    }
    return screenHeight / screenWidth * document.body.clientWidth;
  } : function() {
    return window.innerHeight || document.documentElement.clientHeight;
  };

  // watch resize events
  var watched = [];
  function watchSize(callback) {
    watched.push(callback);
    callback(pageWidth(), pageHeight());
  }

  function resized() {
    var width = pageWidth();
    var height = pageHeight();
    watched.forEach(function (cb) {
      cb(width, height);
    });
  }

  d3.select(window)
      .on("resize.watch", resized)
      .on("load.watch", resized)
      .on("orientationchange.watch", resized)
      .call(resized);

  // hide tip on scroll
  d3.select(window)
      .on("scroll.d3-tip-hide", function () { d3.selectAll('.d3-tip').style('top', '-50px'); });

  // add "appendOnce" method to d3 selections
  d3.selection.prototype.appendOnce = function (type, clazz) {
    var result = this.selectAll(type + '.' + clazz.replace(/ /g, '.')).data([1]);
    result.firstTime = result.enter().append(type).attr('class', clazz);
    return result;
  }

  function wrap(text, width) {
    text.each(function() {
      var text = d3.select(this),
          words = text.text().split(/\s+/).reverse(),
          word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.1, // ems
          y = text.attr("y") || 0,
          dy = parseFloat(text.attr("dy") || 0),
          tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
  }

  // TODO get rid of this
  function placeholder(parent, width, height, name) {
    var svg = parent.selectAll('g')
        .data([1]);

    var existing = parent.attr('width', width)
        .attr('height', height);

    var newOne = svg.enter()
      .append('g')
        .attr('class', 'placeholder')
        .attr('width', width)
        .attr('height', height);

    newOne.append('text').text(name).attr('x', width / 2).style('text-anchor', 'middle').attr('y', 20);

    newOne.append('rect')
        .attr('width', width)
        .attr('height', height);

    newOne.append('line')
        .attr('class', 'a')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', width)
        .attr('y2', height);

    newOne.append('line')
        .attr('class', 'b')
        .attr('x1', width)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', height);

    existing.selectAll('text').attr('x', width / 2);
    existing.selectAll('line.a').attr('x2', width).attr('y2', height);
    existing.selectAll('line.b').attr('x1', width).attr('y2', height);
    existing.selectAll('rect').attr('width', width).attr('height', height);
  }

  var todos = d3.selectAll('div.placeholder').append('svg');

  var $container = $('.container');
  watchSize(function () {
    todos.each(function () {
      placeholder(d3.select(this), $container.width(), 300, $(this.parentNode).attr('class'));
    });
  });


  window.VIZ = {
    ios: ios,
    watchSize: watchSize,
    placeholder: placeholder,
    wrap: wrap
  };
}());