const ethers = require("ethers");

const Sentry = require("@sentry/node");
const { Service: _AlchemyService } = require("./AlchemyService");
const {
  Service: _FarcasterService,
} = require("./identities/FarcasterServiceV2");
const {
  Service: _InitializeCommunityService,
} = require("./initializer/InitializeCommunityService");

const { getTokenIdFromLabel } = require("../helpers/get-token-id-from-label");
const { getProvider } = require("../helpers/alchemy-provider");
const { config, prod } = require("../helpers/registrar");
const {
  validateAndConvertAddress,
} = require("../helpers/validate-and-convert-address");
const {
  validateAndConvertDuration,
} = require("../helpers/validate-and-convert-duration");
const {
  generateSecretFromAddressAndDuration,
} = require("../helpers/generate-secret-from-address-and-duration");

const { Community } = require("../models/Community");

class RegistrarService {
  constructor() {
    const AlchemyService = new _AlchemyService({
      apiKey: prod().NODE_URL, // force use prod for ENS
      chain: prod().NODE_NETWORK, // force use prod for ENS
    });
    const alchemyProvider = getProvider({
      network: config().NODE_NETWORK,
      node: config().NODE_URL,
    });

    const controller = new ethers.Contract(
      config().BETA_CONTROLLER_ADDRESS,
      config().BETA_CONTROLLER_ABI,
      alchemyProvider
    );
    const registrar = new ethers.Contract(
      config().REGISTRAR_ADDRESS,
      config().REGISTRAR_ABI,
      alchemyProvider
    );

    this.AlchemyService = AlchemyService;
    this.alchemyProvider = alchemyProvider;
    this.controller = controller;
    this.registrar = registrar;
  }

  /**
   * Get owner of NFT tokenId
   * @returns {Promise<string>} - address of owner
   */
  async getOwner(domain, tld = "beb") {
    if (!domain) return null;
    const tokenId = this.getTokenIdFromLabel(domain);
    try {
      if (tld === "eth") {
        const data = await this.AlchemyService.getOwnersForToken({
          tokenId,
          contractAddress: "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        });
        return data?.owners?.[0];
      } else if (tld === "fc") {
        const FarcasterService = new _FarcasterService();
        const profile = await FarcasterService.getProfileByUsername(domain);
        return profile?.address;
      }
      return await this.registrar.ownerOf(tokenId);
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
      // tokenId is not registered
      return null;
    }
  }

  /**
   * Get if community is available
   * @returns {Promise<boolean>}
   */
  async available(bebdomain) {
    if (!bebdomain) return false;
    return await this.controller.available(bebdomain);
  }

  /**
   * Get community expires date
   * @returns {Promise<string>}
   */
  async expiresAt(bebdomain) {
    if (!bebdomain) return null;
    const tokenId = this.getTokenIdFromLabel(bebdomain);
    const nameDuration = await this.registrar.nameExpires(tokenId);
    return nameDuration.toString();
  }

  /**
   * Get community price
   * @returns {Promise<RentPrice>}
   */
  async rentPrice({ bebdomain, duration }) {
    if (!bebdomain || !duration) return null;
    const [base, premium] = await this.controller.rentPrice(
      bebdomain,
      validateAndConvertDuration(duration)
    );
    return {
      base: ethers.BigNumber.from(base).toString(),
      premium: ethers.BigNumber.from(premium).toString(),
    };
  }

  makeSecret({ bebdomain, address, duration }) {
    return generateSecretFromAddressAndDuration({
      address: validateAndConvertAddress(address),
      duration: validateAndConvertDuration(duration),
      bebdomain: bebdomain,
    });
  }

  /**
   * Get community commitment
   * @returns {Promise<string>}
   */
  async makeCommitment({ bebdomain, address, duration }) {
    if (!bebdomain) return false;

    const commitmentHash = await this.controller.makeCommitment(
      bebdomain,
      validateAndConvertAddress(address),
      validateAndConvertDuration(duration),
      this.makeSecret({ bebdomain, address, duration })
    );
    return commitmentHash;
  }

  /**
   * Get if community is available
   * @returns {Promise<string>}
   */
  getTokenIdFromLabel(bebdomain) {
    return getTokenIdFromLabel(bebdomain);
  }
  /**
   * Create default community from bebdomain after registering a new community id
   * @returns {Promise<Community>}
   */
  async registerCommunity(_, { bebdomain, tld = "beb" }, context) {
    if (!bebdomain) throw new Error("Invalid domain name");

    const owner = await this.getOwner(bebdomain, tld);

    if (!owner) {
      throw new Error("Community is not registered in the registrar");
    }
    await context.account?.populate?.("addresses");
    if (
      context.account?.addresses?.[0]?.address?.toLowerCase?.() !==
      owner?.toLowerCase?.()
    ) {
      throw new Error("Only owner can register a community");
    }
    const existing = await Community.findOne({ bebdomain });
    if (existing) {
      throw new Error("A community already exists for this domain");
    }

    if (process.env.BLOCK_INITIALIZE) {
      throw new Error(
        "Initializing Communities is blocked due to BLOCK_INITIALIZE!"
      );
    }

    const InitializeCommunityService = new _InitializeCommunityService();
    const community = await Community.create({
      bebdomain,
      tokenId: this.getTokenIdFromLabel(bebdomain),
      name: bebdomain,
      owner: context.account._id,
      tld,
    });
    await InitializeCommunityService.createDefaultRoleWithPermissions(
      community
    );
    return community;
  }
}

module.exports = { Service: RegistrarService };
