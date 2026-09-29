export type UserRole = "student" | "committee" | "staff" | "admin";
export type MealType = "breakfast" | "lunch" | "snacks" | "dinner";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

export type Profile = {
  id: string;
  full_name: string | null;
  room_no: string | null;
  roll_no: string | null;
  role: UserRole;
};

export type MenuItem = {
  id: string;
  name: string;
  is_veg: boolean;
  position: number;
};

export type Meal = {
  id: string;
  menu_date: string;
  meal_type: MealType;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  updated_at: string;
  menu_items: MenuItem[];
};

/** Serving start used when the committee hasn't set one. Mirrors default_meal_start() in SQL. */
export const DEFAULT_TIMES: Record<MealType, [string, string]> = {
  breakfast: ["07:30", "09:30"],
  lunch: ["12:30", "14:30"],
  snacks: ["17:00", "18:00"],
  dinner: ["20:00", "22:00"],
};

/** Opt-in closes this long before a meal starts. Mirrors attendance_deadline() in SQL. */
export const ATTENDANCE_CUTOFF_HOURS = 2;

export type Tag = { slug: string; label: string; sentiment: "negative" | "positive" };

export type MyRating = { meal_id: string; stars: number; comment: string | null; tags: string[] };

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
};

export type Student = {
  roll_no: string;
  full_name: string;
  room_no: string | null;
  photo_url: string | null;
  email: string | null;
};
