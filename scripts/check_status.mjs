import fs from 'fs';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
    const envFile = fs.readFileSync('.env.local', 'utf-8');
    for (const line of envFile.split('\n')) {
        if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
            SERVICE_ROLE_KEY = line.split('=')[1].trim().replace(/^"|"$/g, '');
        }
    }
}

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
};

const inputList = [
    { id: "f42ca76d-4d17-4ba9-910b-2d82ccaf1746", text: "2719 Capitol Dr, Charlotte, NC 28208 ($2,000/mo | 3 Bed / 2 Bath)" },
    { id: "bb49df41-21f7-4d86-acf2-3804d65b0d28", text: "5414 Princess St, Charlotte, NC 28269 ($1,725/mo | 3 Bed / 1 Bath)" },
    { id: "dec6ec68-0035-47f5-aac5-3122a7f3f00d", text: "7109 Rockcliff Ct, Charlotte, NC 28210 ($2,000/mo | 3 Bed / 1 Bath)" },
    { id: "b3ebe9bb-232a-4832-90c2-865461f7413a", text: "6428 Whitewater Dr, Charlotte, NC 28214 ($1,850/mo | 3 Bed / 2 Bath)" },
    { id: "3680f889-9134-4276-bf6f-30057afb0cf8", text: "5521 Jesse Harper Dr, Charlotte, NC 28269 ($1,925/mo | 3 Bed / 2 Bath)" },
    { id: "0c339b9d-4c55-46b9-bcaa-b4730f691df5", text: "10440 Wilson Glen Dr, Charlotte, NC 28214 ($1,825/mo | 3 Bed / 2 Bath)" },
    { id: "f2ce68ab-befa-4833-8bb1-865e66c9af47", text: "812 Silver Ct, Charlotte, NC 28217 ($1,745/mo | 3 Bed / 2 Bath)" },
    { id: "d2364134-cd29-44a8-b56d-61b8eab0df01", text: "7024 Capstan Ter, Charlotte, NC 28269 ($1,900/mo | 3 Bed / 2 Bath)" },
    { id: "5c1b16bc-c56a-4971-9154-e6d710c71167", text: "12571 Bluestem Ln, Charlotte, NC 28277 ($1,700/mo | 3 Bed / 2 Bath)" },
    { id: "fe499b07-363a-4c15-a416-a475b8c3a51d", text: "2830 Hosta Dr, Charlotte, NC 28269 ($1,850/mo | 3 Bed / 2 Bath)" },
    { id: "885dab00-1096-4d73-9a87-4e03e080893c", text: "9128 Lowfalls Ln, Charlotte, NC 28216 ($1,895/mo | 3 Bed / 2 Bath)" },
    { id: "40973c67-c220-4157-82fe-5a0568a018bc", text: "3125 Ophelia Aly, Charlotte, NC 28213 ($1,920/mo | 3 Bed / 2 Bath)" },
    { id: "54f0ca04-020f-4900-9a8d-05fb928c766e", text: "9342 Mallard Mills Dr, Charlotte, NC 28262 ($1,995/mo | 3 Bed / 2 Bath)" },
    { id: "8139df1d-09d6-4b79-a7b5-2bb657e0580a", text: "7117 Millie Fae Aly, Charlotte, NC 28269 ($1,895/mo | 3 Bed / 2 Bath)" }
];

async function main() {
    const idsToQuery = inputList.map(item => item.id).join(',');
    const url = `${SUPABASE_URL}/rest/v1/properties?id=in.(${idsToQuery})&select=id,status`;
    
    try {
        const response = await fetch(url, { headers });
        const existingProperties = await response.json();
        
        console.log("REMAINING PROPERTIES:");
        let count = 1;
        const activeIds = new Set(existingProperties.filter(p => p.status === 'active').map(p => p.id));
        
        for (const item of inputList) {
            if (activeIds.has(item.id)) {
                console.log(`${count}. ${item.text} — https://choice-properties-site.pages.dev/property.html?id=${item.id}`);
                count++;
            }
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}
main();
