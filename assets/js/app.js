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
  var defaultConfig = window.ELASTICSEARCH_RESTAURANTS_DEFAULT_CONFIG || {};
  var config = typeof window.createElasticsearchRestaurantsConfig === 'function'
    ? window.createElasticsearchRestaurantsConfig(window.ELASTICSEARCH_RESTAURANTS_CONFIG)
    : defaultConfig;
  this.endpoint = config.endpoint;
  this.index_name = config.indexName;
  this.map = null;
  this.map_center = config.mapCenter;
  this.center = new google.maps.LatLng(this.map_center[0], this.map_center[1]);
  this.default_type = 'm';
  this.default_enlarge = 'circle';
  this.default_distance_circle = 200;
  this.default_distance_horizontal = 150;
  this.default_distance_vertical = 150;
  this.marker = null;
  this.circle = null;
  this.arr_icons = config.restaurantIcons;
  this.marker_icon = config.markerIcon;
  this.fallback_restaurant_photo = config.fallbackRestaurantPhoto;
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
  this.max_search_results = config.maxSearchResults;
  this.autocomplete_country_restriction = config.autocompleteCountryRestriction || '';

  // Cached jQuery DOM references (populated in init_other)
  this.$sel_enlarge_type = null;
  this.$txt_distance = null;
  this.$txt_horizontal = null;
  this.$txt_vertical = null;

  this.grp = ['#grp-distance', '#grp-horizontal', '#grp-vertical'];

  this.escape_html = function (value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  };

  this.sanitize_url = function (value, fallback = '') {
    if (typeof value !== 'string' || value.trim() === '')
      return fallback;

    try {
      var url = new URL(value, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:')
        return url.toString();
    } catch (error) {
      return fallback;
    }

    return fallback;
  };

  this.to_number = function (value, fallback = 0) {
    var parsed = typeof value === 'number' ? value : parseFloat(value);
    return isFinite(parsed) ? parsed : fallback;
  };

  this.is_positive_number = function (value) {
    return this.to_number(value, 0) > 0;
  };

  this.get_search_type = function () {
    var el = this.$sel_enlarge_type || $('#sel-enlarge-type');
    return el.val() === 'rectangle' ? 'rectangle' : 'circle';
  };

  this.join_url = function (base, path) {
    if (typeof base !== 'string' || base.trim() === '')
      return '';

    return `${base.replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
  };

  this.validate_search_request = function () {
    var position = this.marker && this.marker.getPosition ? this.marker.getPosition() : null;
    if (!this.endpoint)
      return 'Search endpoint is not configured.';
    if (!position || !this.is_latitude(position.lat()) || !this.is_longitude(position.lng()))
      return 'Please select or enter a valid location.';

    if (this.is_circle()) {
      if (!this.is_positive_number(this.circle && this.circle.getRadius ? this.circle.getRadius() : 0))
        return 'Please enter a valid search distance.';
    } else {
      var bounds = this.rectangle && this.rectangle.getBounds ? this.rectangle.getBounds() : null;
      if (!bounds)
        return 'Please enter a valid rectangular search area.';
    }

    return '';
  };

  this.normalize_search_response = function (res) {
    var hits = res && res.hits && Array.isArray(res.hits.hits) ? res.hits.hits : [];
    var totalValue = res && res.hits && res.hits.total ? res.hits.total.value : 0;
    var shards = res && res._shards ? res._shards : {};

    return {
      took: this.to_number(res && res.took, 0),
      total: this.to_number(totalValue, hits.length),
      hits,
      shardsTotal: this.to_number(shards.total, 0),
      shardsSuccessful: this.to_number(shards.successful, 0)
    };
  };

  this.format_search_result_message = function (summary, displayedCount) {
    var limitMessage = summary.total > displayedCount
      ? `<p><strong>Displaying ${displayedCount} of ${summary.total} results.</strong></p>`
      : '';

    return `<div>Took: ${summary.took} Milliseconds<br/>Total: ${summary.total}<br/>Shards:<br/><ul><li>Total: ${summary.shardsTotal}</li><li>Successful: ${summary.shardsSuccessful}</li></ul>${limitMessage}</div>`;
  };

  this.get_restaurant_marker_data = function (restaurant) {
    var source = restaurant && restaurant._source ? restaurant._source : {};
    var location = source.location || {};
    var lat = this.to_number(location.lat, NaN);
    var lng = this.to_number(location.lon, NaN);

    if (!this.is_latitude(lat) || !this.is_longitude(lng))
      return null;

    return {
      lat,
      lng,
      title: this.escape_html(source.name || 'Restaurant'),
      description: this.escape_html(source.description || 'No description available.'),
      photo: this.sanitize_url(this.get_photo(source.photos), this.fallback_restaurant_photo)
    };
  };

  this.build_restaurant_info_content = function (restaurant) {
    var locationText = this.escape_html(`${restaurant.lat}, ${restaurant.lng}`);
    return `<div class="iw-main">
      <h4 title="Location: ${locationText}">${restaurant.title}</h4>
      <div class="iw-body">
      <img src="${this.escape_html(restaurant.photo)}" class="float-start me-3 iw-img" alt="${restaurant.title}">
      <div>${restaurant.description}</div>
      </div>
    </div>`;
  };


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
        url: t.marker_icon,
        scaledSize: { width: 40, height: 40 }
      },
      draggable: true,
      visible: false
    });

    t.map.addListener("click", (event) => {
      var latLng = event.latLng;
      t.txt_point.val(latLng.toUrlValue());
      t.infowindow.setContent(`Your location: <br/><strong class="fw-bold">${t.escape_html(latLng.toUrlValue())}</strong>`);
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
      t.infowindow.setContent(`Your location: <br/><strong class="fw-bold">${t.escape_html(latLng.toUrlValue())}</strong>`);
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

    var search_options = t.autocomplete_country_restriction
      ? { componentRestrictions: { country: t.autocomplete_country_restriction } }
      : {};
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

      t.infowindow.setOptions({ content: `Your location: <br/><strong class="fw-bold">${t.escape_html(place.name)}</strong><p>${t.escape_html(place.formatted_address || '')}</p>`, map: t.map });
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

    t.infowindow.setContent(`Your location: <br/><strong class="fw-bold">${t.escape_html(latLng.toUrlValue())}</strong>`);
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

    t.$sel_enlarge_type = $('#sel-enlarge-type');
    t.$txt_distance = $('#txt-distance');
    t.$txt_horizontal = $('#txt-horizontal');
    t.$txt_vertical = $('#txt-vertical');

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

    t.$sel_enlarge_type.change(function (e) {
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

    $('#btn-search').click(function (e) {
      e.preventDefault();
      var validationError = t.validate_search_request();
      if (validationError) {
        t.show_text_message(null, validationError);
        return;
      }

      var data = t.get_query_params();
      if (t.test_longtime)
        data.sleep = true;

      if (t.xhr_query && t.xhr_query.readyState !== 4)
        t.xhr_query.abort();

      t.xhr_query = $.ajax({
        url: t.join_url(t.endpoint, 'search'),
        type: 'post',
        data,
        timeout: 15000,
        beforeSend: function () {
          t.search_result_message = '';
          t.clear_markers();
          t.set_accessibility(true);
          t.toggle_loading(true);
        },
        error: function (xhr, textStatus) {
          if (textStatus === 'abort')
            return;

          t.clear_markers();
          t.set_accessibility(true);
          t.toggle_loading(false);
          t.arr_restaurants = [];
          t.search_result_message = 'Search request failed.';
          t.show_text_message('Search failed', 'Unable to fetch restaurants right now. Please try again.');
        },
        success: function (res) {
          var summary = t.normalize_search_response(res);
          var displayedCount = Math.min(summary.hits.length, t.max_search_results);

          t.toggle_loading(false);
          t.arr_restaurants = summary.hits.slice(0, t.max_search_results);
          t.search_result_message = t.format_search_result_message(summary, displayedCount);
          t.clear_markers();

          if (summary.total > 0) {
            t.create_restaurant_markers();
            t.set_accessibility(false);
          } else {
            t.set_accessibility(true);
          }

          if (summary.total > t.max_search_results) {
            t.show_message(`Search result limit exceeded: ${t.max_search_results}`, t.search_result_message + '<b>Please specify a smaller range to narrow the results.</b>');
          } else if (summary.total === 0) {
            t.show_message('Search result', t.search_result_message + '<p>No restaurants matched the current search area.</p>');
          } else {
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
      .find('.modal-body').html(msg || '').end()
      .modal('show');
  };

  this.show_text_message = function (title, text) {
    var $modal = $('#md-notice');
    $modal.find('.modal-title').text(title || 'Notice');
    $modal.find('.modal-body').empty().append(
      $('<p>').text(text || '')
    );
    $modal.modal('show');
  };

  this.create_restaurant_markers = function () {
    var t = this;
    if (!Array.isArray(t.arr_restaurants) || t.arr_restaurants.length === 0)
      return;

    t.arr_markers = t.arr_restaurants.reduce((markers, restaurant) => {
      var markerData = t.get_restaurant_marker_data(restaurant);
      if (!markerData)
        return markers;

      var r_marker = new google.maps.Marker({
        map: t.map, position: { lat: markerData.lat, lng: markerData.lng },
        title: markerData.title,
        animation: google.maps.Animation.DROP,
        icon: {
          url: t.arr_icons[Math.floor(Math.random() * t.arr_icons.length)],
          scaledSize: { width: 35, height: 35 }
        }
      });

      r_marker.addListener("click", () => {
        t.infowindow_restaurant.setContent(t.build_restaurant_info_content(markerData));

        t.infowindow_restaurant.open({
          anchor: r_marker, map: t.map
        });
      });

      markers.push(r_marker);
      return markers;
    }, []);

    t.arr_restaurants = [];
  };

  this.get_photo = function (photos) {
    return photos && photos.legacy && photos.legacy.url ? photos.legacy.url : this.fallback_restaurant_photo;
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
        google.maps.event.clearInstanceListeners(mk);
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
        "type": t.get_search_type(),
        "distance": `${t.circle.getRadius()}m`,
        "location": t.marker.getPosition().toJSON()
      };
    else {
      var { nw, se } = t.get_4_corners();
      return {
        "index": t.index_name,
        "type": t.get_search_type(),
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
    return this.get_search_type() === 'circle';
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
          (t.$txt_distance || $('#txt-distance')).val(t.max_distance_circle_in_miles);
      } else {
        if (distance[0] > t.max_distance_horizontal_in_miles)
          (t.$txt_horizontal || $('#txt-horizontal')).val(t.max_distance_horizontal_in_miles);
        if (distance[1] > t.max_distance_vertical_in_miles)
          (t.$txt_vertical || $('#txt-vertical')).val(t.max_distance_vertical_in_miles);
      }
    } else if (value === 'km') {
      if (t.is_circle()) {
        if (distance > t.max_distance_circle_in_km)
          (t.$txt_distance || $('#txt-distance')).val(t.max_distance_circle_in_km);
      } else {
        if (distance[0] > t.max_distance_horizontal_in_km)
          (t.$txt_horizontal || $('#txt-horizontal')).val(t.max_distance_horizontal_in_km);
        if (distance[1] > t.max_distance_vertical_in_km)
          (t.$txt_vertical || $('#txt-vertical')).val(t.max_distance_vertical_in_km);
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
    (t.$sel_enlarge_type || $('#sel-enlarge-type')).val(t.default_enlarge).trigger('change');
    (t.$txt_distance || $('#txt-distance')).val(t.default_distance_circle);
    (t.$txt_horizontal || $('#txt-horizontal')).val(t.default_distance_horizontal);
    (t.$txt_vertical || $('#txt-vertical')).val(t.default_distance_vertical);
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
    return (this.$txt_distance || $('#txt-distance')).val() || this.default_distance_circle;
  };

  this.get_horizontal = function () {
    return (this.$txt_horizontal || $('#txt-horizontal')).val() || this.default_distance_horizontal;
  };

  this.get_vertical = function () {
    return (this.$txt_vertical || $('#txt-vertical')).val() || this.default_distance_vertical;
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
