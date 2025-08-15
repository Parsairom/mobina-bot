import { webhookCallback } from "grammy";

import { createBot } from "./bot";
import type { Env } from "./env";
import { runEveningJob, runMorningJob } from "./scheduler";

const EVENING_CRON = "30 16 * * *";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/webhook" || request.method !== "POST") {
      return new Response("ok");
    }

    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }

    const bot = createBot(env, ctx);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === EVENING_CRON) {
      ctx.waitUntil(runEveningJob(env));
    } else {
      ctx.waitUntil(runMorningJob(env));
    }
  },
};
