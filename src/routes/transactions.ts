import { randomUUID } from "node:crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { knex } from "../database";
import { checkSessionIdExists } from "../middlewares/check-session-id-exist";

export const transactionsRoutes = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [checkSessionIdExists] }, async (request) => {
    const { sessionId } = request.cookies;

    const transactions = await knex("transactions")
      .where("session_id", sessionId)
      .select();

    return { transactions };
  });

  app.get(
    "/:id",
    { preHandler: [checkSessionIdExists] },
    async (request: FastifyRequest) => {
      const getTransactionParams = z.object({
        id: z.string().uuid(),
      });
      const { sessionId } = request.cookies;

      const { id } = getTransactionParams.parse(request.params);

      const transaction = await knex("transactions")
        .where({ session_id: sessionId, id })
        .first();

      return { transaction };
    }
  );

  app.get(
    "/summary",
    { preHandler: [checkSessionIdExists] },
    async (request) => {
      const { sessionId } = request.cookies;

      const summary = await knex("transactions")
        .where("session_id", sessionId)
        .sum("amount", { as: "amount" })
        .first();

      return { summary };
    }
  );

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const createTransactionsBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(["credit", "debit"]),
    });

    const { amount, title, type } = createTransactionsBodySchema.parse(
      request.body
    );

    let sessionId = request.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();

      reply.cookie("sessionId", sessionId, {
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });
    }

    await knex("transactions").insert({
      id: randomUUID(),
      title,
      amount: type === "credit" ? amount : amount * -1,
      session_id: sessionId,
    });

    return reply.status(201).send();
  });
};
