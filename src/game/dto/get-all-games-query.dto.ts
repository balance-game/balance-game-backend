import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { GameSortType } from '../enum/gameSortType.enum';
import { GameStatusType } from '../enum/gameStatusType.enum';

export class GetAllGamesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;

  @IsOptional()
  @IsEnum(GameSortType)
  gameSortType: GameSortType;

  @IsOptional()
  @IsEnum(GameStatusType)
  gameStatus: GameStatusType;

}
