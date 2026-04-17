(function () {
  const DEFAULT_CONFIG = {
    indexName: 'restaurants',
    mapCenter: [-37.840935, 144.946457],
    googleMapsApiKey: '',
    googleMapsLibraries: ['geometry', 'places'],
    markerIcon: '/assets/imgs/marker-x64.png',
    restaurantIcons: [
      '/assets/imgs/restaurant-x64.png',
      '/assets/imgs/restaurant.png',
      '/assets/imgs/restaurant1-x64.png'
    ],
    fallbackRestaurantPhoto: '/assets/imgs/restaurant-x64.png',
    maxSearchResults: 80,
  };

  const cloneArray = function (value) {
    return Array.isArray(value) ? value.slice() : [];
  };

  const isValidMapCenter = function (value) {
    return Array.isArray(value) && value.length === 2 && value.every((item) => {
      const parsed = typeof item === 'number' ? item : parseFloat(item);
      return Number.isFinite(parsed);
    });
  };

  const createElasticsearchRestaurantsConfig = function (runtimeConfig = {}) {
    const runtime = runtimeConfig && typeof runtimeConfig === 'object' ? runtimeConfig : {};

    return {
      ...DEFAULT_CONFIG,
      ...runtime,
      endpoint: typeof runtime.endpoint === 'string' ? runtime.endpoint.trim() : '',
      googleMapsLibraries: Array.isArray(runtime.googleMapsLibraries) && runtime.googleMapsLibraries.length > 0
        ? cloneArray(runtime.googleMapsLibraries)
        : cloneArray(DEFAULT_CONFIG.googleMapsLibraries),
      restaurantIcons: Array.isArray(runtime.restaurantIcons) && runtime.restaurantIcons.length > 0
        ? cloneArray(runtime.restaurantIcons)
        : cloneArray(DEFAULT_CONFIG.restaurantIcons),
      mapCenter: isValidMapCenter(runtime.mapCenter)
        ? cloneArray(runtime.mapCenter).slice(0, 2)
        : cloneArray(DEFAULT_CONFIG.mapCenter),
    };
  };

  window.ELASTICSEARCH_RESTAURANTS_DEFAULT_CONFIG = createElasticsearchRestaurantsConfig();
  window.createElasticsearchRestaurantsConfig = createElasticsearchRestaurantsConfig;
})();
