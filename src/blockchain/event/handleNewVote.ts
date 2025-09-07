import { InternalServerErrorException, Logger } from "@nestjs/common";
import { User } from "src/auth/entity/user.entity";
import { NewVoteEvent } from "src/blockchain/typechain-types/contracts/BalanceGame";
import { Vote } from "src/game/entity/vote.entity";
import { VoteOption } from "src/game/enum/vote-option.enum";
import { DataSource } from "typeorm/data-source";

export async function handleNewVote(
  event: NewVoteEvent.Log,
  dataSource: DataSource,
  logger: Logger,
  saveBlockNumber: any
): Promise<void> {
    const [gameId, address, voteOpttion, votedAt] = event.args;
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const user = await queryRunner.manager.findOne(User, { 
            where: { address: address }
        });

        if (!user) {
            logger.warn("VoteSaveError: unknown Address " + address);
        }
        else {
            const vote = queryRunner.manager.create(Vote, {
                gameId: gameId.toString(),
                userId: user.id,
                option: Number(voteOpttion) == 0 ? VoteOption.A : VoteOption.B,
                votedAt: new Date(Number(votedAt) * 1000)
            });

            const voteResult = await queryRunner.manager.save(vote);
            const blockNumber = (await event.getBlock()).number.toString();
            await saveBlockNumber(blockNumber, queryRunner);
            logger.log("VoteSaveSuccess: VoteId " + voteResult.id);
        }
        
        await queryRunner.commitTransaction();
    } catch(err) {
        await queryRunner.rollbackTransaction();
        console.error(err);
        throw new InternalServerErrorException("투표 정보 저장중 오류가 발생했습니다.");
    } finally {
        await queryRunner.release();
    }
}
