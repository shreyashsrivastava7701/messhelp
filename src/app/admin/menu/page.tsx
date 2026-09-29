import DateNav from "@/components/date-nav";
import SubmitForm from "@/components/submit-form";
import { fillFromWeeklyMenu } from "../actions";
import { requireCommittee } from "@/lib/auth";
import { isoDateIST, isValidIsoDate } from "@/lib/dates";
import { getMealsForDate } from "@/lib/menu";
import { MEAL_TYPES } from "@/lib/types";
import MealEditor from "./meal-editor";

export const metadata = { title: "Edit menu · Chachu ka Mittar" };

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireCommittee();
  const { date: dateParam } = await searchParams;
  const date = isValidIsoDate(dateParam) ? dateParam : isoDateIST();
  const meals = await getMealsForDate(date);
  const byType = new Map(meals.map((m) => [m.meal_type, m]));

  return (
    <div className="space-y-4">
      <DateNav date={date} basePath="/admin/menu" />
      <SubmitForm
        action={fillFromWeeklyMenu}
        submitLabel="Fill 4 weeks from weekly menu"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-600"
      >
        <input type="hidden" name="from" value={date} />
        <span>Empty days get the regular weekly menu, starting from this day. Days you edited stay as they are.</span>
      </SubmitForm>
      <div className="grid gap-4 sm:grid-cols-2">
        {MEAL_TYPES.map((type) => (
          // Keyed on date so switching days resets each editor's local state.
          <MealEditor key={`${date}-${type}`} date={date} mealType={type} meal={byType.get(type)} />
        ))}
      </div>
    </div>
  );
}
