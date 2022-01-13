/*
Tamworth, NSW, Australia (-31.083332, 150.916672)
Queanbeyan, NSW, Australia (-35.353333, 149.234161)
Penrith, NSW, Australia (-33.758011, 150.705444)
Newcastle, NSW, Australia (-32.916668, 151.750000)
Liverpool, NSW, Australia (-33.920921, 150.923141)
Lithgow, NSW, Australia (-33.483334, 150.149994)
Goulburn, NSW, Australia (-34.754723, 149.618607)
Dubbo, NSW, Australia (-32.256943, 148.601105)
Cessnock NSW, Australia (-32.834167, 151.355499)
Campbelltown, NSW, Australia (-34.064999, 150.814163)
*/
const endpoint = 'https://elasticsearch-restaurants-api-nodejs.khoa2016.repl.co';
var map = null;
var index_name = 'restaurants';
var map_center = [-37.840935, 144.946457];
var center = null;
var default_type = 'm';
var default_enlarge = 'circle';
var default_distance_circle = 200;
var default_distance_horizontal = 150;
var default_distance_vertical = 150;
var marker = null;
var circle = null;
var arr_icons = [
  'https://cdn-icons-png.flaticon.com/512/325/325573.png', 'https://cdn-icons-png.flaticon.com/512/2533/2533600.png', 'https://cdn-icons-png.flaticon.com/512/2934/2934069.png',
  'https://cdn-icons-png.flaticon.com/512/846/846398.png'
];
var rectangle = null;
var infowindow = null;
var infowindow_restaurant = null;
var txt_point = null;
var rectangle_distance = [];
var circle_distance = null;
var autocomplete = null;
var xhr_query = null;
var max_distance_circle_in_miles = 4;
var nax_distance_horizontal_in_miles = 4;
var nax_distance_vertical_in_miles = 4;
var max_distance_circle_in_km = 10;
var nax_distance_horizontal_in_km = 10;
var nax_distance_vertical_in_km = 10;
var test_longtime = false;
var content_template = `<div class="iw-main">
  <h4 title="Location: {latitude}, {longitude}">{title}</h4>
  <div class="iw-body">
  <img src="{photo}" class="float-start me-3 iw-img">
  <div>{description}</div>
  </div>
</div>
`;
var help_text = `
  <p>Please enter your address on the textbox to search restaurants near you or click on the map to manual choose, you can drag the marker to specify.</p>
  <p>You can also use advanced filter by clicking the <span class="badge bg-secondary">Advanced</span> button.</p>
  <p>Happy searching...</p>
`;
var arr_markers = [];
var arr_restaurants = [];
var search_result_message = '';
var max_search_results = 80;

var grp = ['#grp-distance', '#grp-horizontal', '#grp-vertical'];

