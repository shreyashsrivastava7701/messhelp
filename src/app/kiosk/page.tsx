import { APP_NAME } from "@/lib/brand";
import Kiosk from "./kiosk";

export const metadata = { title: `Snack counter · ${APP_NAME}` };

/** No-login snack counter screen. Access is by the kiosk PIN, checked in the database. */
export default function KioskPage() {
  return <Kiosk />;
}
