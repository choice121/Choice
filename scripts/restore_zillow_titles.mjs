import { CREDENTIALS_CONFIG } from "../credentials-config.mjs";

const url = CREDENTIALS_CONFIG.SUPABASE_URL;
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const fortWorthUpdates = [
  { id: "f1693a41-0061-4185-aae4-70f42926cd1a", address: "2232 Washington Ave", title: "2BR Single Family in Fort Worth" },
  { id: "1be9d581-b7c0-4384-8417-5715f4a16d4d", address: "3707 Bryce Ave", title: "2BR Single Family in Fort Worth" },
  { id: "14771dd3-6cd0-463d-a947-1812a9f095f9", address: "2506 Normont Cir", title: "2BR Single Family in Fort Worth" },
  { id: "da73edd3-1b40-42fa-b1bf-d5a992c9b1fd", address: "5718 Houghton Ave", title: "2BR Single Family in Fort Worth" },
  { id: "b57e770a-f6b5-444e-8b50-0387094f57e9", address: "3440 Stuart Dr", title: "2BR Single Family in Fort Worth" },
  { id: "0b4cc7ea-e3c7-4706-8a3f-cf598ed098e6", address: "3019 NW 27th St", title: "2BR Single Family in Fort Worth" },
  { id: "13b298b7-0a68-43f1-aed5-a937ca4170ad", address: "3331 Avenue J", title: "2BR Single Family in Fort Worth" },
  { id: "2a587930-ec85-433a-8bb5-4d4e115a9f78", address: "1444 Weiler Blvd", title: "2BR Single Family in Fort Worth" },
  { id: "e2ec9cf3-a67e-48ac-8e3d-835802bdc16d", address: "3211 Rogers Ave", title: "2BR Single Family in Fort Worth" },
  { id: "34076c5f-d18f-440f-b21a-cca3dd054ea1", address: "6819 W Cleburne Rd", title: "2BR Single Family in Fort Worth" },
  { id: "b903a6bc-189c-4527-b36d-6e27246d3a42", address: "5947 Shadydell Dr", title: "2BR Single Family in Fort Worth" },
  { id: "f083c58d-598b-4928-ae62-0008e9e78024", address: "6702 S Creek Dr", title: "2BR Single Family in Fort Worth" }
];

const columbusUpdates = [
  { id: "430ebe00-d85a-41ca-aff2-ee834f0a9647", address: "2099 W Case Rd", title: "2BR Townhome in Columbus" },
  { id: "a304bb51-6427-47a4-8fd6-7de742b524c3", address: "3512 Kinsale Head Dr", title: "2BR Townhome in Columbus" },
  { id: "946e6c46-c5cc-4332-961e-0fab36c152f3", address: "1020 Hartford Village Blvd", title: "2BR Townhome in Columbus" },
  { id: "dff97142-7e88-4e33-b888-496fb7e6e6d4", address: "5248 Dierker Rd", title: "2BR Townhome in Columbus" },
  { id: "dbb44282-1457-43eb-bfcd-61265b68c318", address: "841 Saint Clair Ave", title: "2BR Single Family Home in Columbus" },
  { id: "75ee4c2a-5b8e-42bf-9a5e-1e63c4b89f66", address: "3798 Dunlane Ct", title: "3BR Single Family Home in Columbus" },
  { id: "c30987cf-41c3-4f57-be41-5cbe2cc99184", address: "2998 Indianola Ave", title: "3BR Townhome in Columbus" },
  { id: "1e93ffcd-d9f0-4b9d-9b02-51c450b670ef", address: "3301 Kristin Ct", title: "4BR Single Family Home in Columbus" },
  { id: "c34e9b4d-d64e-49fe-98b9-398326af11cf", address: "378-380 Stoddart Ave", title: "3BR Townhome in Columbus" },
  { id: "32cdf3b0-de2c-41a3-bb7f-1927adfe7341", address: "65 Dakota Ave", title: "2BR Single Family Home in Columbus" },
  { id: "2aad682c-5418-4ee4-9195-49f5031a0817", address: "452 N Ohio Ave", title: "2BR Single Family Home in Columbus" },
  { id: "b9cd69aa-53ae-460f-ad05-51aff913123b", address: "267 S Gift St", title: "2BR Single Family Home in Columbus" },
  { id: "303b10ec-3611-4ebc-beb8-237aeb59779b", address: "912 Annagladys Dr", title: "2BR Townhome in Worthington" }
];

async function updateTitles() {
  const allUpdates = [...fortWorthUpdates, ...columbusUpdates];
  for (const item of allUpdates) {
    const res = await fetch(`${url}/rest/v1/properties?id=eq.${item.id}`, {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title: item.title })
    });
    console.log(`Updated [${item.id}] ${item.address} -> "${item.title}" (Status: ${res.status})`);
  }
  console.log("All property titles successfully updated to match original Zillow titles!");
}

updateTitles();