function initialize() {
  center = new google.maps.LatLng(map_center[0], map_center[1]);

  var mapOptions = {
    center,
    zoom: 9,
    styles: map_styles
  };

  map = new google.maps.Map(document.getElementById("map"), mapOptions);

  circle = new google.maps.Circle({
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillOpacity: 0,
    visible: false,
    draggable: true,
    editable: true,
    map,
    // center,
    radius: default_distance_circle,
  });

  rectangle = new google.maps.Rectangle({
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillOpacity: 0,
    visible: false,
    draggable: true,
    editable: true,
    map,
    // bounds: {
    //   north: 33.685,
    //   south: 33.671,
    //   east: -116.234,
    //   west: -116.251,
    // },
  });

  marker = new google.maps.Marker({
    position: center,
    map: map,
    icon: {
      // url: '/imgs/marker-x64.png',
      url: 'https://cdn-icons-png.flaticon.com/512/1946/1946401.png',
      scaledSize: { width: 40, height: 40 }
    },
    draggable: true,
    visible: false
  });

  map.addListener("click", (event) => {
    var latLng = event.latLng;
    txt_point.val(latLng.toUrlValue());
    infowindow.setContent(`Your location: <br/><strong class="fw-bold">${latLng.toUrlValue()}</strong>`);
    marker.setOptions({ position: latLng, visible: true });
    if (is_circle())
      circle.setOptions({ center: latLng, visible: true });
    else if (rectangle.getVisible())
      move_rectange(latLng);
  });

  infowindow = new google.maps.InfoWindow({ maxWidth: 400, content: '' });
  infowindow_restaurant = new google.maps.InfoWindow({ maxWidth: 400, content: '' });

  marker.addListener("click", () => {
    infowindow.open({
      anchor: marker, map
    });
  });

  marker.addListener('drag', function (event) {
    var latLng = event.latLng;
    txt_point.val(latLng.toUrlValue());
    infowindow.setContent(`Your location: <br/><strong class="fw-bold">${latLng.toUrlValue()}</strong>`);
    if (circle.getVisible())
      circle.setCenter(latLng);
    else if (rectangle.getVisible())
      move_rectange(latLng);
  });

  circle.addListener('radius_changed', function () {
    circle_distance = circle.getRadius();
  });

  circle.addListener('center_changed', function () {
    var latLng = circle.getCenter();
    if (latLng) {
      txt_point.val(latLng.toUrlValue());
      marker.setPosition(latLng);
    }
  });

  rectangle.addListener('bounds_changed', function () {
    var center = rectangle.getBounds().getCenter();
    txt_point.val(center.toUrlValue());
    marker.setPosition(center);
    set_distance_rectange();
  });

  var search_options = {
    componentRestrictions: { country: "au" }
  };
  autocomplete = new google.maps.places.Autocomplete(document.getElementById('txt-address'), search_options);

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();

    if (!place.geometry || !place.geometry.location) {
      // User entered the name of a Place that was not suggested and
      // pressed the Enter key, or the Place Details request failed.
      // window.alert("No details available for input: '" + place.name + "'");
      set_point('#txt-address');
      return;
    }

    // If the place has a geometry, then present it on a map.
    if (place.geometry.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
      map.setZoom(12);
    }

    txt_point.val(place.geometry.location.toUrlValue());

    infowindow.setOptions({ content: `Your location: <br/><strong class="fw-bold">${place.name}</strong><p>${place.formatted_address}</p>`, map });
    marker.setOptions({ position: place.geometry.location, visible: true });

    clear_markers();
    set_accessibility(true);

    if (is_circle())
      circle.setOptions({ center: place.geometry.location, visible: true });
    else if (rectangle.getVisible())
      move_rectange(place.geometry.location);
  });

  init_other();
};

//distance in meters
function get_bounds_from_point(point, horizontal, vertical) {
  return {
    north: google.maps.geometry.spherical.computeOffset(point, vertical, 0),
    south: google.maps.geometry.spherical.computeOffset(point, vertical, 180),
    east: google.maps.geometry.spherical.computeOffset(point, horizontal, 90),
    west: google.maps.geometry.spherical.computeOffset(point, horizontal, -90),
    //  west: google.maps.geometry.spherical.computeOffset(point, horizontal, 270),
  }
}

function debounce(fn, time) {
  let timeout;
  return function () {
    const args = arguments;
    const functionCall = () => fn.apply(this, args);
    clearTimeout(timeout);
    timeout = setTimeout(functionCall, time);
  }
};

function set_point(txt) {
  var point = get_point(txt);
  if (!is_latitude(point[0]) || !is_longitude(point[1]))
    return;

  var latLng = new google.maps.LatLng({ lat: point[0], lng: point[1] });
  marker.setOptions({ position: latLng, visible: true });

  infowindow.setContent(`Your location: <br/><strong class="fw-bold">${latLng.toUrlValue()}</strong>`);
  if (is_circle())
    circle.setOptions({ center: latLng, visible: true });
  else if (rectangle.getVisible())
    move_rectange(latLng);

  map.setOptions({ center: latLng, zoom: 14 });
  map.panTo(latLng);
};

function move_rectange(latLng) {
  var padding = rectangle_distance || get_meters();
  var lat = latLng.lat(), lng = latLng.lng();
  var rect = get_bounds_from_point(latLng, padding[0], padding[1]);
  var bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(rect.south.lat(), rect.west.lng()),
    new google.maps.LatLng(rect.north.lat(), rect.east.lng())
  );
  rectangle.setBounds(bounds);
};

