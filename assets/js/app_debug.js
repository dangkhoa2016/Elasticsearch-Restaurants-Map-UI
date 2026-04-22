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
const defaultConfig = window.ELASTICSEARCH_RESTAURANTS_DEFAULT_CONFIG || {};
const runtimeConfig = typeof window.createElasticsearchRestaurantsConfig === 'function'
  ? window.createElasticsearchRestaurantsConfig(window.ELASTICSEARCH_RESTAURANTS_CONFIG)
  : defaultConfig;
const endpoint = runtimeConfig.endpoint;
var map = null;
var index_name = runtimeConfig.indexName;
var map_center = runtimeConfig.mapCenter;
var center = null;
var default_type = 'm';
var default_enlarge = 'circle';
var default_distance_circle = 200;
var default_distance_horizontal = 150;
var default_distance_vertical = 150;
var marker = null;
var circle = null;
var arr_icons = runtimeConfig.restaurantIcons;
var marker_icon = runtimeConfig.markerIcon;
var fallback_restaurant_photo = runtimeConfig.fallbackRestaurantPhoto;
var rectangle = null;
var infowindow = null;
var infowindow_restaurant = null;
var txt_point = null;
var rectangle_distance = [];
var circle_distance = null;
var autocomplete = null;
var xhr_query = null;
var max_distance_circle_in_miles = 4;
var max_distance_horizontal_in_miles = 4;
var max_distance_vertical_in_miles = 4;
var max_distance_circle_in_km = 10;
var max_distance_horizontal_in_km = 10;
var max_distance_vertical_in_km = 10;
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
var arr_list_data = [];
var clusterer = null;
var fav_temp_marker = null;
var search_result_message = '';
var max_search_results = runtimeConfig.maxSearchResults || 80;
var autocomplete_country_restriction = runtimeConfig.autocompleteCountryRestriction || '';
var history_storage_key = 'er_search_history';
var max_history_items = 8;
var fav_storage_key = 'er_favorites';

// Cached jQuery DOM references (populated in init_other)
var $sel_enlarge_type = null;
var $txt_distance = null;
var $txt_horizontal = null;
var $txt_vertical = null;

var grp = ['#grp-distance', '#grp-horizontal', '#grp-vertical'];

