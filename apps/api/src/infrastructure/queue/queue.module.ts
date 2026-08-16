import { Global, Module } from "@nestjs/common";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { REDIS_QUEUE } from "../redis/redis.constants";

export const EMAIL_QUEUE = Symbol("EMAIL_QUEUE");

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_QUEUE,
      inject: [REDIS_QUEUE],
      useFactory: (connection: Redis): Queue =>
        new Queue("email", {
          connection,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        }),
    },
  ],
  exports: [EMAIL_QUEUE],
})
export class QueueModule {}
