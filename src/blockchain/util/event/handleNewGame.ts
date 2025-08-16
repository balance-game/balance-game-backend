import { InternalServerErrorException, Logger } from "@nestjs/common";
import { User } from "src/auth/entity/user.entity";
import { NewGameEvent } from "src/blockchain/typechain-types/contracts/BalanceGame";
import { Game } from "src/game/entity/game.entity";
import { DataSource } from "typeorm/data-source";

export async function handleNewGame(
  event: NewGameEvent.Log,
  dataSource: DataSource,
  logger: Logger,
  saveBlockNumber
) {
  const [gameId, questionA, questionB, createdAt, deadline, creator] = event.args;
  const deadlineToDate = new Date(Number(deadline) * 1000);

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const user = await queryRunner.manager.findOne(User, {
      where: { address: creator },
      select: { id: true }
    });

    if (!user) {
      logger.warn("GameSaveError: unknown Address " + creator);
    } else {
      const game = queryRunner.manager.create(Game, {
        id: gameId.toString(),
        optionA: questionA,
        optionB: questionB,
        createdAt: new Date(Number(createdAt) * 1000),
        deadline: deadlineToDate,
        createdBy: user.id
      });

      await queryRunner.manager.save(game);
      const blockNumber = (await event.getBlock()).number.toString();
      await saveBlockNumber(blockNumber, queryRunner);
      logger.log("GameSaveSuccess: GameId " + gameId);
    }

    await queryRunner.commitTransaction();
  } catch(err) {
    await queryRunner.rollbackTransaction();
    console.error(err);
    throw new InternalServerErrorException("게임정보 저장중 오류가 발생했습니다.");
  } finally {
    await queryRunner.release();
  }
}
