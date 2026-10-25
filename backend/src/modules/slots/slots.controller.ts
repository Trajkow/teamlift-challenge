import {Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards} from '@nestjs/common';
import {HostKeyGuard} from '../../common/host-key/host-key.guard.js';
import {RateLimit} from '../../common/rate-limit/rate-limit.js';
import {ZodValidationPipe} from '../../common/validation/zod-validation.pipe.js';
import {type CreateBookingDto, createBookingSchema} from './dto/create-booking.dto.js';
import {type CreateSlotsDto, createSlotsSchema} from './dto/create-slots.dto.js';
import {
  type ListHostSlotsDto,
  type ListSlotsDto,
  listHostSlotsSchema,
  listSlotsSchema,
} from './dto/list-slots.dto.js';
import {SlotsService} from './slots.service.js';

@Controller()
export class PublicSlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get('config')
  config() {
    return this.slots.config();
  }

  @Get('slots')
  list(@Query(new ZodValidationPipe(listSlotsSchema)) query: ListSlotsDto) {
    return this.slots.listPublic(query);
  }

  @Post('slots/:id/bookings')
  @RateLimit.booking()
  book(@Param('id') id: string, @Body(new ZodValidationPipe(createBookingSchema)) dto: CreateBookingDto) {
    return this.slots.book(id, dto);
  }
}

@Controller('host')
@UseGuards(HostKeyGuard)
export class HostSlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get('slots')
  list(@Query(new ZodValidationPipe(listHostSlotsSchema)) query: ListHostSlotsDto) {
    return this.slots.listHost(query);
  }

  @Post('slots')
  @RateLimit.hostWrite()
  create(@Body(new ZodValidationPipe(createSlotsSchema)) dto: CreateSlotsDto) {
    return this.slots.createSlots(dto);
  }

  @Delete('slots/:id')
  @HttpCode(204)
  @RateLimit.hostWrite()
  async deleteSlot(@Param('id') id: string) {
    await this.slots.deleteSlot(id);
  }

  @Delete('bookings/:id')
  @HttpCode(204)
  @RateLimit.hostWrite()
  async cancelBooking(@Param('id') id: string) {
    await this.slots.cancelBooking(id);
  }
}
