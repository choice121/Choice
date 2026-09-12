async function run() {
  const url = "https://www.redfin.com/stingray/do/location-autocomplete?location=293%20N%20Burgess%20Ave%20Columbus%20OH&v=2";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  if (res.status === 200) {
      const text = await res.text();
      // Redfin returns {}&& prefix
      const data = JSON.parse(text.replace("{}&&", ""));
      console.log(data.payload.rows[0]);
  } else {
      console.log("Status:", res.status);
  }
}
run();
