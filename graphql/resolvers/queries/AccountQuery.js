const { SearchService, AuthService } = require("../../../services");
const { getGraphQLRateLimiter } = require("graphql-rate-limit");

const rateLimiter = getGraphQLRateLimiter({ identifyContext: (ctx) => ctx.id });
const RATE_LIMIT_MAX = 250;
const resolvers = {
  AccountQuery: {
    _id: () => "AccountQuery",
    /** Get Account by search query */
    searchAccountByUsernameOrAddressOrEns: async (
      root,
      args = {},
      context,
      info
    ) => {
      const { query } = args;
      const errorMessage = await rateLimiter(
        { root, args, context, info },
        { max: RATE_LIMIT_MAX, window: "10s" }
      );
      if (errorMessage) throw new Error(errorMessage);
      return await SearchService.searchAccountByUsernameOrAddressOrENS(query);
    },
    /** Get Accounts by identity username query */
    searchAccountByIdentity: async (root, args = {}, context, info) => {
      const { query } = args;
      const errorMessage = await rateLimiter(
        { root, args, context, info },
        { max: RATE_LIMIT_MAX, window: "10s" }
      );
      if (errorMessage) throw new Error(errorMessage);
      return await SearchService.searchAccountByIdentity(query);
    },
    getAccountSigninMessage: async (root, args = {}, context, info) => {
      const { address, chainId } = args;
      const errorMessage = await rateLimiter(
        { root, args, context, info },
        { max: RATE_LIMIT_MAX, window: "10s" }
      );
      if (errorMessage) throw new Error(errorMessage);
      return await AuthService.getMessageToSign({ address, chainId });
    },
  },
};

module.exports = { resolvers };
