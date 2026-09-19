import { CREDENTIALS_CONFIG } from "../credentials-config.mjs";

const url = CREDENTIALS_CONFIG.SUPABASE_URL;
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const updates = [
  // 12 Fort Worth Properties
  {
    id: "f1693a41-0061-4185-aae4-70f42926cd1a", // 2232 Washington Ave (Duplex)
    title: "2 Bed / 1 Bath Duplex in Fort Worth",
    property_type: "DUPLEX"
  },
  {
    id: "1be9d581-b7c0-4384-8417-5715f4a16d4d", // 3707 Bryce Ave (Duplex)
    title: "2 Bed / 2 Bath Duplex in Fort Worth",
    property_type: "DUPLEX"
  },
  {
    id: "14771dd3-6cd0-463d-a947-1812a9f095f9", // 2506 Normont Cir (Single Family)
    title: "2 Bed / 1 Bath Home in Fort Worth",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "da73edd3-1b40-42fa-b1bf-d5a992c9b1fd", // 5718 Houghton Ave (Single Family)
    title: "2 Bed / 1 Bath Home in Fort Worth",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "b57e770a-f6b5-444e-8b50-0387094f57e9", // 3440 Stuart Dr (Half-Duplex)
    title: "2 Bed / 1 Bath Duplex in Fort Worth",
    property_type: "DUPLEX"
  },
  {
    id: "0b4cc7ea-e3c7-4706-8a3f-cf598ed098e6", // 3019 NW 27th St (Single Family)
    title: "2 Bed / 1 Bath Home in Fort Worth",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "13b298b7-0a68-43f1-aed5-a937ca4170ad", // 3331 Avenue J (Single Family)
    title: "2 Bed / 1 Bath Home in Fort Worth",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "2a587930-ec85-433a-8bb5-4d4e115a9f78", // 1444 Weiler Blvd (Townhouse)
    title: "2 Bed / 2 Bath Townhouse in Fort Worth",
    property_type: "TOWNHOUSE"
  },
  {
    id: "e2ec9cf3-a67e-48ac-8e3d-835802bdc16d", // 3211 Rogers Ave (Single Family)
    title: "2 Bed / 1 Bath Home in Fort Worth",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "34076c5f-d18f-440f-b21a-cca3dd054ea1", // 6819 W Cleburne Rd (Half-Duplex)
    title: "2 Bed / 1 Bath Duplex in Fort Worth",
    property_type: "DUPLEX"
  },
  {
    id: "b903a6bc-189c-4527-b36d-6e27246d3a42", // 5947 Shadydell Dr (Townhouse)
    title: "2 Bed / 1.5 Bath Townhouse in Fort Worth",
    property_type: "TOWNHOUSE",
    description_updater: (desc) => desc.replace(/two-story duplex/gi, "two-story townhome")
  },
  {
    id: "f083c58d-598b-4928-ae62-0008e9e78024", // 6702 S Creek Dr (Duplex)
    title: "2 Bed / 1 Bath Duplex in Fort Worth",
    property_type: "DUPLEX"
  },

  // Columbus & Worthington properties
  {
    id: "430ebe00-d85a-41ca-aff2-ee834f0a9647",
    title: "2 Bed / 2 Bath Townhouse in Columbus",
    property_type: "TOWNHOUSE"
  },
  {
    id: "a304bb51-6427-47a4-8fd6-7de742b524c3",
    title: "2 Bed / 2 Bath Townhouse in Columbus",
    property_type: "TOWNHOUSE",
    description_updater: (desc) => desc.replace(/two-bedroom duplex/gi, "two-bedroom townhome")
  },
  {
    id: "946e6c46-c5cc-4332-961e-0fab36c152f3",
    title: "2 Bed / 3 Bath Townhouse in Columbus",
    property_type: "TOWNHOUSE"
  },
  {
    id: "dff97142-7e88-4e33-b888-496fb7e6e6d4",
    title: "2 Bed / 2 Bath Townhouse in Columbus",
    property_type: "TOWNHOUSE"
  },
  {
    id: "dbb44282-1457-43eb-bfcd-61265b68c318",
    title: "2 Bed / 2 Bath Home in Columbus",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "75ee4c2a-5b8e-42bf-9a5e-1e63c4b89f66",
    title: "3 Bed / 2 Bath Home in Columbus",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "c30987cf-41c3-4f57-be41-5cbe2cc99184",
    title: "3 Bed / 2 Bath Townhouse in Columbus",
    property_type: "TOWNHOUSE"
  },
  {
    id: "1e93ffcd-d9f0-4b9d-9b02-51c450b670ef",
    title: "4 Bed / 2 Bath Home in Columbus",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "c34e9b4d-d64e-49fe-98b9-398326af11cf",
    title: "3 Bed / 2 Bath Townhouse in Columbus",
    property_type: "TOWNHOUSE"
  },
  {
    id: "32cdf3b0-de2c-41a3-bb7f-1927adfe7341",
    title: "2 Bed / 2 Bath Home in Columbus",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "2aad682c-5418-4ee4-9195-49f5031a0817",
    title: "2 Bed / 2 Bath Home in Columbus",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "b9cd69aa-53ae-460f-ad05-51aff913123b",
    title: "2 Bed / 2 Bath Home in Columbus",
    property_type: "SINGLE_FAMILY"
  },
  {
    id: "303b10ec-3611-4ebc-beb8-237aeb59779b",
    title: "2 Bed / 2 Bath Townhouse in Worthington",
    property_type: "TOWNHOUSE"
  }
];

async function run() {
  for (const item of updates) {
    const patchBody = {
      title: item.title,
      property_type: item.property_type
    };

    if (item.description_updater) {
      const getRes = await fetch(`${url}/rest/v1/properties?id=eq.${item.id}&select=description`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      const current = await getRes.json();
      if (current && current[0] && current[0].description) {
        patchBody.description = item.description_updater(current[0].description);
      }
    }

    const res = await fetch(`${url}/rest/v1/properties?id=eq.${item.id}`, {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patchBody)
    });

    console.log(`Updated ${item.id} -> "${item.title}" (${item.property_type}) [status ${res.status}]`);
  }
  console.log("All updates complete!");
}

run();