function escape_html(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function sanitize_url(value, fallback) {
  if (fallback === undefined) fallback = '';
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    var url = new URL(value, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch (e) { /* noop */ }
  return fallback;
}

function to_number(value, fallback) {
  if (fallback === undefined) fallback = 0;
  var parsed = typeof value === 'number' ? value : parseFloat(value);
  return isFinite(parsed) ? parsed : fallback;
}

function preload_image(src) {
  return new Promise(function (resolve) {
    if (!src) return resolve(fallback_restaurant_photo);
    var img = new Image();
    img.onload = function () { resolve(src); };
    img.onerror = function () { resolve(fallback_restaurant_photo); };
    img.src = src;
  });
}

function is_positive_number(value) {
  return to_number(value, 0) > 0;
}

function join_url(base, path) {
  if (typeof base !== 'string' || base.trim() === '') return '';
  return base.replace(/\/+$/, '') + '/' + String(path || '').replace(/^\/+/, '');
}

function show_text_message(title, text) {
  var $modal = $('#md-notice');
  $modal.find('.modal-title').text(title || 'Notice');
  $modal.find('.modal-body').empty().append($('<p>').text(text || ''));
  $modal.modal('show');
}

function validate_search_request() {
  var position = marker && marker.getPosition ? marker.getPosition() : null;
  if (!endpoint) return 'Search endpoint is not configured.';
  if (!position || !is_latitude(position.lat()) || !is_longitude(position.lng()))
    return 'Please select or enter a valid location.';
  if (is_circle()) {
    if (!is_positive_number(circle && circle.getRadius ? circle.getRadius() : 0))
      return 'Please enter a valid search distance.';
  } else {
    if (!rectangle || !rectangle.getBounds || !rectangle.getBounds())
      return 'Please enter a valid rectangular search area.';
  }
  return '';
}

function normalize_search_response(res) {
  var hits = res && res.hits && Array.isArray(res.hits.hits) ? res.hits.hits : [];
  var totalValue = res && res.hits && res.hits.total ? res.hits.total.value : 0;
  var shards = res && res._shards ? res._shards : {};
  return {
    took: to_number(res && res.took, 0),
    total: to_number(totalValue, hits.length),
    hits,
    shardsTotal: to_number(shards.total, 0),
    shardsSuccessful: to_number(shards.successful, 0)
  };
}

function format_search_result_message(summary, displayedCount) {
  var limitMessage = summary.total > displayedCount
    ? '<p><strong>Displaying ' + displayedCount + ' of ' + summary.total + ' results.</strong></p>'
    : '';
  return '<div>Took: ' + summary.took + ' Milliseconds<br/>Total: ' + summary.total +
    '<br/>Shards:<br/><ul><li>Total: ' + summary.shardsTotal + '</li><li>Successful: ' +
    summary.shardsSuccessful + '</li></ul>' + limitMessage + '</div>';
}

function get_restaurant_marker_data(restaurant) {
  var source = restaurant && restaurant._source ? restaurant._source : {};
  var location = source.location || {};
  var lat = to_number(location.lat, NaN);
  var lng = to_number(location.lon, NaN);
  if (!is_latitude(lat) || !is_longitude(lng)) return null;
  return {
    id: restaurant._id || '',
    lat,
    lng,
    title: escape_html(source.name || 'Restaurant'),
    description: escape_html(source.description || 'No description available.').replace(/&lt;br\s*\/?&gt;/gi, '<br>'),
    photo: sanitize_url(get_photo(source.photos), fallback_restaurant_photo)
  };
}

function build_restaurant_info_content(markerData) {
  var isFav = is_favorite(markerData.id);
  var favClass = isFav ? ' is-fav' : '';
  var favTitle = isFav ? 'Remove from saved' : 'Save restaurant';
  var favIcon = isFav ? '&#9733;' : '&#9734;';
  var idAttr = escape_html(markerData.id || '');
  var locationText = escape_html(markerData.lat + ', ' + markerData.lng);
  var fallback = escape_html(fallback_restaurant_photo);
  return '<div class="iw-main">' +
    '<div class="d-flex justify-content-between align-items-start mb-1">' +
    '<h4 class="mb-0 me-2" title="Location: ' + locationText + '">' + markerData.title + '</h4>' +
    '<button type="button" class="lv-fav-btn iw-fav-btn' + favClass + '" data-fav-id="' + idAttr + '" aria-label="' + favTitle + '" title="' + favTitle + '"><span class="fav-icon">' + favIcon + '</span></button>' +
    '</div>' +
    '<div class="iw-body">' +
    '<img src="' + escape_html(markerData.photo) + '" class="float-start me-3 iw-img" alt="' + markerData.title + '" onerror="this.onerror=null;this.src=\'' + fallback + '\'">' +
    '<div>' + markerData.description + '</div>' +
    '</div></div>';
}

function load_search_history() {
  try {
    var raw = localStorage.getItem(history_storage_key);
    var parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function save_to_history(address, latLng) {
  if (!address || !latLng) return;
  var history = load_search_history();
  history = history.filter(function (h) { return h.address !== address; });
  history.unshift({ address: address, lat: latLng.lat(), lng: latLng.lng() });
  history = history.slice(0, max_history_items);
  try {
    localStorage.setItem(history_storage_key, JSON.stringify(history));
  } catch (e) { /* storage full or unavailable */ }
  render_search_history();
}

function render_search_history() {
  var history = load_search_history();
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
        txt_point.val(latLng.toUrlValue());
        infowindow.setContent('Your location: <br/><strong class="fw-bold">' + escape_html(item.address) + '</strong>');
        marker.setOptions({ position: latLng, visible: true });
        clear_markers();
        set_accessibility(true);
        var zoom = min_visible_zoom(latLng.lat(), circle_distance || get_meters());
        map.setOptions({ center: latLng, zoom });
        if (is_circle())
          circle.setOptions({ center: latLng, visible: true });
        else if (rectangle.getVisible())
          move_rectange(latLng);
      });
    $list.append($btn);
  });
  $container.show();
}

function clear_search_history() {
  try { localStorage.removeItem(history_storage_key); } catch (e) { /* noop */ }
  render_search_history();
}

