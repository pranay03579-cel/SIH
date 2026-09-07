# data/elevation/

Place the **Northeast India elevation dataset** here.

## What belongs here

The dataset contains approximately **50,000 geographic elevation points**
covering the North Eastern Region of India.

Expected data concepts (actual column names will be confirmed after inspection):

| Concept | Likely column names |
|---------|-------------------|
| Latitude | `lat`, `latitude`, `y` |
| Longitude | `lon`, `longitude`, `x` |
| Elevation (metres) | `elevation`, `altitude`, `elev`, `z` |

## Accepted file formats

Place the dataset file here in any of these formats:

- `.csv` — preferred (easy to inspect and load)
- `.json`
- `.geojson`
- `.xlsx` / `.xls`
- `.parquet`

## What to place here

```
data/elevation/
├── <elevation_dataset.csv>  ← or .json, .geojson, etc.
└── README.md  ← this file
```

## What NOT to place here

- Do NOT place fake or placeholder data.
- Do NOT modify the dataset — use it as-is.

## Next steps

After the dataset is placed here, notify Person 4. The dataset will be
inspected to determine:
1. Exact column names and data types.
2. Geographic coverage and coordinate format.
3. How to use it for landslide risk scoring alongside Person 2's ML model.
