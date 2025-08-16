import type { Update } from "grammy/types";

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

    function logDebug(info: string): void {
      ctx.waitUntil(
        env.DB.prepare("INSERT INTO debug_log (info, created_at) VALUES (?, ?)")
          .bind(info.slice(0, 1900), new Date().toISOString())
          .run()
          .catch((e) => console.error("debug_log insert failed", e))
      );
    }

    // Telegram retries relentlessly (and queues up behind) any update we
    // answer with a non-2xx status, so this handler must NEVER throw or
    // return an error status — always resolve to "ok" and log the failure
    // instead, or a single bad update can jam the whole webhook.
    //
    // Deliberately not using grammy's `webhookCallback(bot, "cloudflare-mod")`
    // here: it returns its Response before this function's own promise chain
    // has necessarily finished awaiting every downstream `ctx.reply`/
    // `sendMessage` call, so once *this* handler resolves, Workers can tear
    // the isolate down mid-flight on that still-running background work —
    // which surfaced as silent, unlogged "internal error" failures (nothing
    // reached `bot.catch` or this try/catch) for replies that took a bit
    // longer, like the one right after a photo caption. Calling
    // `bot.handleUpdate` directly and awaiting it ourselves guarantees every
    // handler in the chain has actually completed before we return.
    try {
      const bodyText = await request.clone().text();
      const codePoints = Array.from(bodyText)
        .map((ch) => ch.codePointAt(0)!.toString(16))
        .join(",");
      logDebug(`RAW_CODEPOINTS: ${codePoints}`);
      logDebug(`RAW_BODY: ${bodyText}`);

      const update = (await request.json()) as Update;
      const bot = createBot(env, ctx);
      await bot.init();
      await bot.handleUpdate(update);
      return new Response("ok");
    } catch (err) {
      const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      logDebug(`FETCH_ERROR: ${message}`);
      return new Response("ok");
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === EVENING_CRON) {
      ctx.waitUntil(runEveningJob(env));
    } else {
      ctx.waitUntil(runMorningJob(env));
    }
  },
};
