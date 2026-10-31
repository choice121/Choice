export type PropertyMedia = {
  kind: 'photo' | 'floor_plan' | 'video' | 'virtual_tour';
  title: string;
  url: string;
};

export type PropertyUnit = {
  id: string;
  label: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  floor: string;
  status: 'Available' | 'Leased';
};

export type Property = {
  id: string;
  title: string;
  address: string;
  city: string;
  type: 'House' | 'Apartment' | 'Townhome' | 'Condo';
  propertyKind?: 'Single Family' | 'Apartment Community' | 'Townhome' | 'Condo' | 'Multifamily';
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  badge: string;
  image: string;
  gallery: string[];
  media?: PropertyMedia[];
  units?: PropertyUnit[];
  tourUrl?: string;
  neighborhood?: string;
  moveIn: string;
  description: string;
  features: string[];
};

export const sampleProperties: Property[] = [
  {
    id: 'p-101',
    title: 'Hillside Modern Home',
    address: '1425 Willow Creek Ave',
    city: 'Austin',
    type: 'House',
    propertyKind: 'Single Family',
    price: 2850,
    beds: 3,
    baths: 2.5,
    sqft: 2140,
    badge: 'Move-in ready',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=80'
    ],
    media: [
      { kind: 'photo', title: 'Front elevation', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Living room', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Kitchen', url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'floor_plan', title: 'Main floor plan', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'virtual_tour', title: '3D walkthrough', url: 'https://my.matterport.com/show/?m=example-tour-1' }
    ],
    neighborhood: 'North Loop',
    moveIn: 'Immediately',
    description: 'Bright, open-concept home with designer finishes and a private backyard built for evenings outdoors. Includes a chef-ready kitchen, spa-like primary suite, and walk-in pantry.',
    features: ['Hardwood floors', 'Two-car garage', 'Private patio', 'EV charging', 'Pet friendly']
  },
  {
    id: 'p-102',
    title: 'Skyline Loft',
    address: '208 Mercer Street',
    city: 'Seattle',
    type: 'Apartment',
    propertyKind: 'Apartment Community',
    price: 2290,
    beds: 2,
    baths: 1.5,
    sqft: 1180,
    badge: 'Top floor',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'
    ],
    media: [
      { kind: 'photo', title: 'Living area', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Kitchen', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Bedroom', url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'floor_plan', title: 'Floor plan', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'virtual_tour', title: '3D apartment tour', url: 'https://my.matterport.com/show/?m=example-tour-2' }
    ],
    units: [
      { id: 'A-201', label: 'Unit 201', price: 2290, beds: 2, baths: 1.5, sqft: 1180, floor: '2nd Floor', status: 'Available' },
      { id: 'A-305', label: 'Unit 305', price: 2495, beds: 2, baths: 2, sqft: 1245, floor: '3rd Floor', status: 'Available' },
      { id: 'A-410', label: 'Unit 410', price: 2690, beds: 2, baths: 2, sqft: 1365, floor: '4th Floor', status: 'Leased' }
    ],
    neighborhood: 'Downtown',
    moveIn: 'This month',
    description: 'An airy loft with expansive windows, a smart layout, and easy access to downtown dining, parks, and transit. The building includes package lockers and a rooftop lounge.',
    features: ['Concierge', 'Rooftop lounge', 'Gym', 'Pet lounge', 'Secure entry']
  },
  {
    id: 'p-103',
    title: 'Townhome with Courtyard',
    address: '77 Southview Loop',
    city: 'Denver',
    type: 'Townhome',
    propertyKind: 'Townhome',
    price: 2680,
    beds: 3,
    baths: 2.5,
    sqft: 1910,
    badge: 'Quiet street',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'
    ],
    media: [
      { kind: 'photo', title: 'Exterior', url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Courtyard', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Kitchen', url: 'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'floor_plan', title: 'Second floor plan', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'virtual_tour', title: 'Townhome walkthrough', url: 'https://my.matterport.com/show/?m=example-tour-3' }
    ],
    neighborhood: 'South Ridges',
    moveIn: 'Flexible',
    description: 'Modern townhome featuring a tucked-away courtyard, attached garage, and layered living spaces designed for work-from-home comfort and entertaining.',
    features: ['Attached garage', 'Courtyard', 'Office nook', 'Washer/dryer', 'Central A/C']
  },
  {
    id: 'p-104',
    title: 'West End Condo',
    address: '830 Lakeview Terrace',
    city: 'Chicago',
    type: 'Condo',
    propertyKind: 'Condo',
    price: 2450,
    beds: 2,
    baths: 2,
    sqft: 1325,
    badge: 'City views',
    image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'
    ],
    media: [
      { kind: 'photo', title: 'Skyline view', url: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Kitchen', url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'photo', title: 'Living room', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'floor_plan', title: 'Unit floor plan', url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80' },
      { kind: 'video', title: 'Walkthrough video', url: 'https://www.w3schools.com/html/mov_bbb.mp4' }
    ],
    neighborhood: 'West Loop',
    moveIn: 'Within 14 days',
    description: 'Chic condo with skyline views, a chef-inspired kitchen, and a calm palette that makes everyday living feel elevated. Ideal for commuters and design lovers.',
    features: ['Skyline views', 'Doorman', 'Bike room', 'Private balcony', 'In-unit laundry']
  }
];
