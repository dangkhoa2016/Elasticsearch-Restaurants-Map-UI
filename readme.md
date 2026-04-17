## About
This is sample search Restaurants using google map point as center and custom distance from center.

## Security configuration

- Shared defaults and merge logic live in [assets/js/config.js](assets/js/config.js).
- Runtime configuration overrides are loaded from [assets/js/runtime-config.js](assets/js/runtime-config.js).
- A sample template is available at [assets/js/runtime-config.example.js](assets/js/runtime-config.example.js).
- Set `endpoint` and `googleMapsApiKey` in the runtime config files for each environment.
- Set `googleMapsApiKey` locally before running the app.
- Restrict the Google Maps key by allowed HTTP referrers before using it outside local development.
