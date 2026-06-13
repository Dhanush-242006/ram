import { UserInputs, TravelPlan } from "../types";

export async function generateTravelPlan(inputs: UserInputs): Promise<TravelPlan> {
  const response = await fetch("/api/generate-travel-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate travel plan from server");
  }

  return response.json();
}

export async function modifyTravelPlan(currentPlan: TravelPlan, instruction: string): Promise<TravelPlan> {
  const response = await fetch("/api/modify-travel-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPlan, instruction }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to modify travel plan from server");
  }

  return response.json();
}