function redraw_from_distance() {
  if (is_circle())
    circle.setRadius(circle_distance || get_meters());
  else
    move_rectange(marker.getPosition());
};

function init_other() {
  var nav = $('#nav'), height = nav.outerHeight() + 10;
  $('#toggle-panel').click(function (e) {
    var t = $(this);
    var is_hide = t.hasClass('is_hide');
    if (is_hide) {
      nav.stop().animate({ top: 10 });
      t.stop().animate({ top: 0 }, function () {
        t.removeClass('is_hide').find('i').removeClass('bi-arrow-down-circle-fill').addClass('bi-arrow-up-circle-fill');
      });
    } else {
      nav.stop().animate({ top: (0 - height) }, function () {
        t.find('i').removeClass('bi-arrow-up-circle-fill').addClass('bi-arrow-down-circle-fill');
        t.stop().animate({ top: 63 }, function () {
          t.addClass('is_hide');
        });
      });
    }
  });

  $('#sel-enlarge-type').change(function (e) {
    var cls = $(this).val();
    var lst = $('#advanced-panel .offcanvas-body .distance');
    lst.not('.' + cls).addClass('d-none');
    lst.filter('.' + cls).removeClass('d-none');

    if (cls === 'circle') {
      if (marker.getVisible())
        circle.setOptions({ center: marker.getPosition(), visible: true });
      rectangle.setVisible(false);
    }
    else {
      circle.setVisible(false);
      rectangle.setVisible(true);
      move_rectange(marker.getPosition());
    }
  });

  txt_point = $('#txt-point');

  show_help('<h3>We glad you here!</h3>');

  $('#btn-reset').click(function (e) {
    e.preventDefault();
    set_default();
  });


  $('#btn-result').click(function (e) {
    e.preventDefault();
    show_message('Search result', search_result_message ? search_result_message : 'Please search first.');
  });

  $('#btn-help').click(function (e) {
    e.preventDefault();
    show_help();
  });

  $('#btn-clear').click(function (e) {
    e.preventDefault();
    clear_markers();
    set_accessibility(true);
  });

  $('#advanced-panel input[type="number"]').keyup(debounce(() => {
    rectangle_distance = null;
    circle_distance = null;
    redraw_from_distance();
  }, 250));

  txt_point.keyup(debounce(() => {
    set_point(txt_point);
  }, 250));

  grp.map(bind_dropdown_text);

  set_default();

  $('#md-notice').on('hidden.bs.modal', function (e) {
    create_restaurant_markers();
  });

  $('#btn-search').click(function (e) {
    e.preventDefault();
    if (!marker.getVisible()) {
      show_message(null, 'Please select or enter your location.');
      return;
    }

    var data = get_query_params();
    if (test_longtime)
      data.sleep = true;

    xhr_query = $.ajax({
      url: `${endpoint}/search`,
      type: 'post',
      data,
      beforeSend: function () {
        search_result_message = '';
        toggle_loading(true);
      },
      error: function () {
        clear_markers();
        set_accessibility(true);
        toggle_loading(false);
        arr_restaurants = [];
      },
      success: function (res) {
        toggle_loading(false);
        search_result_message = `<div>Took: ${res.took} Milliseconds<br/>Total: ${res.hits.total.value}<br/>Shards:<br/><ul><li>Total: ${res._shards.total}</li><li>Successful: ${res._shards.successful}</li></ul>`;
        if (res.hits.total.value > max_search_results) {
          show_message(`Search result limit exceeded: ${max_search_results}`, search_result_message + `<b>We can't display all markers, please specify smaller range.</b>`);
        } else {
          arr_restaurants = res.hits.hits || [];
          clear_markers();

          if (res.hits.total.value > 0)
            set_accessibility(false);

          show_message('Search result', search_result_message);
        }
      },
    });
  });
};

function toggle_loading(show) {
  $('body > svg').css('display', show ? 'block' : 'none');
}

function show_help(title = '') {
  show_message(`Welcome`, `${title}${help_text}`);
}

