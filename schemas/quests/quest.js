/* eslint-disable no-inline-comments */
const mongoose = require("mongoose");

const { schema: contentSchema } = require("../content");
const { schema: keyValueFieldsSchema } = require("../keyValueFields");

/**
 * A quest requirement schema
 */
const questRequirementSchema = mongoose.Schema({
  title: { type: String },
  type: { type: String, enum: ["COMMUNITY_PARTICIPATION"] }, // e.g API, COMMUNITY_PARTICIPATION, TWITTER_FOLLOW, etc
  // e.g. { key: "twitterHandle", value: "bebverse" } for TWITTER_FOLLOW
  // e.g. { key: "apiEndpoint", value: "https://api.bebverse.com/quest/1" } for API
  data: [keyValueFieldsSchema],
  description: contentSchema,
});

/**
 * A quest rewards schema
 */
const questRewardsSchema = mongoose.Schema({
  title: { type: String },
  type: { type: String, enum: ["ASSET_3D"] }, // e.g Assets, NFTs...
  quantity: { type: Number, default: 1 }, // if -1 then it is unlimited, create a 'copiable' reward e.g a prefab
  rewardId: { type: mongoose.Schema.Types.ObjectId, index: true },
});

/**
 *
 */
const schema = mongoose.Schema(
  {
    description: contentSchema,
    title: { type: String },
    schedule: { type: String, enum: ["ONCE", "DAILY", "WEEKLY", "MONTHLY"] },
    imageUrl: {
      type: String,
    },
    /** Array of requirement */
    requirements: [questRequirementSchema],
    /** Array of rewards */
    rewards: [questRewardsSchema],
  },
  { timestamps: true }
);

module.exports = { schema };
