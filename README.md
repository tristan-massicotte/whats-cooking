# What's cooking?

High-protein batch-cooking recipes you can scale to your appetite and portion count.

**Live site:** https://tristan-massicotte.github.io/whats-cooking/

- **64 recipes**: lunch/dinner batches, breakfast batches and quick single-serving breakfasts
- **Appetite setting**: Light (50%), Normal (70%) or Big eater (100%). Macros, ingredients and step amounts adjust
- **Portions per recipe**: any number. Every recipe was written for 7
- **Merged grocery list**: pick recipes and the ingredients are summed and grouped by aisle, with package hints, checkboxes, your own items and a copy button
- **Week plan**: breakfast, lunch and dinner for each day, with daily calories against a target
- **Compare**: fibre, protein and calories across recipes
- **Favourites, star ratings and personal notes** on every recipe, with filters to find them again
- Filters (vegetarian, pasta, Tex-Mex, no oven…), search, sorting, light/dark mode

Everything runs in the browser. Picks, ticks, plans, favourites, ratings and notes are saved on your device (localStorage).

Macros are estimates from standard nutrition values (±5–10%). 1 cup = 250 mL.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Files

- `index.html`, `styles.css`, `app.js`: the site (no build step)
- `data/recipes.js`: recipes and ingredient catalog. Quantities are for the whole 7-portion batch at big-eater size; macros are per portion.
