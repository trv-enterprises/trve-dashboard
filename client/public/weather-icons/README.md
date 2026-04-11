# Weather Icons

These SVGs are bundled copies of [Meteocons](https://github.com/basmilius/meteocons)
by Bas Milius, MIT licensed. See the top-level `THIRD_PARTY_LICENSES.md`
for the full license and attribution.

Only the 19 icon names referenced by `src/components/weather/WeatherDisplay.jsx`
(`ICON_MAP`) are bundled. To refresh or add a new mapping:

```bash
cd client/public/weather-icons
curl -sSfL -O "https://basmilius.github.io/meteocons/production/fill/svg/<name>.svg"
```
