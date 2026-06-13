export interface TransportOption {
  type: 'Flight' | 'Train' | 'Bus';
  company: string; // e.g., "Indigo" or "IRCTC"
  departureLocation: string; // e.g., "BOM" or "CST"
  arrivalLocation: string;
  duration: string;
  timings: string;
  bookingLink: string;
}

export interface LocationDetail {
  name: string;
  mapsLink: string;
}

export interface Activity {
  time: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  plan: string;
  attractions: LocationDetail[];
  restaurants: LocationDetail[];
  transport: {
    type: string;
    details: string; // e.g., "Board metro from XYZ Station to ABC Station"
    time: string;
    cost: string;
  };
  reminder: string;
}

export interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
  intercityTransport?: TransportOption;
}

export interface HotelOption {
  name: string;
  mapsLink: string;
  category: 'Luxury' | 'Medium' | 'Budget';
  pricePerNight: string;
  amenities: string[];
  distanceFromAttractions: string;
  phoneNumber?: string;
  website?: string;
  description?: string;
}

export interface TravelPlan {
  destination: string;
  origin: string;
  transportOptions: TransportOption[];
  itinerary: DayPlan[];
  hotels: HotelOption[];
  totalCostSummary: {
    localCurrency: string;
    inr: string;
  };
  dailyCostBreakdown: {
    stay: string;
    food: string;
    travel: string;
    activities: string;
  };
  travelAgencies?: {
    name: string;
    services: string;
    contact: string;
  }[];
  packingGuide?: {
    category: string;
    items: string[];
  }[];
}

export interface UserInputs {
  fromLocation: string;
  toLocation: string;
  startDate: string;
  days: number;
  budget: string;
  locations: string;
  budgetCategory: 'Luxury' | 'Medium' | 'Low';
  travelType: 'Solo' | 'Couple' | 'Family' | 'Group';
  travelAgentAssistance: boolean;
}

export interface RefinementRequest {
  id: string;
  user_id: string;
  user_email: string;
  type: 'adapt_day' | 'bespoke_refine';
  status: 'pending' | 'approved' | 'rejected';
  instruction: string;
  current_plan: TravelPlan;
  result_plan?: TravelPlan;
  created_at: string;
  day?: number; // For adapt_day
}
