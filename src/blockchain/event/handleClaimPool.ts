import { InternalServerErrorException, Logger } from "@nestjs/common";
import { User } from "src/auth/entity/user.entity";
import { ClaimPoolEvent } from "src/blockchain/typechain-types/contracts/BalanceGame";
import { DataSource } from "typeorm/data-source";

export async function handleClaimPool(
  event: ClaimPoolEvent.Log,
  dataSource: DataSource,
  logger: Logger,
  saveBlockNumber
): Promise<void> {
  let [gameId, claimAddress, amount, winnerRank] = event.args;
  claimAddress = claimAddress.toLocaleLowerCase();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const user = await queryRunner.manager.findOne(User, {
      where: { address: claimAddress },
      select: { id: true }
    });

    if (!user) {
      logger.warn("ClaimPoolSaveError: unknown Address " + claimAddress);
    } 
    else {
      await this.gameWinnerRepo.update(
        { 
            gameId: gameId.toString(),
            rank: Number(winnerRank)
        },
        {
            claimPool: amount,
            isClaimed: true
        }
      );
    }

    await queryRunner.commitTransaction();
  } catch(err) {
    await queryRunner.rollbackTransaction();
    console.error(err);
    throw new InternalServerErrorException("당첨자 보상 수령 정보 저장중 오류가 발생했습니다.");
  } finally {
    await queryRunner.release();
  }
}
