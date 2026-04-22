# Elasticsearch Restaurants Map UI

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](readme.vi.md)

A static single-page application that lets users search for nearby restaurants on an interactive Google Map. It uses geo-distance queries powered by an Elasticsearch-backed REST API and renders results as interactive map markers with clustering, an info popup, and a sortable/filterable list view.

---

## Features

- **Address search** with Google Places Autocomplete and country restriction
- **"Use my location"** button via the browser Geolocation API with reverse geocoding
- **Click or drag** a marker on the map to set a custom search point
- **Circle** (radius) and **Rectangle** (horizontal × vertical) search area types
- **Multi-unit distances**: meters, kilometers, miles, feet
- **Marker clustering** via `@googlemaps/markerclusterer`
- **List view** (offcanvas) with:
  - Filter by name or description
  - Sort by distance (near/far) or name (A–Z / Z–A)
  - Distance badge next to each result
- **Favorites** — save/remove restaurants, persisted in `localStorage`
- **Search history** — up to 8 recent searches, persisted in `localStorage`
- **Share / deep-link** — copy a URL that restores the current search state
- **Configurable** max results (default 80), index name, map center, icons, and autocomplete country
- **No build step** — pure HTML + CSS + JavaScript, served as static files

---

## Technologies Used

| Layer | Technology |
|---|---|
| UI framework | [Bootstrap 5.2.3](https://getbootstrap.com/) + [Bootstrap Icons 1.7.1](https://icons.getbootstrap.com/) |
| DOM / AJAX | [jQuery 3.6.3](https://jquery.com/) |
| Map | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) (libraries: `geometry`, `places`) |
| Marker clustering | [@googlemaps/markerclusterer](https://github.com/googlemaps/js-markerclusterer) |
| Storage | Browser `localStorage` (favorites, search history) |
| Serving | Any static file server (no Node/build tooling required) |

---

## Backend API

The UI sends geo-distance search requests to a configurable `endpoint`. Two compatible backend implementations are available:

### Option 1 — Node.js (Fastify + OpenSearch/Elasticsearch)
> **Repo:** [github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Nodejs](https://github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Nodejs)

A Fastify-based REST API that wraps an Elasticsearch / OpenSearch cluster. Suitable for self-hosted or cloud deployments (VPS, Docker, Railway, Render, etc.).

### Option 2 — Cloudflare Worker (edge deployment)
> **Repo:** [github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Cloudflare-Worker](https://github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Cloudflare-Worker)

A serverless edge API deployed on Cloudflare Workers. Zero cold-start, globally distributed, and free-tier friendly.

Both backends expose the same request/response contract and are interchangeable via the `endpoint` configuration key.

---

## Configuration

Configuration is split into two files so that sensitive runtime values (API keys, endpoints) are kept out of the shared defaults.

### `assets/js/config.js`
Defines shared defaults and the `createElasticsearchRestaurantsConfig` merge helper. **Do not edit** this file with environment-specific values.

| Key | Default | Description |
|---|---|---|
| `indexName` | `restaurants` | Elasticsearch index name |
| `mapCenter` | `[-37.840935, 144.946457]` | Initial map center (Melbourne, VIC, AU) |
| `googleMapsApiKey` | `''` | Google Maps API key |
| `googleMapsLibraries` | `['geometry', 'places']` | Maps libraries to load |
| `maxSearchResults` | `80` | Maximum results returned per search |
| `autocompleteCountryRestriction` | `'au'` | ISO 3166-1 alpha-2 country code for Places Autocomplete |
| `markerIcon` | `/assets/imgs/marker-x64.png` | Custom map marker icon |
| `restaurantIcons` | *(3 PNG paths)* | Restaurant marker icons (cycled per result) |
| `fallbackRestaurantPhoto` | `/assets/imgs/placeholder.png` | Photo shown when a restaurant has no image |

### `assets/js/runtime-config.js`
Override any of the above keys for a specific environment. **This file is gitignored.** A template is provided at `assets/js/runtime-config.example.js`.

```js
window.ELASTICSEARCH_RESTAURANTS_CONFIG = window.createElasticsearchRestaurantsConfig({
  endpoint: 'https://your-api-host.example.com',
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
});
```

---

## Getting Started

### Prerequisites
- A running backend API (see [Backend API](#backend-api) above)
- A [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) with the **Maps JavaScript API** and **Places API** enabled

### Local setup

```bash
# Clone the repository
git clone https://github.com/dangkhoa2016/Elasticsearch-Restaurants-Map-UI.git
cd Elasticsearch-Restaurants-Map-UI

# Copy the runtime config template and fill in your values
cp assets/js/runtime-config.example.js assets/js/runtime-config.js
# Edit runtime-config.js: set endpoint and googleMapsApiKey

# Serve the files with any static server, e.g.:
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000` (or the port shown) in your browser.

> **Note:** The app uses `fetch()` to load HTML partials at startup, so it must be served over HTTP/HTTPS — opening `index.html` directly as a `file://` URL will not work.

### Replit

The repository includes a `.replit` configuration file. Import the repo into [Replit](https://replit.com/), set `endpoint` and `googleMapsApiKey` in `assets/js/runtime-config.js`, then click **Run**.

---

## Demo / Test Locations

Two helper pages are included to help you quickly find areas with many demo restaurants during testing:

| File | Description |
|---|---|
| [top_location_with_many_restaurants_for_test.html](top_location_with_many_restaurants_for_test.html) | A pre-built list of addresses (with coordinates) in areas that have many demo restaurants. Click any address or coordinate to copy it, then paste into the search box. |
| [reverse_geocoding_list.html](reverse_geocoding_list.html) | Uses the Google Maps Geocoding API to decode the raw coordinates into human-readable addresses in real time. Requires a Google Maps API key. |

---

## Security Notes

- Store `googleMapsApiKey` only in `runtime-config.js`, which is gitignored.
- **Restrict the Google Maps key** to allowed HTTP referrers (your domain) in the [Google Cloud Console](https://console.cloud.google.com/) before using it outside local development.
- Set `endpoint` to your backend API URL. Configure CORS on the backend to allow only your front-end origin.
- All restaurant names and descriptions are HTML-escaped before being rendered into the DOM.