function show_message(title, msg) {
  $('#md-notice').find('.modal-title').text(title || 'Notice').end()
    .find('.modal-body').html(`${msg}`).end()
    .modal('show');
}

function create_restaurant_markers() {
  if (!Array.isArray(arr_restaurants) || arr_restaurants.length === 0)
    return;

  arr_markers = arr_restaurants.map((restaurant) => {
    var { location: { lat, lon: lng }, name: title, description, photos } = restaurant._source;

    var r_marker = new google.maps.Marker({
      map, position: { lat, lng },
      title,
      description,
      photos,
      animation: google.maps.Animation.DROP,
      icon: {
        url: arr_icons[Math.floor(Math.random() * arr_icons.length)],
        // url: '/imgs/restaurant-x64.png',
        scaledSize: { width: 35, height: 35 }
      }
    });

    r_marker.addListener("click", () => {
      infowindow_restaurant.setContent(content_template.replace('{title}', title).replace('{description}', description)
        .replace('{photo}', get_photo(photos))
        .replace('{latitude}', lat).replace('{longitude}', lng));

      infowindow_restaurant.open({
        anchor: r_marker, map
      });
    });

    return r_marker;
  });

  arr_restaurants = [];
};

function get_photo(photos) {
  return photos && photos.legacy && photos.legacy.url ? photos.legacy.url : 'https://cdn-icons-png.flaticon.com/512/2533/2533563.png';
};

function set_accessibility(enabled) {
  if (is_circle())
    circle.setOptions({ draggable: enabled, editable: enabled });
  else
    rectangle.setOptions({ draggable: enabled, editable: enabled });
};

function clear_markers() {
  infowindow_restaurant.close();
  if (Array.isArray(arr_markers) && arr_markers.length > 0) {
    arr_markers.map((mk) => {
      mk.setMap(null);
    });
    arr_markers = [];
  }
};

function get_query_params() {
  if (is_circle())
    return {
      "index": index_name,
      "type": $('#sel-enlarge-type').val(),
      "distance": `${circle.getRadius()}m`,
      "location": marker.getPosition().toJSON()
    };
  else {
    var { nw, se } = get_4_corners();
    return {
      "index": index_name,
      "type": $('#sel-enlarge-type').val(),
      "top_left": nw,
      "bottom_right": se
    };
  }
};

function get_center_point(type) {
  var { nw, ne, sw, se } = get_4_corners();
  switch (type) {
    case 't':
      return { lat: nw.lat, lng: (nw.lng + ne.lng) / 2 };
    case 'b':
      return { lat: sw.lat, lng: (sw.lng + se.lng) / 2 };
    case 'l':
      return { lat: (nw.lat + sw.lat) / 2, lng: (nw.lng + sw.lng) / 2 };
    case 'r':
      return { lat: (ne.lat + se.lat) / 2, lng: (ne.lng + se.lng) / 2 };
  }
};

function get_4_corners() {
  var neb = rectangle.bounds.getNorthEast();
  var swb = rectangle.bounds.getSouthWest();
  var ne = { lat: neb.lat(), lng: neb.lng() };
  var sw = { lat: swb.lat(), lng: swb.lng() };;
  var nw = { lat: ne.lat, lng: sw.lng };
  var se = { lat: sw.lat, lng: ne.lng };
  return { nw, ne, sw, se };
};

function set_distance_rectange() {
  var pos = marker.getPosition();
  var distance_horizontal = google.maps.geometry.spherical.computeDistanceBetween(pos, get_center_point('l'));
  var distance_vertical = google.maps.geometry.spherical.computeDistanceBetween(pos, get_center_point('t'));
  rectangle_distance = [distance_horizontal, distance_vertical];
};

function bind_dropdown_text(el) {
  $(el).find(".dropdown-menu li a").click((e) => {
    handle_change_measure(e.target, true);
  });
};

function is_circle() {
  return $('#sel-enlarge-type').val() === 'circle';
};

