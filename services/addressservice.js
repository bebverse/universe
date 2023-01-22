const { Address } = require("../models/address");

export class AddressService {
  static async createAddress(address) {
    const newAddress = await Address.create(address);
    return newAddress;
  }
}
