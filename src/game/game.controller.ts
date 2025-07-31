import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { GameService } from './game.service';
import { GetAllGamesQueryDto } from './dto/get-all-games-query.dto';

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
  getGame(@Param("id", ParseIntPipe) id: number) {
    return this.gameService.getGame(id);
  }
}
