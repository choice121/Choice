# Sample Job Templates

Drop-in JSON files for `run_ai_job.py`. Copy one, edit it, and run:

```bash
python3 scraper/run_ai_job.py --instructions-file scraper/sample_jobs/your_job.json
```

## Available Templates

| File | Use Case |
|---|---|
| `dallas_2br.json` | 2-bedroom houses/townhomes in Dallas, $1300-1800 |
| `3br_family_home.json` | 3-4 bedroom family homes in Dallas, $1500-2200 |
| `1br_strict_watermark.json` | 1-bedroom units with strict watermark filtering |

## Tips

- Set `"dry_run": true` to preview without publishing
- Set `"strict_watermarks": true` to reject listings with ANY branded photo
- Add `"zip_codes": ["75201", "75202"]` for per-ZIP scraping (200 results per ZIP)
- Use `"fallback_locations"` if primary cities don't hit your target count
- Increase `"min_score"` to 80+ for only the highest-quality listings
