import Web3Utils from 'web3-utils';

class UnitConverter {
  static ETH(value) {
    return Web3Utils.toWei(`${value}`, 'ether');
  }

  static Token(value, decimals) {
    return Web3Utils.toBN(`0x${(+value * 10 ** decimals).toString(16)}`);
  }

  static FromWei(value, decimals) {
    return +value / Math.pow(10, decimals ?? 18);
  }
}

module.exports = UnitConverter;
