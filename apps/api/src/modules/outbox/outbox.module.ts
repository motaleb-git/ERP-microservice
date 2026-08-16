import { Module } from "@nestjs/common";
import { OutboxPublisher } from "./outbox.publisher";
import { SampleConsumer } from "./sample.consumer";

@Module({
  providers: [OutboxPublisher, SampleConsumer],
})
export class OutboxModule {}
