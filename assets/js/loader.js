(async () => {

  const loadHtml = function (file) {
    return new Promise((resolve) => {
      fetch(file)
        .then(res => {
          if (!res.ok)
            throw new Error(`File [${file}] does not exists.`);
          return res.text();
        }).then(html => { resolve(html); })
        .catch(ex => {
          console.log(`Error load html: ${file}`, ex);
          resolve();
        });
    });
  };

  const loadScript = function (src, attributes = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      Object.keys(attributes).forEach((key) => {
        script.setAttribute(key, attributes[key]);
      });
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load script: ${src}`));
      document.body.appendChild(script);
    });
  };

  const getRuntimeConfig = function () {
    if (typeof window.createElasticsearchRestaurantsConfig !== 'function')
      throw new Error('Missing config helper. Load assets/js/config.js before runtime-config.js and loader.js.');

    return window.createElasticsearchRestaurantsConfig(window.ELASTICSEARCH_RESTAURANTS_CONFIG);
  };

  const showBootstrapError = function (message) {
    const container = document.createElement('div');
    const text = message || 'Application configuration is incomplete.';
    container.className = 'alert alert-danger m-3';
    container.setAttribute('role', 'alert');
    container.textContent = text;

    const root = document.getElementById('container');
    if (root && root.parentNode) {
      root.parentNode.insertBefore(container, root);
    } else {
      document.body.prepend(container);
    }
  };

  const loadGoogleMaps = function (config) {
    if (window.google && window.google.maps)
      return Promise.resolve();

    if (!config.googleMapsApiKey)
      return Promise.reject(new Error('Missing Google Maps API key. Define it in assets/js/runtime-config.js before loading the app.'));

    return new Promise((resolve, reject) => {
      const callbackName = '__erGoogleMapsReady';
      const libraries = encodeURIComponent(config.googleMapsLibraries.join(','));
      const cleanup = function () {
        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
      };

      window[callbackName] = function () {
        cleanup();
        resolve();
      };

      loadScript(`https://maps.googleapis.com/maps/api/js?loading=async&libraries=${libraries}&key=${encodeURIComponent(config.googleMapsApiKey)}&callback=${callbackName}`, {
        async: 'true',
        defer: 'true'
      }).catch((error) => {
        cleanup();
        reject(error);
      });
    });
  };

  async function loadAndRenderParts() {
    const arr = ['loader', 'search-top', 'advanced-search', 'modal-notice', 'list-view'];
    await Promise.all(arr.map(async item => {
      try {
        const element = $(`body > ${item}`);
        if (element.length > 0) {
          const html = await loadHtml(`/assets/parts/${item}.html`);
          if (html)
            element.replaceWith(html);
        }
      } catch (error) {
        console.log(`Error load ${item}`, error);
      }
    }));
  };

  async function main() {
    const config = getRuntimeConfig();
    window.ELASTICSEARCH_RESTAURANTS_CONFIG = config;

    await loadScript('/assets/js/app.js');
    await loadGoogleMaps(config);
    await loadScript('https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js');

    window.map_styles = [
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

    const er = new ElasticsearchRestaurants();
    er.initialize();
  };

  await loadAndRenderParts();

  try {
    await main();
  } catch (error) {
    console.error('Application bootstrap error', error);
    showBootstrapError(error.message);
  } finally {
    delete window.map_styles;
    delete window.ElasticsearchRestaurants;
  }

})();
