import { redirect } from "next/navigation";

// Match predictions are now account-level — made once from /predict and mirrored
// to every league the user is in. This per-league route just forwards there so
// old links, bookmarks and push-notification deep-links keep working.
export default function LeaguePredictRedirect() {
  redirect("/predict");
}
