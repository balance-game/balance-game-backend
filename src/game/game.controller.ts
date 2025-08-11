import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { GetAllGamesQueryDto } from './dto/get-all-games-query.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { OptionalAuthGuard } from 'src/common/guard/optional-auth.guard';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get("/")
  getAllGames(@Query() query: GetAllGamesQueryDto) {
    return this.gameService.getAllGames(query.page, query.limit, query.gameSortType, query.gameStatus);
  }

  @Get("/top3")
  getTop3Games() {
    return this.gameService.getTop3Games();
  }
  
  @Get("/:id")
  @UseGuards(OptionalAuthGuard)
  getGame(@GetUser() user, @Param("id") id: string) {
    return this.gameService.getGame(user, id);
  }
}
