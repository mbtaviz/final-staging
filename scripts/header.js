(function () {
  "use strict";
  var MIN_HEIGHT = 200;
  var $container = $('.header .container');
  var $caption = $('.header .caption');
  var svg = d3.select('.header .graphic').append("svg");
  var heights = d3.scale.linear()
    .clamp(true);
  VIZ.watchSize(function (pageWidth, pageHeight) {
    heights
        .domain([MIN_HEIGHT, pageWidth])
        .range([MIN_HEIGHT, pageWidth]);
    var height = heights(pageHeight);
    var captionHeight = $caption.outerHeight();
    var width = $container.width();
    svg
        .attr('width', width)
        .attr('height', height - captionHeight);
    $container.css('height', height + 'px');

    // TODO implement header
    VIZ.placeholder(svg, width, height - captionHeight, 'intro');
  });
}());