function load_favorites() {
  try {
    var raw = localStorage.getItem(fav_storage_key);
    var parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function save_favorites(arr) {
  try {
    localStorage.setItem(fav_storage_key, JSON.stringify(arr));
  } catch (e) { /* storage full or unavailable */ }
}

function is_favorite(id) {
  if (!id) return false;
  return load_favorites().some(function (f) { return f.id === id; });
}

function toggle_favorite(item) {
  if (!item || !item.id) return;
  var favs = load_favorites();
  var idx = favs.findIndex(function (f) { return f.id === item.id; });
  var nowFav;
  if (idx >= 0) {
    favs.splice(idx, 1);
    nowFav = false;
  } else {
    favs.push({ id: item.id, title: item.title, description: item.description, photo: item.photo, lat: item.lat, lng: item.lng });
    nowFav = true;
  }
  save_favorites(favs);
  update_fav_ui(item.id, nowFav);
  render_favorites_tab();
}

function update_fav_ui(id, isFav) {
  $('[data-fav-id="' + id + '"]').each(function () {
    $(this).toggleClass('is-fav', isFav)
      .attr('aria-label', isFav ? 'Remove from saved' : 'Save restaurant')
      .attr('title', isFav ? 'Remove from saved' : 'Save restaurant');
    $(this).find('.fav-icon').text(isFav ? '\u2605' : '\u2606');
  });
  var count = load_favorites().length;
  $('#fav-count').text(count || '').toggle(count > 0);
}

function render_favorites_tab() {
  var favs = load_favorites();
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
      .on('error', function () { $(this).attr('src', fallback_restaurant_photo); });
    var $info = $('<div>').addClass('lv-info');
    var $titleRow = $('<div>').addClass('d-flex justify-content-between');
    var $title = $('<div>').addClass('lv-title').html(fav.title);
    var $desc = $('<div>').addClass('lv-desc').html(fav.description);
    $titleRow.append($title);
    $info.append($titleRow, $desc);
    var $favBtn = $('<button>').addClass('lv-fav-btn is-fav')
      .attr({ type: 'button', 'data-fav-id': fav.id, 'aria-label': 'Remove from saved', title: 'Remove from saved' })
      .html('<span class="fav-icon">\u2605</span>');
    $card.append($thumb, $info, $favBtn);
    var clickHandler = function (e) {
      if ($(e.target).closest('.lv-fav-btn').length) return;
      show_fav_on_map(fav);
    };
    $card.click(clickHandler).keydown(function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(e); }
    });
    $list.append($card);
  });
}

function show_fav_on_map(fav) {
  var pos = new google.maps.LatLng(fav.lat, fav.lng);
  map.setOptions({ center: pos, zoom: Math.max(map.getZoom(), 15) });

  // Use the real marker if this restaurant is in the current search results
  var currentItem = arr_list_data.find(function (d) { return d.id === fav.id; });
  if (currentItem) {
    var mk = arr_markers[arr_list_data.indexOf(currentItem)];
    if (mk) {
      infowindow_restaurant.setContent(build_restaurant_info_content(currentItem));
      infowindow_restaurant.open({ anchor: mk, map });
      return;
    }
  }

  // Restaurant is from a different search — use a temporary marker
  if (fav_temp_marker) {
    google.maps.event.clearInstanceListeners(fav_temp_marker);
    fav_temp_marker.setMap(null);
    fav_temp_marker = null;
  }
  fav_temp_marker = new google.maps.Marker({
    position: pos,
    map: map,
    title: fav.title,
    animation: google.maps.Animation.DROP,
    icon: {
      url: marker_icon,
      scaledSize: { width: 35, height: 35 }
    }
  });
  infowindow_restaurant.setContent(build_restaurant_info_content(fav));
  infowindow_restaurant.open({ anchor: fav_temp_marker, map });
  fav_temp_marker.addListener('click', function () {
    infowindow_restaurant.setContent(build_restaurant_info_content(fav));
    infowindow_restaurant.open({ anchor: fav_temp_marker, map });
  });
}

function format_distance(meters) {
  if (meters === null || meters === undefined) return '';
  if (meters >= 1000)
    return (meters / 1000).toFixed(1) + ' km';
  return Math.round(meters) + ' m';
}

function compute_item_distances(items) {
  var origin = marker && marker.getVisible() ? marker.getPosition() : null;
  items.forEach(function (item) {
    if (!origin) { item._distance = null; return; }
    var dest = new google.maps.LatLng(item.lat, item.lng);
    item._distance = google.maps.geometry.spherical.computeDistanceBetween(origin, dest);
  });
}

