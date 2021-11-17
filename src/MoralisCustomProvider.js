/* global window */
import Web3 from 'web3';
import { getMoralisRpcs } from './Web3Connector/MoralisRpcs';

const ERROR_CHAINID_MISSING = 'Invalid chainId: Chain not currently supported by Moralis';

class MoralisCustomProvider {
  get type() {
    return 'CustomProvider';
  }

  async activate(options) {
    if (!options.chainId) {
      options.chainId = 1;
    }
    const { speedyNodeApiKey, chainId } = options;

    const MWeb3 = typeof Web3 === 'function' ? Web3 : window.Web3;

    const web3Provider = new MWeb3.providers.HttpProvider(
      this.getUrl(chainId, speedyNodeApiKey),
      options
    );

    this.web3 = new MWeb3(web3Provider);
    this.isActivated = true;

    return this.web3;
  }

  async deactivate() {
    this.isActivated = false;
    this.web3 = null;
  }

  getUrl(chainId, speedyNodeKey) {
    const url = getMoralisRpcs(speedyNodeKey)[chainId];
    if (!url) {
      throw new Error(ERROR_CHAINID_MISSING);
    }
    return url;
  }
}

export default MoralisCustomProvider;
