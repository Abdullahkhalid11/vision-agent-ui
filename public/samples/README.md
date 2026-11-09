# Sample photos

The "Try a sample" buttons read `manifest.json` in this folder. The list is empty, so no buttons
show until you add photos.

To add samples:

1. Use photos you took yourself, or photos with a licence that allows this use. Check the licence.
2. Keep each file under 4 MB, as JPEG or PNG.
3. Copy the files into this folder.
4. Replace `manifest.json` with an entry for each file:

```json
[
  { "file": "street.jpg", "label": "Street with cars" },
  { "file": "hiker.jpg", "label": "Hiker on a ridge" }
]
```

Samples are fetched and uploaded like any other photo, so they are cached on the server after the
first use.