function sort_list_items(items, sortKey) {
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
}

function highlight_text(text, query) {
  if (!query) return text;
  var safeQuery = escape_html(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('(' + safeQuery + ')', 'gi'), '<mark class="lv-highlight">$1</mark>');
}

function render_list_view(items) {
  var $body = $('#list-view-items');
  var $empty = $('#list-view-empty');
  var $count = $('#list-view-count');
  $body.empty();

  if (!items || items.length === 0) {
    $empty.show();
    $count.text('');
    $('#list-view-toolbar').hide();
    $('#list-filter').val('');
    $('#list-filter-count').text('');
    return;
  }

  $('#list-view-toolbar').show();

  // Compute distances from current marker position
  compute_item_distances(items);

  // Apply text filter
  var filterText = ($('#list-filter').val() || '').trim().toLowerCase();
  var filtered = filterText
    ? items.filter(function (item) {
        return item.title.toLowerCase().indexOf(filterText) >= 0 ||
               item.description.toLowerCase().indexOf(filterText) >= 0;
      })
    : items;

  // Update count badges
  $count.text(items.length);
  if (filterText) {
    $('#list-filter-count').text(filtered.length + '/' + items.length);
  } else {
    $('#list-filter-count').text('');
  }

  if (filtered.length === 0) {
    $empty.text('No results match "' + filterText + '"').show();
    return;
  }
  $empty.hide();

  // Apply current sort
  var sortKey = $('#list-sort').val() || 'distance';
  var sorted = sort_list_items(filtered, sortKey);

  sorted.forEach(function (item) {
    var markerIndex = arr_list_data.indexOf(item);

    var $card = $('<div>').addClass('lv-card').attr({
      role: 'button',
      tabindex: '0',
      'aria-label': 'View ' + item.title + ' on map'
    });

    var $thumb = $('<img>').addClass('lv-thumb')
      .attr('src', item.photo)
      .attr('alt', item.title)
      .on('error', function () { $(this).attr('src', fallback_restaurant_photo); });

    var $info = $('<div>').addClass('lv-info');
    var $titleRow = $('<div>').addClass('d-flex justify-content-between align-items-baseline');
    var $title = $('<div>').addClass('lv-title');
    if (filterText) {
      $title.html(highlight_text(item.title, filterText));
    } else {
      $title.html(item.title);
    }
    var $dist = $('<span>').addClass('lv-distance')
      .text(item._distance !== null ? format_distance(item._distance) : '');
    $titleRow.append($title, $dist);
    var $desc = $('<div>').addClass('lv-desc');
    if (filterText) {
      $desc.html(highlight_text(item.description, filterText));
    } else {
      $desc.html(item.description);
    }

    var isFav = is_favorite(item.id);
    var $favBtn = $('<button>').addClass('lv-fav-btn' + (isFav ? ' is-fav' : ''))
      .attr({ type: 'button', 'data-fav-id': item.id || '',
        'aria-label': isFav ? 'Remove from saved' : 'Save restaurant',
        title: isFav ? 'Remove from saved' : 'Save restaurant' })
      .html('<span class="fav-icon">' + (isFav ? '\u2605' : '\u2606') + '</span>');

    $info.append($titleRow, $desc);
    $card.append($thumb, $info, $favBtn);

    var clickHandler = function (e) {
      if ($(e.target).closest('.lv-fav-btn').length) return;
      var mk = arr_markers[markerIndex];
      if (!mk) return;
      map.setOptions({ center: mk.getPosition(), zoom: Math.max(map.getZoom(), 15) });
      infowindow_restaurant.setContent(build_restaurant_info_content(item));
      infowindow_restaurant.open({ anchor: mk, map });
      var offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('list-view-panel'));
      if (offcanvas && window.innerWidth < 768) offcanvas.hide();
    };

    $card.click(clickHandler).keydown(function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(e); }
    });

    $body.append($card);
  });
}

function clear_list_view() {
  arr_list_data = [];
  render_list_view([]);
}

// ── Share / Deep Link ────────────────────────────────────────────────────

