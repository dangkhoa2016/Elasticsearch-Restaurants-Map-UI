(async () => {

  const loadHtml = function (file) {
    return new Promise((resolve) => {
      fetch(file)
        .then(res => {
          if (res.status !== 200)
            throw new Error(`File [${file}] does not exists.`);
          return res.text();
        }).then(html => { resolve(html); })
        .catch(ex => {
          console.log(`Error load html: ${file}`, ex);
          resolve();
        });
    });
  };

  const loadJs = function (file) {
    return new Promise((resolve) => {
      fetch(file, { mode: 'no-cors' })
        .then(res => {
          if (res.status !== 200)
            throw new Error(`File [${file}] does not exists.`);
          return res.text();
        }).then(js => {
          eval(js);
          resolve();
        }).catch(ex => {
          console.log(`Error load js: ${file}`, ex);
          resolve();
        });
    });
  };

  async function loadAndRenderParts() {
    const arr = ['loader', 'search-top', 'advanced-search', 'modal-notice'];
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

  function main_debug() {
    return new Promise(resolve => {
      var script = document.createElement('script');
      script.onload = function() { initialize(); resolve(); };
      script.src = '/assets/js/app_debug.js';
      document.body.appendChild(script);
    });
  }

  async function main() {
    await loadJs('/assets/js/app.js');

    const er = new ElasticsearchRestaurants();

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

    er.initialize();

    delete window.map_styles;
    delete window.ElasticsearchRestaurants;
  };

  await loadAndRenderParts();

  // run the app
  // await main_debug();
  await main();

})();

function initialize() {  };
