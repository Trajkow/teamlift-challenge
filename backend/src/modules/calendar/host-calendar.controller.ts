import {Controller, Delete, Get, HttpCode, Query, Res, UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {HostKeyGuard, HostKeyQueryGuard} from '../../common/host-key/host-key.guard.js';
import {RateLimit} from '../../common/rate-limit/rate-limit.js';
import {CalendarConnectionService} from './calendar-connection.service.js';

// Fixed same-origin paths: the redirect target never comes from the request.
const HOST_CONNECTED = '/host?calendar=connected';
const HOST_ERROR = '/host?calendar=error';

const callbackQuery = z.object({code: z.string().max(2048).optional(), state: z.string().max(256).optional()});

@Controller('host/calendar')
export class HostCalendarController {
  constructor(private readonly connection: CalendarConnectionService) {}

  @Get()
  @UseGuards(HostKeyGuard)
  status() {
    return this.connection.status();
  }

  /** A full-page navigation can't send headers, so the host key (when set) comes as `?hostKey=`. */
  @Get('connect')
  @UseGuards(HostKeyQueryGuard)
  @RateLimit.hostWrite()
  connect(@Res() res: Response) {
    try {
      res.redirect(302, this.connection.startConnect());
    } catch {
      res.redirect(302, HOST_ERROR);
    }
  }

  @Get('callback')
  @RateLimit.hostWrite()
  async callback(@Query() raw: unknown, @Res() res: Response) {
    // Odd input is an error redirect, not a JSON 400. Google's own `error` text is never read or echoed.
    const query = callbackQuery.safeParse(raw);
    const ok = query.success && (await this.connection.completeConnect(query.data.code, query.data.state));
    res.redirect(302, ok ? HOST_CONNECTED : HOST_ERROR);
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(HostKeyGuard)
  @RateLimit.hostWrite()
  async disconnect() {
    await this.connection.disconnect();
  }
}
