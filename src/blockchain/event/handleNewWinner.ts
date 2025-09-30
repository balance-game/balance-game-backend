import { InternalServerErrorException, Logger } from "@nestjs/common";
import { User } from "src/auth/entity/user.entity";
import { NewWinnerEvent } from "src/blockchain/typechain-types/contracts/BalanceGame";
import { DataSource } from "typeorm/data-source";
import { GameWinner } from "../../game/entity/game-winner.entity";

export async function handleNewWinner(
  event: NewWinnerEvent.Log,
  dataSource: DataSource,
  logger: Logger,
  saveBlockNumber
): Promise<void> {
  let [gameId, winners] = event.args;
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    let winner: GameWinner[] = [];

    for(let i = 0; i < winners.length; i++) {
      winners[i] = winners[i].toLocaleLowerCase();

      const user = await queryRunner.manager.findOne(User, { 
        where: { address: winners[i] }
      });
      if (!user) {
        logger.warn("GameWinnerSaveError: unknown Address " + winners[i]);
      }
      else {
        winner.push(queryRunner.manager.create(GameWinner, {
          gameId: gameId.toString(),
          userId: user.id,
          rank: i + 1
        }));
      }
    }

    await queryRunner.manager.save(winner);
    const blockNumber = (await event.getBlock()).number.toString();
    await saveBlockNumber(blockNumber, queryRunner);
    logger.log("GameWinnerSaveSuccess: GameId " + gameId);
      
      await queryRunner.commitTransaction();
  } catch(err) {
      await queryRunner.rollbackTransaction();
      console.error(err);
      throw new InternalServerErrorException("게임 당첨자 저장중 오류가 발생했습니다.");
  } finally {
      await queryRunner.release();
  }
}