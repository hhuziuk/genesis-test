import { Module } from "@nestjs/common";
import { SubscriptionRepository } from "@/subscription/infrastructure/repositories/subscription.repository";
import { SUBSCRIPTION_REPOSITORY } from "@/subscription/infrastructure/repositories/subscription.repository.interface";
import { SubscriptionController } from "@/subscription/presentation/controllers/subscription.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubscriptionService } from "@/subscription/application/services/subscription.service";
import { SubscriptionOrmEntity } from "@/subscription/infrastructure/database/subscription.orm-entity";
import { WeatherModule } from "@/weather/weather.module";

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionOrmEntity]), WeatherModule],
  providers: [
    SubscriptionService,
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: SubscriptionRepository,
    },
  ],
  exports: [
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: SubscriptionRepository,
    },
  ],
  controllers: [SubscriptionController],
})
export class SubscriptionModule {}
