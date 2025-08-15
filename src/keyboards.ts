import { InlineKeyboard } from "grammy";

export function moodKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("😄 عالی", "mood:great")
    .text("🙂 خوب", "mood:good")
    .text("😐 معمولی", "mood:meh")
    .row()
    .text("😔 خسته", "mood:tired")
    .text("😢 بد", "mood:bad");
}

export const MOOD_LABELS: Record<string, string> = {
  great: "😄 عالی",
  good: "🙂 خوب",
  meh: "😐 معمولی",
  tired: "😔 خسته",
  bad: "😢 بد",
};
