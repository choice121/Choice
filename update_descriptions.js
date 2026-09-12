const fs = require('fs');

async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

  const updates = {
    "2009bdfd-016e-43c5-a1cd-6d43043a93a3": "Natural light and sensible room proportions define this 1,065-square-foot residence on Sandlin Avenue. Rather than feeling sectioned off, the main living areas flow together to create a comfortable daily environment. The kitchen provides ample cabinet storage and connects effortlessly to the rest of the home, making meal preparation straightforward and engaging. Down the hall, three well-sized bedrooms offer flexibility for residents, whether you need dedicated sleeping quarters, a home office, or a quiet study area. A full bathroom serves the home with clean fixtures and practical vanity space. Choice Properties requires a $50 application fee, and we are pleased to welcome your pets.",
    
    "26febe5b-ef75-480a-9ff1-b9422aa56e3e": "Efficiency and modern updates meet in this streamlined three-bedroom layout on Clarkston Avenue. The 816-square-foot footprint has been thoughtfully utilized to ensure no space is wasted. Upon entering, the living room provides a straightforward, comfortable gathering space that transitions directly into an updated kitchen equipped with reliable appliances and crisp cabinetry. Three independent bedrooms branch off the main corridor, allowing for excellent privacy and versatile use of the rooms. The shared full bathroom is brightly lit and neatly appointed. Outside, the property includes usable yard space for weekend relaxation. Pets are happily accepted here, and the application fee is always $50 through Choice Properties.",
    
    "PROP-B3F4F1CD": "Clintonville living rarely gets more convenient than this classic two-story townhome setup. Positioned just west of High Street, residents enjoy immediate proximity to the Olentangy Trail, local dining favorites, and The Ohio State University. Inside, original-style woodwork and traditional hardwood floors anchor the living space with historic character. The eat-in kitchen has been upgraded with luxury vinyl plank flooring, a gas range, and a modern refrigerator. Both spacious bedrooms and a clean, low-maintenance bathroom are situated on the upper level, ensuring a quiet separation from the main living areas. Downstairs, a full private basement delivers outstanding storage capacity alongside dedicated washer and dryer hookups. Off-street and rear parking add significant value to this urban location. This property is fully pet-friendly, and applications are $50.",
    
    "PROP-09B6CBF4": "Smart structural design elevates this 1,020-square-foot property well beyond a standard two-bedroom layout. The main floor prioritizes daily convenience, featuring a dedicated half-bathroom for guests and a highly functional kitchen outfitted with a gas range and stainless steel appliances. Upstairs, two generously sized bedrooms offer quiet retreats away from the activity of the home. Perhaps the greatest asset of this residence is the half-finished basement, which provides an incredibly flexible bonus area—perfect for a home gym, media room, or secluded office—while still preserving a large unfinished section for raw storage. Situated near major commuter routes for easy transit around Columbus, this pet-friendly home is managed by Choice Properties with a standard $50 application fee.",
    
    "PROP-1738B099": "A sprawling big backyard and an attached single-car garage distinguish this ranch-style twin-single. Spanning just over 1,000 square feet, the single-story floorplan emphasizes practical, stair-free living. Freshly refinished wood floors run throughout the main rooms, reflecting the natural light and bringing a warm tone to the interior. The kitchen features a gas range and plenty of workspace, while ceiling fans and central air conditioning keep the climate comfortable year-round. An expansive unfinished basement drastically increases the home's utility, housing washer and dryer hookups alongside massive storage potential. You'll appreciate the private driveway and the sheer amount of closet space integrated throughout the halls and two bedrooms. Pets are permitted, and the Choice Properties application fee remains $50.",
    
    "83b9bf7a-a174-49ce-8309-2e79d71bae7a": "Rich hardwood floors and a meticulously updated kitchen make an immediate impression inside this Argyle Park ranch. The culinary space has been entirely reimagined with refinished cabinetry, upgraded countertops, and a full suite of stainless steel appliances—including a dishwasher and electric range. While the main floor hosts three bedrooms with brand-new carpet and a sparkling full bathroom, the finished basement transforms the property. This massive lower-level bonus area includes a kitchenette and a second full bathroom, creating the ultimate setup for a recreation room, guest suite, or sprawling home office. Summer entertaining is effortless thanks to a fully fenced backyard, and a detached two-car garage provides exceptional vehicle security. Central air conditioning is installed. Bring your pets to this Choice Properties home; applications are $50.",
    
    "0b12ac7f-e316-4d60-8e09-9e362ca73f48": "Finding a two-bedroom residence with 1,250 square feet of living space is a rare architectural treat, resulting in exceptionally large rooms and an uncrowded atmosphere. The expansive living and dining areas easily accommodate oversized furniture arrangements without feeling cramped. Throughout the interior, large windows pull in shifting sunlight, highlighting the updated flooring and clean finishes. The kitchen provides extensive countertop surfaces and abundant cabinetry, catering to those who genuinely enjoy cooking at home. Both bedrooms are scaled generously, featuring deep closets and excellent wall space for various bed configurations. A streamlined full bathroom serves the home efficiently. Choice Properties invites pet owners to apply, with an application fee set at $50.",
    
    "cf79b604-a004-4ca6-8b1a-7de2f1ab7cd3": "Straightforward, modernized, and highly efficient. This two-bedroom home strips away wasted space in favor of an open, highly functional main living area. Durable hard-surface flooring sweeps through the entertaining zones, connecting directly to a kitchen loaded with expansive cabinetry and quality appliances. The layout is optimized to make every one of its 708 square feet count, offering two quiet bedrooms with suitably sized closets and a refreshed full bathroom. When you need to commute, central Columbus highways are just moments away, alongside local recreation parks and neighborhood shopping centers. Your pets are welcome to join you here. The Choice Properties application fee is $50.",
    
    "3e474851-b13d-4c72-b6b1-4bc8934174c8": "A covered front porch welcomes you to this classic three-bedroom layout on Eureka Avenue. The interior utilizes an intuitive traffic flow, guiding you from the bright main living area into a practical kitchen outfitted with a refrigerator, range, and built-in microwave. The bedrooms offer comfortable dimensions and benefit from updated flooring that runs throughout the house. A full basement significantly expands the property's utility by providing washer and dryer hookups alongside crucial dry storage space. Central air conditioning ensures summer comfort, while forced air heating handles the winter months. In the rear, a fenced backyard offers a secure environment for relaxation, complemented by the convenience of a private driveway for off-street parking. This is a pet-friendly Choice Properties home with a $50 application fee.",
    
    "743ecfdf-0500-463d-a88e-502ee54dfb27": "Flexibility defines the layout of this Burgess Avenue residence, which functions beautifully as a two-bedroom home but includes adaptable space that can easily serve as a third sleeping quarter or a dedicated home office. With 975 square feet on the main level, the rooms feel appropriately scaled for comfortable daily routines. The kitchen comes prepared with a range and refrigerator, streamlining your move-in process. Downstairs, an unfinished basement solves all your storage challenges and includes standard washer and dryer connections. Street parking is readily available right out front. Pets are always welcome under our guidelines. Submit your $50 application through Choice Properties today to secure this adaptable home."
  };

  for (const [id, newDesc] of Object.entries(updates)) {
    const url = `${SUPABASE_URL}/rest/v1/properties?id=eq.${id}`;
    
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ description: newDesc })
    });
    
    if (!res.ok) {
      console.error(`Failed to update ${id}:`, await res.text());
    } else {
      console.log(`Successfully updated ${id}`);
    }
  }
}
run();
