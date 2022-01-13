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

window.ElasticsearchRestaurants = function() {
  this.endpoint = 'https://elasticsearch-restaurants-api-nodejs.khoa2016.repl.co';
  this.index_name = 'restaurants';
  this.map = null;
  this.map_center = [-37.840935, 144.946457];
  this.center = new google.maps.LatLng(this.map_center[0], this.map_center[1]);
  this.default_type = 'm';
  this.default_enlarge = 'circle';
  this.default_distance_circle = 200;
  this.default_distance_horizontal = 150;
  this.default_distance_vertical = 150;
  this.marker = null;
  this.circle = null;
  this.arr_icons = [
    'https://cdn-icons-png.flaticon.com/512/325/325573.png', 'https://cdn-icons-png.flaticon.com/512/2533/2533600.png', 'https://cdn-icons-png.flaticon.com/512/2934/2934069.png',
    'https://cdn-icons-png.flaticon.com/512/846/846398.png'
  ];
  this.rectangle = null;
  this.infowindow = null;
  this.infowindow_restaurant = null;
  this.txt_point = null;
  this.rectangle_distance = [];
  this.circle_distance = null;
  this.autocomplete = null;
  this.xhr_query = null;
  this.max_distance_circle_in_miles = 4;
  this.max_distance_horizontal_in_miles = 4;
  this.max_distance_vertical_in_miles = 4;
  this.max_distance_circle_in_km = 10;
  this.max_distance_horizontal_in_km = 10;
  this.max_distance_vertical_in_km = 10;
  this.test_longtime = false;
  this.content_template = `<div class="iw-main">
    <h4 title="Location: {latitude}, {longitude}">{title}</h4>
    <div class="iw-body">
    <img src="{photo}" class="float-start me-3 iw-img">
    <div>{description}</div>
    </div>
  </div>`;
  this.help_text = `
    <p>Please enter your address on the textbox to search restaurants near you or click on the map to manual choose, you can drag the marker to specify.</p>
    <p>You can also use advanced filter by clicking the <span class="badge bg-secondary">Advanced</span> button.</p>
    <p>Happy searching...</p>
  `;
  this.arr_markers = [];
  this.arr_restaurants = [];
  this.search_result_message = '';
  this.max_search_results = 80;

  this.grp = ['#grp-distance', '#grp-horizontal', '#grp-vertical'];


  this.initialize = function () {
    var t = this;

    var mapOptions = {
      center: t.center,
      zoom: 9,
      styles: window.map_styles
    };

    t.map = new google.maps.Map(document.getElementById("map"), mapOptions);

    t.circle = new google.maps.Circle({
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillOpacity: 0,
      visible: false,
      draggable: true,
      editable: true,
      map: t.map,
      // center,
      radius: t.default_distance_circle,
    });

    t.rectangle = new google.maps.Rectangle({
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillOpacity: 0,
      visible: false,
      draggable: true,
      editable: true,
      map: t.map
    });

    t.marker = new google.maps.Marker({
      position: t.center,
      map: t.map,
      icon: {
        // url: '/imgs/marker-x64.png',
        url: 'https://cdn-icons-png.flaticon.com/512/1946/1946401.png',
        scaledSize: { width: 40, height: 40 }
      },
      draggable: true,
      visible: false
    });

    t.map.addListener("click", (event) => {
      var latLng = event.latLng;
      t.txt_point.val(latLng.toUrlValue());
      t.infowindow.setContent(`Your location: <br/><strong class="fw-bold">${latLng.toUrlValue()}</strong>`);
      t.marker.setOptions({ position: latLng, visible: true });
      if (t.is_circle())
        t.circle.setOptions({ center: latLng, visible: true });
      else if (t.rectangle.getVisible())
        t.move_rectange(latLng);
    });

    t.infowindow = new google.maps.InfoWindow({ maxWidth: 400, content: '' });
    t.infowindow_restaurant = new google.maps.InfoWindow({ maxWidth: 400, content: '' });

    t.marker.addListener("click", () => {
      t.infowindow.open({
        anchor: t.marker, map: t.map
      });
    });

    t.marker.addListener('drag', function (event) {
      var latLng = event.latLng;
      t.txt_point.val(latLng.toUrlValue());
      t.infowindow.setContent(`Your location: <br/><strong class="fw-bold">${latLng.toUrlValue()}</strong>`);
      if (t.circle.getVisible())
        t.circle.setCenter(latLng);
      else if (t.rectangle.getVisible())
        t.move_rectange(latLng);
    });

    t.circle.addListener('radius_changed', function () {
      t.circle_distance = t.circle.getRadius();
    });

    t.circle.addListener('center_changed', function () {
      var latLng = t.circle.getCenter();
      if (latLng) {
        t.txt_point.val(latLng.toUrlValue());
        t.marker.setPosition(latLng);
      }
    });

    t.rectangle.addListener('bounds_changed', function () {
      var center = t.rectangle.getBounds().getCenter();
      t.txt_point.val(center.toUrlValue());
      t.marker.setPosition(center);
      t.set_distance_rectange();
    });

    var search_options = {
      componentRestrictions: { country: "au" }
    };
    t.autocomplete = new google.maps.places.Autocomplete(document.getElementById('txt-address'), search_options);

    t.autocomplete.addListener("place_changed", () => {
      const place = t.autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        // User entered the name of a Place that was not suggested and
        // pressed the Enter key, or the Place Details request failed.
        // window.alert("No details available for input: '" + place.name + "'");
        t.set_point('#txt-address');
        return;
      }

      // If the place has a geometry, then present it on a map.
      if (place.geometry.viewport) {
        t.map.fitBounds(place.geometry.viewport);
      } else {
        t.map.setCenter(place.geometry.location);
        t.map.setZoom(12);
      }

      t.txt_point.val(place.geometry.location.toUrlValue());

      t.infowindow.setOptions({ content: `Your location: <br/><strong class="fw-bold">${place.name}</strong><p>${place.formatted_address}</p>`, map: t.map });
      t.marker.setOptions({ position: place.geometry.location, visible: true });

      t.clear_markers();
      t.set_accessibility(true);

      if (t.is_circle())
        t.circle.setOptions({ center: place.geometry.location, visible: true });
      else if (t.rectangle.getVisible())
        t.move_rectange(place.geometry.location);
    });

    t.init_other();
  };

  this.get_bounds_from_point = function (point, horizontal, vertical) {
    return {
      north: google.maps.geometry.spherical.computeOffset(point, vertical, 0),
      south: google.maps.geometry.spherical.computeOffset(point, vertical, 180),
      east: google.maps.geometry.spherical.computeOffset(point, horizontal, 90),
      west: google.maps.geometry.spherical.computeOffset(point, horizontal, -90),
      //  west: google.maps.geometry.spherical.computeOffset(point, horizontal, 270),
    }
  };

  this.debounce = function (fn, time) {
    let timeout;
    return function () {
      const args = arguments;
      const functionCall = () => fn.apply(this, args);
      clearTimeout(timeout);
      timeout = setTimeout(functionCall, time);
    }
  };

  this.set_point = function (txt) {
    var t = this;
    var point = t.get_point(txt);
    if (!t.is_latitude(point[0]) || !t.is_longitude(point[1]))
      return;

    var latLng = new google.maps.LatLng({ lat: point[0], lng: point[1] });
    t.marker.setOptions({ position: latLng, visible: true });

    t.infowindow.setContent(`Your location: <br/><strong class="fw-bold">${latLng.toUrlValue()}</strong>`);
    if (t.is_circle())
      t.circle.setOptions({ center: latLng, visible: true });
    else if (t.rectangle.getVisible())
      t.move_rectange(latLng);

    t.map.setOptions({ center: latLng, zoom: 14 });
    t.map.panTo(latLng);
  };

  this.move_rectange = function (latLng) {
    var t = this;
    var padding = t.rectangle_distance || t.get_meters();
    var lat = latLng.lat(), lng = latLng.lng();
    var rect = t.get_bounds_from_point(latLng, padding[0], padding[1]);
    var bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(rect.south.lat(), rect.west.lng()),
      new google.maps.LatLng(rect.north.lat(), rect.east.lng())
    );
    t.rectangle.setBounds(bounds);
  };

  this.redraw_from_distance = function () {
    var t = this;
    if (t.is_circle())
      t.circle.setRadius(t.circle_distance || t.get_meters());
    else
      t.move_rectange(t.marker.getPosition());
  };

  this.init_other = function () {
    var t = this;
    var nav = $('#nav'), height = nav.outerHeight() + 10;
    $('#toggle-panel').click(function (e) {
      var el = $(this);
      var is_hide = el.hasClass('is_hide');
      if (is_hide) {
        nav.stop().animate({ top: 10 });
        el.stop().animate({ top: 0 }, function () {
          el.removeClass('is_hide').find('i').removeClass('bi-arrow-down-circle-fill').addClass('bi-arrow-up-circle-fill');
        });
      } else {
        nav.stop().animate({ top: (0 - height) }, function () {
          el.find('i').removeClass('bi-arrow-up-circle-fill').addClass('bi-arrow-down-circle-fill');
          el.stop().animate({ top: 63 }, function () {
            el.addClass('is_hide');
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
        if (t.marker.getVisible())
          t.circle.setOptions({ center: t.marker.getPosition(), visible: true });
        t.rectangle.setVisible(false);
      }
      else {
        t.circle.setVisible(false);
        t.rectangle.setVisible(true);
        t.move_rectange(t.marker.getPosition());
      }
    });

    t.txt_point = $('#txt-point');

    $('#btn-reset').click(function (e) {
      e.preventDefault();
      t.set_default();
    });


    $('#btn-result').click(function (e) {
      e.preventDefault();
      t.show_message('Search result', t.search_result_message ? t.search_result_message : 'Please search first.');
    });

    $('#btn-help').click(function (e) {
      e.preventDefault();
      t.show_help();
    });

    $('#btn-clear').click(function (e) {
      e.preventDefault();
      t.clear_markers();
      t.set_accessibility(true);
    });

    $('#advanced-panel input[type="number"]').keyup(t.debounce(() => {
      t.rectangle_distance = null;
      t.circle_distance = null;
      t.redraw_from_distance();
    }, 250));

    t.txt_point.keyup(t.debounce(() => {
      t.set_point(t.txt_point);
    }, 250));

    $('#md-notice').on('hidden.bs.modal', function (e) {
      t.create_restaurant_markers();
    });

    $('#btn-search').click(function (e) {
      e.preventDefault();
      if (!t.marker.getVisible()) {
        t.show_message(null, 'Please select or enter your location.');
        return;
      }

      var data = t.get_query_params();
      if (this.test_longtime)
        data.sleep = true;

      t.xhr_query = $.ajax({
        url: `${t.endpoint}/search`,
        type: 'post',
        data,
        beforeSend: function () {
          t.search_result_message = '';
          t.toggle_loading(true);
        },
        error: function () {
          t.clear_markers();
          t.set_accessibility(true);
          t.toggle_loading(false);
          t.arr_restaurants = [];
        },
        success: function (res) {
          t.toggle_loading(false);
          t.search_result_message = `<div>Took: ${res.took} Milliseconds<br/>Total: ${res.hits.total.value}<br/>Shards:<br/><ul><li>Total: ${res._shards.total}</li><li>Successful: ${res._shards.successful}</li></ul>`;
          if (res.hits.total.value > t.max_search_results) {
            t.show_message(`Search result limit exceeded: ${t.max_search_results}`, t.search_result_message + `<b>We can't display all markers, please specify smaller range.</b>`);
          } else {
            t.arr_restaurants = res.hits.hits || [];
            t.clear_markers();

            if (res.hits.total.value > 0)
              t.set_accessibility(false);

            t.show_message('Search result', t.search_result_message);
          }
        },
      });
    });

    t.show_help('<h3>We glad you here!</h3>');

    t.grp.map((el) => { t.bind_dropdown_text(el); });

    t.set_default();

  };

  this.toggle_loading = function (show) {
    $('body > svg').css('display', show ? 'block' : 'none');
  }

  this.show_help = function (title = '') {
    this.show_message(`Welcome`, `${title}${this.help_text}`);
  };

  this.show_message = function (title, msg) {
    $('#md-notice').find('.modal-title').text(title || 'Notice').end()
      .find('.modal-body').html(`${msg}`).end()
      .modal('show');
  };

  this.create_restaurant_markers = function () {
    var t = this;
    if (!Array.isArray(t.arr_restaurants) || t.arr_restaurants.length === 0)
      return;

    t.arr_markers = t.arr_restaurants.map((restaurant) => {
      var { location: { lat, lon: lng }, name: title, description, photos } = restaurant._source;

      var r_marker = new google.maps.Marker({
        map: t.map, position: { lat, lng },
        title,
        description,
        photos,
        animation: google.maps.Animation.DROP,
        icon: {
          url: t.arr_icons[Math.floor(Math.random() * t.arr_icons.length)],
          // url: '/imgs/restaurant-x64.png',
          scaledSize: { width: 35, height: 35 }
        }
      });

      r_marker.addListener("click", () => {
        t.infowindow_restaurant.setContent(t.content_template.replace('{title}', title).replace('{description}', description)
          .replace('{photo}', t.get_photo(photos))
          .replace('{latitude}', lat).replace('{longitude}', lng));

        t.infowindow_restaurant.open({
          anchor: r_marker, map: t.map
        });
      });

      return r_marker;
    });

    t.arr_restaurants = [];
  };

  this.get_photo = function (photos) {
    return photos && photos.legacy && photos.legacy.url ? photos.legacy.url : 'https://cdn-icons-png.flaticon.com/512/2533/2533563.png';
  };

  this.set_accessibility = function (enabled) {
    var t = this;
    if (t.is_circle())
      t.circle.setOptions({ draggable: enabled, editable: enabled });
    else
      t.rectangle.setOptions({ draggable: enabled, editable: enabled });
  };

  this.clear_markers = function () {
    var t = this;
    t.infowindow_restaurant.close();
    if (Array.isArray(t.arr_markers) && t.arr_markers.length > 0) {
      t.arr_markers.map((mk) => {
        mk.setMap(null);
      });
      t.arr_markers = [];
    }
  };

  this.get_query_params = function () {
    var t = this;
    if (t.is_circle())
      return {
        "index": t.index_name,
        "type": $('#sel-enlarge-type').val(),
        "distance": `${t.circle.getRadius()}m`,
        "location": t.marker.getPosition().toJSON()
      };
    else {
      var { nw, se } = t.get_4_corners();
      return {
        "index": t.index_name,
        "type": $('#sel-enlarge-type').val(),
        "top_left": nw,
        "bottom_right": se
      };
    }
  };

  this.get_center_point = function (type) {
    var { nw, ne, sw, se } = this.get_4_corners();
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

  this.get_4_corners = function () {
    var t = this;
    var neb = t.rectangle.bounds.getNorthEast();
    var swb = t.rectangle.bounds.getSouthWest();
    var ne = { lat: neb.lat(), lng: neb.lng() };
    var sw = { lat: swb.lat(), lng: swb.lng() };;
    var nw = { lat: ne.lat, lng: sw.lng };
    var se = { lat: sw.lat, lng: ne.lng };
    return { nw, ne, sw, se };
  };

  this.set_distance_rectange = function () {
    var t = this;
    var pos = t.marker.getPosition();
    var distance_horizontal = google.maps.geometry.spherical.computeDistanceBetween(pos, t.get_center_point('l'));
    var distance_vertical = google.maps.geometry.spherical.computeDistanceBetween(pos, t.get_center_point('t'));
    t.rectangle_distance = [distance_horizontal, distance_vertical];
  };

  this.is_circle = function () {
    return $('#sel-enlarge-type').val() === 'circle';
  };

  this.handle_change_measure = function (el, redraw = true) {
    var t = this;
    var value = $(el).attr('data-value');
    var distance = t.get_meters();
    t.rectangle_distance = null;
    t.circle_distance = null;

    //prevent to large bound
    if (value === 'miles') {
      if (t.is_circle()) {
        if (distance > t.max_distance_circle_in_miles)
          $('#txt-distance').val(t.max_distance_circle_in_miles);
      } else {
        if (distance[0] > t.max_distance_horizontal_in_miles)
          $('#txt-horizontal').val(t.max_distance_horizontal_in_miles);
        if (distance[1] > t.max_distance_vertical_in_miles)
          $('#txt-vertical').val(t.max_distance_vertical_in_miles);
      }
    } else if (value === 'km') {
      if (t.is_circle()) {
        if (distance > t.max_distance_circle_in_km)
          $('#txt-distance').val(t.max_distance_circle_in_km);
      } else {
        if (distance[0] > t.max_distance_horizontal_in_km)
          $('#txt-horizontal').val(t.max_distance_horizontal_in_km);
        if (distance[1] > t.max_distance_vertical_in_km)
          $('#txt-vertical').val(t.max_distance_vertical_in_km);
      }
    }

    var toggle = t.get_toggle($(el).closest('[id^="grp"]'));
    toggle.attr('data-selected', value).text($(el).text());
    if (redraw)
      t.redraw_from_distance();
  };

  this.bind_dropdown_text = function (el) {
    var t = this;
    $(el).find(".dropdown-menu li a").click((e) => {
      t.handle_change_measure(e.target, true);
    });
  };

  this.get_toggle = function (el) {
    return $(el).find(".dropdown-toggle");
  };

  this.get_dropdown_measure = function (el) {
    return this.get_toggle(el).attr('data-selected');
  };

  this.set_default = function () {
    var t = this;
    $('#sel-enlarge-type').val(t.default_enlarge).trigger('change');
    $('#txt-distance').val(t.default_distance_circle);
    $('#txt-horizontal').val(t.default_distance_horizontal);
    $('#txt-vertical').val(t.default_distance_vertical);
    ['#grp-distance .dropdown-menu li a[data-value="m"]', '#grp-horizontal .dropdown-menu li a[data-value="m"]', '#grp-vertical .dropdown-menu li a[data-value="m"]'].map((el) => t.handle_change_measure(el, false));

    t.redraw_from_distance();
  };

  //distance in meters
  this.get_meters = function () {
    var t = this;
    if (t.is_circle())
      return t.to_meters(t.get_dropdown_measure('#grp-distance'), t.get_distance());
    else
      return [t.to_meters(t.get_dropdown_measure('#grp-horizontal'), t.get_horizontal()), t.to_meters(t.get_dropdown_measure('#grp-vertical'), t.get_vertical())];
  };

  this.get_distance = function () {
    return $('#txt-distance').val() || this.default_distance_circle;
  };

  this.get_horizontal = function () {
    return $('#txt-horizontal').val() || this.default_distance_horizontal;
  };

  this.get_vertical = function () {
    return $('#txt-vertical').val() || this.default_distance_vertical;
  };

  this.get_point = function (txt) {
    return $(txt).val().split(",").map(item => parseFloat(item.trim()));
  };

  this.is_latitude = num => isFinite(num) && Math.abs(num) <= 90;
  this.is_longitude = num => isFinite(num) && Math.abs(num) <= 180;

  this.to_meters = function (from_type, num) {
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

}
