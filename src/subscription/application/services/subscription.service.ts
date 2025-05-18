import { Injectable, Inject, ConflictException, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "@/subscription/infrastructure/repositories/subscription.repository.interface";
import { Subscription } from "@/subscription/domain/entities/subscription.entity";
import { CreateSubscriptionDto } from "@/weather/application/dto/create-subscription.dto";
import { ConfirmSubscriptionDto } from "@/weather/application/dto/confirm-subscription.dto";
import { UnsubscribeDto } from "@/weather/application/dto/unsubscribe.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { Cron, CronExpression } from "@nestjs/schedule";
import { UpdateFrequency } from "@/shared/enums/frequency.enum";
import { config } from "@/shared/configs/config";
import { WeatherService } from "@/weather/application/services/weather.service";

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repo: ISubscriptionRepository,
    private readonly mailer: MailerService,
    private readonly weatherService: WeatherService,
  ) {}

  @Cron("0 8 * * *", { timeZone: "Europe/Warsaw" })
  async handleDailyNotifications() {
    await this.sendBatch(UpdateFrequency.DAILY);
  }

  @Cron("0 * * * *", { timeZone: "Europe/Warsaw" })
  async handleWeeklyNotifications() {
    await this.sendBatch(UpdateFrequency.HOURLY);
  }

  async subscribe(dto: CreateSubscriptionDto): Promise<void> {
      const isSubbed = await this.repo.isEmailSubscribed(dto.email, dto.city);
      if (isSubbed) {
        throw new ConflictException("Email already subscribed");
      }
      const token = uuidv4();
      const subscription = new Subscription(
        uuidv4(),
        dto.email,
        dto.city,
        dto.frequency,
        false,
        token,
        new Date(),
      );
      await this.repo.create(subscription);

      const confirmUrl = `${config.app.baseUrl}/api/confirm/${token}`;
      await this.mailer.sendMail({
        to: dto.email,
        subject: "Please confirm your weather subscription",
        template: "confirm-subscription",
        context: {
          city: dto.city,
          confirmUrl,
        },
      });
  }

  async confirm(dto: ConfirmSubscriptionDto): Promise<void> {
    const sub = await this.repo.findByToken(dto.token);
    if (!sub) throw new NotFoundException("Token not found");
    if (sub.confirmed) return;
    await this.repo.confirmSubscription(dto.token);
  }

  async unsubscribe(dto: UnsubscribeDto): Promise<void> {
    const sub = await this.repo.findByToken(dto.token);
    if (!sub) throw new NotFoundException("Token not found");
    await this.repo.unsubscribe(dto.token);
  }

  private async sendBatch(frequency: UpdateFrequency) {
    const subs = await this.repo.findConfirmedByFrequency(frequency);

    for (const sub of subs) {
      const weather = await this.weatherService.getCurrent({ city: sub.city });
      console.log(`Email sent to ${sub.email} for ${sub.city}`);

      const context: any = {
        city: sub.city,
        weather: {
          temperature: weather.temperature,
          humidity: weather.humidity,
          description: weather.description,
        },
      };

      await this.mailer.sendMail({
        to: sub.email,
        subject:
          frequency === UpdateFrequency.DAILY
            ? "Your daily weather update"
            : "Your hourly weather update",
        template:
          frequency === UpdateFrequency.DAILY ? "daily-subscription" : "hourly-subscription",
        context,
      });
    }
  }
}
