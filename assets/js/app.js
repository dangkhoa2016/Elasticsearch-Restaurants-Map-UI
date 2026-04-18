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
  this.arr_list_data = [];
  this.clusterer = null;
  this.fav_temp_marker = null;
  this.search_result_message = '';
  this.max_search_results = config.maxSearchResults;
  this.autocomplete_country_restriction = config.autocompleteCountryRestriction || '';
  this.history_storage_key = 'er_search_history';
  this.max_history_items = 8;
  this.fav_storage_key = 'er_favorites';

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

  this.preload_image = function (src) {
    var fallback = this.fallback_restaurant_photo;
    return new Promise(function (resolve) {
      if (!src) return resolve(fallback);
      var img = new Image();
      img.onload = function () { resolve(src); };
      img.onerror = function () { resolve(fallback); };
      img.src = src;
    });
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
      id: restaurant._id || '',
      lat,
      lng,
      title: this.escape_html(source.name || 'Restaurant'),
      description: this.escape_html(source.description || 'No description available.'),
      photo: this.sanitize_url(this.get_photo(source.photos), this.fallback_restaurant_photo)
    };
  };

  this.build_restaurant_info_content = function (restaurant) {
    var t = this;
    var isFav = t.is_favorite(restaurant.id);
    var favClass = isFav ? ' is-fav' : '';
    var favTitle = isFav ? 'Remove from saved' : 'Save restaurant';
    var favIcon = isFav ? '&#9733;' : '&#9734;';
    var idAttr = t.escape_html(restaurant.id || '');
    var locationText = t.escape_html(`${restaurant.lat}, ${restaurant.lng}`);
    var fallback = t.escape_html(t.fallback_restaurant_photo);
    return `<div class="iw-main">
      <div class="d-flex justify-content-between align-items-start mb-1">
        <h4 class="mb-0 me-2" title="Location: ${locationText}">${restaurant.title}</h4>
        <button type="button" class="lv-fav-btn iw-fav-btn${favClass}" data-fav-id="${idAttr}" aria-label="${favTitle}" title="${favTitle}"><span class="fav-icon">${favIcon}</span></button>
      </div>
      <div class="iw-body">
      <img src="${t.escape_html(restaurant.photo)}" class="float-start me-3 iw-img" alt="${restaurant.title}" onerror="this.onerror=null;this.src='${fallback}'">
      <div>${restaurant.description}</div>
      </div>
    </div>`;
  };


  this.load_search_history = function () {
    try {
      var raw = localStorage.getItem(this.history_storage_key);
      var parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  this.save_to_history = function (address, latLng) {
    if (!address || !latLng) return;
    var history = this.load_search_history();
    history = history.filter(function (h) { return h.address !== address; });
    history.unshift({ address: address, lat: latLng.lat(), lng: latLng.lng() });
    history = history.slice(0, this.max_history_items);
    try {
      localStorage.setItem(this.history_storage_key, JSON.stringify(history));
    } catch (e) { /* storage full or unavailable */ }
    this.render_search_history();
  };

  this.render_search_history = function () {
    var t = this;
    var history = t.load_search_history();
    var $container = $('#search-history');
    var $list = $('#history-list');
    if (!$container.length) return;
    $list.empty();
    if (history.length === 0) {
      $container.hide();
      return;
    }
    history.forEach(function (item) {
      var $btn = $('<button>')
        .attr('type', 'button')
        .addClass('btn btn-link btn-sm p-0 d-block text-start w-100 text-truncate text-secondary')
        .attr('title', item.address)
        .text(item.address)
        .css({ fontSize: '0.8rem' })
        .click(function () {
          var latLng = new google.maps.LatLng(item.lat, item.lng);
          $('#txt-address').val(item.address);
          t.txt_point.val(latLng.toUrlValue());
          t.infowindow.setContent('Your location: <br/><strong class="fw-bold">' + t.escape_html(item.address) + '</strong>');
          t.marker.setOptions({ position: latLng, visible: true });
          t.clear_markers();
          t.set_accessibility(true);
          var zoom = t.min_visible_zoom(latLng.lat(), t.circle_distance || t.get_meters());
          t.map.setOptions({ center: latLng, zoom });
          if (t.is_circle())
            t.circle.setOptions({ center: latLng, visible: true });
          else if (t.rectangle.getVisible())
            t.move_rectange(latLng);
        });
      $list.append($btn);
    });
    $container.show();
  };

  this.clear_search_history = function () {
    try { localStorage.removeItem(this.history_storage_key); } catch (e) { /* noop */ }
    this.render_search_history();
  };

  this.load_favorites = function () {
    try {
      var raw = localStorage.getItem(this.fav_storage_key);
      var parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  };

  this.save_favorites = function (arr) {
    try {
      localStorage.setItem(this.fav_storage_key, JSON.stringify(arr));
    } catch (e) { /* storage full or unavailable */ }
  };

  this.is_favorite = function (id) {
    if (!id) return false;
    return this.load_favorites().some(function (f) { return f.id === id; });
  };

  this.toggle_favorite = function (item) {
    if (!item || !item.id) return;
    var favs = this.load_favorites();
    var idx = favs.findIndex(function (f) { return f.id === item.id; });
    var nowFav;
    if (idx >= 0) {
      favs.splice(idx, 1);
      nowFav = false;
    } else {
      favs.push({ id: item.id, title: item.title, description: item.description, photo: item.photo, lat: item.lat, lng: item.lng });
      nowFav = true;
    }
    this.save_favorites(favs);
    this.update_fav_ui(item.id, nowFav);
    this.render_favorites_tab();
  };

  this.update_fav_ui = function (id, isFav) {
    $('[data-fav-id="' + id + '"]').each(function () {
      $(this).toggleClass('is-fav', isFav)
        .attr('aria-label', isFav ? 'Remove from saved' : 'Save restaurant')
        .attr('title', isFav ? 'Remove from saved' : 'Save restaurant');
      $(this).find('.fav-icon').text(isFav ? '\u2605' : '\u2606');
    });
    var count = this.load_favorites().length;
    $('#fav-count').text(count || '').toggle(count > 0);
  };

  this.render_favorites_tab = function () {
    var t = this;
    var favs = t.load_favorites();
    var $empty = $('#fav-empty');
    var $list = $('#fav-items');
    var count = favs.length;
    $('#fav-count').text(count || '').toggle(count > 0);
    $list.empty();
    if (count === 0) { $empty.show(); return; }
    $empty.hide();
    favs.forEach(function (fav) {
      var $card = $('<div>').addClass('lv-card lv-fav-card').attr({
        role: 'button', tabindex: '0', 'aria-label': 'Go to ' + fav.title
      });
      var $thumb = $('<img>').addClass('lv-thumb').attr({ src: fav.photo, alt: fav.title })
        .on('error', function () { $(this).attr('src', t.fallback_restaurant_photo); });
      var $info = $('<div>').addClass('lv-info');
      var $titleRow = $('<div>').addClass('d-flex justify-content-between');
      var $title = $('<div>').addClass('lv-title').text(fav.title);
      var $desc = $('<div>').addClass('lv-desc').text(fav.description);
      $titleRow.append($title);
      $info.append($titleRow, $desc);
      var $favBtn = $('<button>').addClass('lv-fav-btn is-fav')
        .attr({ type: 'button', 'data-fav-id': fav.id, 'aria-label': 'Remove from saved', title: 'Remove from saved' })
        .html('<span class="fav-icon">\u2605</span>');
      $card.append($thumb, $info, $favBtn);
      var clickHandler = function (e) {
        if ($(e.target).closest('.lv-fav-btn').length) return;
        t.show_fav_on_map(fav);
      };
      $card.click(clickHandler).keydown(function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(e); }
      });
      $list.append($card);
    });
  };

  this.show_fav_on_map = function (fav) {
    var t = this;
    var pos = new google.maps.LatLng(fav.lat, fav.lng);
    t.map.panTo(pos);
    if (t.map.getZoom() < 15) t.map.setZoom(15);

    // Use the real marker if this restaurant is in the current search results
    var currentItem = t.arr_list_data.find(function (d) { return d.id === fav.id; });
    if (currentItem) {
      var mk = t.arr_markers[t.arr_list_data.indexOf(currentItem)];
      if (mk) {
        t.infowindow_restaurant.setContent(t.build_restaurant_info_content(currentItem));
        t.infowindow_restaurant.open({ anchor: mk, map: t.map });
        return;
      }
    }

    // Restaurant is from a different search — use a temporary marker
    if (t.fav_temp_marker) {
      google.maps.event.clearInstanceListeners(t.fav_temp_marker);
      t.fav_temp_marker.setMap(null);
      t.fav_temp_marker = null;
    }
    t.fav_temp_marker = new google.maps.Marker({
      position: pos,
      map: t.map,
      title: fav.title,
      animation: google.maps.Animation.DROP,
      icon: {
        url: t.marker_icon,
        scaledSize: { width: 35, height: 35 }
      }
    });
    t.infowindow_restaurant.setContent(t.build_restaurant_info_content(fav));
    t.infowindow_restaurant.open({ anchor: t.fav_temp_marker, map: t.map });
    t.fav_temp_marker.addListener('click', function () {
      t.infowindow_restaurant.setContent(t.build_restaurant_info_content(fav));
      t.infowindow_restaurant.open({ anchor: t.fav_temp_marker, map: t.map });
    });
  };

  this.format_distance = function (meters) {
    if (meters === null || meters === undefined) return '';
    if (meters >= 1000)
      return (meters / 1000).toFixed(1) + ' km';
    return Math.round(meters) + ' m';
  };

  this.compute_item_distances = function (items) {
    var t = this;
    var origin = t.marker && t.marker.getVisible() ? t.marker.getPosition() : null;
    items.forEach(function (item) {
      if (!origin) { item._distance = null; return; }
      var dest = new google.maps.LatLng(item.lat, item.lng);
      item._distance = google.maps.geometry.spherical.computeDistanceBetween(origin, dest);
    });
  };

  this.sort_list_items = function (items, sortKey) {
    var sorted = items.slice();
    switch (sortKey) {
      case 'name':
        sorted.sort(function (a, b) { return a.title.localeCompare(b.title); });
        break;
      case 'name-desc':
        sorted.sort(function (a, b) { return b.title.localeCompare(a.title); });
        break;
      case 'distance-desc':
        sorted.sort(function (a, b) {
          if (a._distance === null) return 1;
          if (b._distance === null) return -1;
          return b._distance - a._distance;
        });
        break;
      case 'distance':
      default:
        sorted.sort(function (a, b) {
          if (a._distance === null) return 1;
          if (b._distance === null) return -1;
          return a._distance - b._distance;
        });
        break;
    }
    return sorted;
  };

  this.render_list_view = function (items) {
    var t = this;
    var $body = $('#list-view-items');
    var $empty = $('#list-view-empty');
    var $count = $('#list-view-count');
    $body.empty();

    if (!items || items.length === 0) {
      $empty.show();
      $count.text('');
      $('#list-view-sort-bar').hide();
      return;
    }

    $empty.hide();
    $count.text(items.length);
    $('#list-view-sort-bar').show();

    // Compute distances from current marker position
    t.compute_item_distances(items);

    // Apply current sort
    var sortKey = $('#list-sort').val() || 'distance';
    var sorted = t.sort_list_items(items, sortKey);

    sorted.forEach(function (item) {
      // Find the true index in arr_markers (match by lat/lng)
      var markerIndex = t.arr_list_data.indexOf(item);

      var $card = $('<div>').addClass('lv-card').attr({
        role: 'button',
        tabindex: '0',
        'aria-label': 'View ' + item.title + ' on map'
      });

      var $thumb = $('<img>').addClass('lv-thumb')
        .attr('src', item.photo)
        .attr('alt', item.title)
        .on('error', function () { $(this).attr('src', t.fallback_restaurant_photo); });

      var $info = $('<div>').addClass('lv-info');
      var $titleRow = $('<div>').addClass('d-flex justify-content-between align-items-baseline');
      var $title = $('<div>').addClass('lv-title').text(item.title);
      var $dist = $('<span>').addClass('lv-distance')
        .text(item._distance !== null ? t.format_distance(item._distance) : '');
      $titleRow.append($title, $dist);
      var $desc = $('<div>').addClass('lv-desc').text(item.description);

      var isFav = t.is_favorite(item.id);
      var $favBtn = $('<button>').addClass('lv-fav-btn' + (isFav ? ' is-fav' : ''))
        .attr({ type: 'button', 'data-fav-id': item.id || '',
          'aria-label': isFav ? 'Remove from saved' : 'Save restaurant',
          title: isFav ? 'Remove from saved' : 'Save restaurant' })
        .html('<span class="fav-icon">' + (isFav ? '\u2605' : '\u2606') + '</span>');

      $info.append($titleRow, $desc);
      $card.append($thumb, $info, $favBtn);

      var clickHandler = function (e) {
        if ($(e.target).closest('.lv-fav-btn').length) return;
        var mk = t.arr_markers[markerIndex];
        if (!mk) return;
        t.map.panTo(mk.getPosition());
        if (t.map.getZoom() < 15) t.map.setZoom(15);
        t.infowindow_restaurant.setContent(t.build_restaurant_info_content(item));
        t.infowindow_restaurant.open({ anchor: mk, map: t.map });
        var offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('list-view-panel'));
        if (offcanvas && window.innerWidth < 768) offcanvas.hide();
      };

      $card.click(clickHandler).keydown(function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(e); }
      });

      $body.append($card);
    });
  };

  this.clear_list_view = function () {
    this.arr_list_data = [];
    this.render_list_view([]);
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
        t.map.setZoom(15);
      }

      t.txt_point.val(place.geometry.location.toUrlValue());

      t.infowindow.setOptions({ content: `Your location: <br/><strong class="fw-bold">${t.escape_html(place.name)}</strong><p>${t.escape_html(place.formatted_address || '')}</p>`, map: t.map });
      t.marker.setOptions({ position: place.geometry.location, visible: true });

      t.save_to_history(place.formatted_address || place.name, place.geometry.location);
      t.clear_markers();
      t.set_accessibility(true);

      if (t.is_circle())
        t.circle.setOptions({ center: place.geometry.location, visible: true });
      else if (t.rectangle.getVisible())
        t.move_rectange(place.geometry.location);

      // After fitBounds animation settles, ensure the map is zoomed in enough
      // to make the red circle clearly visible (fitBounds may zoom out too far).
      if (t.is_circle()) {
        google.maps.event.addListenerOnce(t.map, 'idle', function () {
          if (!t.circle.getVisible()) return;
          var c = t.circle.getCenter();
          if (!c) return;
          var minZoom = t.min_visible_zoom(c.lat(), t.circle.getRadius());
          if (t.map.getZoom() < minZoom) t.map.setZoom(minZoom);
        });
      }
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

    var zoom = t.min_visible_zoom(latLng.lat(), t.circle_distance || t.get_meters());
    t.map.setOptions({ center: latLng, zoom });
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
    if (t.is_circle()) {
      var r = t.circle_distance || t.get_meters();
      if (t.marker.getVisible()) {
        // Re-center the circle on the current marker position and ensure it is visible.
        // This guards against the circle drifting or losing visibility after zoom/pans.
        t.circle.setOptions({ center: t.marker.getPosition(), radius: r, visible: true });
      } else {
        t.circle.setRadius(r);
      }
    } else {
      if (t.marker.getVisible())
        t.move_rectange(t.marker.getPosition());
    }
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
        nav.css('top', 10);
        el.css('top', 0);
        el.removeClass('is_hide').find('i').removeClass('bi-arrow-down-circle-fill').addClass('bi-arrow-up-circle-fill');
        el.attr('aria-expanded', 'true');
      } else {
        nav.css('top', 0 - height);
        el.css('top', 63);
        el.find('i').removeClass('bi-arrow-up-circle-fill').addClass('bi-arrow-down-circle-fill');
        el.addClass('is_hide').attr('aria-expanded', 'false');
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

    $('#btn-clear-history').click(function (e) {
      e.preventDefault();
      t.clear_search_history();
    });

    t.render_search_history();
    t.render_favorites_tab();

    // Favorite toggle — covers list cards, favorites panel, and info window buttons
    $(document).on('click', '[data-fav-id]', function (e) {
      e.stopPropagation();
      var id = $(this).attr('data-fav-id');
      if (!id) return;
      var item = t.arr_list_data.find(function (d) { return d.id === id; });
      if (!item) {
        var favs = t.load_favorites();
        item = favs.find(function (f) { return f.id === id; });
      }
      if (item) t.toggle_favorite(item);
    });

    $('#list-sort').change(function () {
      if (t.arr_list_data && t.arr_list_data.length > 0)
        t.render_list_view(t.arr_list_data);
    });

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

    // Show empty state for list view on startup
    t.render_list_view([]);

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

    var listData = [];

    t.arr_markers = t.arr_restaurants.reduce((markers, restaurant) => {
      var markerData = t.get_restaurant_marker_data(restaurant);
      if (!markerData)
        return markers;

      var r_marker = new google.maps.Marker({
        position: { lat: markerData.lat, lng: markerData.lng },
        title: markerData.title,
        animation: google.maps.Animation.DROP,
        icon: {
          url: t.arr_icons[Math.floor(Math.random() * t.arr_icons.length)],
          scaledSize: { width: 35, height: 35 }
        }
      });

      r_marker.addListener("click", () => {
        t.infowindow_restaurant.setContent(t.build_restaurant_info_content(markerData));
        t.infowindow_restaurant.open({ anchor: r_marker, map: t.map });
      });

      markers.push(r_marker);
      listData.push(markerData);
      return markers;
    }, []);

    t.arr_list_data = listData;

    // Preload all photos then render list view with resolved URLs
    Promise.all(listData.map(function (item) {
      return t.preload_image(item.photo).then(function (resolvedUrl) {
        item.photo = resolvedUrl;
        return item;
      });
    })).then(function (resolvedList) {
      t.render_list_view(resolvedList);
    });

    // Use MarkerClusterer if available, otherwise fall back to plain markers
    if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
      t.clusterer = new window.markerClusterer.MarkerClusterer({
        map: t.map,
        markers: t.arr_markers
      });
    } else {
      t.arr_markers.forEach(function (mk) { mk.setMap(t.map); });
    }

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
    if (t.fav_temp_marker) {
      google.maps.event.clearInstanceListeners(t.fav_temp_marker);
      t.fav_temp_marker.setMap(null);
      t.fav_temp_marker = null;
    }
    if (t.clusterer) {
      t.clusterer.clearMarkers();
      t.clusterer = null;
    }
    if (Array.isArray(t.arr_markers) && t.arr_markers.length > 0) {
      t.arr_markers.map((mk) => {
        google.maps.event.clearInstanceListeners(mk);
        mk.setMap(null);
      });
      t.arr_markers = [];
    }
    t.clear_list_view();
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

  // Returns the minimum map zoom level at which a circle of `radiusMeters`
  // would appear at least `minPxRadius` pixels wide on screen at `latitude`.
  this.min_visible_zoom = function (latitude, radiusMeters, minPxRadius) {
    if (!(minPxRadius > 0)) minPxRadius = 25;
    if (!(radiusMeters > 0)) return 15;
    var cosLat = Math.cos(latitude * Math.PI / 180);
    var zoom = Math.ceil(Math.log2(156543.03392 * cosLat * minPxRadius / radiusMeters));
    return Math.min(Math.max(zoom, 10), 18);
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
