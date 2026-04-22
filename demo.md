# Demo Guide

This document provides a quick visual walkthrough of the main user flows in Elasticsearch Restaurants Map UI.

## What this demo covers

1. First-load welcome state
2. Demo address helper page
3. Search by address with Google Places Autocomplete
4. Recent searches and saved restaurants
5. Circle-based geo search
6. Search result limit handling
7. Rectangle-based geo search
8. Result panel, filtering, and sorting
9. Clicking a restaurant to focus the map
10. Navigating saved restaurants

## Suggested demo flow

1. Open the app and explain the welcome modal and basic search entry points.
2. Open the helper page and copy one of the demo addresses or coordinates.
3. Search by address and show autocomplete suggestions.
4. Run a circle search and explain clustering and result limits.
5. Switch to rectangle mode and run the same flow with a bounded area.
6. Open the results sidebar, filter by keyword, and click a restaurant.
7. Save a restaurant, reopen the Saved tab, and jump back to it on the map.

## Screenshots

### 1. Welcome modal on first load

The app opens with a short introduction that explains how to search by address, click on the map, or use advanced search.

![Welcome modal on first load](screenshots/demo-welcome-modal-on-first-load.png)

### 2. Demo address helper page

Use the bundled helper page to quickly find coordinates or addresses in areas that have many demo restaurants.

![Demo address helper page](screenshots/demo-address-helper-page.png)

### 3. Address autocomplete

Typing an address shows Google Places Autocomplete suggestions before running a search.

![Address autocomplete](screenshots/demo-address-autocomplete.png)

### 4. Recent searches and saved count

After searching, the top panel shows recent search history, while the result panel keeps track of saved restaurants.

![Recent searches and saved count](screenshots/demo-recent-searches-and-saved-count.png)

### 5. Circle search mode

Circle mode lets users search within a radius around the selected center point.

![Circle search mode](screenshots/demo-circle-search-mode.png)

### 6. Search result limit handling

When the backend returns more items than the configured cap, the UI explains that only the first 80 results are shown and prompts the user to narrow the range.

![Search result limit handling](screenshots/demo-search-result-limit-handling.png)

### 7. Rectangle search mode

Rectangle mode lets users define a bounded horizontal and vertical search area.

![Rectangle search mode](screenshots/demo-rectangle-search-mode.png)

### 8. Rectangle search with result panel

After searching, the right-hand offcanvas panel lists matched restaurants and shows their distances.

![Rectangle search with result panel](screenshots/demo-rectangle-search-with-result-panel.png)

### 9. Live filter in the result panel

Users can filter the current result set live by typing in the sidebar search box.

![Live filter in result panel](screenshots/demo-live-filter-in-result-panel.png)

### 10. Click a restaurant to focus the map

Clicking a restaurant in the sidebar focuses the map and opens the restaurant info window with image and description.

![Click a restaurant to focus the map](screenshots/demo-click-restaurant-to-focus-map.png)

### 11. Navigate between saved restaurants

Saved restaurants remain available in the Saved tab so users can quickly jump back to them later.

![Navigate between saved restaurants](screenshots/demo-navigate-between-saved-restaurants.png)

## Related helper pages

- [top_location_with_many_restaurants_for_test.html](top_location_with_many_restaurants_for_test.html)
- [reverse_geocoding_list.html](reverse_geocoding_list.html)