function get_url_state() {
  if (!marker || !marker.getVisible()) return null;
  var pos = marker.getPosition();
  var params = new URLSearchParams();
  params.set('lat', pos.lat().toFixed(6));
  params.set('lng', pos.lng().toFixed(6));
  params.set('addr', $('#txt-address').val() || '');
  var isCircle = is_circle();
  params.set('type', isCircle ? 'circle' : 'rectangle');
  if (isCircle) {
    params.set('d', get_distance());
    params.set('du', get_dropdown_measure('#grp-distance'));
  } else {
    params.set('h', get_horizontal());
    params.set('hu', get_dropdown_measure('#grp-horizontal'));
    params.set('v', get_vertical());
    params.set('vu', get_dropdown_measure('#grp-vertical'));
  }
  return params;
}

function apply_url_state() {
  var hash = window.location.hash;
  if (!hash || hash.length <= 1) return;
  try {
    var params = new URLSearchParams(hash.slice(1));
    var lat = parseFloat(params.get('lat'));
    var lng = parseFloat(params.get('lng'));
    if (!is_latitude(lat) || !is_longitude(lng)) return;

    var type = params.get('type') === 'rectangle' ? 'rectangle' : 'circle';
    var d = params.get('d');
    var du = params.get('du') || 'm';
    var h = params.get('h');
    var hu = params.get('hu') || 'm';
    var v = params.get('v');
    var vu = params.get('vu') || 'm';
    var addr = params.get('addr') || '';

    // 1. Restore shape type
    ($sel_enlarge_type || $('#sel-enlarge-type')).val(type).trigger('change');

    // 2. Restore units FIRST so the max-cap check in handle_change_measure
    //    runs against the existing default, not the URL value.
    handle_change_measure('#grp-distance .dropdown-menu li a[data-value="' + du + '"]', false);
    handle_change_measure('#grp-horizontal .dropdown-menu li a[data-value="' + hu + '"]', false);
    handle_change_measure('#grp-vertical .dropdown-menu li a[data-value="' + vu + '"]', false);

    // 3. Restore distance values AFTER units are set (overwrites any clipped default).
    if (d !== null) ($txt_distance || $('#txt-distance')).val(d);
    if (h !== null) ($txt_horizontal || $('#txt-horizontal')).val(h);
    if (v !== null) ($txt_vertical || $('#txt-vertical')).val(v);

    // 4. Restore center point
    var latLng = new google.maps.LatLng(lat, lng);
    txt_point.val(latLng.toUrlValue());
    set_point(txt_point);

    // 5. Ensure circle has correct radius
    redraw_from_distance();

    // 6. Set address text
    if (addr) $('#txt-address').val(addr);
  } catch (e) { /* noop — malformed hash */ }
}

function share_search() {
  var params = get_url_state();
  if (!params) {
    show_text_message('Nothing to share', 'Please set a search location first.');
    return;
  }
  var url = window.location.origin + window.location.pathname + '#' + params.toString();
  history.replaceState(null, '', '#' + params.toString());
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(function () { show_share_feedback(true); })
      .catch(function () { fallback_copy(url); });
  } else {
    fallback_copy(url);
  }
}

function fallback_copy(text) {
  var $ta = $('<textarea>').val(text).css({ position: 'fixed', top: 0, left: 0, opacity: 0 }).appendTo('body');
  $ta[0].select();
  try { document.execCommand('copy'); show_share_feedback(true); } catch (e) { show_share_feedback(false); }
  $ta.remove();
}

function show_share_feedback(success) {
  var $btn = $('#btn-share');
  var $icon = $btn.find('i');
  $icon.removeClass('bi-share-fill').addClass(success ? 'bi-check2-circle' : 'bi-x-circle');
  $btn.addClass(success ? 'text-info' : 'text-danger');
  setTimeout(function () {
    $icon.removeClass('bi-check2-circle bi-x-circle').addClass('bi-share-fill');
    $btn.removeClass('text-info text-danger');
  }, 2000);
}

// ── My Location ────────────────────────────────────────────────────

