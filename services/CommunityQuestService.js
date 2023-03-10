const { Quest } = require("../models/quests/Quest");

const { Service: _QuestService } = require("./QuestService");
class CommunityQuestService {
  /**
   * Check if a communityQuest can claim the reward
   * @TODO add more than one requirement
   * @returns Promise<Boolean>
   * */
  async canClaimReward(communityQuest) {
    if (!communityQuest) return false;
    if (communityQuest.isArchived) return false;

    const quest = await Quest.findById(communityQuest.quest);
    const requirement = quest?.requirements?.[0];
    switch (requirement.type) {
      case "COMMUNITY_PARTICIPATION": {
        const requiredAmount =
          requirement.data?.find(
            (data) => data.key === "requiredParticipationCount"
          )?.value || 1;
        return communityQuest.accounts?.length >= requiredAmount;
      }
      default: {
        return communityQuest.accounts?.length >= 1;
      }
    }
  }

  /**
   * type QuestStatus: "IN_PROGRESS" | "COMPLETED" | "CAN_COMPLETE" | "CAN_CLAIM_REWARD" | "CHECKED_IN"
   * CAN_COMPLETE: the account can complete the quest
   * CAN_CLAIM_REWARD: the account can claim the reward
   * Get the quest status of a community
   * @returns Promise<QuestStatus>
   * */
  async getQuestStatus(communityQuest, _, context) {
    if (!communityQuest || !context.account) return "IN_PROGRESS";
    if (communityQuest.isArchived) return "COMPLETED";
    const canClaimReward = await this.canClaimReward(communityQuest);
    if (canClaimReward) return "CAN_CLAIM_REWARD";

    // if account already completed the quest and cannot claim reward
    if (communityQuest.accounts?.includes(context.account._id)) {
      return "CHECKED_IN";
    }

    const quest = await Quest.findById(communityQuest.quest);
    const QuestService = new _QuestService();
    const canCompleteQuest = await QuestService.canCompleteQuest(
      quest,
      { communityId: communityQuest.community },
      context
    );
    if (canCompleteQuest) return "CAN_COMPLETE";
    return "IN_PROGRESS";
  }
}

module.exports = { Service: CommunityQuestService };