function handle_change_measure(el, redraw = true) {
  var value = $(el).attr('data-value');
  var distance = get_meters();
  rectangle_distance = null;
  circle_distance = null;

  //prevent to large bound
  if (value === 'miles') {
    if (is_circle()) {
      if (distance > max_distance_circle_in_miles)
        $('#txt-distance').val(max_distance_circle_in_miles);
    } else {
      if (distance[0] > nax_distance_horizontal_in_miles)
        $('#txt-horizontal').val(nax_distance_horizontal_in_miles);
      if (distance[1] > nax_distance_vertical_in_miles)
        $('#txt-vertical').val(nax_distance_vertical_in_miles);
    }
  } else if (value === 'km') {
    if (is_circle()) {
      if (distance > max_distance_circle_in_km)
        $('#txt-distance').val(max_distance_circle_in_km);
    } else {
      if (distance[0] > nax_distance_horizontal_in_km)
        $('#txt-horizontal').val(nax_distance_horizontal_in_km);
      if (distance[1] > nax_distance_vertical_in_km)
        $('#txt-vertical').val(nax_distance_vertical_in_km);
    }
  }

  var toggle = get_toggle($(el).closest('[id^="grp"]'));
  toggle.attr('data-selected', value).text($(el).text());
  if (redraw)
    redraw_from_distance();
};

function get_toggle(el) {
  return $(el).find(".dropdown-toggle");
};

function get_dropdown_measure(el) {
  return get_toggle(el).attr('data-selected');
};

function set_default() {
  $('#sel-enlarge-type').val(default_enlarge).trigger('change');
  $('#txt-distance').val(default_distance_circle);
  $('#txt-horizontal').val(default_distance_horizontal);
  $('#txt-vertical').val(default_distance_vertical);
  ['#grp-distance .dropdown-menu li a[data-value="m"]', '#grp-horizontal .dropdown-menu li a[data-value="m"]', '#grp-vertical .dropdown-menu li a[data-value="m"]'].map((el) => handle_change_measure(el, false));

  redraw_from_distance();
};

function get_meters() {
  if (is_circle())
    return to_meters(get_dropdown_measure('#grp-distance'), get_distance());
  else
    return [to_meters(get_dropdown_measure('#grp-horizontal'), get_horizontal()), to_meters(get_dropdown_measure('#grp-vertical'), get_vertical())];
};

function get_distance() {
  return $('#txt-distance').val() || default_distance_circle;
};

function get_horizontal() {
  return $('#txt-horizontal').val() || default_distance_horizontal;
};

function get_vertical() {
  return $('#txt-vertical').val() || default_distance_vertical;
};

function get_point(txt) {
  return $(txt).val().split(",").map(item => parseFloat(item.trim()));
};

const is_latitude = num => isFinite(num) && Math.abs(num) <= 90;
const is_longitude = num => isFinite(num) && Math.abs(num) <= 180;

function to_meters(from_type, num) {
  if (typeof num !== "number")
    num = parseFloat(num) || 1;
  switch (from_type) {
    case 'km':
      num = num * 1000;
      break;
    case 'miles':
      num = num * 1609.344;
      break;
    case 'feet':
      num = num * 0.3048;
      break;
    case 'm':
    default:
      break;
  }

  return parseFloat(num.toFixed(8));
};

var map_styles = [
  {
    elementType: "geometry",
    stylers: [
      {
        color: "#f5f5f5"
      }
    ]
  },
  {
    elementType: "labels.icon",
    stylers: [
      {
        visibility: "on"
      }
    ]
  },
  {
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#616161"
      }
    ]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [
      {
        color: "#f5f5f5"
      }
    ]
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#bdbdbd"
      }
    ]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [
      {
        color: "#eeeeee"
      }
    ]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#757575"
      }
    ]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [
      {
        color: "#e5e5e5"
      }
    ]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#9e9e9e"
      }
    ]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      {
        color: "#ffffff"
      }
    ]
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#757575"
      }
    ]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [
      {
        color: "#dadada"
      }
    ]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#616161"
      }
    ]
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#9e9e9e"
      }
    ]
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [
      {
        color: "#e5e5e5"
      }
    ]
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [
      {
        color: "#eeeeee"
      }
    ]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [
      {
        color: "#c9c9c9"
      }
    ]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#9e9e9e"
      }
    ]
  }
];