function use_my_location() {
  if (!navigator.geolocation) {
    show_text_message('Not supported', 'Your browser does not support geolocation.');
    return;
  }

  var $btn = $('#btn-my-location');
  var $icon = $btn.find('i');
  $btn.prop('disabled', true);
  $icon.removeClass('bi-geo-alt-fill').addClass('bi-hourglass-split geo-spin');

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var latLng = new google.maps.LatLng(lat, lng);

      var geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, function (results, status) {
        $btn.prop('disabled', false);
        $icon.removeClass('bi-hourglass-split geo-spin').addClass('bi-geo-alt-fill');

        var address = (status === 'OK' && results && results[0])
          ? results[0].formatted_address
          : lat.toFixed(6) + ', ' + lng.toFixed(6);

        $('#txt-address').val(address);
        txt_point.val(latLng.toUrlValue());

        infowindow.setContent('Your location: <br/><strong class="fw-bold">' + escape_html(address) + '</strong>');
        marker.setOptions({ position: latLng, visible: true });

        save_to_history(address, latLng);
        clear_markers();
        set_accessibility(true);

        if (is_circle())
          circle.setOptions({ center: latLng, visible: true });
        else if (rectangle.getVisible())
          move_rectange(latLng);

        var zoom = min_visible_zoom(lat, circle_distance || get_meters());
        map.setOptions({ center: latLng, zoom });
      });
    },
    function (err) {
      $btn.prop('disabled', false);
      $icon.removeClass('bi-hourglass-split geo-spin').addClass('bi-geo-alt-fill');
      var msgs = {
        1: 'Location access was denied. Please allow location permission in your browser.',
        2: 'Your location could not be determined. Please try again.',
        3: 'Location request timed out. Please try again.'
      };
      show_text_message('Location unavailable', msgs[err.code] || 'Unable to get your location.');
    },
    { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
  );
}

// ────────────────────────────────────────────────────────────────────────

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
      url: marker_icon,
      scaledSize: { width: 40, height: 40 }
    },
    draggable: true,
    visible: false
  });

  map.addListener("click", (event) => {
    var latLng = event.latLng;
    txt_point.val(latLng.toUrlValue());
    infowindow.setContent(`Your location: <br/><strong class="fw-bold">${escape_html(latLng.toUrlValue())}</strong>`);
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
    infowindow.setContent(`Your location: <br/><strong class="fw-bold">${escape_html(latLng.toUrlValue())}</strong>`);
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

  var search_options = autocomplete_country_restriction
    ? { componentRestrictions: { country: autocomplete_country_restriction } }
    : {};
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
      map.setZoom(15);
    }

    txt_point.val(place.geometry.location.toUrlValue());

    infowindow.setOptions({ content: `Your location: <br/><strong class="fw-bold">${escape_html(place.name)}</strong><p>${escape_html(place.formatted_address || '')}</p>`, map });
    marker.setOptions({ position: place.geometry.location, visible: true });

    save_to_history(place.formatted_address || place.name, place.geometry.location);
    clear_markers();
    set_accessibility(true);

    if (is_circle())
      circle.setOptions({ center: place.geometry.location, visible: true });
    else if (rectangle.getVisible())
      move_rectange(place.geometry.location);

    if (is_circle()) {
      google.maps.event.addListenerOnce(map, 'idle', function () {
        if (!circle.getVisible()) return;
        var c = circle.getCenter();
        if (!c) return;
        var minZoom = min_visible_zoom(c.lat(), circle.getRadius());
        if (map.getZoom() < minZoom) map.setZoom(minZoom);
      });
    }
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

  infowindow.setContent(`Your location: <br/><strong class="fw-bold">${escape_html(latLng.toUrlValue())}</strong>`);
  if (is_circle())
    circle.setOptions({ center: latLng, visible: true });
  else if (rectangle.getVisible())
    move_rectange(latLng);

  var zoom = min_visible_zoom(latLng.lat(), circle_distance || get_meters());
  map.setOptions({ center: latLng, zoom });
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
  if (is_circle()) {
    var r = circle_distance || get_meters();
    if (marker.getVisible()) {
      circle.setOptions({ center: marker.getPosition(), radius: r, visible: true });
    } else {
      circle.setRadius(r);
    }
  } else {
    if (marker.getVisible())
      move_rectange(marker.getPosition());
  }
};

function init_other() {
  $sel_enlarge_type = $('#sel-enlarge-type');
  $txt_distance = $('#txt-distance');
  $txt_horizontal = $('#txt-horizontal');
  $txt_vertical = $('#txt-vertical');

  var nav = $('#nav'), height = nav.outerHeight() + 10;
  $('#toggle-panel').click(function (e) {
    var t = $(this);
    var is_hide = t.hasClass('is_hide');
    if (is_hide) {
      nav.css('top', 10);
      t.css('top', 0);
      t.removeClass('is_hide').find('i').removeClass('bi-arrow-down-circle-fill').addClass('bi-arrow-up-circle-fill');
      t.attr('aria-expanded', 'true');
    } else {
      nav.css('top', 0 - height);
      t.css('top', 63);
      t.find('i').removeClass('bi-arrow-up-circle-fill').addClass('bi-arrow-down-circle-fill');
      t.addClass('is_hide').attr('aria-expanded', 'false');
    }
  });

  $sel_enlarge_type.change(function (e) {
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

  $('#btn-clear-history').click(function (e) {
    e.preventDefault();
    clear_search_history();
  });

  render_search_history();
  render_favorites_tab();

  // Favorite toggle — covers list cards, favorites panel, and info window buttons
  $(document).on('click', '[data-fav-id]', function (e) {
    e.stopPropagation();
    var id = $(this).attr('data-fav-id');
    if (!id) return;
    var item = arr_list_data.find(function (d) { return d.id === id; });
    if (!item) {
      var favs = load_favorites();
      item = favs.find(function (f) { return f.id === id; });
    }
    if (item) toggle_favorite(item);
  });

  $('#list-sort').change(function () {
    if (arr_list_data && arr_list_data.length > 0)
      render_list_view(arr_list_data);
  });

  var filterDebounce = debounce(function () {
    if (arr_list_data && arr_list_data.length > 0)
      render_list_view(arr_list_data);
  }, 200);
  $('#list-filter').on('input search', filterDebounce);

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

  // Show empty state for list view on startup
  render_list_view([]);

  // Share button
  $('#btn-share').click(function (e) {
    e.preventDefault();
    share_search();
  });

  // My Location button
  $('#btn-my-location').click(function (e) {
    e.preventDefault();
    use_my_location();
  });

  // Restore state from URL hash if present
  apply_url_state();

  $('#md-notice').on('hidden.bs.modal', function (e) {
    create_restaurant_markers();
  });

  $('#btn-search').click(function (e) {
    e.preventDefault();
    var validationError = validate_search_request();
    if (validationError) {
      show_text_message(null, validationError);
      return;
    }

    var data = get_query_params();
    if (test_longtime)
      data.sleep = true;

    if (xhr_query && xhr_query.readyState !== 4)
      xhr_query.abort();

    xhr_query = $.ajax({
      url: join_url(endpoint, 'search'),
      type: 'post',
      data,
      timeout: 15000,
      beforeSend: function () {
        search_result_message = '';
        clear_markers();
        set_accessibility(true);
        toggle_loading(true);
      },
      error: function (xhr, textStatus) {
        if (textStatus === 'abort') return;
        clear_markers();
        set_accessibility(true);
        toggle_loading(false);
        arr_restaurants = [];
        search_result_message = 'Search request failed.';
        show_text_message('Search failed', 'Unable to fetch restaurants right now. Please try again.');
      },
      success: function (res) {
        var summary = normalize_search_response(res);
        var displayedCount = Math.min(summary.hits.length, max_search_results);

        toggle_loading(false);
        arr_restaurants = summary.hits.slice(0, max_search_results);
        search_result_message = format_search_result_message(summary, displayedCount);
        clear_markers();

        if (summary.total > 0) {
          set_accessibility(false);
        } else {
          set_accessibility(true);
        }

        if (summary.total > max_search_results) {
          show_message('Search result limit exceeded: ' + max_search_results, search_result_message + '<b>Please specify a smaller range to narrow the results.</b>');
        } else if (summary.total === 0) {
          show_message('Search result', search_result_message + '<p>No restaurants matched the current search area.</p>');
        } else {
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

  var listData = [];

  arr_markers = arr_restaurants.reduce((markers, restaurant) => {
    var markerData = get_restaurant_marker_data(restaurant);
    if (!markerData) return markers;

    var r_marker = new google.maps.Marker({
      position: { lat: markerData.lat, lng: markerData.lng },
      title: markerData.title,
      animation: google.maps.Animation.DROP,
      icon: {
        url: arr_icons[Math.floor(Math.random() * arr_icons.length)],
        scaledSize: { width: 35, height: 35 }
      }
    });

    r_marker.addListener("click", () => {
      infowindow_restaurant.setContent(build_restaurant_info_content(markerData));
      infowindow_restaurant.open({ anchor: r_marker, map });
    });

    markers.push(r_marker);
    listData.push(markerData);
    return markers;
  }, []);

  arr_list_data = listData;

  // Preload all photos then render list view with resolved URLs
  Promise.all(listData.map(function (item) {
    return preload_image(item.photo).then(function (resolvedUrl) {
      item.photo = resolvedUrl;
      return item;
    });
  })).then(function (resolvedList) {
    render_list_view(resolvedList);
  });

  // Use MarkerClusterer if available, otherwise fall back to plain markers
  if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
    clusterer = new window.markerClusterer.MarkerClusterer({
      map,
      markers: arr_markers
    });
  } else {
    arr_markers.forEach(function (mk) { mk.setMap(map); });
  }

  arr_restaurants = [];
};

function get_photo(photos) {
  return photos && photos.legacy && photos.legacy.url ? photos.legacy.url : fallback_restaurant_photo;
};

function set_accessibility(enabled) {
  if (is_circle())
    circle.setOptions({ draggable: enabled, editable: enabled });
  else
    rectangle.setOptions({ draggable: enabled, editable: enabled });
};

function clear_markers() {
  infowindow_restaurant.close();
  if (fav_temp_marker) {
    google.maps.event.clearInstanceListeners(fav_temp_marker);
    fav_temp_marker.setMap(null);
    fav_temp_marker = null;
  }
  if (clusterer) {
    clusterer.clearMarkers();
    clusterer = null;
  }
  if (Array.isArray(arr_markers) && arr_markers.length > 0) {
    arr_markers.map((mk) => {
      google.maps.event.clearInstanceListeners(mk);
      mk.setMap(null);
    });
    arr_markers = [];
  }
  clear_list_view();
};

function get_query_params() {
  if (is_circle())
    return {
      "index": index_name,
      "type": "circle",
      "distance": `${circle.getRadius()}m`,
      "location": marker.getPosition().toJSON()
    };
  else {
    var { nw, se } = get_4_corners();
    return {
      "index": index_name,
      "type": "rectangle",
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
  return ($sel_enlarge_type || $('#sel-enlarge-type')).val() === 'circle';
};

function min_visible_zoom(latitude, radiusMeters, minPxRadius) {
  if (!(minPxRadius > 0)) minPxRadius = 25;
  if (!(radiusMeters > 0)) return 15;
  var cosLat = Math.cos(latitude * Math.PI / 180);
  var zoom = Math.ceil(Math.log2(156543.03392 * cosLat * minPxRadius / radiusMeters));
  return Math.min(Math.max(zoom, 10), 18);
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
        ($txt_distance || $('#txt-distance')).val(max_distance_circle_in_miles);
    } else {
      if (distance[0] > max_distance_horizontal_in_miles)
        ($txt_horizontal || $('#txt-horizontal')).val(max_distance_horizontal_in_miles);
      if (distance[1] > max_distance_vertical_in_miles)
        ($txt_vertical || $('#txt-vertical')).val(max_distance_vertical_in_miles);
    }
  } else if (value === 'km') {
    if (is_circle()) {
      if (distance > max_distance_circle_in_km)
        ($txt_distance || $('#txt-distance')).val(max_distance_circle_in_km);
    } else {
      if (distance[0] > max_distance_horizontal_in_km)
        ($txt_horizontal || $('#txt-horizontal')).val(max_distance_horizontal_in_km);
      if (distance[1] > max_distance_vertical_in_km)
        ($txt_vertical || $('#txt-vertical')).val(max_distance_vertical_in_km);
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
  ($sel_enlarge_type || $('#sel-enlarge-type')).val(default_enlarge).trigger('change');
  ($txt_distance || $('#txt-distance')).val(default_distance_circle);
  ($txt_horizontal || $('#txt-horizontal')).val(default_distance_horizontal);
  ($txt_vertical || $('#txt-vertical')).val(default_distance_vertical);
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
  return ($txt_distance || $('#txt-distance')).val() || default_distance_circle;
};

function get_horizontal() {
  return ($txt_horizontal || $('#txt-horizontal')).val() || default_distance_horizontal;
};

function get_vertical() {
  return ($txt_vertical || $('#txt-vertical')).val() || default_distance_vertical;
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

